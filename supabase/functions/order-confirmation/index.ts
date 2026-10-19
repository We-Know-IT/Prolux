import { createClient } from 'jsr:@supabase/supabase-js@2'

// Order confirmation to the customer, sent when the seller ticks "Skicka
// orderbekräftelse" in the CRM checkout. Called with { order_id } and the
// logged-in seller's token.
// Deploy: Supabase → Edge Functions → new function "order-confirmation",
// paste this file. "Verify JWT" may stay on.
// Sends with the e-mail settings in Admin → Automationer (email_config).

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const APP_URL = Deno.env.get('APP_URL') || 'https://crm.proluxshine.com'
const SITE_URL = Deno.env.get('SITE_URL') || 'https://www.proluxshine.com'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
const kr = (n: number) => `${Math.round(n || 0).toLocaleString('sv-SE')} kr`

async function sendEmail(to: string[], subject: string, html: string, config: any): Promise<boolean> {
  if (!config || config.provider === 'pending') throw new Error('e-post är inte inställd ännu (Admin → Automationer)')
  if (config.provider === 'outlook') {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: config.client_id, client_secret: config.client_secret, scope: 'https://graph.microsoft.com/.default' }),
    })
    const { access_token } = await tokenRes.json()
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${config.from_email}/sendMail`, {
      method: 'POST', headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { subject, body: { contentType: 'HTML', content: html }, toRecipients: to.map(address => ({ emailAddress: { address } })) } }),
    })
    return res.ok
  }
  if (config.provider === 'sendgrid') {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST', headers: { Authorization: `Bearer ${config.api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personalizations: [{ to: to.map(email => ({ email })) }], from: { email: config.from_email, name: config.from_name }, subject, content: [{ type: 'text/html', value: html }] }),
    })
    return res.ok || res.status === 202
  }
  throw new Error(`okänd e-postleverantör ${config.provider}`)
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST' }, 405)

  // Staff only.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const { data: auth } = token ? await sb.auth.getUser(token) : { data: { user: null } }
  const role = auth.user?.app_metadata?.role
  if (role !== 'admin' && role !== 'crm') return json({ error: 'Logga in som säljare eller admin.' }, 401)

  let body: any = {}
  try { body = await req.json() } catch { /* empty */ }
  const orderId = String(body.order_id ?? '')
  if (!orderId) return json({ error: 'order_id saknas' }, 400)

  const { data: order } = await sb.from('orders').select('*,customers(company,contact_name,email)').eq('id', orderId).maybeSingle()
  if (!order) return json({ error: 'Ordern hittades inte' }, 404)
  if (['draft', 'quote', 'cancelled'].includes(order.status)) return json({ error: 'Det här är ingen lagd order' }, 400)
  const c = order.customers ?? {}
  if (!c.email) return json({ error: 'kunden saknar e-postadress' }, 400)

  const { data: items } = await sb.from('order_items').select('product_name,qty,unit_price,total_price,delivery').eq('order_id', orderId)
  const { data: config } = await sb.from('email_config').select('*').eq('id', 'default').maybeSingle()
  // The seller's name and e-mail, for questions.
  const { data: staff } = await sb.from('staff_members').select('email,full_name')
  const first = (n: string) => (n || '').trim().split(/\s+/)[0]
  const seller = (staff ?? []).find(s => first(s.full_name) === (order.assigned_to || order.created_by))

  const lines = items ?? []
  const fromCar = lines.some(l => l.delivery === 'car'), toShip = lines.some(l => l.delivery !== 'car')
  const rows = lines.map(i => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee">${esc(i.product_name)}${i.delivery === 'car' ? '<br><span style="font-size:12px;color:#1F7A4D">Levererad på plats</span>' : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${i.qty} st</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${kr(i.total_price)}</td></tr>`).join('')
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:600px;margin:0 auto">
      <div style="background:#0F1115;padding:18px 24px;border-radius:10px 10px 0 0"><img src="${APP_URL}/email/logo.png" alt="ProLuxShine" height="30" style="display:block"></div>
      <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 10px 10px">
        <h2 style="margin:0 0 6px">Tack för din order!</h2>
        <p style="margin:0 0 18px;color:#555">Hej ${esc(c.contact_name || c.company)}, här är en bekräftelse på order <b>#${order.order_nr}</b>${c.company ? ` för ${esc(c.company)}` : ''}.</p>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
        <table style="width:100%;margin-top:12px">
          <tr><td style="color:#555">Summa exkl. moms</td><td style="text-align:right">${kr(order.subtotal)}</td></tr>
          <tr><td style="color:#555">Moms</td><td style="text-align:right">${kr(order.vat_amount)}</td></tr>
          <tr><td style="font-weight:bold;font-size:16px;padding-top:4px">Totalt inkl. moms</td><td style="text-align:right;font-weight:bold;font-size:16px;padding-top:4px">${kr(order.total)}</td></tr>
        </table>
        <p style="margin:18px 0 0;color:#555">${fromCar && toShip ? 'En del av varorna har lämnats på plats, resten skickas till er.' : fromCar ? 'Varorna har lämnats på plats.' : 'Varorna skickas till er. Du får besked när de har skickats.'}</p>
        ${seller ? `<p style="margin:12px 0 0;color:#555">Frågor? Kontakta ${esc(seller.full_name)}, <a href="mailto:${esc(seller.email)}">${esc(seller.email)}</a>.</p>` : ''}
        <p style="margin:24px 0 0;color:#888;font-size:12px">ProLuxShine · <a href="${SITE_URL}" style="color:#888">${SITE_URL.replace(/^https?:\/\//, '')}</a></p>
      </div>
    </div>`

  let ok = false, error = ''
  try { ok = await sendEmail([c.email], `Orderbekräftelse #${order.order_nr} – ProLuxShine`, html, config) }
  catch (e) { error = e instanceof Error ? e.message : String(e) }
  await sb.from('integration_log').insert({ order_id: orderId, type: 'order-confirmation', status: ok ? 'success' : 'error', payload: { to: c.email }, response: error ? { error } : null }).then(() => null, () => null)
  if (!ok) return json({ error: error || 'e-postleverantören tog inte emot mejlet' }, 502)
  return json({ sent: true, to: c.email })
})
