// GENERATED from supabase/functions/visma/index.ts + lib.ts — one file to paste into
// Supabase → Edge Functions → visma → index.ts (dashboard editor). Edit the source files, not this.

import { createClient } from 'jsr:@supabase/supabase-js@2'

// ── Visma logic (same as lib.ts) ───────────────────────────────────────────
// Visma Spiris (eEkonomi) API v2 — the logic behind the "visma" Edge Function.
// Kept free of Supabase specifics (see Repo) so it can be tested on its own.
// API reference: https://eaccountingapi.vismaonline.com/scalar/v2

export interface VismaSettings {
  terms_of_payment_id?: string
  unit_id?: string
  coding_id?: string
  invoice_mode?: 'draft' | 'invoice'   // draft: review and send in Visma; invoice: book directly
  auto_on_confirm?: boolean
}

export interface Connection {
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  company_name?: string | null
  settings: VismaSettings
  last_payment_sync?: string | null
}

export interface OrderRow {
  id: string
  order_nr: number
  status: string
  customer_id: string | null
  subtotal: number
  vat_amount: number | null
  total: number | null
  delivery_name: string | null
  delivery_address: string | null
  delivery_city: string | null
  notes: string | null
  assigned_to: string | null
  created_at: string
  visma_invoice_id: string | null
  visma_draft_id: string | null
  visma_status: string | null
}
export interface OrderItemRow {
  product_id: string | null
  product_name: string
  product_sku: string | null
  qty: number
  unit_price: number
}
export interface CustomerRow {
  id: string
  company: string
  contact_name: string | null
  email: string | null
  phone: string | null
  org_nr: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  customer_type: string | null
  visma_customer_id: string | null
}
export interface ProductRow {
  id: string
  name: string
  sku: string | null
  list_price: number
  visma_article_id: string | null
}

// Database access, implemented with Supabase in index.ts and in memory in tests.
export interface Repo {
  getConnection(): Promise<Connection | null>
  saveConnection(patch: Partial<Connection> & Record<string, unknown>): Promise<void>
  getOrder(id: string): Promise<{ order: OrderRow; items: OrderItemRow[] } | null>
  updateOrder(id: string, patch: Record<string, unknown>): Promise<void>
  getCustomer(id: string): Promise<CustomerRow | null>
  updateCustomer(id: string, patch: Record<string, unknown>): Promise<void>
  getProducts(ids: string[]): Promise<ProductRow[]>
  updateProduct(id: string, patch: Record<string, unknown>): Promise<void>
  openOrders(): Promise<OrderRow[]>                 // visma_status draft | invoiced
  log(orderId: string | null, status: 'success' | 'error', payload: unknown, response: unknown): Promise<void>
}

export interface Config {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string
  identityUrl: string    // https://identity.vismaonline.com
  apiUrl: string         // https://eaccountingapi.vismaonline.com/v2
}

export function configFromEnv(env: (k: string) => string | undefined): Config {
  // Visma's sandbox is a test company on the normal Visma servers; it is the
  // sandbox client id/secret that make the difference, not the hosts.
  return {
    clientId: env('VISMA_CLIENT_ID') || '',
    clientSecret: env('VISMA_CLIENT_SECRET') || '',
    redirectUri: env('VISMA_REDIRECT_URI') || `${env('SUPABASE_URL')}/functions/v1/visma`,
    scopes: env('VISMA_SCOPES') || 'ea:api ea:sales ea:accounting offline_access',   // as granted by Visma
    identityUrl: env('VISMA_IDENTITY_URL') || 'https://identity.vismaonline.com',
    apiUrl: env('VISMA_API_URL') || 'https://eaccountingapi.vismaonline.com/v2',
  }
}

export class VismaError extends Error {
  constructor(message: string, public status = 0, public details: unknown = null) { super(message) }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const cut = (s: string | null | undefined, n: number) => (s ?? '').trim().slice(0, n) || undefined
const round2 = (n: number) => Math.round(n * 100) / 100
const odata = (s: string) => s.replace(/'/g, "''")

export class Visma {
  constructor(private cfg: Config, private repo: Repo, private fetchFn: typeof fetch = fetch) {}

  // ── OAuth ────────────────────────────────────────────────────────────────
  authorizeUrl(state: string): string {
    const q = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: this.cfg.redirectUri,
      scope: this.cfg.scopes,
      state,
      response_type: 'code',
      prompt: 'select_account',
    })
    return `${this.cfg.identityUrl}/connect/authorize?${q}`
  }

