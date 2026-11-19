-- E-mail settings: a reply address (where customers' answers go) and copies
-- of every order confirmation – to fixed addresses (e.g. Bashar) and to the
-- salesperson who placed the order.
-- Run once in the Supabase SQL Editor, after 0029. Safe to run again.

alter table email_config add column if not exists reply_to    text;
alter table email_config add column if not exists copy_to     text;              -- comma-separated
alter table email_config add column if not exists copy_seller boolean not null default true;
