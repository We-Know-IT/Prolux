-- Visma Spiris (eEkonomi) integration. Run once in the Supabase SQL Editor.
-- Safe to run again.
--
--   * visma_connection: the single Visma login (OAuth tokens) and settings.
--     Only the "visma" Edge Function reads it (service role); nobody can read
--     the tokens from the browser.
--   * Visma ids on customers, products and orders, and the invoice status on
--     orders (pending → draft/invoiced → paid, or error).
--   * Customers get an invoice address and postal code: Visma requires a
--     postal code and city on every customer.

create table if not exists visma_connection (
  id                  int primary key default 1 check (id = 1),
  access_token        text,
  refresh_token       text,
  expires_at          timestamptz,
  company_name        text,
  connected_by        text,
  connected_at        timestamptz,
  oauth_state         text,
  oauth_state_expires timestamptz,
  last_payment_sync   timestamptz,
  -- terms_of_payment_id, unit_id, coding_id, invoice_mode ('draft' | 'invoice'),
  -- auto_on_confirm (bool)
  settings            jsonb not null default '{"invoice_mode": "draft", "auto_on_confirm": true}'::jsonb,
  updated_at          timestamptz not null default now()
);
alter table visma_connection enable row level security;   -- no policies: service role only

alter table customers add column if not exists address           text;
alter table customers add column if not exists postal_code       text;
alter table customers add column if not exists visma_customer_id text;
alter table products  add column if not exists visma_article_id  text;
alter table orders    add column if not exists visma_invoice_id     text;
alter table orders    add column if not exists visma_draft_id       text;
alter table orders    add column if not exists visma_invoice_number text;
alter table orders    add column if not exists visma_status         text;   -- draft | invoiced | paid | error
alter table orders    add column if not exists visma_error          text;
alter table orders    add column if not exists visma_synced_at      timestamptz;
alter table orders    add column if not exists paid_at              timestamptz;

-- Staff can see whether Visma is connected (never the tokens).
create or replace function visma_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_staff() then null else coalesce((
    select jsonb_build_object(
      'connected',    c.refresh_token is not null,
      'company_name', c.company_name,
      'connected_by', c.connected_by,
      'connected_at', c.connected_at,
      'last_payment_sync', c.last_payment_sync,
      'settings',     c.settings)
      from visma_connection c where c.id = 1), '{"connected": false}'::jsonb) end
$$;
revoke all on function visma_status() from public;
grant execute on function visma_status() to authenticated;

-- Log table used by the integrations (exists in most installs already).
create table if not exists integration_log (
  id         bigserial primary key,
  order_id   text,
  type       text,
  status     text,
  payload    jsonb,
  response   jsonb,
  created_at timestamptz not null default now()
);
alter table integration_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'integration_log' and policyname = 'staff_all') then
    create policy staff_all on integration_log for all to authenticated using (public.is_staff()) with check (public.is_staff());
  end if;
end $$;
