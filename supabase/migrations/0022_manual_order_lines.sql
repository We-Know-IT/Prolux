-- Lines typed in by hand in the CRM checkout ("Egen rad"): something that is
-- not (yet) a product in the catalogue. They are saved without a product_id.
-- Run once in the Supabase SQL Editor, after 0021. Safe to run again.

alter table order_items alter column product_id drop not null;

-- The car stock only follows catalogue products.
create or replace function car_on_order_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare o record; r record; v_sign int;
begin
  if tg_op = 'INSERT' then r := new; v_sign := -1; else r := old; v_sign := 1; end if;
  if coalesce(r.delivery, 'ship') <> 'car' or r.product_id is null then return r; end if;
  select status::text as status, coalesce(created_by, assigned_to) as seller into o from orders where id = r.order_id;
  if not found or o.seller is null or not order_is_live(o.status) then return r; end if;
  insert into car_stock (salesperson, product_id, qty) values (o.seller, r.product_id, greatest(0, v_sign * r.qty))
  on conflict (salesperson, product_id) do update set qty = greatest(0, car_stock.qty + v_sign * r.qty), updated_at = now();
  return r;
end; $$;
