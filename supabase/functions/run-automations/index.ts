import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Daily e-mail automations, configured in admin (Automationer).
// Deploy: Supabase → Edge Functions → run-automations → paste this file.
//
// Types (automations.type):
//   birthday   — on the contact person's birthday (customers.birthday)
//   inactivity — no order for trigger_days days (customers.last_order_at)
//   reorder    — trigger_days after a delivered order
// Placeholders in subject/body: {name}, {company}, {days}
//
// Each customer gets a given automation at most once per period (see
// alreadySent), so a daily run never repeats the same e-mail.

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const SITE_URL = 'https://www.proluxshine.com';

// ── EMAIL SENDER — byt ut provider-blocket när ProLuxShine valt leverantör ──
async function sendEmail(to: string, subject: string, body: string, config: any): Promise<boolean> {
  if (!config || config.provider === 'pending') {
    console.log(`[DEMO] Skulle skickat till ${to}: ${subject}`);
    return true; // Loggas men skickas inte
  }

  // OUTLOOK / MICROSOFT GRAPH
  if (config.provider === 'outlook') {
    try {
      const tokenRes = await fetch(`https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.client_id,
          client_secret: config.client_secret,
          scope: 'https://graph.microsoft.com/.default'
        })
      });
      const { access_token } = await tokenRes.json();
      const res = await fetch(`https://graph.microsoft.com/v1.0/users/${config.from_email}/sendMail`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'HTML', content: body },
            toRecipients: [{ emailAddress: { address: to } }],
            from: { emailAddress: { address: config.from_email, name: config.from_name } }
          }
        })
      });
      return res.ok;
    } catch (e) {
      console.error('Outlook error:', e);
      return false;
    }
  }

  // SENDGRID
  if (config.provider === 'sendgrid') {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: config.from_email, name: config.from_name },
          subject,
          content: [{ type: 'text/html', value: body }]
        })
      });
      return res.ok || res.status === 202;
    } catch (e) {
      console.error('SendGrid error:', e);
      return false;
    }
  }

  // GMAIL (OAuth2)
  if (config.provider === 'gmail') {
    console.log('[TODO] Gmail provider ej konfigurerad');
    return false;
  }

  return false;
}

// ── Helpers ─────────────────────────────────────────────────
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

function fill(template: string, vars: Record<string, string>, html: boolean) {
  let out = template || '';
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, html ? esc(v) : v);
  return out;
}

function emailHtml(bodyText: string, vars: Record<string, string>, button?: string) {
  const paragraphs = fill(esc(bodyText), vars, true).split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  const cta = button
    ? `<p><a href="${SITE_URL}" style="background:#C8A030;color:#000;padding:10px 20px;text-decoration:none;font-weight:bold;display:inline-block">${esc(button)}</a></p>`
    : '';
  return `${paragraphs}${cta}<br><p style="color:#8A6A10">Med vänliga hälsningar,<br><strong>ProLuxShine</strong></p>`;
}

// Was this automation sent to this customer within the last `days` days?
async function alreadySent(automationId: string, customerId: string, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { count } = await sb.from('integration_log')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'automation').eq('status', 'success')
    .eq('payload->>automation_id', automationId)
    .eq('payload->>customer_id', customerId)
    .gte('created_at', since);
  return (count ?? 0) > 0;
}

async function deliver(auto: any, config: any, c: any, vars: Record<string, string>, button?: string) {
  const subject = fill(auto.email_subject, vars, false);
  const ok = await sendEmail(c.email, subject, emailHtml(auto.email_body, vars, button), config);
  await sb.from('integration_log').insert({
    type: 'automation',
    status: ok ? 'success' : 'failed',
    payload: { automation: auto.type, automation_id: auto.id, customer_id: c.id, to: c.email },
    response: { sent: ok }
  });
  return ok;
}

