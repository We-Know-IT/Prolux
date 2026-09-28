-- CRM: drafts and quotes, delivery straight from the car, and the logged-in
-- salesperson's own identity. Run once in the Supabase SQL Editor, after
-- 0010–0013. Safe to run again.

-- ── 1. Who is logged in ──────────────────────────────────────────────────────
-- Salespeople read the team list (names only matter; admins still manage it).
drop policy if exists staff_read on staff_members;
create policy staff_read on staff_members for select to authenticated using (is_staff());

-- A staff member's first name: from Personal, else the account name, else the
-- e-mail address. Never another person's name.
create or replace function public.my_staff_name() returns text
language sql stable security definer set search_path = public as $$
  select split_part(coalesce(
    nullif(trim((select s.full_name from public.staff_members s where lower(s.email) = lower(auth.jwt() ->> 'email') limit 1)), ''),
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    (select upper(left(p, 1)) || substr(p, 2)
       from (select (regexp_split_to_array(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), '[._-]'))[1] as p) x)
  ), ' ', 1)
$$;

-- ── 2. Order statuses "draft" (utkast) and "quote" (offert) ──────────────────
do $$
declare
  v_type text;
  v_con  record;
begin
  select t.typname into v_type
    from pg_attribute a join pg_type t on t.oid = a.atttypid
   where a.attrelid = 'public.orders'::regclass and a.attname = 'status' and t.typtype = 'e';
  if v_type is not null then
    execute format('alter type %I add value if not exists %L', v_type, 'draft');
    execute format('alter type %I add value if not exists %L', v_type, 'quote');
  end if;

  -- A check constraint listing the allowed statuses is widened.
  for v_con in
    select conname from pg_constraint
     where conrelid = 'public.orders'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table orders drop constraint %I', v_con.conname);
  end loop;
  alter table orders add constraint orders_status_check check (status::text in
    ('draft', 'quote', 'pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'));
end $$;

-- Customers do not see drafts and quotes among their orders.
drop policy if exists customer_own_select on orders;
create policy customer_own_select on orders for select to authenticated
  using ((customer_id::text in (select public.my_customer_ids()) or customer_id::text = auth.uid()::text)
         and status::text not in ('draft', 'quote'));

-- ── 3. Delivery per order line: from the car or shipped ─────────────────────
alter table order_items add column if not exists delivery text not null default 'ship';
alter table order_items drop constraint if exists order_items_delivery_check;
alter table order_items add constraint order_items_delivery_check check (delivery in ('ship', 'car'));

-- ── 4. Stock follows live, shipped lines only ────────────────────────────────
-- Drafts, quotes and cancelled orders do not hold stock, and goods handed
-- over from the car never left the warehouse.
create or replace function order_is_live(p_status text) returns boolean
language sql immutable as $$ select coalesce(p_status, '') not in ('draft', 'quote', 'cancelled') $$;

create or replace function stock_on_order_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if tg_op = 'INSERT' then
    select status::text into v_status from orders where id = new.order_id;
    if order_is_live(v_status) and coalesce(new.delivery, 'ship') = 'ship' then
      update products set stock_qty = coalesce(stock_qty, 0) - new.qty where id = new.product_id;
    end if;
    return new;
  else
    select status::text into v_status from orders where id = old.order_id;
    if found and order_is_live(v_status) and coalesce(old.delivery, 'ship') = 'ship' then
      update products set stock_qty = coalesce(stock_qty, 0) + old.qty where id = old.product_id;
    end if;
    return old;
  end if;
end; $$;

create or replace function stock_on_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_sign int;
begin
  if order_is_live(old.status::text) = order_is_live(new.status::text) then return new; end if;
  v_sign := case when order_is_live(new.status::text) then -1 else 1 end;
  update products p
     set stock_qty = coalesce(p.stock_qty, 0) + v_sign * s.qty
    from (select product_id, sum(qty) as qty from order_items
           where order_id = new.id and coalesce(delivery, 'ship') = 'ship' group by product_id) s
   where p.id = s.product_id;
  return new;
end; $$;

drop trigger if exists stock_on_order_item on order_items;
create trigger stock_on_order_item after insert or delete on order_items
  for each row execute function stock_on_order_item();
drop trigger if exists stock_on_order_status on orders;
create trigger stock_on_order_status after update of status on orders
  for each row execute function stock_on_order_status();

-- A draft or quote is not the customer's latest order.
create or replace function touch_customer_last_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null and order_is_live(new.status::text) then
    update customers set last_order_at = greatest(coalesce(last_order_at, new.created_at), new.created_at)
     where id::text = new.customer_id::text;
  end if;
  return new;
end; $$;

drop trigger if exists touch_customer_last_order on orders;
create trigger touch_customer_last_order after insert or update of status on orders
  for each row execute function touch_customer_last_order();
