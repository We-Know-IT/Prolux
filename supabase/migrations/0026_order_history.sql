-- Order history in one place: who sent the order from the warehouse, who
-- delivered it and when, and when it was made a quote. Filled in by the
-- database when the status changes, so every view shows the same thing.
-- Run once in the Supabase SQL Editor, after 0025. Safe to run again.

alter table orders add column if not exists shipped_by   text;
alter table orders add column if not exists delivered_at timestamptz;
alter table orders add column if not exists delivered_by text;
alter table orders add column if not exists quoted_at    timestamptz;

create or replace function order_history_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_me text;
begin
  begin v_me := my_staff_name(); exception when others then v_me := null; end;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status::text = 'quote' and new.quoted_at is null then
      new.quoted_at := now();
    end if;
    if new.status::text = 'shipped' then
      new.shipped_at := coalesce(new.shipped_at, now());
      new.shipped_by := coalesce(new.shipped_by, v_me);
    end if;
    if new.status::text = 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
      -- Handed over from the car: the seller who made the sale delivered it.
      new.delivered_by := coalesce(new.delivered_by, case when tg_op = 'INSERT' then new.created_by end, v_me);
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists order_history_stamp on orders;
create trigger order_history_stamp before insert or update on orders
  for each row execute function order_history_stamp();

-- Quotes made before this migration: use the creation time.
update orders set quoted_at = created_at where status::text = 'quote' and quoted_at is null;
