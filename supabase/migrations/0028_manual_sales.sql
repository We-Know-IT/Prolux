-- Sales entered by hand per salesperson and month (e.g. August and September,
-- before the CRM was used). They count towards the budget together with the
-- orders in the system. month is 0–11, the same as sales_budgets.month.
-- Also lets customers be saved without contact person or e-mail (imported
-- company lists often lack them).
-- Run once in the Supabase SQL Editor, after 0027. Safe to run again.

create table if not exists manual_sales (
  salesperson text    not null,
  year        int     not null,
  month       int     not null check (month between 0 and 11),
  amount      numeric not null default 0,
  note        text,
  updated_at  timestamptz not null default now(),
  primary key (salesperson, year, month)
);

alter table manual_sales enable row level security;

drop policy if exists staff_read  on manual_sales;
drop policy if exists admin_write on manual_sales;
create policy staff_read  on manual_sales for select to authenticated using (is_staff());
create policy admin_write on manual_sales for all    to authenticated using (is_admin()) with check (is_admin());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'manual_sales') then
    alter publication supabase_realtime add table public.manual_sales;
  end if;
end $$;

alter table customers alter column contact_name drop not null;
alter table customers alter column email        drop not null;
