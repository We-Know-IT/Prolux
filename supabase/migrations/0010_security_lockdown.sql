-- Security lock-down. Run once in the Supabase SQL Editor. Safe to run again.
--
-- Before this, every logged-in user (including anyone who registers as a
-- customer on www) could read and change every table, a few tables were open
-- to everyone, and the admin/CRM role lived in user_metadata, which users
-- can edit themselves.
--
-- After this:
--   * Roles come from staff_members (only admins can change it) and are
--     stored in app_metadata, which users cannot edit.
--   * Staff (admin, crm) can work with all CRM/admin data.
--   * Customers see and edit only their own customer card and orders.
--   * Orders from the webshop are priced by the database (place_order), so
--     prices, price lists and campaign codes cannot be tampered with.
--   * Only admins upload images and edit products, content and budgets.
--
-- After running: everyone logs out and in again once (so their login picks
-- up the new role). The last query lists who has admin/CRM access; check it.

-- ── 1. Roles from staff_members into app_metadata ───────────────────────────

-- The role a user gets: admin/crm if their e-mail is in staff_members,
-- otherwise portal (customer). Recomputed on every insert/update of the user,
-- so what is in staff_members always wins.
create or replace function public.sync_app_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role',
    coalesce((select s.role::text from public.staff_members s
               where lower(s.email) = lower(new.email) and s.role::text in ('admin', 'crm')
               limit 1), 'portal'));
  return new;
end; $$;

drop trigger if exists sync_app_role on auth.users;
create trigger sync_app_role before insert or update on auth.users
  for each row execute function public.sync_app_role();

-- Adding, changing or removing a staff member updates that user's role.
create or replace function public.staff_members_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update auth.users set raw_app_meta_data = raw_app_meta_data
   where lower(email) in (lower(coalesce(new.email, '')), lower(coalesce(old.email, '')));
  return null;
end; $$;

drop trigger if exists staff_members_sync on public.staff_members;
create trigger staff_members_sync after insert or update or delete on public.staff_members
  for each row execute function public.staff_members_sync();

-- Existing admins/sellers that are not in staff_members yet keep their access.
do $$
declare v_role_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into v_role_type
    from pg_attribute a where a.attrelid = 'public.staff_members'::regclass and a.attname = 'role';
  execute format($f$
    insert into public.staff_members (email, full_name, role)
    select u.email,
           coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
           (u.raw_user_meta_data->>'role')::%s
      from auth.users u
     where u.raw_user_meta_data->>'role' in ('admin', 'crm')
       and u.email is not null
       and not exists (select 1 from public.staff_members s where lower(s.email) = lower(u.email))
  $f$, v_role_type);
end $$;

-- Recompute everyone's role now.
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb);

-- ── 2. Helpers used by the policies ─────────────────────────────────────────

create or replace function public.app_role() returns text
language sql stable as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') $$;

create or replace function public.is_staff() returns boolean
language sql stable as $$ select public.app_role() in ('admin', 'crm') $$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.app_role() = 'admin' $$;

-- The customers.id values that belong to the logged-in customer.
create or replace function public.my_customer_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select c.id::text from public.customers c where auth.uid() is not null and c.auth_user_id = auth.uid()
$$;

-- Staff member's first name, as used in orders.assigned_to/created_by.
create or replace function public.my_staff_name() returns text
language sql stable security definer set search_path = public as $$
  select split_part(coalesce(
    (select s.full_name from public.staff_members s where lower(s.email) = lower(auth.jwt() ->> 'email') limit 1),
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    'Bashar'), ' ', 1)
$$;

-- ── 3. Replace all policies on the app's tables ─────────────────────────────

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
     where (schemaname = 'public' and tablename in (
             'activities', 'automations', 'campaigns', 'categories', 'customer_activities',
             'customer_product_views', 'customers', 'deals', 'email_config', 'integration_log',
             'order_items', 'orders', 'price_lists', 'products', 'reminders', 'sales_budgets',
             'site_content', 'staff_members'))
        or (schemaname = 'storage' and tablename = 'objects')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table activities             enable row level security;
alter table automations            enable row level security;
alter table campaigns              enable row level security;
alter table categories             enable row level security;
alter table customer_activities    enable row level security;
alter table customer_product_views enable row level security;
alter table customers              enable row level security;
alter table deals                  enable row level security;
alter table email_config           enable row level security;
alter table integration_log        enable row level security;
alter table order_items            enable row level security;
alter table orders                 enable row level security;
alter table price_lists            enable row level security;
alter table products               enable row level security;
alter table reminders              enable row level security;
alter table sales_budgets          enable row level security;
alter table site_content           enable row level security;
alter table staff_members          enable row level security;

