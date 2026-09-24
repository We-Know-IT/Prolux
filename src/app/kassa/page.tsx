'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PublicShell, useLoginModal, usePublicCart } from '@/components/layout/PublicShell'
import { fmt } from '@/lib/utils'
import { Package, Minus, Plus, Trash2, FileText, CheckCircle, ArrowLeft, Tag, X } from 'lucide-react'

// Matches the free-shipping promise on the site. The cost below it is not
// set yet, so it is shown as added on top.
const FREE_SHIPPING_FROM = 2000

interface Totals { subtotal: number; discount: number; vat: number; total: number }

const EMPTY_FORM = {
  company: '', org_nr: '', contact_name: '', email: '', phone: '',
  address: '', zip: '', city: '', reference: '', invoice_email: '', message: '',
  website: '',   // honeypot: hidden from people, bots fill it in and the order is rejected
}

const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }
const input: React.CSSProperties = { width: '100%', padding: '11px 13px', background: '#fff', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 8, color: '#111', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }

function CheckoutContent() {
  const cart = usePublicCart()
  const openLogin = useLoginModal()
  const [form, setForm]         = useState(EMPTY_FORM)
  const [code, setCode]         = useState('')          // applied campaign code
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')
  const [totals, setTotals]     = useState<Totals | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [placing, setPlacing]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState<(Totals & { order_nr: number; email: string }) | null>(null)
  const prefilled = useRef(false)

  // Fill in what we know about a logged-in customer, once.
  useEffect(() => {
    if (prefilled.current || (!cart.customer && !cart.authUser)) return
    const c = cart.customer || {}
    setForm(f => ({
      ...f,
      company:      f.company      || c.company || '',
      org_nr:       f.org_nr       || c.org_nr || '',
      contact_name: f.contact_name || c.contact_name || cart.authUser?.user_metadata?.full_name || '',
      email:        f.email        || c.email || cart.authUser?.email || '',
      phone:        f.phone        || c.phone || '',
      address:      f.address      || c.address || '',
      city:         f.city         || c.city || '',
    }))
    if (cart.customer) prefilled.current = true
  }, [cart.customer, cart.authUser])

  // Prices are always computed by the database (place_order dry run), so the
  // totals shown are exactly what the order will be.
  const itemsKey = JSON.stringify(cart.items.map(i => [i.id, i.qty]))
  useEffect(() => {
    if (cart.items.length === 0) return
    let cancelled = false
    const t = setTimeout(async () => {
      const { data, error: err } = await createClient().rpc('place_order', {
        p_items: cart.items.map(i => ({ product_id: i.id, qty: i.qty })),
        p_campaign_code: code || null,
        p_dry_run: true,
      })
      if (cancelled) return
      if (err) {
        if (code) { setCodeError(err.message); setCode('') }
        else setQuoteError(err.message.includes('place_order') ? 'Kassan är inte aktiverad ännu.' : err.message)
        return
      }
      setQuoteError('')
      setTotals(data as Totals)
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [itemsKey, code, cart.priceList]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyCode() {
    setCodeError('')
    if (codeInput.trim()) setCode(codeInput.trim().toUpperCase())
  }

  const required: (keyof typeof EMPTY_FORM)[] = ['company', 'contact_name', 'email', 'address', 'zip', 'city']
  const missing = required.filter(k => !form[k].trim())
  const emailOk = /^\S+@\S+\.\S+$/.test(form.email.trim())

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (missing.length || !emailOk) { setError('Fyll i alla obligatoriska fält (*) och en giltig e-postadress.'); return }
    setPlacing(true)
    const { data, error: err } = await createClient().rpc('place_order', {
      p_items: cart.items.map(i => ({ product_id: i.id, qty: i.qty })),
      p_delivery: form,
      p_campaign_code: code || null,
    })
    setPlacing(false)
    if (err || !data) { setError(err?.message || 'Något gick fel. Försök igen.'); return }
    setDone({ ...(data as Totals & { order_nr: number }), email: form.email })
    cart.clearCart()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const field = (key: keyof typeof EMPTY_FORM, text: string, opts: { type?: string; placeholder?: string; req?: boolean; auto?: string } = {}) => (
    <div>
      <label style={label} htmlFor={`k-${key}`}>{text}{opts.req && ' *'}</label>
      <input id={`k-${key}`} type={opts.type || 'text'} value={form[key]} placeholder={opts.placeholder} autoComplete={opts.auto}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={input} />
    </div>
  )

  if (done) return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '120px 20px 80px', textAlign: 'center' }}>
      <CheckCircle size={56} color="#4CAF7D" strokeWidth={1.5} style={{ margin: '0 auto 18px', display: 'block' }} />
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400, color: '#111', margin: '0 0 10px' }}>Tack för din beställning!</h1>
      <p style={{ fontSize: 15, color: '#444', margin: '0 0 6px' }}>Order <strong>#{done.order_nr}</strong> har tagits emot.</p>
      <p style={{ fontSize: 14, color: '#666', margin: '0 0 28px', lineHeight: 1.6 }}>
        Vi bekräftar ordern och skickar fakturan till {done.email}. Totalt {fmt(done.total)} kr inkl. moms.
      </p>
      <Link href="/produkter" style={{ display: 'inline-block', padding: '13px 28px', borderRadius: 9, background: '#111', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
        Fortsätt handla
      </Link>
    </div>
  )

  if (cart.items.length === 0) return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '140px 20px 100px', textAlign: 'center' }}>
      <Package size={48} color="#bbb" strokeWidth={1} style={{ margin: '0 auto 16px', display: 'block' }} />
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 400, color: '#111', margin: '0 0 10px' }}>Varukorgen är tom</h1>
      <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px' }}>Lägg till produkter för att gå till kassan.</p>
      <Link href="/produkter" style={{ display: 'inline-block', padding: '13px 28px', borderRadius: 9, background: '#111', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
        Se produkter
      </Link>
    </div>
  )

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '110px 20px 80px' }}>
      <style>{`
        .kassa-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 24px; align-items: start; }
        .kassa-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .kassa-sum { position: sticky; top: 96px; }
        @media (max-width: 860px) {
          .kassa-grid { grid-template-columns: 1fr; }
          .kassa-sum { position: static; }
        }
        @media (max-width: 520px) { .kassa-2 { grid-template-columns: 1fr; } }
      `}</style>

      <Link href="/produkter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555', textDecoration: 'none', marginBottom: 14 }}>
        <ArrowLeft size={14} /> Fortsätt handla
      </Link>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 34, fontWeight: 400, color: '#111', margin: '0 0 22px' }}>Kassa</h1>

      <form onSubmit={placeOrder} className="kassa-grid" noValidate>
        <div aria-hidden="true" style={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
          <label htmlFor="k-website">Lämna tomt</label>
          <input id="k-website" name="website" type="text" tabIndex={-1} autoComplete="off"
            value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {!cart.authLoading && !cart.authUser && (
            <div style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: '#333' }}>Har du ett företagskonto? Logga in för dina priser.</span>
              <button type="button" onClick={openLogin} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1.5px solid #111', color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Logga in
              </button>
            </div>
          )}

          <section style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>Företag & kontakt</h2>
            <div className="kassa-2">
              {field('company', 'Företag', { req: true, auto: 'organization' })}
              {field('org_nr', 'Org.nr', { placeholder: '556123-4567' })}
              {field('contact_name', 'Kontaktperson', { req: true, auto: 'name' })}
              {field('phone', 'Telefon', { type: 'tel', auto: 'tel' })}
            </div>
            <div style={{ marginTop: 14 }}>{field('email', 'E-post', { type: 'email', req: true, auto: 'email' })}</div>
          </section>

          <section style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>Leveransadress</h2>
            {field('address', 'Adress', { req: true, auto: 'street-address' })}
            <div className="kassa-2" style={{ marginTop: 14 }}>
              {field('zip', 'Postnummer', { req: true, auto: 'postal-code' })}
              {field('city', 'Ort', { req: true, auto: 'address-level2' })}
            </div>
          </section>

          <section style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={17} /> Betalning: faktura
            </h2>
            <p style={{ fontSize: 13, color: '#555', margin: '0 0 16px', lineHeight: 1.6 }}>
              Vi bekräftar ordern och skickar fakturan till er. Ange gärna er referens eller inköpsnummer.
            </p>
            <div className="kassa-2">
              {field('reference', 'Er referens / PO-nummer')}
              {field('invoice_email', 'Faktura-e-post', { type: 'email', placeholder: 'Om annan än ovan' })}
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={label} htmlFor="k-message">Meddelande</label>
              <textarea id="k-message" rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="T.ex. leveransinstruktioner" style={{ ...input, resize: 'vertical' }} />
            </div>
          </section>
        </div>

        <aside className="kassa-sum" style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 12px' }}>Din order</h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cart.items.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 8, background: '#F5F2ED', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {item.image_url ? <img src={item.image_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Package size={20} color="#bbb" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.3 }}>{item.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(0,0,0,.12)', borderRadius: 7, overflow: 'hidden' }}>
                      <button type="button" aria-label="Minska antal" onClick={() => cart.updateQty(item.id, item.qty - 1)} style={{ width: 28, height: 28, background: '#F5F3EE', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}><Minus size={12} /></button>
                      <span style={{ width: 30, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#111' }}>{item.qty}</span>
                      <button type="button" aria-label="Öka antal" onClick={() => cart.updateQty(item.id, item.qty + 1)} style={{ width: 28, height: 28, background: '#F5F3EE', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}><Plus size={12} /></button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#C9971A' }}>{fmt(item.unit_price * item.qty)} kr</span>
                      <button type="button" aria-label="Ta bort" onClick={() => cart.removeItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 2 }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Campaign code */}
          <div style={{ marginTop: 14 }}>
            {code ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: '#F0FDF4', borderRadius: 8, fontSize: 13, color: '#1F7A4D' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Tag size={13} /> {code}</span>
                <button type="button" aria-label="Ta bort kampanjkod" onClick={() => { setCode(''); setCodeInput('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1F7A4D', padding: 2 }}><X size={14} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={codeInput} onChange={e => { setCodeInput(e.target.value); setCodeError('') }} placeholder="Kampanjkod"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCode() } }}
                  style={{ ...input, padding: '9px 12px', fontSize: 13 }} />
                <button type="button" onClick={applyCode} style={{ padding: '0 16px', borderRadius: 8, background: '#F5F3EE', border: '1px solid rgba(0,0,0,.1)', color: '#111', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Använd</button>
              </div>
            )}
            {codeError && <div style={{ fontSize: 12, color: '#C0392B', marginTop: 6 }}>{codeError}</div>}
          </div>

          {/* Totals from the database */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,.07)', fontSize: 13, color: '#444', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {quoteError ? (
              <div style={{ color: '#C0392B' }}>{quoteError}</div>
            ) : !totals ? (
              <div style={{ color: '#777' }}>Räknar…</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Delsumma exkl. moms</span><span style={{ color: '#111' }}>{fmt(totals.subtotal)} kr</span></div>
                {totals.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1F7A4D' }}><span>Kampanjrabatt</span><span>−{fmt(totals.discount)} kr</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Moms 25 %</span><span style={{ color: '#111' }}>{fmt(totals.vat)} kr</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Frakt</span>
                  <span style={{ color: totals.subtotal >= FREE_SHIPPING_FROM ? '#1F7A4D' : '#111' }}>{totals.subtotal >= FREE_SHIPPING_FROM ? 'Fri frakt' : 'Tillkommer'}</span>
                </div>
                {totals.subtotal < FREE_SHIPPING_FROM && (
                  <div style={{ fontSize: 12, color: '#666' }}>Fri frakt från {fmt(FREE_SHIPPING_FROM)} kr exkl. moms – {fmt(FREE_SHIPPING_FROM - totals.subtotal)} kr kvar.</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,.07)', fontSize: 17, fontWeight: 700, color: '#111' }}>
                  <span>Totalt inkl. moms</span><span style={{ color: '#C9971A' }}>{fmt(totals.total)} kr</span>
                </div>
              </>
            )}
          </div>

          {error && <div role="alert" style={{ marginTop: 14, padding: '10px 12px', background: '#FDECEA', borderRadius: 8, fontSize: 13, color: '#A93226' }}>{error}</div>}

          <button type="submit" disabled={placing || !totals}
            style={{ width: '100%', marginTop: 16, padding: '15px', borderRadius: 10, background: placing || !totals ? '#999' : '#111', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: placing || !totals ? 'default' : 'pointer' }}>
            {placing ? 'Skickar beställning…' : 'Skicka beställning'}
          </button>
          <p style={{ fontSize: 12, color: '#666', margin: '10px 0 0', textAlign: 'center', lineHeight: 1.5 }}>
            Betalning sker mot faktura. Du får en bekräftelse när vi har behandlat ordern.
          </p>
        </aside>
      </form>
    </div>
  )
}

export default function KassaPage() {
  return (
    <PublicShell>
      <CheckoutContent />
    </PublicShell>
  )
}
