-- Go-live: remove all test/demo data from the CRM, admin and webshop.
-- Run ONCE in the Supabase SQL Editor, just before launch. It cannot be undone,
-- so take a backup first if you want one (Database → Backups).
--
-- Removes: customers, orders and order lines, deals (pipeline), activities and
-- notes, reminders (calendar), product views, automation runs and logs, and
-- the spam-protection logs. Order numbers start again from 1.
--
-- Keeps: products, categories, price lists, site texts and images
-- (site_content), staff (staff_members), logins (auth.users), automations,
-- e-mail settings, campaign codes and sales budgets.
--
-- If any table is referenced by another table that is not in the list, the
-- whole run stops with an error and nothing is removed.

begin;

do $$
declare
  t text;
  v_tables text[] := array[
    'order_items', 'orders',
    'deals', 'activities', 'customer_activities', 'customer_product_views', 'reminders',
    'automation_runs', 'integration_log', 'order_guard_log', 'lead_guard_log',
    'customers'
  ];
  v_existing text[] := '{}';
  v_count bigint;
begin
  foreach t in array v_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into v_count;
      raise notice '% : % rader tas bort', t, v_count;
      v_existing := v_existing || format('public.%I', t);
    end if;
  end loop;
  execute 'truncate ' || array_to_string(v_existing, ', ') || ' restart identity';

  -- Order numbers: also restart a sequence the column only uses as default.
  select coalesce(pg_get_serial_sequence('public.orders', 'order_nr'),
                  substring(column_default from 'nextval\(''([^'']+)''')) into t
    from information_schema.columns
   where table_schema = 'public' and table_name = 'orders' and column_name = 'order_nr';
  if t is not null then execute format('alter sequence %s restart with 1', t); end if;
end $$;

commit;

-- Check: everything above should now be 0.
select 'customers' as tabell, count(*) from customers
union all select 'orders', count(*) from orders
union all select 'deals', count(*) from deals
union all select 'activities', count(*) from activities;
