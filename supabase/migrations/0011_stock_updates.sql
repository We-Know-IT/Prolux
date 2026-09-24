-- Stock follows orders automatically, whichever way the order was placed
-- (webshop, customer portal or CRM):
--   * a new order line takes its quantity off products.stock_qty
--   * cancelling an order puts its quantities back; un-cancelling takes them again
--   * removing an order line from a live order puts it back
-- Stock may go below zero; that shows as oversold rather than hiding it.
-- Run once in the Supabase SQL Editor (after 0010). Safe to run again.
-- Existing orders do not change current stock.

create or replace function stock_on_order_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if tg_op = 'INSERT' then
    select status into v_status from orders where id = new.order_id;
    if coalesce(v_status, '') <> 'cancelled' then
      update products set stock_qty = coalesce(stock_qty, 0) - new.qty where id = new.product_id;
    end if;
    return new;
  else
    select status into v_status from orders where id = old.order_id;
    if found and coalesce(v_status, '') <> 'cancelled' then
      update products set stock_qty = coalesce(stock_qty, 0) + old.qty where id = old.product_id;
    end if;
    return old;
  end if;
end; $$;

drop trigger if exists stock_on_order_item on order_items;
create trigger stock_on_order_item after insert or delete on order_items
  for each row execute function stock_on_order_item();

create or replace function stock_on_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_sign int;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = 'cancelled' then v_sign := 1;          -- back to stock
  elsif old.status = 'cancelled' then v_sign := -1;      -- reactivated
  else return new;
  end if;
  update products p
     set stock_qty = coalesce(p.stock_qty, 0) + v_sign * s.qty
    from (select product_id, sum(qty) as qty from order_items where order_id = new.id group by product_id) s
   where p.id = s.product_id;
  return new;
end; $$;

drop trigger if exists stock_on_order_status on orders;
create trigger stock_on_order_status after update of status on orders
  for each row execute function stock_on_order_status();
