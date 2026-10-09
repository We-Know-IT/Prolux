-- Why can't an account log in to crm.proluxshine.com? Read-only: changes nothing.
-- Change the e-mail on the next line and run it in the Supabase SQL Editor.
with target as (select lower('overlord@weknowit.se') as email)
select
  u.email,
  case when u.id is null then 'SAKNAS: skapa kontot under Authentication → Users → Add user'
       else 'finns' end                                                        as konto,
  case when u.email_confirmed_at is null then 'NEJ: bekräfta kontot (Auto Confirm User / Send confirmation)'
       else 'ja' end                                                           as bekraftad,
  coalesce(s.role::text, 'SAKNAS: lägg till e-posten i staff_members med role = admin') as staff_members_roll,
  coalesce(u.raw_app_meta_data ->> 'role', '—')                                as roll_i_inloggningen,
  u.last_sign_in_at                                                            as senaste_inloggning
from target t
left join auth.users u          on lower(u.email) = t.email
left join public.staff_members s on lower(s.email) = t.email;
