-- B2B enquiries from the "Intresserad av B2B-avtal?" form on Om oss.
-- Run once in the Supabase SQL Editor, after 0010. Safe to run again.
--
-- submit_b2b_lead() is callable by visitors who are not logged in. It:
--   * finds the customer by e-mail, or creates a prospect customer
--   * opens a deal in the "Prospekt" stage (source 'web') for the customer's
--     account manager, so it lands in the CRM pipeline
--   * logs the enquiry as a note on the customer card
-- Spam protection as for guest orders (0012): a hidden "website" field, at most
-- 3 enquiries per hour per connection, 3 per day per e-mail and 30 per hour in total.

alter table deals add column if not exists source text;

create table if not exists lead_guard_log (
  id         bigserial primary key,
  ip         text,
  email      text,
  created_at timestamptz not null default now()
);
create index if not exists lead_guard_log_created_idx on lead_guard_log (created_at);
-- Only submit_b2b_lead (security definer) reads and writes it.
alter table lead_guard_log enable row level security;

create or replace function submit_b2b_lead(p_lead jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l          jsonb := coalesce(p_lead, '{}'::jsonb);
  v_name     text  := left(nullif(trim(l ->> 'name'), ''), 120);
  v_company  text  := left(nullif(trim(l ->> 'company'), ''), 160);
  v_email    text  := lower(left(nullif(trim(l ->> 'email'), ''), 200));
  v_phone    text  := left(nullif(trim(l ->> 'phone'), ''), 40);
  v_message  text  := left(nullif(trim(l ->> 'message'), ''), 2000);
  v_headers  jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_ip       text;
  v_customer customers%rowtype;
  v_new      boolean := false;
  v_body     text;
begin
  if nullif(trim(coalesce(l ->> 'website', '')), '') is not null then
    raise exception 'Förfrågan kunde inte skickas';        -- honeypot filled in: a bot
  end if;
  if v_name is null or v_company is null or v_email is null then
    raise exception 'Fyll i namn, företag och e-post';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ange en giltig e-postadress';
  end if;

  v_ip := nullif(trim(split_part(coalesce(v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-real-ip',
                                          v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  if v_ip is not null and (select count(*) from lead_guard_log
        where ip = v_ip and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from lead_guard_log
        where email = v_email and created_at > now() - interval '24 hours') >= 3
     or (select count(*) from lead_guard_log
        where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'För många förfrågningar på kort tid. Ring eller mejla oss istället.';
  end if;
  insert into lead_guard_log (ip, email) values (v_ip, v_email);

  -- An existing customer keeps its data; only new ones are created.
  select * into v_customer from customers where lower(email) = v_email order by created_at limit 1;
  if not found then
    insert into customers (company, contact_name, email, phone, price_list_id, status)
    values (v_company, v_name, v_email, v_phone, 'Standard', 'prospect')
    returning * into v_customer;
    v_new := true;
  end if;

  v_body := concat_ws(E'\n',
    'Skickad via formuläret på Om oss.',
    '',
    'Företag: ' || v_company,
    'Kontakt: ' || v_name,
    'E-post: '  || v_email,
    'Telefon: ' || coalesce(v_phone, '—'),
    case when v_message is not null then E'\nMeddelande:\n' || v_message end);

  insert into deals (title, customer_id, value, stage, notes, assigned_to, source)
  values ('B2B-förfrågan – ' || v_company, v_customer.id, 0, 'Prospekt', v_body,
          v_customer.account_manager, 'web');

  insert into activities (customer_id, type, title, body, created_by)
  values (v_customer.id, 'note',
          case when v_new then 'Ny B2B-förfrågan (ny kund)' else 'Ny B2B-förfrågan' end,
          v_body, 'Webbformulär');

  return jsonb_build_object('ok', true);
end; $$;

revoke all on function submit_b2b_lead(jsonb) from public;
grant execute on function submit_b2b_lead(jsonb) to anon, authenticated;
