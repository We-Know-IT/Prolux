-- Company budget per month, next to each salesperson's (sales_budgets), and
-- the annual budgets entered for a period (e.g. Aug 2026 – Jul 2027) that
-- were split into months. month is 0–11, the same as sales_budgets.month.
-- Run once in the Supabase SQL Editor, after 0026. Safe to run again.

create table if not exists company_budgets (
  year       int     not null,
  month      int     not null check (month between 0 and 11),
  budget     numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (year, month)
);

create table if not exists budget_periods (
  id          uuid primary key default gen_random_uuid(),
  start_year  int     not null,
  start_month int     not null check (start_month between 0 and 11),
  end_year    int     not null,
  end_month   int     not null check (end_month between 0 and 11),
  total       numeric not null default 0,
  method      text    not null default 'workdays',  -- 'workdays' | 'even'
  created_at  timestamptz not null default now(),
  unique (start_year, start_month, end_year, end_month)
);

alter table company_budgets enable row level security;
alter table budget_periods  enable row level security;

drop policy if exists staff_read  on company_budgets;
drop policy if exists admin_write on company_budgets;
create policy staff_read  on company_budgets for select to authenticated using (is_staff());
create policy admin_write on company_budgets for all    to authenticated using (is_admin()) with check (is_admin());

drop policy if exists staff_read  on budget_periods;
drop policy if exists admin_write on budget_periods;
create policy staff_read  on budget_periods for select to authenticated using (is_staff());
create policy admin_write on budget_periods for all    to authenticated using (is_admin()) with check (is_admin());

-- Live updates on every open dashboard when the budget changes.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'company_budgets') then
    alter publication supabase_realtime add table public.company_budgets;
  end if;
end $$;
