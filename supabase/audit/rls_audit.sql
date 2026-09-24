-- Read-only permissions report. Changes nothing.
-- Run in the Supabase SQL Editor and send the result table back.
-- One row per table (public schema + storage.objects): whether row-level
-- security is on, and every policy with who it applies to and its rule.

select
  n.nspname || '.' || c.relname                        as tabell,
  case when c.relrowsecurity then 'PÅ' else 'AV !!' end as rls,
  coalesce(string_agg(
    format('%s [%s] %s → using(%s) check(%s)',
           p.polname,
           case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE'
                         when 'd' then 'DELETE' else 'ALL' end,
           coalesce((select string_agg(case when r = 0 then 'public' else pg_get_userbyid(r) end, ',')
                       from unnest(p.polroles) r), ''),
           coalesce(pg_get_expr(p.polqual, p.polrelid), '-'),
           coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '-')),
    E'\n' order by p.polcmd, p.polname) filter (where p.oid is not null), 'INGA POLICYER') as policyer
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where c.relkind = 'r'
  and (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects'))
group by n.nspname, c.relname, c.relrowsecurity
order by c.relrowsecurity, n.nspname, c.relname;
