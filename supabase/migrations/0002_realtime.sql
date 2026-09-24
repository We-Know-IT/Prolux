-- Enable Supabase Realtime for the tables the admin/CRM views listen to, so
-- changes on one device show up on every other open device.
-- Safe to run more than once: skips tables that are missing or already enabled.

do $$
declare
  t text;
begin
  foreach t in array array[
    'orders', 'order_items', 'products', 'customers', 'deals',
    'sales_budgets', 'reminders', 'customer_activities', 'activities'
  ] loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