  private async tokenRequest(params: Record<string, string>) {
    const res = await this.fetchFn(`${this.cfg.identityUrl}/connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${this.cfg.clientId}:${this.cfg.clientSecret}`)}`,
      },
      body: new URLSearchParams(params),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.access_token) {
      throw new VismaError(`Visma-inloggningen misslyckades: ${json.error_description || json.error || res.status}`, res.status, json)
    }
    return json as { access_token: string; refresh_token?: string; expires_in: number }
  }

  async exchangeCode(code: string) {
    const t = await this.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: this.cfg.redirectUri })
    await this.repo.saveConnection({
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? null,
      expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    })
  }

  private async accessToken(force = false): Promise<string> {
    const c = await this.repo.getConnection()
    if (!c?.refresh_token) throw new VismaError('Visma är inte anslutet. Anslut under Admin → Integrationer.')
    const valid = c.access_token && c.expires_at && new Date(c.expires_at).getTime() - Date.now() > 60_000
    if (valid && !force) return c.access_token!
    const t = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: c.refresh_token })
    await this.repo.saveConnection({
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? c.refresh_token,   // Visma rotates refresh tokens
      expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    })
    return t.access_token
  }

  // ── API ──────────────────────────────────────────────────────────────────
  async api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    let token = await this.accessToken()
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await this.fetchFn(`${this.cfg.apiUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (res.status === 401 && attempt === 0) { token = await this.accessToken(true); continue }
      if (res.status === 429 || res.status === 503) { await sleep(1000 * (attempt + 1)); continue }
      const text = await res.text()
      const json = text ? (() => { try { return JSON.parse(text) } catch { return text } })() : null
      if (!res.ok) {
        const fieldErrors = Array.isArray(json?.Errors) ? json.Errors.map((e: any) => `${e.Field ?? ''} ${e.Message ?? ''}`.trim()).join('; ') : ''
        const msg = json?.DeveloperErrorMessage || json?.Message || (typeof json === 'string' ? json : '') || `HTTP ${res.status}`
        throw new VismaError(`Visma: ${msg}${fieldErrors ? ` (${fieldErrors})` : ''}`, res.status, json)
      }
      return json as T
    }
    throw new VismaError('Visma svarar inte just nu (för många anrop). Försök igen om en stund.', 429)
  }

  async list<T = any>(path: string, filter?: string): Promise<T[]> {
    const out: T[] = []
    for (let page = 1; page <= 50; page++) {
      const q = new URLSearchParams({ $page: String(page), $pagesize: '200' })
      if (filter) q.set('$filter', filter)
      const r = await this.api<{ Data: T[]; Meta?: { TotalNumberOfPages?: number } }>('GET', `${path}${path.includes('?') ? '&' : '?'}${q}`)
      out.push(...(r?.Data ?? []))
      if (!r?.Meta?.TotalNumberOfPages || page >= r.Meta.TotalNumberOfPages) break
    }
    return out
  }

  // Lists the admin picks settings from, plus the company name.
  async lookups() {
    const [terms, units, codings, company] = await Promise.all([
      this.list<any>('/termsofpayments'),
      this.list<any>('/units'),
      this.list<any>('/articleaccountcodings'),
      this.api<any>('GET', '/companysettings').catch(() => null),
    ])
    if (company?.Name) await this.repo.saveConnection({ company_name: company.Name })
    return {
      company_name: company?.Name ?? null,
      terms: terms.filter(t => t.AvailableForSales !== false).map(t => ({ id: t.Id, name: t.Name, days: t.NumberOfDays })),
      units: units.map(u => ({ id: u.Id, name: u.Name, abbreviation: u.Abbreviation })),
      codings: codings.filter(c => c.IsActive !== false).map(c => ({ id: c.Id, name: c.Name, type: c.Type, vat: c.VatRatePercent ?? c.VatRate })),
    }
  }

  // ── Customer ─────────────────────────────────────────────────────────────
  private async ensureCustomer(c: CustomerRow, order: OrderRow, s: VismaSettings): Promise<string> {
    if (c.visma_customer_id) return c.visma_customer_id

    // Reuse a customer that already exists in Visma (same org.nr or e-mail).
    const filters = [
      c.org_nr && `CorporateIdentityNumber eq '${odata(c.org_nr.trim())}'`,
      c.email && `EmailAddress eq '${odata(c.email.trim())}'`,
    ].filter(Boolean) as string[]
    for (const f of filters) {
      const found = await this.list<any>('/customers', f).catch(() => [])
      if (found[0]?.Id) { await this.repo.updateCustomer(c.id, { visma_customer_id: found[0].Id }); return found[0].Id }
    }

    // Address: from the customer card, else from this order.
    const zipFromNotes = order.notes?.match(/Postnummer:\s*([0-9 ]{5,6})/)?.[1]
    const postal = (c.postal_code || zipFromNotes || '').replace(/\s/g, '')
    const city = c.city || order.delivery_city
    if (!postal || !city) throw new VismaError(`Kunden ${c.company} saknar postnummer eller ort, som Visma kräver. Fyll i dem på kundkortet och försök igen.`)
    if (!s.terms_of_payment_id) throw new VismaError('Välj betalningsvillkor under Admin → Integrationer → Visma.')

    const created = await this.api<any>('POST', '/customers', {
      Name: cut(c.company, 50),
      IsPrivatePerson: c.customer_type === 'private',
      IsActive: true,
      CorporateIdentityNumber: c.customer_type === 'private' ? undefined : cut(c.org_nr, 20),
      EmailAddress: cut(c.email, 255),
      ContactPersonName: cut(c.contact_name, 100),
      ContactPersonEmail: cut(c.email, 255),
      Telephone: cut(c.phone, 50),
      InvoiceAddress1: cut(c.address || order.delivery_address, 50),
      InvoicePostalCode: postal.slice(0, 10),
      InvoiceCity: cut(city, 50),
      InvoiceCountryCode: 'SE',
      TermsOfPaymentId: s.terms_of_payment_id,
    })
    await this.repo.updateCustomer(c.id, {
      visma_customer_id: created.Id,
      ...(c.postal_code ? {} : { postal_code: postal }),
      ...(c.address || !order.delivery_address ? {} : { address: order.delivery_address }),
    })
    return created.Id
  }

  // ── Articles ─────────────────────────────────────────────────────────────
  // VAT rate (0.25) of an account coding; Visma checks GrossPrice against it.
  private vatCache = new Map<string, number>()
  private async vatRate(codingId: string): Promise<number> {
    if (this.vatCache.has(codingId)) return this.vatCache.get(codingId)!
    const c = await this.api<any>('GET', `/articleaccountcodings/${codingId}`).catch(() => null)
    const raw = c?.VatRatePercent ?? c?.VatRate
    const rate = typeof raw === 'number' ? (raw > 1 ? raw / 100 : raw) : 0.25
    this.vatCache.set(codingId, rate)
    return rate
  }

  private async ensureArticle(p: ProductRow | null, item: OrderItemRow, s: VismaSettings): Promise<string> {
    if (p?.visma_article_id) return p.visma_article_id
    const number = cut(p?.sku || item.product_sku || `PLS-${(p?.id || item.product_id || item.product_name).replace(/[^A-Za-z0-9]/g, '').slice(0, 10)}`, 40)!
    const found = await this.list<any>('/articles', `Number eq '${odata(number)}'`).catch(() => [])
    let id: string | undefined = found[0]?.Id
    if (!id) {
      if (!s.unit_id || !s.coding_id) throw new VismaError('Välj enhet och bokföringskonto för artiklar under Admin → Integrationer → Visma.')
      const net = round2(p?.list_price ?? item.unit_price)
      const vat = await this.vatRate(s.coding_id)
      const created = await this.api<any>('POST', '/articles', {
        Number: number,
        Name: cut(p?.name || item.product_name, 50),
        IsActive: true,
        NetPrice: net,
        GrossPrice: round2(net * (1 + vat)),
        UnitId: s.unit_id,
        CodingId: s.coding_id,
      })
      id = created.Id as string
    }
    if (p) await this.repo.updateProduct(p.id, { visma_article_id: id })
    return id
  }

  // Keep an article's price in Visma in step with the webshop list price.
  async syncArticlePrice(p: ProductRow) {
    if (!p.visma_article_id) return
    const a = await this.api<any>('GET', `/articles/${p.visma_article_id}`)
    if (round2(a.NetPrice) === round2(p.list_price) && a.Name === cut(p.name, 50)) return
    const vat = a.CodingId ? await this.vatRate(a.CodingId) : 0.25
    await this.api('PUT', `/articles/${p.visma_article_id}`, { ...a, NetPrice: round2(p.list_price), GrossPrice: round2(p.list_price * (1 + vat)), Name: cut(p.name, 50) })
  }

  // ── Invoice for an order ─────────────────────────────────────────────────
  async syncOrder(orderId: string, opts: { auto?: boolean } = {}) {
    const conn = await this.repo.getConnection()
    if (!conn?.refresh_token) {
      if (opts.auto) return { skipped: 'Visma är inte anslutet' }
      throw new VismaError('Visma är inte anslutet. Anslut under Admin → Integrationer.')
    }
    const s = conn.settings || {}
    if (opts.auto && s.auto_on_confirm === false) return { skipped: 'Automatisk fakturering är avstängd' }

    const data = await this.repo.getOrder(orderId)
    if (!data) throw new VismaError('Ordern hittades inte.')
    const { order, items } = data
    if (order.visma_draft_id || order.visma_invoice_id) {
      return { already: true, draft_id: order.visma_draft_id, invoice_id: order.visma_invoice_id }
    }
    if (['draft', 'quote', 'cancelled'].includes(order.status)) {
      if (opts.auto) return { skipped: 'Ordern är inte lagd ännu' }
      throw new VismaError('Utkast, offerter och avbrutna ordrar faktureras inte.')
    }
    if (!order.customer_id) throw new VismaError('Ordern saknar kund. Koppla ordern till en kund först.')
    if (items.length === 0) throw new VismaError('Ordern har inga rader.')

    try {
      const customer = await this.repo.getCustomer(order.customer_id)
      if (!customer) throw new VismaError('Kunden hittades inte.')
      const customerId = await this.ensureCustomer(customer, order, s)

      const products = await this.repo.getProducts(items.map(i => i.product_id).filter(Boolean) as string[])
      const byId = new Map(products.map(p => [p.id, p]))
      const rows: any[] = []
      for (const it of items) {
        const articleId = await this.ensureArticle(it.product_id ? byId.get(it.product_id) ?? null : null, it, s)
        rows.push({ ArticleId: articleId, Quantity: it.qty, UnitPrice: round2(Number(it.unit_price)), Text: cut(it.product_name, 255), IsTextRow: false, ReversedConstructionServicesVatFree: false })
      }

      // A campaign discount is spread over the rows as a percentage.
      const linesTotal = items.reduce((sum, i) => sum + i.qty * Number(i.unit_price), 0)
      const discountPct = linesTotal > 0 && order.subtotal < linesTotal ? round2((1 - order.subtotal / linesTotal) * 100 * 100) / 100 : 0
      if (discountPct > 0) for (const r of rows) r.DiscountPercentage = discountPct

      const draftBody: any = {
        CustomerId: customerId,
        RotReducedInvoicingType: 0,
        EuThirdParty: false,
        Rows: rows,
        YourReference: cut(customer.contact_name, 100),
        OurReference: cut(order.assigned_to, 100),
        BuyersOrderReference: `Order #${order.order_nr}`,
      }
      let draft = await this.api<any>('POST', '/customerinvoicedrafts', draftBody)

      // Private customers may be invoiced with prices incl. VAT (company setting).
      if (draft.IncludesVat) {
        draftBody.Rows = rows.map(r => ({ ...r, UnitPrice: round2(r.UnitPrice * 1.25) }))
        draft = await this.api<any>('PUT', `/customerinvoicedrafts/${draft.Id}`, { ...draft, Rows: draftBody.Rows })
      }

      const patch: Record<string, unknown> = { visma_draft_id: draft.Id, visma_status: 'draft', visma_error: null, visma_synced_at: new Date().toISOString() }
      let invoice: any = null
      if (s.invoice_mode === 'invoice') {
        invoice = await this.api<any>('POST', `/customerinvoicedrafts/${draft.Id}/convert`)
        Object.assign(patch, { visma_invoice_id: invoice.Id, visma_invoice_number: invoice.InvoiceNumber != null ? String(invoice.InvoiceNumber) : null, visma_status: 'invoiced' })
      }
      await this.repo.updateOrder(order.id, patch)

      // Totals check: the order was priced by our database.
      const vismaTotal = invoice?.TotalAmount ?? draft.TotalAmount ?? null
      const warning = vismaTotal != null && order.total != null && Math.abs(vismaTotal - order.total) > 1
        ? `Totalbeloppet i Visma (${vismaTotal} kr) skiljer sig från ordern (${order.total} kr). Kontrollera fakturan.` : null
      await this.repo.log(order.id, 'success', { order_nr: order.order_nr, mode: s.invoice_mode || 'draft' }, { draft_id: draft.Id, invoice_id: invoice?.Id ?? null, invoice_number: invoice?.InvoiceNumber ?? null, warning })
      return { draft_id: draft.Id, invoice_id: invoice?.Id ?? null, invoice_number: invoice?.InvoiceNumber ?? null, warning }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await this.repo.updateOrder(order.id, { visma_status: 'error', visma_error: msg.slice(0, 500), visma_synced_at: new Date().toISOString() })
      await this.repo.log(order.id, 'error', { order_nr: order.order_nr }, { error: msg, details: e instanceof VismaError ? e.details : null })
      throw e
    }
  }

  // ── Payment status ───────────────────────────────────────────────────────
  // Finds invoices for our drafts (also those converted by hand in Visma) and
  // marks orders paid when Visma says so.
  async syncPayments() {
    const conn = await this.repo.getConnection()
    if (!conn?.refresh_token) throw new VismaError('Visma är inte anslutet.')
    const open = await this.repo.openOrders()
    if (open.length === 0) { await this.repo.saveConnection({ last_payment_sync: new Date().toISOString() }); return { checked: 0, invoiced: 0, paid: 0 } }

    const oldest = open.reduce((m, o) => (o.created_at < m ? o.created_at : m), open[0].created_at)
    const since = new Date(new Date(oldest).getTime() - 86_400_000).toISOString()
    const invoices = await this.list<any>(`/customerinvoices?modifiedSinceUtc=${encodeURIComponent(since)}`)
    const byDraft = new Map(invoices.filter(i => i.CreatedFromDraftId).map(i => [i.CreatedFromDraftId, i]))
    const byId = new Map(invoices.map(i => [i.Id, i]))

    let invoiced = 0, paid = 0
    for (const o of open) {
      const inv = (o.visma_invoice_id && byId.get(o.visma_invoice_id)) || (o.visma_draft_id && byDraft.get(o.visma_draft_id))
      if (!inv) continue
      const patch: Record<string, unknown> = { visma_synced_at: new Date().toISOString() }
      if (!o.visma_invoice_id) {
        Object.assign(patch, { visma_invoice_id: inv.Id, visma_invoice_number: inv.InvoiceNumber != null ? String(inv.InvoiceNumber) : null, visma_status: 'invoiced' })
        invoiced++
      }
      const isPaid = inv.PaymentStatus === 0 || (typeof inv.RemainingAmount === 'number' && inv.RemainingAmount <= 0 && inv.TotalAmount > 0)
      if (isPaid) { Object.assign(patch, { visma_status: 'paid', paid_at: inv.PaymentDate || new Date().toISOString() }); paid++ }
      await this.repo.updateOrder(o.id, patch)
    }
    await this.repo.saveConnection({ last_payment_sync: new Date().toISOString() })
    return { checked: open.length, invoiced, paid }
  }
}

// ── Edge Function ───────────────────────────────────────────────────────────
// Visma Spiris integration. Deploy: Supabase → Edge Functions → new function
// "visma" with this single index.ts, and turn OFF "Verify JWT" (Visma's
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