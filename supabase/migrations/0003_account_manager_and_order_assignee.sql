-- Kundansvarig per kund, och en mottagare (ansvarig säljare) per order.
-- The order's assignee receives it to act on and gets it counted on their budget.
-- Safe to run more than once.

alter table customers add column if not exists account_manager text;
alter table orders    add column if not exists assigned_to     text;

-- Default a new order's assignee to the customer's account manager, whichever
-- path created it (webshop, portal checkout or CRM). Portal checkout stores the
-- customer's auth user id in orders.customer_id, so match on either id.
-- Must never block an order: any error just leaves the order unassigned.
create or replace function set_order_assignee() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is null and new.customer_id is not null then
    begin
      select c.account_manager into new.assigned_to
      from customers c
      where c.id::text = new.customer_id::text
         or c.auth_user_id::text = new.customer_id::text
      limit 1;
    exception when others then
      new.assigned_to := null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_assignee on orders;
create trigger orders_set_assignee
  before insert on orders
  for each row execute function set_order_assignee();
