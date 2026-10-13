-- CRM: saved carts without a customer, fixed info on the customer card.
-- Run once in the Supabase SQL Editor. Safe to run again.
--
--   * customers.fixed_info: a standing note shown under Prislista on the
--     customer card, e.g. "Leverans en trappa ned till höger".
--   * orders.customer_id may be empty, so a cart can be saved as a draft
--     before the customer card exists (the customer is chosen in the checkout).

alter table customers add column if not exists fixed_info text;

alter table orders alter column customer_id drop not null;
