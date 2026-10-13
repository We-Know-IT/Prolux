import { createClient } from 'jsr:@supabase/supabase-js@2'

// Admin → Team → "Lägg till medarbetare". Creates the login for a new
// colleague (admin or säljare) or a customer account.
// Deploy: Supabase → Edge Functions → new function "create-staff-user",
// paste this file, turn OFF "Verify JWT" (the caller is checked below).
//
// POST { email, full_name, role: 'admin' | 'crm' | 'portal', password }
// Authorization: Bearer <admin's token>
//
// Also removes people: POST { action: 'delete', email?, customer_id? }
//   Deletes the login. A colleague also leaves the team (staff_members);
//   a customer card is deleted, or set inactive when it has order history.

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
  if (body.action === 'delete') return await removeUser(body, caller.user!)
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

// Login id for an e-mail (the admin API has no lookup by e-mail).
async function userIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    const hit = data.users.find(u => u.email?.toLowerCase() === email)
    if (hit) return hit.id
    if (data.users.length < 1000) return null
  }
  return null
}

async function removeUser(body: any, me: { id: string; email?: string }) {
  try {
    const customerId = body.customer_id ? String(body.customer_id) : null
    const { data: card } = customerId
      ? await sb.from('customers').select('id,email,auth_user_id').eq('id', customerId).maybeSingle()
      : { data: null }
    if (customerId && !card) return json({ error: 'Kunden hittades inte.' }, 404)
    const email = String(body.email ?? card?.email ?? '').trim().toLowerCase()
    // A customer card only removes the login linked to it, never one found by e-mail
    // (a colleague could share the address).
    const userId = card ? card.auth_user_id : (email ? await userIdByEmail(email) : null)
    if (userId === me.id || (email && email === me.email?.toLowerCase())) {
      return json({ error: 'Du kan inte ta bort dig själv.' }, 400)
    }

    // Colleague: out of the team first, so the login loses its role.
    if (!customerId && email) {
      const { error } = await sb.from('staff_members').delete().ilike('email', email)
      if (error) return json({ error: `Kunde inte ta bort medarbetaren: ${error.message}` }, 500)
    }

    // The login. Customer cards keep their history, so unlink them first.
    if (userId) {
      await sb.from('customers').update({ auth_user_id: null }).eq('auth_user_id', userId)
      const { error } = await sb.auth.admin.deleteUser(userId)
      if (error && !/not found/i.test(error.message)) return json({ error: `Kunde inte ta bort inloggningen: ${error.message}` }, 500)
    }

    // Customer card: deleted when it has no orders, otherwise kept as inactive.
    let customer: 'deleted' | 'inactive' | null = null
    if (card) {
      const { count } = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', card.id)
      const { error } = count ? { error: true } : await sb.from('customers').delete().eq('id', card.id)
      if (error) {
        await sb.from('customers').update({ status: 'inactive', auth_user_id: null }).eq('id', card.id)
        customer = 'inactive'
      } else customer = 'deleted'
    }
    return json({ ok: true, login_deleted: !!userId, customer })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
}
