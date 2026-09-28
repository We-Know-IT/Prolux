-- Företag or privat customers, and shopping only when logged in.
-- Run once in the Supabase SQL Editor, after 0010 and 0012. Safe to run again.
--
--   * customers.customer_type: 'business' (default, all existing customers) or
--     'private'. Chosen when the account is created; afterwards only staff can
--     change it (protect_customer_fields).
--   * place_order can no longer be called without logging in: the webshop
--     requires an account to see prices and to order.

alter table customers add column if not exists customer_type text not null default 'business';
alter table customers drop constraint if exists customers_customer_type_check;
alter table customers add constraint customers_customer_type_check
  check (customer_type in ('business', 'private'));

create or replace function public.protect_customer_fields() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' and not public.is_staff() then
    if tg_op = 'INSERT' then
      new.price_list_id   := 'Standard';
      new.account_manager := null;
      new.status          := 'active';
      new.auth_user_id    := auth.uid();
      new.customer_type   := case when new.customer_type = 'private' then 'private' else 'business' end;
    else
      new.price_list_id   := old.price_list_id;
      new.account_manager := old.account_manager;
      new.status          := old.status;
      new.auth_user_id    := old.auth_user_id;
      new.customer_type   := old.customer_type;
    end if;
  end if;
  return new;
end; $$;

-- Guests can no longer order (or price a cart) through the API.
revoke execute on function place_order(jsonb, jsonb, text, boolean) from anon;
revoke execute on function place_order(jsonb, jsonb, text, boolean) from public;
grant  execute on function place_order(jsonb, jsonb, text, boolean) to authenticated;
