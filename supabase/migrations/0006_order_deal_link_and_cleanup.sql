-- 1. Orders can be linked to the deal they came from, so a won deal and its
--    order are not both counted towards the salesperson's budget.
-- 2. Clean-up: orders from the old customer portal were saved under the
--    customer's login id instead of customers.id. Point them at customers.id
--    like every other order.
-- Run once in the Supabase SQL Editor. Safe to run again.

-- deal_id gets the same type as deals.id.
do $$
declare v_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into v_type
    from pg_attribute a
   where a.attrelid = 'public.deals'::regclass and a.attname = 'id';
  execute format(
    'alter table orders add column if not exists deal_id %s references deals(id) on delete set null',
    v_type);
end $$;

create index if not exists orders_deal_id_idx on orders(deal_id);

update orders o
   set customer_id = c.id
  from customers c
 where c.auth_user_id is not null
   and o.customer_id::text = c.auth_user_id::text
   and o.customer_id::text <> c.id::text;
