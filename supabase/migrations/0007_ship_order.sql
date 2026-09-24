-- Mark an order as shipped with carrier and tracking number, so the customer
-- can follow the parcel from their order history.
-- Run once in the Supabase SQL Editor. Safe to run again.

alter table orders add column if not exists carrier    text;
alter table orders add column if not exists shipped_at timestamptz;

-- Same permissions as confirm_order(): admins any order, CRM users orders
-- they placed or received. Calling it again on a shipped order corrects the
-- carrier or tracking number without changing when it was shipped.
create or replace function ship_order(p_order_id text, p_carrier text, p_tracking text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_role text := auth.jwt() -> 'user_metadata' ->> 'role';
  v_me   text := split_part(coalesce(
                   auth.jwt() -> 'user_metadata' ->> 'full_name',
                   auth.jwt() -> 'user_metadata' ->> 'name',
                   'Bashar'), ' ', 1);  -- same fallback as salespersonName()
  v_rows int;
begin
  if v_role not in ('admin', 'crm') then
    return false;
  end if;
  update orders
     set status             = 'shipped',
         carrier            = nullif(trim(p_carrier), ''),
         transport_order_id = nullif(trim(p_tracking), ''),
         shipped_at         = coalesce(shipped_at, now())
   where id::text = p_order_id
     and status in ('pending', 'confirmed', 'packed', 'shipped')
     and (v_role = 'admin' or created_by = v_me or assigned_to = v_me);
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end; $$;

revoke all on function ship_order(text, text, text) from public, anon;
grant execute on function ship_order(text, text, text) to authenticated;