// ── AUTOMATION: FÖDELSEDAG ──────────────────────────────────
async function runBirthday(auto: any, config: any) {
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const { data: customers } = await sb.from('customers')
    .select('id, email, contact_name, company, birthday')
    .eq('status', 'active').not('birthday', 'is', null);

  let sent = 0, failed = 0;
  for (const c of customers || []) {
    if (!c.email || String(c.birthday).slice(5, 10) !== mmdd) continue;
    if (await alreadySent(auto.id, c.id, 300)) continue;
    const vars = { name: c.contact_name || c.company || '', company: c.company || '', days: '' };
    if (await deliver(auto, config, c, vars)) sent++; else failed++;
  }
  return { sent, failed };
}

// ── AUTOMATION: INAKTIVITET ─────────────────────────────────
async function runInactivity(auto: any, config: any) {
  const days = auto.trigger_days || 60;
  const cutoff = new Date(Date.now() - days * 86400000);

  const { data: customers } = await sb.from('customers')
    .select('id, email, contact_name, company, last_order_at')
    .eq('status', 'active').not('last_order_at', 'is', null)
    .lt('last_order_at', cutoff.toISOString());

  let sent = 0, failed = 0;
  for (const c of customers || []) {
    if (!c.email) continue;
    // At most once per inactivity period, not every day.
    if (await alreadySent(auto.id, c.id, days)) continue;
    const daysSince = Math.floor((Date.now() - new Date(c.last_order_at).getTime()) / 86400000);
    const vars = { name: c.contact_name || c.company || '', company: c.company || '', days: String(daysSince) };
    if (await deliver(auto, config, c, vars, 'Beställ nu')) sent++; else failed++;
  }
  return { sent, failed };
}

// ── AUTOMATION: ÅTERKÖP ─────────────────────────────────────
async function runReorder(auto: any, config: any) {
  const days = auto.trigger_days || 30;
  const from = new Date(Date.now() - (days + 3) * 86400000);
  const to = new Date(Date.now() - days * 86400000);

  const { data: orders } = await sb.from('orders')
    .select('customer_id, customers(id, email, contact_name, company)')
    .gte('created_at', from.toISOString()).lte('created_at', to.toISOString())
    .eq('status', 'delivered');

  let sent = 0, failed = 0;
  const seen = new Set<string>();
  for (const o of orders || []) {
    const c = (o as any).customers;
    if (!c?.email || seen.has(c.id)) continue;
    seen.add(c.id);
    // The 3-day window overlaps daily runs: send once per order cycle.
    if (await alreadySent(auto.id, c.id, days)) continue;
    const vars = { name: c.contact_name || c.company || '', company: c.company || '', days: String(days) };
    if (await deliver(auto, config, c, vars, 'Se dina produkter')) sent++; else failed++;
  }
  return { sent, failed };
}

// ── MAIN ────────────────────────────────────────────────────
Deno.serve(async () => {
  const { data: config } = await sb.from('email_config').select('*').eq('id', 'default').maybeSingle();
  const { data: automations } = await sb.from('automations').select('*').eq('active', true);

  if (!automations?.length) {
    return new Response(JSON.stringify({ message: 'Inga aktiva automationer' }), { status: 200 });
  }

  const results: any[] = [];
  for (const auto of automations) {
    let result = { sent: 0, failed: 0 };
    try {
      if (auto.type === 'birthday')   result = await runBirthday(auto, config);
      if (auto.type === 'inactivity') result = await runInactivity(auto, config);
      if (auto.type === 'reorder')    result = await runReorder(auto, config);
    } catch (e) {
      console.error(`Automation ${auto.id} failed:`, e);
    }

    await sb.from('automation_runs').insert({
      automation_id: auto.id,
      automation_type: auto.type,
      emails_sent: result.sent,
      emails_failed: result.failed,
      status: 'completed',
      notes: !config || config.provider === 'pending' ? 'Demo-läge: ingen e-post skickad' : undefined
    });

    await sb.from('automations').update({
      last_run_at: new Date().toISOString(),
      run_count: (auto.run_count || 0) + 1,
    }).eq('id', auto.id);

    results.push({ type: auto.type, ...result });
  }

  return new Response(JSON.stringify({ status: 'ok', provider: config?.provider || 'pending', results }),
    { headers: { 'Content-Type': 'application/json' } });
});
