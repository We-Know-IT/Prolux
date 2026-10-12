// Run: deno test supabase/functions/visma/lib.test.ts
// Exercises lib.ts against a fake Visma API (shapes from the v2 OpenAPI spec).
import { assertEquals, assertRejects, assert } from 'jsr:@std/assert@1'
import { Visma, type Repo, type Connection } from './lib.ts'

function setup(opts: { includesVat?: boolean; mode?: 'draft' | 'invoice'; customer?: Record<string, unknown> } = {}) {
  const calls: { method: string; path: string; body: any }[] = []
  const state = {
    conn: { access_token: 'a1', refresh_token: 'r1', expires_at: new Date(Date.now() - 1000).toISOString(),
            settings: { terms_of_payment_id: 'T30', unit_id: 'U1', coding_id: 'C25', invoice_mode: opts.mode ?? 'draft' } } as Connection,
    orders: { o1: { id: 'o1', order_nr: 7, status: 'confirmed', customer_id: 'c1', subtotal: 900, vat_amount: 225, total: 1125,
                    delivery_name: 'Bilvård AB', delivery_address: 'Gatan 1', delivery_city: 'Malmö', notes: 'Postnummer: 211 22',
                    assigned_to: 'Bashar', created_at: '2026-10-01T10:00:00Z', visma_invoice_id: null, visma_draft_id: null, visma_status: null } } as Record<string, any>,
    items: [{ product_id: 'p1', product_name: 'RAPIDET', product_sku: 'FRE-RAP-5L', qty: 2, unit_price: 300 },
            { product_id: 'p2', product_name: 'SETA', product_sku: null, qty: 1, unit_price: 400 }],
    customers: { c1: { id: 'c1', company: 'Bilvård AB', contact_name: 'Anna', email: 'anna@bilvard.se', phone: null, org_nr: '556677-8899',
                       address: null, postal_code: null, city: 'Malmö', customer_type: 'business', visma_customer_id: null, ...opts.customer } } as Record<string, any>,
    products: { p1: { id: 'p1', name: 'RAPIDET', sku: 'FRE-RAP-5L', list_price: 500, visma_article_id: null },
                p2: { id: 'p2', name: 'SETA', sku: null, list_price: 400, visma_article_id: 'ART-EXISTING' } } as Record<string, any>,
    logs: [] as any[],
  }
  const repo: Repo = {
    getConnection: async () => state.conn,
    saveConnection: async p => { state.conn = { ...state.conn, ...p } as Connection },
    getOrder: async id => state.orders[id] ? { order: state.orders[id], items: state.items } : null,
    updateOrder: async (id, p) => { Object.assign(state.orders[id], p) },
    getCustomer: async id => state.customers[id] ?? null,
    updateCustomer: async (id, p) => { Object.assign(state.customers[id], p) },
    getProducts: async ids => ids.map(i => state.products[i]).filter(Boolean),
    updateProduct: async (id, p) => { Object.assign(state.products[id], p) },
    openOrders: async () => Object.values(state.orders).filter(o => ['draft', 'invoiced'].includes(o.visma_status)),
    log: async (order_id, status, payload, response) => { state.logs.push({ order_id, status, payload, response }) },
  }
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(input)); const method = init?.method ?? 'GET'
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : init?.body
    const path = u.pathname.replace('/v2', '') + (u.search ? decodeURIComponent(u.search) : '')
    calls.push({ method, path, body })
    const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s })
    if (u.pathname === '/connect/token') {
      assertEquals((init?.headers as any).Authorization, `Basic ${btoa('cid:secret')}`)
      return ok({ access_token: 'a2', refresh_token: 'r2', expires_in: 3600 })
    }
    if (u.pathname === '/v2/customers' && method === 'GET') return ok({ Meta: { TotalNumberOfPages: 1 }, Data: [] })
    if (u.pathname === '/v2/customers' && method === 'POST') return ok({ ...body, Id: 'VC1' }, 201)
    if (u.pathname === '/v2/articles' && method === 'GET') return ok({ Meta: { TotalNumberOfPages: 1 }, Data: [] })
    if (u.pathname === '/v2/articles' && method === 'POST') return ok({ ...body, Id: 'VA-' + body.Number }, 201)
    if (u.pathname === '/v2/customerinvoicedrafts' && method === 'POST') {
      const total = body.Rows.reduce((s: number, r: any) => s + r.Quantity * r.UnitPrice * (1 - (r.DiscountPercentage ?? 0) / 100), 0)
      return ok({ ...body, Id: 'D1', IncludesVat: !!opts.includesVat, TotalAmount: Math.round(total * 1.25) }, 201)
    }
    if (u.pathname === '/v2/customerinvoicedrafts/D1' && method === 'PUT') return ok({ ...body })
    if (u.pathname === '/v2/customerinvoicedrafts/D1/convert') return ok({ Id: 'INV1', InvoiceNumber: 1001, TotalAmount: 1125 }, 201)
    if (u.pathname === '/v2/customerinvoices') return ok({ Meta: { TotalNumberOfPages: 1 }, Data: [
      { Id: 'INV9', CreatedFromDraftId: 'D1', InvoiceNumber: 1009, PaymentStatus: 0, RemainingAmount: 0, TotalAmount: 1125, PaymentDate: '2026-10-10' }] })
    return ok({ ErrorCode: 4000, DeveloperErrorMessage: `unexpected ${method} ${u.pathname}` }, 400)
  }) as typeof fetch
  const cfg = { clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://x/functions/v1/visma', scopes: 'ea:api offline_access',
                identityUrl: 'https://id.test', apiUrl: 'https://api.test/v2' }
  return { visma: new Visma(cfg, repo, fakeFetch), state, calls }
}

