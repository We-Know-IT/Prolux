import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'
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
//
// Each lead is mailed to the customer's salesperson, or to the admins when the
// customer has none yet, with "reply to" set to the sender so the salesperson
// can answer straight from their own inbox. A form meant for one salesperson
// can add &seller=<first name> to the address. Sends with the e-mail settings
// in Admin → Integrationer (email_config).

const env = (k: string) => Deno.env.get(k)
const sb = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!)

const APP_URL = env('APP_URL') || 'https://crm.proluxshine.com'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
const first = (n: string | null | undefined) => (n || '').trim().split(/\s+/)[0]

// deno-lint-ignore no-explicit-any
async function sendEmail(to: string[], subject: string, html: string, replyTo: string | null, config: any): Promise<boolean> {
  if (!config || config.provider === 'pending') { console.log(`[ej konfigurerat] ${to.join(', ')}: ${subject}`); return false }
  if (config.provider === 'smtp') {
    // An ordinary mailbox, e.g. one.com (send.one.com, port 465).
    const port = Number(config.smtp_port) || 465
    const transport = nodemailer.createTransport({
      host: config.smtp_host || 'send.one.com', port, secure: port === 465,
      auth: { user: config.smtp_user || config.from_email, pass: config.smtp_password },
    })
    await transport.sendMail({ from: { name: config.from_name || 'ProLuxShine', address: config.from_email }, to, subject, html, ...(replyTo ? { replyTo } : {}) })
    return true
  }
  if (config.provider === 'sendgrid') {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST', headers: { Authorization: `Bearer ${config.api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personalizations: [{ to: to.map(email => ({ email })) }], from: { email: config.from_email, name: config.from_name }, ...(replyTo ? { reply_to: { email: replyTo } } : {}), subject, content: [{ type: 'text/html', value: html }] }),
    })
    return res.ok || res.status === 202
  }
  if (config.provider === 'outlook') {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: config.client_id, client_secret: config.client_secret, scope: 'https://graph.microsoft.com/.default' }),
    })
    const { access_token } = await tokenRes.json()
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${config.from_email}/sendMail`, {
      method: 'POST', headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { subject, body: { contentType: 'HTML', content: html }, toRecipients: to.map(address => ({ emailAddress: { address } })), ...(replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {}) } }),
    })
    return res.ok
  }
  console.log(`[okänd e-postleverantör ${config.provider}]`)
  return false
}

// The lead to its salesperson, else to every admin.
async function notify(lead: ReturnType<typeof toLead>, dealId: string, seller: string | null, company: string, isNew: boolean, note: string) {
  const { data: staff } = await sb.from('staff_members').select('email,full_name,role')
  const people = (staff ?? []).filter(s => s.email)
  let to = seller ? people.filter(s => first(s.full_name).toLowerCase() === seller.toLowerCase()) : []
  if (!to.length) to = people.filter(s => s.role === 'admin')
  const emails = [...new Set(to.map(s => s.email.toLowerCase()))]
  if (!emails.length) return { sent: false, to: [] as string[] }
  const admin = to.every(s => s.role === 'admin')
  const link = `${APP_URL}${admin ? '/admin/crm' : '/crm'}/pipeline?deal=${dealId}`
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:560px">
      <h2 style="margin:0 0 4px">Ny förfrågan från webben – ${esc(company)}</h2>
      <p style="margin:0 0 14px;color:#555">${isNew ? 'Ny kund, inlagd som prospekt.' : 'Befintlig kund.'}${seller ? ` Säljare: ${esc(seller)}.` : ' Ingen säljare är kopplad än – välj en i CRM:et.'}</p>
      <pre style="font-family:Arial,sans-serif;white-space:pre-wrap;background:#f6f6f6;padding:12px 14px;border-radius:8px;margin:0">${esc(note)}</pre>
      <p style="margin:20px 0"><a href="${link}" style="background:#E8B84B;color:#111;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Öppna leaden i CRM:et</a></p>
      <p style="color:#888;font-size:12px">${lead.email ? 'Svara på det här mejlet så går svaret direkt till ' + esc(lead.email) + '. ' : ''}Skickat automatiskt när ett formulär skickas på www.proluxshine.se.</p>
    </div>`
  const { data: config } = await sb.from('email_config').select('*').eq('id', 'default').maybeSingle()
  const sent = await sendEmail(emails, `Ny förfrågan från webben – ${company}`, html, lead.email, config).catch(e => { console.error(e); return false })
  return { sent, to: emails }
}

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
  const sellerParam = url.searchParams.get('seller')?.trim() || null
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
        account_manager: sellerParam,
      }).select('id,account_manager,company').single()
      if (error) throw error
      customer = c
    }

    const note = noteFor(lead)
    const title = `${lead.form || 'Webbförfrågan'} – ${lead.company || customer!.company}`.slice(0, 200)
    const seller = customer!.account_manager || sellerParam
    const { data: deal, error: dealError } = await sb.from('deals').insert({
      title, customer_id: customer!.id, value: 0, stage: 'Prospekt', notes: note,
      assigned_to: seller, source: 'web',
    }).select('id').single()
    if (dealError) throw dealError
    await sb.from('activities').insert({
      customer_id: customer!.id, type: 'note',
      title: isNew ? `Ny förfrågan från webben (ny kund)` : 'Ny förfrågan från webben',
      body: note, created_by: 'Webbformulär',
    })
    const mail = await notify(lead, deal.id, seller, lead.company || customer!.company, isNew, note)
    return json({ ok: true, mailed: mail.sent, to: mail.to })
  } catch (e) {
    console.error('web-form', e)
    return json({ error: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) }, 500)
  }
})
