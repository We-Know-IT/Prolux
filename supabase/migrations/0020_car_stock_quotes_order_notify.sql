-- 1. Stock in the car, per salesperson.
-- 2. Storage for quote PDFs.
-- 3. E-mail to the salesperson when a customer places an order in the webshop.
-- Run once in the Supabase SQL Editor, after 0019. Safe to run again.

-- ── 1. Car stock ────────────────────────────────────────────────────────────
-- What each salesperson carries. Loading the car moves goods out of the
-- warehouse; lines sold "från bilen" are taken from the seller's car.
do $$
declare v_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into v_type
    from pg_attribute a where a.attrelid = 'public.products'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists car_stock (
      salesperson text not null,
      product_id  %s not null references products(id) on delete cascade,
      qty         int  not null default 0,
      updated_at  timestamptz not null default now(),
      primary key (salesperson, product_id)
    )$f$, v_type);
end $$;

alter table car_stock enable row level security;
drop policy if exists staff_all on car_stock;
create policy staff_all on car_stock for all to authenticated using (is_staff()) with check (is_staff());

-- Load (p_qty > 0) or unload (p_qty < 0) the logged-in seller's car.
-- p_from_warehouse: the goods come from (or go back to) the warehouse stock.
create or replace function car_load(p_product text, p_qty int, p_from_warehouse boolean default true)
returns int language plpgsql security definer set search_path = public as $$
declare v_me text := my_staff_name(); v_new int;
begin
  if not is_staff() then raise exception 'Endast säljare och admin'; end if;
  if p_qty = 0 then return 0; end if;
  insert into car_stock (salesperson, product_id, qty)
       select v_me, p.id, greatest(0, p_qty) from products p where p.id::text = p_product
  on conflict (salesperson, product_id)
    do update set qty = greatest(0, car_stock.qty + p_qty), updated_at = now()
  returning qty into v_new;
  if v_new is null then raise exception 'Produkten finns inte'; end if;
  if p_from_warehouse then
    update products set stock_qty = coalesce(stock_qty, 0) - p_qty where id::text = p_product;
  end if;
  return v_new;
end; $$;

-- Set the counted quantity (stocktaking), without touching the warehouse.
create or replace function car_set(p_product text, p_qty int)
returns int language plpgsql security definer set search_path = public as $$
declare v_me text := my_staff_name();
begin
  if not is_staff() then raise exception 'Endast säljare och admin'; end if;
  insert into car_stock (salesperson, product_id, qty)
       select v_me, p.id, greatest(0, p_qty) from products p where p.id::text = p_product
  on conflict (salesperson, product_id) do update set qty = greatest(0, p_qty), updated_at = now();
  return greatest(0, p_qty);
end; $$;

grant execute on function car_load(text, int, boolean) to authenticated;
grant execute on function car_set(text, int) to authenticated;

-- Lines handed over from the car leave the seller's car (the order's creator,
-- else its salesperson) while the order is live; they come back if it is cancelled.
create or replace function car_on_order_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare o record; r record; v_sign int;
begin
  if tg_op = 'INSERT' then r := new; v_sign := -1; else r := old; v_sign := 1; end if;
  if coalesce(r.delivery, 'ship') <> 'car' then return r; end if;
  select status::text as status, coalesce(created_by, assigned_to) as seller into o from orders where id = r.order_id;
  if not found or o.seller is null or not order_is_live(o.status) then return r; end if;
  insert into car_stock (salesperson, product_id, qty) values (o.seller, r.product_id, greatest(0, v_sign * r.qty))
  on conflict (salesperson, product_id) do update set qty = greatest(0, car_stock.qty + v_sign * r.qty), updated_at = now();
  return r;
end; $$;

create or replace function car_on_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_sign int; v_seller text := coalesce(new.created_by, new.assigned_to); r record;
begin
  if v_seller is null or order_is_live(old.status::text) = order_is_live(new.status::text) then return new; end if;
  v_sign := case when order_is_live(new.status::text) then -1 else 1 end;
  for r in select product_id, sum(qty)::int as q from order_items
            where order_id = new.id and delivery = 'car' and product_id is not null group by product_id loop
    insert into car_stock (salesperson, product_id, qty) values (v_seller, r.product_id, greatest(0, v_sign * r.q))
    on conflict (salesperson, product_id) do update set qty = greatest(0, car_stock.qty + v_sign * r.q), updated_at = now();
  end loop;
  return new;
end; $$;

drop trigger if exists car_on_order_item on order_items;
create trigger car_on_order_item after insert or delete on order_items
  for each row execute function car_on_order_item();
drop trigger if exists car_on_order_status on orders;
create trigger car_on_order_status after update of status on orders
  for each row execute function car_on_order_status();

-- ── 2. Quote PDFs ───────────────────────────────────────────────────────────
-- Public files with random names, linked from the quote e-mail.
insert into storage.buckets (id, name, public) values ('quotes', 'quotes', true)
on conflict (id) do nothing;
drop policy if exists quotes_staff_insert on storage.objects;
create policy quotes_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'quotes' and public.is_staff());
drop policy if exists quotes_staff_update on storage.objects;
create policy quotes_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'quotes' and public.is_staff());

-- ── 3. E-mail on new webshop orders ─────────────────────────────────────────
-- Calls the Edge Function "order-notify", which e-mails the salesperson (or
-- the admins) once per order. Orders created in the CRM are not mailed.
create extension if not exists pg_net;
alter table orders add column if not exists notified_at timestamptz;

create or replace function notify_new_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null and order_is_live(new.status::text) then
    perform net.http_post(
      url     := 'https://fopshubqliboxgokbhnr.supabase.co/functions/v1/order-notify',
      body    := jsonb_build_object('order_id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb);
  end if;
  return new;
exception when others then
  return new;   -- a notification problem must never stop the order
end; $$;

drop trigger if exists notify_new_order on orders;
create trigger notify_new_order after insert on orders
  for each row execute function notify_new_order();
