-- Spam protection for webshop orders. Run once in the Supabase SQL Editor,
-- after 0010. Safe to run again.
--
-- place_order() now also:
--   * rejects orders where the hidden "website" field is filled in (bots)
--   * limits guests (not logged in) to 3 orders per hour per connection,
--     3 per day per e-mail address and 20 guest orders per hour in total
--   * limits logged-in customers to 10 orders per hour
--   * caps guest orders at 100 000 kr incl. VAT (larger ones need an account)
--   * marks guest orders "GÄSTORDER – verifiera kunden innan leverans"

create table if not exists order_guard_log (
  id         bigserial primary key,
  ip         text,
  email      text,
  user_id    uuid,
  guest      boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists order_guard_log_created_idx on order_guard_log (created_at);
-- Only place_order (security definer) reads and writes it.
alter table order_guard_log enable row level security;

create or replace function place_order(
  p_items jsonb, p_delivery jsonb default '{}'::jsonb,
  p_campaign_code text default null, p_dry_run boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_customer_id text;
  v_pl          text := 'Standard';
  v_disc        numeric;
  v_item        jsonb;
  v_qty         int;
  v_list        numeric;
  v_active      boolean;
  v_subtotal    numeric := 0;
  v_discount    numeric := 0;
  v_after       numeric;
  v_code        text := upper(nullif(trim(coalesce(p_campaign_code, '')), ''));
  v_camp        campaigns%rowtype;
  v_order_id    text;
  v_order_nr    bigint;
  d             jsonb := coalesce(p_delivery, '{}'::jsonb);
  v_guest       boolean := auth.uid() is null;
  v_headers     jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_ip          text;
  v_email       text := lower(nullif(trim(coalesce(p_delivery ->> 'email', '')), ''));
begin
  select c.id::text, coalesce(c.price_list_id, 'Standard') into v_customer_id, v_pl
    from customers c where auth.uid() is not null and c.auth_user_id = auth.uid() limit 1;
  v_pl   := coalesce(v_pl, 'Standard');
  v_disc := case v_pl when 'A' then 0.40 when 'B' then 0.30 when 'C' then 0.20 else 0 end;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Varukorgen är tom';
  end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'För många rader i varukorgen'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := case when (v_item ->> 'qty') ~ '^\d{1,4}$' then (v_item ->> 'qty')::int end;
    if v_qty is null or v_qty < 1 then raise exception 'Ogiltigt antal'; end if;
    select p.list_price, coalesce(p.active, true) into v_list, v_active
      from products p where p.id::text = v_item ->> 'product_id';
    if v_list is null or not v_active then raise exception 'En produkt i varukorgen finns inte längre'; end if;
    v_subtotal := v_subtotal + round(v_list * (1 - v_disc)) * v_qty;
  end loop;

  if v_code is not null then
    select * into v_camp from campaigns
     where upper(code) = v_code and coalesce(active, true)
       and (valid_from is null or valid_from::date <= current_date)
       and (valid_to is null or valid_to::date >= current_date)
       and (max_uses is null or coalesce(used_count, 0) < max_uses);
    if not found then raise exception 'Kampanjkoden är ogiltig eller har gått ut'; end if;
    if v_subtotal < coalesce(v_camp.min_order_amount, 0) then
      raise exception 'Minsta ordervärde för kampanjkoden är % kr', v_camp.min_order_amount;
    end if;
    v_discount := least(v_subtotal, case when v_camp.discount_type = 'percent'
                                         then round(v_subtotal * v_camp.discount_value / 100.0)
                                         else v_camp.discount_value end);
  end if;
  v_after := v_subtotal - v_discount;

  if p_dry_run then
    return jsonb_build_object('price_list', v_pl, 'subtotal', v_subtotal, 'discount', v_discount,
      'vat', round(v_after * 0.25), 'total', v_after + round(v_after * 0.25));
  end if;

  if nullif(trim(d ->> 'company'), '') is null or nullif(trim(d ->> 'contact_name'), '') is null
     or nullif(trim(d ->> 'email'), '') is null or nullif(trim(d ->> 'address'), '') is null
     or nullif(trim(d ->> 'city'), '') is null then
    raise exception 'Fyll i företag, kontaktperson, e-post, adress och ort';
  end if;

  -- Spam protection (see header).
  if nullif(trim(coalesce(d ->> 'website', '')), '') is not null then
    raise exception 'Beställningen kunde inte skickas';     -- honeypot filled in: a bot
  end if;
  v_ip := nullif(trim(split_part(coalesce(v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-real-ip',
                                          v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  if v_guest then
    if v_after + round(v_after * 0.25) > 100000 then
      raise exception 'Större beställningar kräver ett företagskonto. Skapa konto eller kontakta oss.';
    end if;
    if v_ip is not null and (select count(*) from order_guard_log
          where ip = v_ip and created_at > now() - interval '1 hour') >= 3
       or (select count(*) from order_guard_log
          where email = v_email and guest and created_at > now() - interval '24 hours') >= 3
       or (select count(*) from order_guard_log
          where guest and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'För många beställningar på kort tid. Försök igen senare eller kontakta oss.';
    end if;
  elsif (select count(*) from order_guard_log
          where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'För många beställningar på kort tid. Försök igen senare eller kontakta oss.';
  end if;
  insert into order_guard_log (ip, email, user_id, guest) values (v_ip, v_email, auth.uid(), v_guest);

  if v_code is not null then
    update campaigns set used_count = coalesce(used_count, 0) + 1 where id = v_camp.id;
  end if;

  insert into orders (customer_id, price_list_id, status, delivery_name, delivery_address, delivery_city,
                      notes, subtotal, vat_amount, total)
  values (
    (select c.id from customers c where c.id::text = v_customer_id),
    v_pl, 'pending',
    left(trim(d ->> 'company'), 200),
    left(trim(d ->> 'address'), 300),
    left(trim(d ->> 'city'), 100),
    left(concat_ws(E'\n',
      case when v_guest then 'GÄSTORDER – verifiera kunden innan leverans' end,
      'Betalning: Faktura',
      'Kontakt: ' || nullif(trim(d ->> 'contact_name'), ''),
      'E-post: '  || nullif(trim(d ->> 'email'), ''),
      'Telefon: ' || nullif(trim(d ->> 'phone'), ''),
      'Org.nr: '  || nullif(trim(d ->> 'org_nr'), ''),
      'Postnummer: ' || nullif(trim(d ->> 'zip'), ''),
      'Er referens: ' || nullif(trim(d ->> 'reference'), ''),
      'Faktura-e-post: ' || nullif(trim(d ->> 'invoice_email'), ''),
      case when v_code is not null then 'Kampanjkod: ' || v_code || ' (−' || v_discount || ' kr)' end,
      'Meddelande: ' || nullif(trim(d ->> 'message'), '')), 2000),
    v_after, round(v_after * 0.25), v_after + round(v_after * 0.25))
  returning id::text, order_nr into v_order_id, v_order_nr;

  insert into order_items (order_id, product_id, product_name, product_sku, qty, unit_price, list_price, total_price)
  select o.id, p.id, p.name, p.sku, (i ->> 'qty')::int,
         round(p.list_price * (1 - v_disc)), p.list_price, round(p.list_price * (1 - v_disc)) * (i ->> 'qty')::int
    from jsonb_array_elements(p_items) i
    join products p on p.id::text = i ->> 'product_id'
    join orders o on o.id::text = v_order_id;

  return jsonb_build_object('order_nr', v_order_nr, 'subtotal', v_after, 'discount', v_discount,
    'vat', round(v_after * 0.25), 'total', v_after + round(v_after * 0.25));
end; $$;

revoke all on function place_order(jsonb, jsonb, text, boolean) from public;
grant execute on function place_order(jsonb, jsonb, text, boolean) to anon, authenticated;

-- Keep the log small: drop entries older than a week whenever one is added.
create or replace function prune_order_guard_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from order_guard_log where created_at < now() - interval '7 days';
  return null;
end; $$;

drop trigger if exists prune_order_guard_log on order_guard_log;
create trigger prune_order_guard_log after insert on order_guard_log
  for each statement execute function prune_order_guard_log();