-- Staff only
create policy staff_all on activities             for all to authenticated using (is_staff()) with check (is_staff());
create policy staff_all on automations            for all to authenticated using (is_staff()) with check (is_staff());
create policy staff_all on customer_activities    for all to authenticated using (is_staff()) with check (is_staff());
create policy staff_all on customer_product_views for all to authenticated using (is_staff()) with check (is_staff());
create policy staff_all on customers              for all to authenticated using (is_staff()) with check (is_staff());
create policy staff_all on deals                  for all to authenticated using (is_staff()) with check (is_staff());
create policy staff_all on email_config           for all to authenticated using (is_staff()) with check (is_staff());
create policy staff_all on integration_log        for all to authenticated using (is_staff()) with check (is_staff());
create policy staff_all on order_items            for all to authenticated using (is_staff()) with check (is_staff());
create policy staff_all on orders                 for all to authenticated using (is_staff()) with check (is_staff());
create policy staff_all on reminders              for all to authenticated using (is_staff()) with check (is_staff());

-- Staff read, admins write
create policy staff_read  on campaigns     for select to authenticated using (is_staff());
create policy admin_write on campaigns     for all    to authenticated using (is_admin()) with check (is_admin());
create policy staff_read  on sales_budgets for select to authenticated using (is_staff());
create policy admin_write on sales_budgets for all    to authenticated using (is_admin()) with check (is_admin());
create policy admin_all   on staff_members for all    to authenticated using (is_admin()) with check (is_admin());

-- Public read (webshop), admins write
create policy public_read on products     for select using (true);
create policy admin_write on products     for all to authenticated using (is_admin()) with check (is_admin());
create policy public_read on categories   for select using (true);
create policy admin_write on categories   for all to authenticated using (is_admin()) with check (is_admin());
create policy public_read on price_lists  for select using (true);
create policy admin_write on price_lists  for all to authenticated using (is_admin()) with check (is_admin());
create policy public_read on site_content for select using (true);
create policy admin_write on site_content for all to authenticated using (is_admin()) with check (is_admin());

-- Customers: their own card, orders and the registration note
create policy customer_own_select on customers for select to authenticated using (auth_user_id = auth.uid());
create policy customer_own_insert on customers for insert to authenticated with check (auth_user_id = auth.uid());
create policy customer_own_update on customers for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy customer_own_select on orders for select to authenticated
  using (customer_id::text in (select public.my_customer_ids()) or customer_id::text = auth.uid()::text);
create policy customer_own_select on order_items for select to authenticated
  using (order_id in (select o.id from orders o));
create policy customer_own_insert on activities for insert to authenticated
  with check (customer_id::text in (select public.my_customer_ids()));

-- Customers can edit their contact details but not their price list,
-- status, account manager or which login the card belongs to.
create or replace function public.protect_customer_fields() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' and not public.is_staff() then
    if tg_op = 'INSERT' then
      new.price_list_id   := 'Standard';
      new.account_manager := null;
      new.status          := 'active';
      new.auth_user_id    := auth.uid();
    else
      new.price_list_id   := old.price_list_id;
      new.account_manager := old.account_manager;
      new.status          := old.status;
      new.auth_user_id    := old.auth_user_id;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists protect_customer_fields on customers;
create trigger protect_customer_fields before insert or update on customers
  for each row execute function public.protect_customer_fields();

-- ── 4. Images: everyone can view, admins upload ─────────────────────────────

insert into storage.buckets (id, name, public)
values ('product-images',  'product-images',  true),
       ('hero-images',     'hero-images',     true),
       ('category-images', 'category-images', true),
       ('om-oss-images',   'om-oss-images',   true)
on conflict (id) do update set public = true;

create policy prolux_images_public_read on storage.objects for select
  using (bucket_id in ('product-images', 'hero-images', 'category-images', 'om-oss-images'));
create policy prolux_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('product-images', 'hero-images', 'category-images', 'om-oss-images') and public.is_admin());
create policy prolux_images_admin_update on storage.objects for update to authenticated
  using (bucket_id in ('product-images', 'hero-images', 'category-images', 'om-oss-images') and public.is_admin());
create policy prolux_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id in ('product-images', 'hero-images', 'category-images', 'om-oss-images') and public.is_admin());

-- ── 5. Order functions use the protected role ───────────────────────────────

create or replace function confirm_order(p_order_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  if not is_staff() then return false; end if;
  update orders set status = 'confirmed'
   where id::text = p_order_id and status = 'pending'
     and (is_admin() or created_by = my_staff_name() or assigned_to = my_staff_name());
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end; $$;

create or replace function ship_order(p_order_id text, p_carrier text, p_tracking text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  if not is_staff() then return false; end if;
  update orders
     set status             = 'shipped',
         carrier            = nullif(trim(p_carrier), ''),
         transport_order_id = nullif(trim(p_tracking), ''),
         shipped_at         = coalesce(shipped_at, now())
   where id::text = p_order_id
     and status in ('pending', 'confirmed', 'packed', 'shipped')
     and (is_admin() or created_by = my_staff_name() or assigned_to = my_staff_name());
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end; $$;

-- Webshop checkout (guests and customers). Prices come from products and the
-- customer's price list, campaign codes are checked here. With p_dry_run it
-- only returns the totals, for showing them in the checkout.
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

-- ── 6. Who has staff access now ─────────────────────────────────────────────
select email, raw_app_meta_data ->> 'role' as roll
  from auth.users
 where raw_app_meta_data ->> 'role' in ('admin', 'crm')
 order by 2, 1;
