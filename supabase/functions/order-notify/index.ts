import { createClient } from 'jsr:@supabase/supabase-js@2'

// E-mail to the salesperson and the admins when a customer places an order in the webshop.
// Called by the database (migration 0020, trigger notify_new_order) with
// { order_id }. Deploy: Supabase → Edge Functions → new function "order-notify",
// paste this file, turn OFF "Verify JWT" (the database calls it without a login).
// Safe to call by anyone: it only mails staff about a real, new webshop order,
// and each order at most once (orders.notified_at).
// Sends with the e-mail settings in Admin → Automationer (email_config).

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const APP_URL = Deno.env.get('APP_URL') || 'https://crm.proluxshine.com'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
const kr = (n: number) => `${Math.round(n || 0).toLocaleString('sv-SE')} kr`

async function sendEmail(to: string[], subject: string, html: string, config: any): Promise<boolean> {
  if (!config || config.provider === 'pending') { console.log(`[ej konfigurerat] ${to.join(', ')}: ${subject}`); return false }
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
  console.log(`[okänd e-postleverantör ${config.provider}]`)
  return false
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'POST' }, 405)
  let body: any = {}
  try { body = await req.json() } catch { /* empty */ }
  const orderId = String(body.order_id ?? '')
  if (!orderId) return json({ error: 'order_id saknas' }, 400)

  const { data: order } = await sb.from('orders').select('*,customers(company,contact_name,email,phone)').eq('id', orderId).maybeSingle()
  if (!order) return json({ skipped: 'ingen order' })
  if (order.created_by || ['draft', 'quote', 'cancelled'].includes(order.status)) return json({ skipped: 'inte en webbshopsorder' })

  // Claim the order first so it is only ever mailed once.
  const { data: claimed } = await sb.from('orders').update({ notified_at: new Date().toISOString() })
    .eq('id', orderId).is('notified_at', null).select('id')
  if (!claimed?.length) return json({ skipped: 'redan skickad' })

  // The salesperson on the order and every admin (each address once).
  const { data: staff } = await sb.from('staff_members').select('email,full_name,role')
  const first = (n: string) => (n || '').trim().split(/\s+/)[0]
  const wanted = (staff ?? []).filter(s => s.email && (s.role === 'admin' || (order.assigned_to && first(s.full_name) === order.assigned_to)))
  const recipients = wanted.filter((s, i) => wanted.findIndex(x => x.email.toLowerCase() === s.email.toLowerCase()) === i)
  if (!recipients.length) return json({ skipped: 'ingen mottagare' })

  const { data: items } = await sb.from('order_items').select('product_name,qty,unit_price,total_price').eq('order_id', orderId)
  const { data: config } = await sb.from('email_config').select('*').eq('id', 'default').maybeSingle()
  const c = order.customers ?? {}
  const who = c.company || order.delivery_name || 'Kund'
  const link = recipients.every(r => r.role === 'admin') ? `${APP_URL}/admin/orders?order=${order.id}` : `${APP_URL}/crm/orders?view=history`
  const rows = (items ?? []).map(i => `<tr><td style="padding:6px 0">${esc(i.product_name)}</td><td style="padding:6px 12px;text-align:right">${i.qty} st</td><td style="padding:6px 0;text-align:right">${kr(i.total_price)}</td></tr>`).join('')
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:560px">
      <h2 style="margin:0 0 4px">Ny order #${order.order_nr} från ${esc(who)}</h2>
      <p style="margin:0 0 16px;color:#555">${esc([c.contact_name, c.email, c.phone].filter(Boolean).join(' · '))}</p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee">${rows}</table>
      <p style="margin:12px 0 0">Summa exkl. moms: <b>${kr(order.subtotal)}</b> · Totalt inkl. moms: <b>${kr(order.total)}</b></p>
      ${order.delivery_city ? `<p style="margin:6px 0 0;color:#555">Leverans: ${esc([order.delivery_address, order.delivery_city].filter(Boolean).join(', '))}</p>` : ''}
      <p style="margin:20px 0"><a href="${link}" style="background:#E8B84B;color:#111;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Öppna ordern</a></p>
      <p style="color:#888;font-size:12px">Skickat automatiskt av ProLuxShine när en kund lägger en order i webbshoppen.</p>
    </div>`
  const ok = await sendEmail(recipients.map(r => r.email), `Ny order #${order.order_nr} – ${who}`, html, config).catch(e => { console.error(e); return false })
  if (!ok) await sb.from('orders').update({ notified_at: null }).eq('id', orderId)   // try again on a later call
  await sb.from('integration_log').insert({ order_id: orderId, type: 'order-notify', status: ok ? 'success' : 'error', payload: { to: recipients.map(r => r.email) }, response: null }).then(() => null, () => null)
  return json({ sent: ok, to: recipients.map(r => r.email) })
})
