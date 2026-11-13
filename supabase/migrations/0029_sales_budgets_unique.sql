-- Saving a salesperson's budget updates the row for that month
-- (upsert on salesperson, year, month), which needs a unique key on those
-- columns. sales_budgets was created by hand in Supabase, so make sure it has
-- one: keep the newest row of any duplicates, then add the key.
-- Run once in the Supabase SQL Editor, after 0028. Safe to run again.

delete from sales_budgets a
 using sales_budgets b
 where a.salesperson = b.salesperson and a.year = b.year and a.month = b.month
   and a.ctid < b.ctid;

create unique index if not exists sales_budgets_salesperson_year_month_key
  on sales_budgets (salesperson, year, month);
