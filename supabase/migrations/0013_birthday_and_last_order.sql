-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- 1. customers.birthday already existed (admin customer page, automations);
--    0009 added a duplicate contact_birthday. Everything now uses birthday,
--    so copy over what was entered in the CRM.
-- 2. customers.last_order_at drives the inactivity automation but was never
--    updated. It now follows the customer's latest order (not cancelled).
-- 3. Makes sure automations has the fields admin and run-automations use.

alter table customers add column if not exists birthday      date;
alter table customers add column if not exists last_order_at timestamptz;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'customers' and column_name = 'contact_birthday') then
    update customers set birthday = contact_birthday where birthday is null and contact_birthday is not null;
  end if;
end $$;

update customers c
   set last_order_at = s.last_at
  from (select customer_id::text as cid, max(created_at) as last_at
          from orders where status is distinct from 'cancelled' and customer_id is not null
         group by customer_id) s
 where c.id::text = s.cid;

create or replace function touch_customer_last_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null and new.status is distinct from 'cancelled' then
    update customers set last_order_at = greatest(coalesce(last_order_at, new.created_at), new.created_at)
     where id::text = new.customer_id::text;
  end if;
  return new;
end; $$;

drop trigger if exists touch_customer_last_order on orders;
create trigger touch_customer_last_order after insert on orders
  for each row execute function touch_customer_last_order();

-- 3. Automations created in admin. These are the fields run-automations reads.
alter table automations add column if not exists type          text;
alter table automations add column if not exists trigger_days  int;
alter table automations add column if not exists email_subject text;
alter table automations add column if not exists email_body    text;
alter table automations add column if not exists run_count     int default 0;
alter table automations add column if not exists last_run_at   timestamptz;
alter table automations add column if not exists created_at    timestamptz default now();
