import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { toLead, noteFor, parseForm } from './lib.ts'

// Receives the forms on www.proluxshine.se (WordPress): every submission
// becomes a lead in the CRM pipeline (stage Prospekt, source "web") with a
// note on the customer card. A new sender is created as a prospect customer;
// a known one (same e-mail) keeps its card and account manager.
//
// Deploy: Supabase → Edge Functions → new function "web-form" with index.ts
// and lib.ts. Turn OFF "Verify JWT" (WordPress sends no Supabase login);
// the secret key in the address protects it instead.
//
// Secret (Edge Functions → Secrets): WEB_FORM_SECRET – a long random string
// you make up. The webhook address in WordPress is then
//   https://<project>.supabase.co/functions/v1/web-form?key=<WEB_FORM_SECRET>
// Fluent Forms Pro: the form → Settings & Integrations → Configure
// Integrations → Webhook (all fields, method POST, format JSON).
// Elementor Pro: the form → Actions After Submit → Webhook.

const env = (k: string) => Deno.env.get(k)
const sb = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ ok: true, info: 'Skicka formulärdata med POST.' })
  const secret = env('WEB_FORM_SECRET')
  const url = new URL(req.url)
  if (!secret || (url.searchParams.get('key') ?? req.headers.get('x-webhook-key')) !== secret) {
    return json({ error: 'Fel nyckel' }, 401)
  }

  let data: Record<string, unknown> = {}
  try {
    const type = req.headers.get('content-type') || ''
    const raw = await req.text()
    data = type.includes('json') ? JSON.parse(raw || '{}') : parseForm(raw)
  } catch {
    return json({ error: 'Kunde inte läsa formulärdatan' }, 400)
  }
  // Form name from the address if the plugin does not send it (…&form=Kontakt).
  if (url.searchParams.get('form') && !data.form_name) data.form_name = url.searchParams.get('form')

  const lead = toLead(data)
  if (!lead.email && !lead.phone) return json({ error: 'Formuläret saknar e-post och telefon' }, 422)
  if (lead.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) lead.email = null

  try {
    // Known customer: by e-mail, else by phone.
    let customer: { id: string; account_manager: string | null; company: string } | null = null
    if (lead.email) {
      const { data: c } = await sb.from('customers').select('id,account_manager,company').ilike('email', lead.email).order('created_at').limit(1)
      customer = c?.[0] ?? null
    }
    if (!customer && lead.phone) {
      const { data: c } = await sb.from('customers').select('id,account_manager,company').eq('phone', lead.phone).order('created_at').limit(1)
      customer = c?.[0] ?? null
    }
    const isNew = !customer
    if (!customer) {
      const { data: c, error } = await sb.from('customers').insert({
        company: lead.company || lead.name || lead.email || lead.phone,
        contact_name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone,
        org_nr: lead.org_nr,
        city: lead.city,
        price_list_id: 'Standard',
        status: 'prospect',
      }).select('id,account_manager,company').single()
      if (error) throw error
      customer = c
    }

    const note = noteFor(lead)
    const title = `${lead.form || 'Webbförfrågan'} – ${lead.company || customer!.company}`.slice(0, 200)
    const { error: dealError } = await sb.from('deals').insert({
      title, customer_id: customer!.id, value: 0, stage: 'Prospekt', notes: note,
      assigned_to: customer!.account_manager, source: 'web',
    })
    if (dealError) throw dealError
    await sb.from('activities').insert({
      customer_id: customer!.id, type: 'note',
      title: isNew ? `Ny förfrågan från webben (ny kund)` : 'Ny förfrågan från webben',
      body: note, created_by: 'Webbformulär',
    })
    return json({ ok: true })
  } catch (e) {
    console.error('web-form', e)
    return json({ error: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) }, 500)
  }
})
