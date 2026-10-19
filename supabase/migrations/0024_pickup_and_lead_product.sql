-- 1. When the carrier is to pick up the parcel (set when the order is packed).
-- 2. The product a lead is about ("Skapa lead" on the customer card).
-- Run once in the Supabase SQL Editor, after 0023. Safe to run again.

alter table orders add column if not exists pickup_at timestamptz;

do $$
declare v_type text;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'deals' and column_name = 'product_id') then
    select format_type(a.atttypid, a.atttypmod) into v_type
      from pg_attribute a where a.attrelid = 'public.products'::regclass and a.attname = 'id';
    execute format('alter table deals add column product_id %s references products(id) on delete set null', v_type);
  end if;
end $$;
