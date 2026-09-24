-- Orders get their salesperson (orders.assigned_to) from the customer's
-- account manager automatically. This fills in orders that are missing one
-- and keeps doing so whenever a customer gets an account manager.
-- Run once in the Supabase SQL Editor, after 0003.

-- 1. Existing orders without a salesperson: take the customer's account manager.
update orders o
   set assigned_to = c.account_manager
  from customers c
 where o.assigned_to is null
   and c.account_manager is not null
   and (o.customer_id::text = c.id::text or o.customer_id::text = c.auth_user_id::text);

-- 2. When a customer gets (or changes) account manager, their orders that
--    still have no salesperson get it too. Orders already assigned are kept.
create or replace function fill_orders_from_account_manager() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.account_manager is not null
     and new.account_manager is distinct from old.account_manager then
    update orders
       set assigned_to = new.account_manager
     where assigned_to is null
       and (customer_id::text = new.id::text
            or (new.auth_user_id is not null and customer_id::text = new.auth_user_id::text));
  end if;
  return new;
end; $$;

drop trigger if exists customers_fill_order_salesperson on customers;
create trigger customers_fill_order_salesperson
  after update of account_manager on customers
  for each row execute function fill_orders_from_account_manager();
