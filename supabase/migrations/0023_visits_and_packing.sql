-- 1. Besökslista: customers a salesperson plans to visit on a day, ticked off
--    after each visit.
-- 2. Packing on the order: who in the warehouse packed it, and when.
-- Run once in the Supabase SQL Editor, after 0022. Safe to run again.

-- ── 1. Visit plans ──────────────────────────────────────────────────────────
do $$
declare v_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into v_type
    from pg_attribute a where a.attrelid = 'public.customers'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists visit_plans (
      id          uuid primary key default gen_random_uuid(),
      salesperson text not null,
      customer_id %s not null references customers(id) on delete cascade,
      visit_date  date not null default current_date,
      position    int  not null default 0,
      visited_at  timestamptz,
      note        text,
      created_at  timestamptz not null default now(),
      unique (salesperson, customer_id, visit_date)
    )$f$, v_type);
end $$;

create index if not exists visit_plans_day on visit_plans (salesperson, visit_date);

alter table visit_plans enable row level security;
drop policy if exists staff_all on visit_plans;
create policy staff_all on visit_plans for all to authenticated using (is_staff()) with check (is_staff());

-- ── 2. Packing ──────────────────────────────────────────────────────────────
alter table orders add column if not exists packed_by text;
alter table orders add column if not exists packed_at timestamptz;

-- Live updates on other devices.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visit_plans') then
    alter publication supabase_realtime add table public.visit_plans;
  end if;
end $$;
