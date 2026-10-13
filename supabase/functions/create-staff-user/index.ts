import { createClient } from 'jsr:@supabase/supabase-js@2'

// Admin → Team → "Lägg till medarbetare". Creates the login for a new
// colleague (admin or säljare) or a customer account.
// Deploy: Supabase → Edge Functions → new function "create-staff-user",
// paste this file, turn OFF "Verify JWT" (the caller is checked below).
//
// POST { email, full_name, role: 'admin' | 'crm' | 'portal', password }
// Authorization: Bearer <admin's token>

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Använd POST.' }, 405)

  // Only admins may add people.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const { data: caller } = token ? await sb.auth.getUser(token) : { data: { user: null } }
  if (caller.user?.app_metadata?.role !== 'admin') return json({ error: 'Endast administratörer kan lägga till medarbetare.' }, 403)

  let body: any = {}
  try { body = await req.json() } catch { /* empty */ }
  const email = String(body.email ?? '').trim().toLowerCase()
  const fullName = String(body.full_name ?? '').trim()
  const role = String(body.role ?? '')
  const password = String(body.password ?? '')
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Ange en giltig e-postadress.' }, 400)
  if (!fullName) return json({ error: 'Ange ett namn.' }, 400)
  if (!['admin', 'crm', 'portal'].includes(role)) return json({ error: 'Okänd roll.' }, 400)
  if (password.length < 10) return json({ error: 'Lösenordet är för kort.' }, 400)

  // Staff: the staff_members row gives the login its role (0010 trigger), so
  // it is written before the login is created.
  let insertedStaffId: string | null = null
  if (role !== 'portal') {
    const { data: existing } = await sb.from('staff_members').select('id').ilike('email', email).maybeSingle()
    if (existing) {
      const { error } = await sb.from('staff_members').update({ full_name: fullName, role }).eq('id', existing.id)
      if (error) return json({ error: `Kunde inte spara medarbetaren: ${error.message}` }, 500)
    } else {
      const { data, error } = await sb.from('staff_members').insert({ email, full_name: fullName, role }).select('id').single()
      if (error) return json({ error: `Kunde inte spara medarbetaren: ${error.message}` }, 500)
      insertedStaffId = data.id
    }
  }

  const { data: created, error: createError } = await sb.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  })

  if (createError) {
    const exists = /already|registered|exists/i.test(createError.message)
    if (exists) {
      // The login exists: keep its password, just give it the role.
      return json({ ok: true, existing: true, message: 'Det finns redan ett konto med den e-postadressen. Rollen är uppdaterad — personen loggar in med sitt befintliga lösenord (eller "Glömt lösenord").' })
    }
    if (insertedStaffId) await sb.from('staff_members').delete().eq('id', insertedStaffId)
    return json({ error: `Kunde inte skapa inloggningen: ${createError.message}` }, 500)
  }

  // Customer accounts get a customer card linked to the login.
  if (role === 'portal' && created.user) {
    await sb.from('customers').insert({
      company: fullName, contact_name: fullName, email, auth_user_id: created.user.id,
      price_list_id: 'Standard', status: 'active',
    })
  }

  return json({ ok: true, existing: false })
})