Deno.test('order → customer, articles and invoice draft', async () => {
  const { visma, state, calls } = setup()
  const r = await visma.syncOrder('o1')
  assertEquals(r.draft_id, 'D1')
  // expired token was refreshed and the rotated refresh token stored
  assertEquals(state.conn.refresh_token, 'r2')
  // customer created with postal code from the order, saved back on the card
  const cust = calls.find(c => c.path === '/customers' && c.method === 'POST')!.body
  assertEquals([cust.Name, cust.InvoicePostalCode, cust.InvoiceCity, cust.IsPrivatePerson, cust.TermsOfPaymentId, cust.CorporateIdentityNumber],
               ['Bilvård AB', '21122', 'Malmö', false, 'T30', '556677-8899'])
  assertEquals(state.customers.c1.visma_customer_id, 'VC1')
  assertEquals(state.customers.c1.postal_code, '21122')
  // only the article without a Visma id is created
  const arts = calls.filter(c => c.path === '/articles' && c.method === 'POST')
  assertEquals(arts.length, 1)
  assertEquals([arts[0].body.Number, arts[0].body.NetPrice, arts[0].body.UnitId, arts[0].body.CodingId], ['FRE-RAP-5L', 500, 'U1', 'C25'])
  assertEquals(state.products.p1.visma_article_id, 'VA-FRE-RAP-5L')
  // draft rows use the order's prices; the campaign discount (1000 → 900) as 10 %
  const draft = calls.find(c => c.path === '/customerinvoicedrafts' && c.method === 'POST')!.body
  assertEquals(draft.Rows.map((x: any) => [x.ArticleId, x.Quantity, x.UnitPrice, x.DiscountPercentage]),
               [['VA-FRE-RAP-5L', 2, 300, 10], ['ART-EXISTING', 1, 400, 10]])
  assertEquals(draft.BuyersOrderReference, 'Order #7')
  assertEquals([state.orders.o1.visma_status, state.orders.o1.visma_draft_id], ['draft', 'D1'])
  assertEquals(state.logs[0].status, 'success')
  assertEquals(state.logs[0].response.warning, null)
  // running again does nothing
  const again = await visma.syncOrder('o1')
  assertEquals(again.already, true)
  assertEquals(calls.filter(c => c.path === '/customerinvoicedrafts' && c.method === 'POST').length, 1)
})

Deno.test('invoice mode books the invoice', async () => {
  const { visma, state } = setup({ mode: 'invoice' })
  const r = await visma.syncOrder('o1')
  assertEquals([r.invoice_id, r.invoice_number], ['INV1', 1001])
  assertEquals([state.orders.o1.visma_status, state.orders.o1.visma_invoice_number], ['invoiced', '1001'])
})

Deno.test('prices incl. VAT when the draft says so', async () => {
  const { visma, calls } = setup({ includesVat: true, customer: { customer_type: 'private', org_nr: null } })
  await visma.syncOrder('o1')
  const put = calls.find(c => c.method === 'PUT')!.body
  assertEquals(put.Rows.map((x: any) => x.UnitPrice), [375, 500])
  assertEquals(calls.find(c => c.path === '/customers' && c.method === 'POST')!.body.CorporateIdentityNumber, undefined)
})

Deno.test('missing postal code → clear error stored on the order', async () => {
  const { visma, state } = setup()
  state.orders.o1.notes = null
  await assertRejects(() => visma.syncOrder('o1'), Error, 'saknar postnummer')
  assertEquals(state.orders.o1.visma_status, 'error')
  assert(state.orders.o1.visma_error.includes('postnummer'))
})

Deno.test('auto mode skips drafts, quotes and switched-off setting', async () => {
  const { visma, state } = setup()
  state.orders.o1.status = 'quote'
  assertEquals((await visma.syncOrder('o1', { auto: true })).skipped, 'Ordern är inte lagd ännu')
  state.orders.o1.status = 'confirmed'
  state.conn.settings.auto_on_confirm = false
  assertEquals((await visma.syncOrder('o1', { auto: true })).skipped, 'Automatisk fakturering är avstängd')
})

Deno.test('payment sync finds the invoice made from the draft and marks it paid', async () => {
  const { visma, state } = setup()
  await visma.syncOrder('o1')
  const r = await visma.syncPayments()
  assertEquals(r, { checked: 1, invoiced: 1, paid: 1 })
  assertEquals([state.orders.o1.visma_invoice_id, state.orders.o1.visma_invoice_number, state.orders.o1.visma_status], ['INV9', '1009', 'paid'])
  assert(state.conn.last_payment_sync)
})

Deno.test('authorize URL', () => {
  const { visma } = setup()
  const u = new URL(visma.authorizeUrl('st'))
  assertEquals([u.origin + u.pathname, u.searchParams.get('client_id'), u.searchParams.get('state'), u.searchParams.get('response_type')],
               ['https://id.test/connect/authorize', 'cid', 'st', 'code'])
})
