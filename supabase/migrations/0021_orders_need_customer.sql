-- An order made in the CRM (created_by set) must have a customer before it
-- becomes a real order. Varukorgar (draft), offerter (quote) and cancelled
-- orders may be without one. Webshop orders (created_by empty) are not affected.
-- Existing rows are not checked (NOT VALID), so old orders without a customer
-- can still be fixed with "Koppla kund" in Admin → Ordrar.
-- Run once in the Supabase SQL Editor. Safe to run again.

alter table orders drop constraint if exists orders_need_customer;
alter table orders add constraint orders_need_customer
  check (customer_id is not null or created_by is null or status::text in ('draft', 'quote', 'cancelled'))
  not valid;
