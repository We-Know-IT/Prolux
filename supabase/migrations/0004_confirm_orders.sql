-- Salespeople confirm the orders they place or receive.
-- Run once in the Supabase SQL Editor.

-- Who placed the order in the CRM (salesperson first name, same as assigned_to).
alter table orders add column if not exists created_by text;

-- Confirm a pending order. Admins may confirm any order; CRM users only
-- orders they placed (created_by) or received (assigned_to). Runs as
-- security definer so it works regardless of the update policies on orders.
create or replace function confirm_order(p_order_id text)
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
  if v_role = 'admin' then
    update orders set status = 'confirmed'
     where id::text = p_order_id and status = 'pending';
  elsif v_role = 'crm' and v_me <> '' then
    update orders set status = 'confirmed'
     where id::text = p_order_id and status = 'pending'
       and (created_by = v_me or assigned_to = v_me);
  else
    return false;
  end if;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end; $$;

revoke all on function confirm_order(text) from public, anon;
grant execute on function confirm_order(text) to authenticated;
