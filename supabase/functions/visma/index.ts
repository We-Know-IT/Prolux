import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { configFromEnv, Visma, VismaError, type Repo } from './lib.ts'

// Visma Spiris integration. Deploy: Supabase → Edge Functions → new function
// "visma" with index.ts and lib.ts, and turn OFF "Verify JWT" (Visma's
// redirect back after login carries no Supabase token; every other call is
// checked below).
//
// Secrets (Edge Functions → Secrets):
//   VISMA_CLIENT_ID, VISMA_CLIENT_SECRET   from ProLuxShine's app at Visma Developer
//   APP_URL        where to return after connecting (default https://crm.proluxshine.com)
//   CRON_SECRET    optional: lets a scheduled job run the payment check
//   (Sandbox vs live is decided by which client id/secret you put here.)
//   VISMA_REDIRECT_URI  default <SUPABASE_URL>/functions/v1/visma — must be registered at Visma
//   VISMA_IDENTITY_URL / VISMA_API_URL  override the Visma hosts if Visma's docs give others
//
// Calls (POST, JSON { action, ... }, Authorization: Bearer <user token>):
//   status | connect | disconnect | save-settings      admin
//   lookups | sync-order {order_id, auto} | sync-payments   staff
// GET ?code=…&state=…  is Visma's redirect after login.

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cfg = configFromEnv(k => Deno.env.get(k))
const APP_URL = Deno.env.get('APP_URL') || 'https://crm.proluxshine.com'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const repo: Repo = {
  async getConnection() {
    const { data } = await sb.from('visma_connection').select('*').eq('id', 1).maybeSingle()
    return data
  },
  async saveConnection(patch) {
    const { error } = await sb.from('visma_connection').upsert({ id: 1, ...patch, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
  },
  async getOrder(id) {
    const { data: order } = await sb.from('orders').select('*').eq('id', id).maybeSingle()
    if (!order) return null
    const { data: items } = await sb.from('order_items').select('product_id,product_name,product_sku,qty,unit_price').eq('order_id', id)
    return { order, items: items ?? [] }
  },
  async updateOrder(id, patch) { await sb.from('orders').update(patch).eq('id', id) },
  async getCustomer(id) {
    const { data } = await sb.from('customers').select('*').eq('id', id).maybeSingle()
    return data
  },
  async updateCustomer(id, patch) { await sb.from('customers').update(patch).eq('id', id) },
  async getProducts(ids) {
    if (ids.length === 0) return []
    const { data } = await sb.from('products').select('id,name,sku,list_price,visma_article_id').in('id', ids)
    return data ?? []
  },
  async updateProduct(id, patch) { await sb.from('products').update(patch).eq('id', id) },
  async openOrders() {
    const { data } = await sb.from('orders').select('*').in('visma_status', ['draft', 'invoiced']).limit(500)
    return data ?? []
  },
  async log(orderId, status, payload, response) {
    await sb.from('integration_log').insert({ order_id: orderId, type: 'visma', status, payload, response })
  },
}
const visma = new Visma(cfg, repo)

async function caller(req: Request): Promise<{ role: string; name: string } | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await sb.auth.getUser(token)
  const role = data.user?.app_metadata?.role
  if (role !== 'admin' && role !== 'crm') return null
  return { role, name: data.user?.user_metadata?.full_name || data.user?.email || '' }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)

  // ── Visma's redirect back after login ──
  if (req.method === 'GET') {
    const back = (q: string) => Response.redirect(`${APP_URL}/admin/integrations?${q}`, 302)
    const code = url.searchParams.get('code'), state = url.searchParams.get('state')
    if (url.searchParams.get('error')) return back(`visma=error&message=${encodeURIComponent(url.searchParams.get('error_description') || url.searchParams.get('error')!)}`)
    if (!code || !state) return back('visma=error&message=Saknar%20kod')
    const { data: conn } = await sb.from('visma_connection').select('oauth_state,oauth_state_expires,connected_by').eq('id', 1).maybeSingle()
    if (!conn?.oauth_state || conn.oauth_state !== state || new Date(conn.oauth_state_expires) < new Date()) {
      return back('visma=error&message=' + encodeURIComponent('Inloggningen gick ut. Försök igen.'))
    }
    try {
      await visma.exchangeCode(code)
      await repo.saveConnection({ oauth_state: null, oauth_state_expires: null, connected_at: new Date().toISOString() })
      await visma.lookups().catch(() => null)   // stores the company name
      return back('visma=connected')
    } catch (e) {
      return back('visma=error&message=' + encodeURIComponent(e instanceof Error ? e.message : String(e)))
    }
  }

  let body: any = {}
  try { body = await req.json() } catch { /* empty body */ }
  const action = body.action as string

  // Scheduled payment check (no user).
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (action === 'sync-payments' && cronSecret && req.headers.get('x-cron-secret') === cronSecret) {
    try { return json(await visma.syncPayments()) } catch (e) { return json({ error: (e as Error).message }, 400) }
  }

  const who = await caller(req)
  if (!who) return json({ error: 'Logga in som admin eller säljare.' }, 401)
  const adminOnly = ['connect', 'disconnect', 'save-settings']
  if (adminOnly.includes(action) && who.role !== 'admin') return json({ error: 'Endast administratörer kan ändra Visma-kopplingen.' }, 403)

  try {
    switch (action) {
      case 'connect': {
        if (!cfg.clientId || !cfg.clientSecret) return json({ error: 'VISMA_CLIENT_ID och VISMA_CLIENT_SECRET saknas bland Edge Function-hemligheterna.' }, 400)
        const state = crypto.randomUUID()
        await repo.saveConnection({ oauth_state: state, oauth_state_expires: new Date(Date.now() + 15 * 60_000).toISOString(), connected_by: who.name })
        return json({ url: visma.authorizeUrl(state) })
      }
      case 'disconnect': {
        const conn = await repo.getConnection()
        if (conn?.refresh_token) {
          await fetch(`${cfg.identityUrl}/connect/revocation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${cfg.clientId}:${cfg.clientSecret}`)}` },
            body: new URLSearchParams({ token: conn.refresh_token, token_type_hint: 'refresh_token' }),
          }).catch(() => null)
        }
        await repo.saveConnection({ access_token: null, refresh_token: null, expires_at: null, company_name: null, connected_at: null })
        return json({ ok: true })
      }
      case 'save-settings': {
        const conn = await repo.getConnection()
        const allowed = ['terms_of_payment_id', 'unit_id', 'coding_id', 'invoice_mode', 'auto_on_confirm']
        const next = { ...(conn?.settings ?? {}) } as Record<string, unknown>
        for (const k of allowed) if (k in (body.settings ?? {})) next[k] = body.settings[k]
        await repo.saveConnection({ settings: next })
        return json({ ok: true, settings: next })
      }
      case 'lookups':
        return json(await visma.lookups())
      case 'sync-order':
        if (!body.order_id) return json({ error: 'order_id saknas' }, 400)
        return json(await visma.syncOrder(String(body.order_id), { auto: !!body.auto }))
      case 'sync-payments':
        return json(await visma.syncPayments())
      default:
        return json({ error: `Okänd åtgärd: ${action}` }, 400)
    }
  } catch (e) {
    const status = e instanceof VismaError && e.status >= 400 && e.status < 500 ? 400 : 500
    return json({ error: e instanceof Error ? e.message : String(e) }, status)
  }
})
