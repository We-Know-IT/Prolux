-- E-mail through an ordinary mailbox (SMTP), e.g. one.com: send.one.com:465.
-- The settings hold a mailbox password, so only admins can read or change
-- them; the Edge Functions that send e-mail read them with the service key.
-- Run once in the Supabase SQL Editor, after 0024. Safe to run again.

alter table email_config add column if not exists smtp_host     text;
alter table email_config add column if not exists smtp_port     int;
alter table email_config add column if not exists smtp_user     text;
alter table email_config add column if not exists smtp_password text;

drop policy if exists staff_all on email_config;
drop policy if exists admin_all on email_config;
create policy admin_all on email_config for all to authenticated using (is_admin()) with check (is_admin());
