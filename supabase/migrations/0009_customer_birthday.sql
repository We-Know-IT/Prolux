-- Contact person's birthday, for marketing activities (greetings, offers).
-- Run once in the Supabase SQL Editor. Safe to run again.
alter table customers add column if not exists contact_birthday date;
