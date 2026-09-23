-- Editable marketing-site content (hero, kategorier, guider, om oss, kontakt).
-- Run this once in the Supabase SQL editor for the ProLuxShine project.

create table if not exists site_content (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table site_content enable row level security;

-- Anyone (including anonymous visitors) can read site content — it's
-- what renders the public marketing pages.
create policy "site_content_public_read"
  on site_content for select
  using (true);

-- Only admins can write it.
create policy "site_content_admin_write"
  on site_content for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
