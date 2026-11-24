'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { reorderToCart } from '@/lib/reorder'
import { PublicShell, useLoginModal, usePublicCart } from '@/components/layout/PublicShell'
import Price from '@/components/shop/Price'
import ProductCard from '@/components/shop/ProductCard'
import { fmt, formatDate } from '@/lib/utils'
import { DEFAULT_HOME, DEFAULT_TRUST, DEFAULT_PROMO, DEFAULT_TEAM, DEFAULT_GUIDES, TAG_COLORS, HomeContent as SiteHomeContent, GuidesContent } from '@/lib/site-content'
import { useSiteContent, useIsEditingSite, EditableText, EditableImage } from '@/components/site-edit/SiteEdit'
import {
  ArrowRight, ChevronRight, Package,
  ShoppingCart, ShoppingBag, ExternalLink, User, Lock, Save, Check, ClipboardList, RefreshCw
} from 'lucide-react'
import type { User as SupaUser } from '@supabase/supabase-js'
import OrderTracking from '@/components/portal/OrderTracking'
import { userRole } from '@/lib/roles'
import { featureIcon } from '@/lib/feature-icons'
import { popElement } from '@/lib/pop'
import { STOCK, guideStockImage } from '@/lib/stock-images'
import { PRODUCT_BADGE } from '@/lib/product-badge'
import AddProductCard from '@/components/site-edit/AddProductCard'

const DISCOUNT: Record<string, number> = { A: 0.40, B: 0.30, C: 0.20, Standard: 0 }

/* ─── Scroll-reveal ───────────────────────────────────── */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect() } }, { threshold: 0.08 })
    obs.observe(el); return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ height: '100%', opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(22px)', transition: `opacity .55s ease ${delay}ms, transform .55s ease ${delay}ms` }}>
      {children}
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   LOGGED-IN PORTAL — tabs: Översikt | Ordrar | Mitt konto
════════════════════════════════════════════════════════ */
function PortalHome({ user, products }: { user: SupaUser; products: any[] }) {
  const [customer, setCustomer]   = useState<any>(null)
  const [orders, setOrders]       = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<'overview'|'orders'|'account'>('overview')
  // Account form state
  const [acctName, setAcctName]   = useState('')
  const [acctPhone, setAcctPhone] = useState('')
  const [acctAddr, setAcctAddr]   = useState('')
  const [acctSaving, setAcctSaving] = useState(false)
  const [acctSaved, setAcctSaved]   = useState(false)
  const [pwCurrent, setPwCurrent]   = useState('')
  const [pwNew, setPwNew]           = useState('')
  const [pwMsg, setPwMsg]           = useState('')
  const [pwSaving, setPwSaving]     = useState(false)

  const role      = userRole(user)
  const name      = user.user_metadata?.full_name || user.email?.split('@')[0] || 'kund'
  const priceList = customer?.price_list_id || 'Standard'
  const disc      = DISCOUNT[priceList] ?? 0

  useEffect(() => {
    const supabase = createClient()
    // Orders are readable only for the customer's own card (see migration 0010).
    supabase.from('customers').select('*').eq('auth_user_id', user.id).maybeSingle().then(async ({ data: c }) => {
      const { data: o } = c
        ? await supabase.from('orders').select('*,order_items(product_name,qty,unit_price)').eq('customer_id', c.id).order('created_at', { ascending: false })
        : { data: null }
      if (c) {
        setCustomer(c)
        setAcctName(c.contact_name || '')
        setAcctPhone(c.phone || '')
        setAcctAddr(c.address || '')
      }
      if (o) setOrders(o)
      setLoading(false)
    })
  }, [user])

  const totalSpent     = orders.reduce((s, o) => s + (o.total || 0), 0)
  const ordersThisYear = orders.filter(o => new Date(o.created_at).getFullYear() === new Date().getFullYear()).length
  const savings        = totalSpent && disc ? Math.round(totalSpent * disc / (1 - disc)) : 0

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault()
    setAcctSaving(true)
    if (customer?.id) {
      const supabase = createClient()
      await supabase.from('customers').update({ contact_name: acctName, phone: acctPhone, address: acctAddr }).eq('id', customer.id)
    }
    setAcctSaving(false); setAcctSaved(true)
    setTimeout(() => setAcctSaved(false), 3000)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwSaving(true); setPwMsg('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pwNew })
    setPwSaving(false)
    if (error) setPwMsg('Kunde inte byta lösenord: ' + error.message)
    else { setPwMsg('Lösenordet har bytts!'); setPwCurrent(''); setPwNew('') }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', background: '#fff', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 8, color: '#111', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const TABS = [
    { id: 'overview', label: 'Översikt' },
    { id: 'orders',   label: 'Mina ordrar' },
    { id: 'account',  label: 'Mitt konto' },
  ] as const

  /* Admin/CRM */
  if (role === 'admin' || role === 'crm') {
    const href = role === 'admin' ? '/admin/dashboard' : '/crm/dashboard'
    return (
      <div style={{ paddingTop: 64, minHeight: '100vh', background: '#fff' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#E8B84B', margin: '0 auto 20px' }}>
            {name[0]?.toUpperCase()}
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400, color: '#111', margin: '0 0 8px' }}>Välkommen, {name}</h1>
          <p style={{ fontSize: 15, color: '#888', margin: '0 0 32px' }}>Du är inloggad som {role === 'admin' ? 'administratör' : 'säljare'}.</p>
          <Link href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 32px', borderRadius: 10, background: '#111', color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
            Öppna {role === 'admin' ? 'Admin' : 'CRM'} <ExternalLink size={16} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 64, background: '#F8F5F0', minHeight: '100vh' }}>

      {/* Welcome bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,.07)', padding: '24px 24px 0' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 13, color: '#999' }}>Välkommen tillbaka</p>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, color: '#111' }}>
                {customer?.company || name}
              </h1>
              {priceList !== 'Standard' && (
                <p style={{ margin: '3px 0 0', fontSize: 13, color: '#888' }}>
                  Prislista <strong style={{ color: '#C9971A' }}>{priceList}</strong> · {Math.round(disc * 100)}% B2B-rabatt
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 1, background: 'rgba(0,0,0,.06)', borderRadius: 10, overflow: 'hidden' }}>
              {[
                { label: 'Total inköpt', value: totalSpent ? `${fmt(totalSpent)} kr` : '—' },
                { label: 'Ordrar i år',  value: `${ordersThisYear}` },
                { label: 'Besparingar',  value: savings ? `${fmt(savings)} kr` : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '12px 20px', background: '#fff', textAlign: 'center', minWidth: 110 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, borderTop: '1px solid rgba(0,0,0,.06)' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '14px 22px', background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#111' : '#888',
                borderBottom: tab === t.id ? '2px solid #111' : '2px solid transparent',
                marginBottom: -1, fontFamily: 'inherit', transition: 'all .15s',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '36px 24px 80px' }}>

        {/* ── ÖVERSIKT ── */}
        {tab === 'overview' && (
          <div>
            <h2 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700, color: '#111' }}>Senaste ordrar</h2>
            {loading ? (
              <div style={{ height: 80, background: '#eee', borderRadius: 12, animation: 'pulse 1.5s ease infinite', marginBottom: 40 }} />
            ) : orders.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 40 }}>
                {orders.slice(0, 4).map(o => {
                  const sc = o.status === 'Levererad' ? '#16A34A' : o.status === 'Bekräftad' ? '#2563EB' : '#888'
                  return (
                    <div key={o.id} style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 12, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>#{o.order_nr}</div>
                        <div style={{ fontSize: 12, color: '#bbb', marginTop: 3 }}>{formatDate(o.created_at)}</div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{o.order_items?.length || 0} produkter</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#111' }}>{fmt(o.total)} kr</div>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${sc}15`, color: sc, fontWeight: 700 }}>{o.status}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,.06)', borderRadius: 12, padding: '36px', textAlign: 'center', marginBottom: 40 }}>
                <ShoppingBag size={32} strokeWidth={1} style={{ margin: '0 auto 12px', display: 'block', color: '#ccc' }} />
                <p style={{ margin: 0, fontSize: 14, color: '#999' }}>Inga ordrar ännu</p>
              </div>
            )}

            <h2 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700, color: '#111' }}>Dina produkter</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
              {products.map(p => {
                const price = Math.round(p.list_price * (1 - disc))
                return (
                  <div key={p.id} style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all .2s' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = '#C9971A'; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 20px rgba(0,0,0,.08)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'rgba(0,0,0,.08)'; el.style.transform = 'none'; el.style.boxShadow = 'none' }}
                  >
                    <div style={{ height: 160, background: '#F5F2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={40} color="#ccc" strokeWidth={1} />}
                    </div>
                    <div style={{ padding: '12px 14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: 10, color: '#bbb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{p.brand}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', flex: 1, lineHeight: 1.3, marginBottom: 10 }}>{p.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <Price listPrice={p.list_price} showListPrice />
                        </div>
                        <Link href="/produkter" style={{ padding: '7px 14px', borderRadius: 7, background: '#111', color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>Beställ</Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── ORDRAR ── */}
        {tab === 'orders' && (
          <div>
            <h2 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700, color: '#111' }}>Alla ordrar</h2>
            {loading ? (
              <div style={{ height: 80, background: '#eee', borderRadius: 12, animation: 'pulse 1.5s ease infinite' }} />
            ) : orders.length === 0 ? (
              <div style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,.06)', borderRadius: 12, padding: '48px', textAlign: 'center' }}>
                <ShoppingBag size={40} strokeWidth={1} style={{ margin: '0 auto 14px', display: 'block', color: '#ccc' }} />
                <p style={{ margin: 0, fontSize: 15, color: '#999' }}>Inga ordrar ännu</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orders.map(o => {
                  const sc = o.status === 'Levererad' ? '#16A34A' : o.status === 'Bekräftad' ? '#2563EB' : '#888'
                  return (
                    <div key={o.id} style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 12, padding: '18px 22px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>#{o.order_nr}</div>
                            <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>{formatDate(o.created_at)}</div>
                          </div>
                          <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: `${sc}15`, color: sc, fontWeight: 700 }}>{o.status}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{fmt(o.total)} kr</div>
                          <div style={{ fontSize: 11, color: '#bbb' }}>inkl. moms</div>
                        </div>
                      </div>
                      <OrderTracking order={o} />
                      {o.order_items?.length > 0 && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {o.order_items.map((item: any, i: number) => (
                            <span key={i} style={{ fontSize: 12, color: '#666', background: '#F5F2ED', padding: '3px 10px', borderRadius: 5 }}>
                              {item.qty}× {item.product_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MITT KONTO ── */}
        {tab === 'account' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>

            {/* Profile */}
            <div style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 16, padding: '28px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8B84B', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                  {name[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{customer?.company || name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{user.email}</div>
                </div>
              </div>

              <form onSubmit={saveAccount} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>Kontaktperson</label>
                  <input value={acctName} onChange={e => setAcctName(e.target.value)} placeholder="Ditt namn" style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>Telefon</label>
                  <input value={acctPhone} onChange={e => setAcctPhone(e.target.value)} placeholder="070-000 00 00" style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>Leveransadress</label>
                  <input value={acctAddr} onChange={e => setAcctAddr(e.target.value)} placeholder="Gatuadress, postort" style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>E-post</label>
                  <input value={user.email || ''} disabled style={{ ...inp, background: '#F5F2ED', color: '#999', cursor: 'not-allowed' }} />
                </div>
                <button type="submit" disabled={acctSaving} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 8, background: acctSaved ? '#16A34A' : '#111', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'background .2s' }}>
                  {acctSaved ? <><Check size={15} /> Sparat!</> : acctSaving ? 'Sparar…' : <><Save size={15} /> Spara uppgifter</>}
                </button>
              </form>
            </div>

            {/* Password */}
            <div style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 16, padding: '28px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <Lock size={18} color="#C9971A" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111' }}>Byt lösenord</h3>
              </div>
              <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>Nytt lösenord</label>
                  <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} required minLength={6} placeholder="Minst 6 tecken" style={inp} />
                </div>
                {pwMsg && (
                  <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, background: pwMsg.includes('bytts') ? '#F0FFF4' : '#FFF5F5', color: pwMsg.includes('bytts') ? '#16A34A' : '#DC2626', border: `1px solid ${pwMsg.includes('bytts') ? '#BBF7D0' : '#FECACA'}` }}>
                    {pwMsg}
                  </div>
                )}
                <button type="submit" disabled={pwSaving} style={{ padding: '12px', borderRadius: 8, background: '#111', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  {pwSaving ? 'Sparar…' : 'Byt lösenord'}
                </button>
              </form>

              {/* Price list info */}
              <div style={{ marginTop: 28, padding: '16px 18px', background: '#F8F5F0', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Din prislista</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>{priceList}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                  {disc > 0 ? `${Math.round(disc * 100)}% rabatt på listpris` : 'Standardpris'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  )
}

/* ─── Hero Slider ─────────────────────────────────────── */
const HERO_TEXT = [
  { label: 'Kvalitetsgaranti från Italien', heading: 'Prolux Shine', sub: 'Premiumleverantör av italienska bilvårdsprodukter — skapade för proffs och entusiaster.' },
  { label: 'Professionell bilvård', heading: 'Rätt teknik.\nRätt produkter.', sub: 'Komplett sortiment för handtvätt, maskinpolering och lackskydd.' },
  { label: 'Fälg & Exteriör', heading: 'Rena fälgar.\nKlara resultat.', sub: 'Starka rengöringsmedel formulerade för professionella biltvättar och detailingföretag.' },
]

function HeroSlider({ openLogin, loggedIn, heroImages, heroText, paused = false }: { openLogin: () => void; loggedIn?: boolean; heroImages: string[]; heroText: typeof HERO_TEXT; paused?: boolean }) {
  const [current, setCurrent] = useState(0)
  const slides = heroImages.length >= 3 ? heroImages.slice(0, 3) : heroImages.length > 0 ? [heroImages[0], heroImages[0], heroImages[0]] : []
  const total = heroText.length

  useEffect(() => {
    if (paused) return   // hold the slide still while an admin edits it
    const t = setInterval(() => {
      setCurrent(c => (c + 1) % total)
    }, 6500)
    return () => clearInterval(t)
  }, [total, paused])

  const slide = heroText[current]

  return (
    <section className="hero">
      {/* Background images — smooth crossfade, all always mounted */}
      {slides.map((src, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, opacity: i === current ? 1 : 0, transition: 'opacity 1.2s ease-in-out', zIndex: i === current ? 1 : 0 }}>
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'right center', display: 'block' }} />
        </div>
      ))}

      <EditableImage doc="home" path={`hero.${current}.image_url`} bucket="hero-images" top={140} />

      {slides.length === 0 && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(80% 90% at 80% 40%, #3a2a08 0%, #0D0D0F 70%)' }} />}

      {/* Dark on the left, where the text is */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'linear-gradient(90deg, rgba(9,9,11,.94) 0%, rgba(9,9,11,.75) 38%, rgba(9,9,11,.2) 70%, rgba(9,9,11,0) 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 160, zIndex: 2, background: 'linear-gradient(to top, #0D0D0F, transparent)' }} />

      <div className="hero-inner">
        <div key={current} style={{ animation: 'fadeUp .5s ease', maxWidth: 760 }}>
          <p className="hero-label"><EditableText doc="home" path={`hero.${current}.label`} value={slide.label} /></p>
          <h1 className="hero-title"><EditableText doc="home" path={`hero.${current}.heading`} value={slide.heading} multiline /></h1>
          <p className="hero-sub"><EditableText doc="home" path={`hero.${current}.sub`} value={slide.sub} multiline /></p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/produkter" className="btn-white">Se alla produkter <ArrowRight size={17} /></Link>
            {!loggedIn && <Link href="/aterforsaljare" className="btn-ghost">Bli återförsäljare</Link>}
          </div>
        </div>
      </div>

      {total > 1 && (
        <div className="hero-dots">
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} aria-label={`Bild ${i + 1}`}
              style={{ width: i === current ? 28 : 8, height: 8, borderRadius: 4, background: i === current ? '#E8B84B' : 'rgba(255,255,255,.35)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all .3s ease' }} />
          ))}
        </div>
      )}
    </section>
  )
}

/* ════════════════════════════════════════════════════════
   CUSTOMER PORTAL SECTION — shows below marketing for logged-in users
════════════════════════════════════════════════════════ */
function CustomerPortalSection({ customer, authUser, openLogin }: { customer: any; authUser: any; openLogin: () => void }) {
  const cart = usePublicCart()
  const [portalTab, setPortalTab] = useState<'overview'|'orders'|'account'>('overview')
  const [orders, setOrders]       = useState<any[]>([])
  const [products, setProducts]   = useState<any[]>([])
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [pwNew, setPwNew]         = useState('')
  const [pwMsg, setPwMsg]         = useState('')
  const [form, setForm]           = useState({ contact_name: customer?.contact_name || '', phone: customer?.phone || '', address: customer?.address || '' })
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [regForm, setRegForm]     = useState({ company: '', contact_name: authUser?.email?.split('@')[0] || '', phone: '', city: '', org_nr: '' })
  const [regSaving, setRegSaving] = useState(false)
  const [regError, setRegError]   = useState('')

  useEffect(() => {
    if (ordersLoaded) return
    const sb = createClient()
    if (customer?.id) {
      Promise.all([
        sb.from('orders').select('*,order_items(product_id,product_name,qty,unit_price,list_price)')
          .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(20),
        sb.from('products').select('id,name,list_price,image_url,unit,brand').eq('active', true).order('sort_order').limit(12),
      ]).then(([{ data: o }, { data: p }]) => {
        if (o) setOrders(o)
        if (p) setProducts(p)
        setOrdersLoaded(true)
      })
    } else {
      sb.from('products').select('id,name,list_price,image_url,unit,brand').eq('active', true).order('sort_order').limit(6)
        .then(({ data }) => { if (data) setProducts(data); setOrdersLoaded(true) })
    }
  }, [customer?.id, ordersLoaded])

  async function saveProfile() {
    setSaving(true)
    const sb = createClient()
    await sb.from('customers').update({ contact_name: form.contact_name, phone: form.phone }).eq('id', customer.id)
    setSaved(true); setSaving(false)
    setTimeout(() => setSaved(false), 2500)
  }

  async function changePassword() {
    if (!pwNew || pwNew.length < 6) { setPwMsg('Minst 6 tecken'); return }
    const sb = createClient()
    const { error } = await sb.auth.updateUser({ password: pwNew })
    if (error) setPwMsg('Fel: ' + error.message)
    else { setPwMsg('Lösenord uppdaterat!'); setPwNew('') }
    setTimeout(() => setPwMsg(''), 4000)
  }

  async function createCustomer() {
    if (!regForm.company.trim()) { setRegError('Företagsnamn krävs'); return }
    setRegSaving(true); setRegError('')
    const sb = createClient()
    const { data, error } = await sb.from('customers').insert({
      company: regForm.company, contact_name: regForm.contact_name,
      email: authUser.email, phone: regForm.phone, city: regForm.city,
      org_nr: regForm.org_nr, auth_user_id: authUser.id,
      price_list_id: 'Standard', status: 'active',
    }).select().single()
    if (error) { setRegError('Kunde inte skapa konto: ' + error.message); setRegSaving(false); return }
    if (data) {
      await sb.from('activities').insert({
        customer_id: data.id, type: 'note', title: 'Registrerade sig via kundportalen',
        body: `Kund skapade sitt konto via portalen.\n\nFöretag: ${data.company}\nKontakt: ${data.contact_name || '—'}\nE-post: ${data.email}`,
        created_by: 'System',
      })
    }
    window.location.reload()
  }

  const STATUS_LABEL: Record<string, string> = { pending: 'Mottagen', confirmed: 'Bekräftad', packed: 'Packad', shipped: 'Skickad', delivered: 'Levererad', cancelled: 'Avbruten' }
  const STATUS_COLOR: Record<string, string> = { pending: '#D48A3A', confirmed: '#C9971A', packed: '#C9971A', shipped: '#4A8FD4', delivered: '#4CAF7D', cancelled: '#E05252' }
  const disc = DISCOUNT[customer?.price_list_id] ?? 0
  const totalSpend = orders.reduce((s, o) => s + (o.subtotal || 0), 0)
  const latestOrder = orders[0]
  const pl = customer?.price_list_id || 'Standard'

  // Most purchased: flatten all order items and aggregate by product
  const productFreq: Record<string, { name: string; qty: number }> = {}
  orders.forEach(o => o.order_items?.forEach((i: any) => {
    if (!productFreq[i.product_id]) productFreq[i.product_id] = { name: i.product_name, qty: 0 }
    productFreq[i.product_id].qty += i.qty
  }))
  const topProducts = Object.entries(productFreq).sort((a, b) => b[1].qty - a[1].qty).slice(0, 4)

  // Recommended: products not in topProducts
  const topIds = new Set(topProducts.map(([id]) => id))
  const recommended = products.filter(p => !topIds.has(p.id)).slice(0, 4)

  async function reorder(o: any) {
    const { added } = await reorderToCart(createClient(), cart, o, pl)
    if (!added) alert('Produkterna i den här ordern finns tyvärr inte längre i sortimentet.')
  }

  return (
    <section id="min-portal" style={{ background: '#FAFAF8', borderTop: '3px solid #C9971A', padding: '56px 24px 80px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 20 }}>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.15em' }}>Min portal</p>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 400, color: '#111', lineHeight: 1.1 }}>
              Välkommen, {customer?.contact_name?.split(' ')[0] || authUser?.email?.split('@')[0] || 'kund'}
            </h2>
            <p style={{ margin: '5px 0 0', fontSize: 14, color: '#888' }}>{customer?.company || authUser?.email}</p>
          </div>
          {customer && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Prislista', value: customer.price_list_id || 'Standard', accent: true },
                { label: 'Din rabatt', value: disc > 0 ? `${Math.round(disc * 100)}%` : '—', accent: false },
                { label: 'Antal ordrar', value: String(orders.length), accent: false },
                { label: 'Totalt köpt', value: `${fmt(totalSpend)} kr`, accent: false },
              ].map(({ label, value, accent }) => (
                <div key={label} style={{ textAlign: 'center', padding: '12px 18px', background: '#fff', borderRadius: 10, border: `1px solid ${accent ? 'rgba(201,151,26,.3)' : 'rgba(0,0,0,.07)'}`, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                  <div style={{ fontSize: 10, color: '#aaa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: accent ? '#C9971A' : '#111' }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid rgba(0,0,0,.08)', marginBottom: 32 }}>
          {(customer
            ? [['overview', 'Översikt'], ['orders', 'Mina ordrar'], ['account', 'Mitt konto']] as const
            : [['orders', 'Kom igång'], ['account', 'Mitt konto']] as const
          ).map(([key, label]) => (
            <button key={key} onClick={() => setPortalTab(key as any)}
              style={{ padding: '10px 22px', background: 'none', border: 'none', borderBottom: `2px solid ${portalTab === key ? '#C9971A' : 'transparent'}`, color: portalTab === key ? '#111' : '#888', fontSize: 14, fontWeight: portalTab === key ? 700 : 400, cursor: 'pointer', marginBottom: -2, transition: 'all .15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {portalTab === 'overview' && customer && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>

            {/* Latest order */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 14, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>Senaste order</div>
              {!ordersLoaded ? (
                <div style={{ height: 60, background: '#F5F3EE', borderRadius: 8, animation: 'pulse 1.5s ease infinite' }} />
              ) : latestOrder ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Order #{latestOrder.order_nr}</div>
                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{latestOrder.created_at?.slice(0, 10)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#C9971A' }}>{fmt(latestOrder.subtotal)} kr</div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${STATUS_COLOR[latestOrder.status] || '#999'}18`, color: STATUS_COLOR[latestOrder.status] || '#999' }}>
                        {STATUS_LABEL[latestOrder.status] || latestOrder.status}
                      </span>
                    </div>
                  </div>
                  {/* Status progress bar */}
                  {['pending','confirmed','packed','shipped','delivered'].includes(latestOrder.status) && (
                    <div style={{ margin: '12px 0 14px' }}>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {['pending','confirmed','packed','shipped','delivered'].map((s, i, arr) => {
                          const idx = arr.indexOf(latestOrder.status)
                          const active = i <= idx
                          return <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: active ? '#C9971A' : '#E8E4DC', transition: 'background .3s' }} />
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        {['Mottagen','Packad','Skickad','Levererad'].map(l => (
                          <span key={l} style={{ fontSize: 9, color: '#bbb', fontWeight: 600 }}>{l}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <OrderTracking order={latestOrder} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {latestOrder.order_items?.slice(0, 3).map((item: any, i: number) => (
                      <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: '#F5F3EE', borderRadius: 4, color: '#666' }}>{item.product_name} ×{item.qty}</span>
                    ))}
                    {(latestOrder.order_items?.length || 0) > 3 && <span style={{ fontSize: 11, color: '#999' }}>+{latestOrder.order_items.length - 3} till</span>}
                  </div>
                  <button onClick={() => reorder(latestOrder)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, background: '#111', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                    <RefreshCw size={12} /> Beställ igen
                  </button>
                </>
              ) : (
                <div style={{ color: '#bbb', fontSize: 13, padding: '20px 0' }}>Inga ordrar ännu</div>
              )}
            </div>

            {/* Most purchased */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 14, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>Mest köpta produkter</div>
              {topProducts.length === 0 ? (
                <div style={{ color: '#bbb', fontSize: 13, padding: '20px 0' }}>Inga köp registrerade ännu</div>
              ) : topProducts.map(([id, { name, qty }], i) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBlock: 10, borderBottom: i < topProducts.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#F5F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#C9971A', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#111', lineHeight: 1.3 }}>{name}</div>
                  <div style={{ fontSize: 12, color: '#888', flexShrink: 0 }}>{qty} st köpt</div>
                </div>
              ))}
            </div>

            {/* Recommended products */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 14, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,.04)', gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.1em' }}>Rekommenderade produkter</div>
                <Link href="/produkter" style={{ fontSize: 12, color: '#C9971A', fontWeight: 600, textDecoration: 'none' }}>Se alla →</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {recommended.map(p => {
                  return (
                    <div key={p.id} style={{ background: '#F9F7F3', border: '1px solid rgba(0,0,0,.06)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <Link href={`/produkter/${p.id}`} aria-label={p.name} style={{ height: 150, background: '#fff', borderBottom: '1px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
                        {p.image_url
                          ? <img src={p.image_url} alt={p.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} />
                          : <Package size={40} color="#bbb" strokeWidth={1} />}
                      </Link>
                      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      <Link href={`/produkter/${p.id}`} style={{ fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.3, textDecoration: 'none' }}>{p.name}</Link>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
                        <Price listPrice={p.list_price} size="sm" />
                        <button onClick={e => { popElement(e.currentTarget); cart.addItem({ id: p.id, name: p.name, brand: p.brand || '', list_price: p.list_price, image_url: p.image_url, unit: p.unit || '' }, pl) }}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, background: '#111', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          + Lägg i varukorg
                        </button>
                      </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 14, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,.04)', gridColumn: 'span 2' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>Snabbåtgärder</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/produkter" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 9, background: '#111', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  <ShoppingBag size={15} /> Beställ produkter
                </Link>
                <button onClick={() => setPortalTab('orders')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 9, background: '#F5F3EE', color: '#333', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  <ClipboardList size={15} /> Alla mina ordrar
                </button>
                <button onClick={() => setPortalTab('account')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 9, background: '#F5F3EE', color: '#333', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  <User size={15} /> Mitt konto
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {portalTab === 'orders' && (
          <div>
            {!ordersLoaded ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>Laddar ordrar…</div>
            ) : !customer ? (
              <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 0 40px' }}>
                <h3 style={{ margin: '0 0 6px', fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, color: '#111' }}>Skapa ditt kundkort</h3>
                <p style={{ margin: '0 0 24px', fontSize: 14, color: '#888', lineHeight: 1.6 }}>Fyll i dina uppgifter så är du redo att beställa direkt.</p>
                {[
                  { key: 'company',      label: 'Företagsnamn *', placeholder: 'AB Bilservice',  type: 'text' },
                  { key: 'contact_name', label: 'Ditt namn',      placeholder: 'Erik Lindgren',  type: 'text' },
                  { key: 'phone',        label: 'Telefon',         placeholder: '070-123 45 67', type: 'tel'  },
                  { key: 'city',         label: 'Stad',            placeholder: 'Stockholm',      type: 'text' },
                  { key: 'org_nr',       label: 'Org.nr',          placeholder: '556123-4567',   type: 'text' },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key} style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</label>
                    <input type={type} value={(regForm as any)[key]} onChange={e => setRegForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                      style={{ width: '100%', padding: '11px 14px', background: '#F9F7F3', border: '1.5px solid rgba(0,0,0,.1)', borderRadius: 8, color: '#111', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
                {regError && <p style={{ color: '#E05252', fontSize: 13, marginBottom: 12 }}>{regError}</p>}
                <button onClick={createCustomer} disabled={regSaving}
                  style={{ width: '100%', padding: '13px', borderRadius: 9, background: regSaving ? '#ccc' : '#111', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: regSaving ? 'default' : 'pointer' }}>
                  {regSaving ? 'Skapar konto…' : 'Skapa kundkort'}
                </button>
              </div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <ClipboardList size={48} strokeWidth={1} style={{ margin: '0 auto 16px', display: 'block', color: '#ddd' }} />
                <p style={{ fontSize: 15, color: '#999', margin: 0 }}>Inga ordrar ännu</p>
                <Link href="/produkter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '10px 20px', borderRadius: 8, background: '#111', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  <ShoppingBag size={14} /> Bläddra bland produkter
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orders.map(o => (
                  <div key={o.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Order #{o.order_nr}</div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${STATUS_COLOR[o.status] || '#999'}18`, color: STATUS_COLOR[o.status] || '#999' }}>
                          {STATUS_LABEL[o.status] || o.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 12, color: '#aaa' }}>{o.created_at?.slice(0, 10)}</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#C9971A' }}>{fmt(o.subtotal)} kr</div>
                        <button onClick={() => reorder(o)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, background: '#111', color: '#fff', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                          <RefreshCw size={11} /> Beställ igen
                        </button>
                      </div>
                    </div>
                    <OrderTracking order={o} />
                    {o.order_items?.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {o.order_items.slice(0, 4).map((item: any, i: number) => (
                          <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: '#F5F3EE', borderRadius: 4, color: '#666' }}>{item.product_name} ×{item.qty}</span>
                        ))}
                        {o.order_items.length > 4 && <span style={{ fontSize: 11, color: '#999', alignSelf: 'center' }}>+{o.order_items.length - 4} till</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ACCOUNT TAB ── */}
        {portalTab === 'account' && (
          <div style={{ maxWidth: 540 }}>
            {customer && (
              <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 16 }}>Kontaktuppgifter</div>
                {[
                  { label: 'Namn', key: 'contact_name', placeholder: 'Ditt namn', type: 'text' },
                  { label: 'Telefon', key: 'phone', placeholder: '070-123 45 67', type: 'tel' },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key} style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>
                    <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                      style={{ width: '100%', padding: '10px 13px', background: '#F9F7F3', border: '1px solid rgba(0,0,0,.1)', borderRadius: 8, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>E-post</label>
                  <input value={authUser?.email || ''} disabled style={{ width: '100%', padding: '10px 13px', background: '#eee', border: '1px solid rgba(0,0,0,.06)', borderRadius: 8, fontSize: 14, color: '#999', boxSizing: 'border-box' }} />
                </div>
                <button onClick={saveProfile} disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 8, background: '#111', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saved ? <><Check size={14} /> Sparat!</> : saving ? 'Sparar…' : <><Save size={14} /> Spara</>}
                </button>
              </div>
            )}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 16 }}>Byt lösenord</div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Nytt lösenord</label>
                <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="Minst 6 tecken"
                  style={{ width: '100%', padding: '10px 13px', background: '#F9F7F3', border: '1px solid rgba(0,0,0,.1)', borderRadius: 8, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {pwMsg && <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, background: pwMsg.includes('Fel') ? '#fef2f2' : '#f0fdf4', color: pwMsg.includes('Fel') ? '#dc2626' : '#16a34a', marginBottom: 12 }}>{pwMsg}</div>}
              <button onClick={changePassword}
                style={{ padding: '11px 22px', borderRadius: 8, background: '#F5F3EE', color: '#111', fontSize: 14, fontWeight: 600, border: '1px solid rgba(0,0,0,.1)', cursor: 'pointer' }}>
                Uppdatera lösenord
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }`}</style>
    </section>
  )
}

/* ════════════════════════════════════════════════════════
   MARKETING HOME — professional B2B webshop (v2)
════════════════════════════════════════════════════════ */


const GUIDES = [
  { title: 'Så tvättar du bilen på rätt sätt', desc: 'Steg-för-steg-guide för en säker och effektiv handtvätt.', img: 'https://proluxshine.com/wp-content/uploads/2025/11/a7ffd562-2bb4-4699-aaeb-ce4da03ba0ac.png' },
  { title: 'Polering – välj rätt pad och polermedel', desc: 'Så får du bästa resultatet utan att riskera lacken.', img: 'https://proluxshine.com/wp-content/uploads/2025/11/IMG_3023-removebg-preview.png' },
  { title: 'Interiörrengöring som gör skillnad', desc: 'Tips och produkter för ett rent och fräscht resultat.', img: 'https://proluxshine.com/wp-content/uploads/2025/11/80690ec5-0a73-4a38-aa98-1c6d03d6b8e7.png' },
  { title: 'Lackskydd – så håller det längre', desc: 'Allt du behöver veta om vax, sealant och keramiskt skydd.', img: 'https://proluxshine.com/wp-content/uploads/2025/11/df6ba40f-5d3d-4c32-8cfd-55f9c68de3e7.png' },
]

const BRAND_LOGOS = ['Virtus', 'Frescura', 'Virtus Pro', 'Frescura+', 'ProLux', 'Virtus Elite', 'Frescura Daily']

function MarketingHome({ products, allImages, openLogin, authUser, customer, onProductCreated }: { products: any[]; allImages: string[]; openLogin: () => void; authUser?: any; customer?: any; onProductCreated?: (p: any) => void }) {
  const cart = usePublicCart()
  const [storyBrand, setStoryBrand] = useState<'frescura' | 'virtus'>('frescura')
  const priceList = customer?.price_list_id || 'Standard'
  const heroImg = products.find(p => p.image_url)?.image_url || null
  const siteHome = useSiteContent<SiteHomeContent>('home', DEFAULT_HOME)
  const editingSite = useIsEditingSite()
  // Keep each item's position in the saved list (`at`) for editing; empty
  // items are hidden from visitors but stay editable in edit mode.
  const trust = (siteHome.trust ?? DEFAULT_TRUST).map((t, at) => ({ ...t, at })).filter(t => editingSite || t.title.trim())
  const promo = siteHome.promo ?? DEFAULT_PROMO
  const team = siteHome.team ?? DEFAULT_TEAM
  const guides = useSiteContent<GuidesContent>('guides', DEFAULT_GUIDES).items.slice(0, 3)
  // Newest first (products marked "Ny" lead), and best sellers (marked "Storsäljare" first).
  const newest = [...products].sort((a, b) => Number(b.badge === 'new') - Number(a.badge === 'new') || String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 12)
  const bestsellers = [...products].sort((a, b) => Number(b.badge === 'top') - Number(a.badge === 'top') || (a.sort_order ?? 0) - (b.sort_order ?? 0)).slice(0, 12)

  return (
    <>
      {/* ── HERO — image slider ── */}
      <HeroSlider openLogin={openLogin} loggedIn={!!authUser} heroImages={siteHome.hero.map(h => h.image_url)} heroText={siteHome.hero} paused={editingSite} />

      {/* ── USP ROW ── */}
      <section className="usp-band">
        <div className="usp-grid" style={{ gridTemplateColumns: `repeat(${Math.max(trust.length, 1)}, minmax(0, 1fr))` }}>
          {trust.map(({ icon, title, sub, at }) => { const Icon = featureIcon(icon); return (
            <div key={at} className="usp">
              <span className="usp-icon"><Icon size={18} color="#E8B84B" strokeWidth={1.8} /></span>
              <div>
                <div className="usp-title"><EditableText doc="home" path={`trust.${at}.title`} value={title} /></div>
                {(sub || editingSite) && <div className="usp-sub"><EditableText doc="home" path={`trust.${at}.sub`} value={sub} /></div>}
              </div>
            </div>
          ) })}
        </div>
      </section>

      {/* ── BRANDS ── */}
      <section className="brand-strip">
        <span className="brand-strip-label">Officiell distributör i Norden</span>
        <Image src="/brands/frescura.svg" alt="Frescura" width={220} height={20} style={{ height: 20, width: 'auto' }} />
        <span className="brand-strip-dot" />
        <Image src="/brands/virtus.svg" alt="Virtus" width={44} height={46} style={{ height: 44, width: 'auto' }} />
        <span className="brand-strip-label">Italiensk kvalitet sedan 1957</span>
      </section>

      {/* ── NEWEST PRODUCTS ── */}
      {(newest.length > 0 || editingSite) && (
        <section className="home-sec">
          <div className="sec-head">
            <h2 className="sec-title">Senast inkommet</h2>
            <Link href="/produkter" className="sec-link">Se alla produkter</Link>
          </div>
          <div className="pcard-row">
            {newest.map(p => <ProductCard key={p.id} p={p} />)}
            <AddProductCard minHeight={300} onCreated={p => onProductCreated?.(p)} />
          </div>
        </section>
      )}

      {/* ── CAMPAIGN BANNER ── */}
      <section className="home-sec">
        <div className="promo">
          <div className="promo-img">
            {promo.image_url
              ? <img src={promo.image_url} alt="" />
              : <div className="promo-graphic"><Image src="/brands/virtus.svg" alt="" width={120} height={124} style={{ height: '46%', width: 'auto', opacity: .9 }} /></div>}
            <span className="promo-tape">{promo.label} · {promo.label} · {promo.label} · {promo.label} · {promo.label}</span>
            <EditableImage doc="home" path="promo.image_url" bucket="hero-images" />
          </div>
          <div className="promo-text">
            <p className="hero-label"><EditableText doc="home" path="promo.label" value={promo.label} /></p>
            <h2 className="sec-title"><EditableText doc="home" path="promo.heading" value={promo.heading} /></h2>
            <p className="sec-lead" style={{ margin: '16px 0 26px' }}><EditableText doc="home" path="promo.sub" value={promo.sub} multiline /></p>
            <Link href={promo.ctaHref || '/produkter?kampanj=1'} className="btn-white"><EditableText doc="home" path="promo.ctaLabel" value={promo.ctaLabel} /> <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>

      {/* ── CATEGORIES: from dirty to showroom ── */}
      <section className="home-sec">
        <div className="sec-head sec-head-split">
          <h2 className="sec-title sec-title-xl">Från smutsig<br />till showroom</h2>
          <p className="sec-lead">Välj var du vill börja. Vi har produkterna för varje steg – från förtvätt och avfettning till polering och lackskydd.</p>
        </div>
        <div className="cat-row">
          {siteHome.categories.map((cat, i) => (
            <Link key={i} href={`/produkter?kat=${encodeURIComponent(cat.name)}`} className="cat-tile">
              <img src={cat.img} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '118%', objectFit: 'cover', objectPosition: 'top' }} />
              <span className="cat-shade" />
              <span className="cat-name">{cat.name} <ArrowRight size={18} /></span>
              <EditableImage doc="home" path={`categories.${i}.img`} bucket="category-images" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── BEST SELLERS ── */}
      {bestsellers.length > 0 && (
        <section className="home-sec">
          <div className="sec-head">
            <h2 className="sec-title">Bästsäljare</h2>
            <Link href="/produkter" className="sec-link">Se alla produkter</Link>
          </div>
          <div className="pcard-row">
            {bestsellers.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* ── GUIDES ── */}
      {guides.length > 0 && (
        <section className="home-sec">
          <div className="sec-head">
            <h2 className="sec-title">Bilvårdstips</h2>
            <Link href="/guider" className="sec-link">Alla guider</Link>
          </div>
          <div className="guide-row">
            {guides.map((g, i) => { const Icon = featureIcon(g.emoji); const color = TAG_COLORS[g.tag] || TAG_COLORS.Tips; return (
              <Link key={g.id} href="/guider" className="guide-card">
                <div className="guide-img" style={{ background: `radial-gradient(90% 90% at 70% 30%, ${color}40 0%, #141417 70%)` }}>
                  {(g.image_url || guideStockImage(g.category)) ? <img src={g.image_url || guideStockImage(g.category)} alt="" loading="lazy" /> : <Icon size={64} color={color} strokeWidth={1.2} />}
                  <span className="guide-tag" style={{ background: color }}>{g.tag}</span>
                  <EditableImage doc="guides" path={`items.${i}.image_url`} bucket="category-images" />
                </div>
                <div className="guide-body">
                  <div className="guide-meta">{g.category} · {g.readTime} läsning</div>
                  <h3 className="guide-title">{g.title}</h3>
                  <p className="guide-desc">{g.desc}</p>
                </div>
              </Link>
            ) })}
          </div>
        </section>
      )}

      {/* ── TEAM ── */}
      <section className="home-sec">
        <div className="sec-head sec-head-split">
          <h2 className="sec-title"><EditableText doc="home" path="team.heading" value={team.heading} /></h2>
          <p className="sec-lead"><EditableText doc="home" path="team.sub" value={team.sub} multiline /></p>
        </div>
        <div className="team-row">
          {team.people.map((p, i) => (
            <div key={i} className="team-card">
              <div className="team-img">
                {p.image_url ? <img src={p.image_url} alt={p.name} /> : <span className="team-initial">{(p.name || '?')[0]}</span>}
                <EditableImage doc="home" path={`team.people.${i}.image_url`} bucket="om-oss-images" />
              </div>
              <div className="team-name"><EditableText doc="home" path={`team.people.${i}.name`} value={p.name} /></div>
              <div className="team-role"><EditableText doc="home" path={`team.people.${i}.role`} value={p.role} /> · <EditableText doc="home" path={`team.people.${i}.area`} value={p.area} /></div>
            </div>
          ))}
          <a href="/om-oss#kontakta-oss" className="team-card team-contact">
            <span className="team-contact-title">Vill du ha ett besök?</span>
            <span className="team-contact-sub">Vi kommer ut till din verkstad eller tvätthall och visar produkterna på plats.</span>
            <span className="sec-link" style={{ marginTop: 'auto' }}>Kontakta oss</span>
          </a>
        </div>
      </section>

      {/* ── PRO CENTER — full-width dark banner ── */}
      <section id="pro-center" style={{ background: '#141417', borderTop: '1px solid rgba(255,255,255,.06)', borderBottom: '1px solid rgba(255,255,255,.06)', position: 'relative', overflow: 'hidden', marginTop: 24 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '420px 1fr', alignItems: 'center', minHeight: 360 }} className="b2b-grid">
          {/* Left — image placeholder with product */}
          <div className="b2b-img" style={{ height: '100%', position: 'relative', overflow: 'hidden', minHeight: 320 }}>
            <img src={STOCK.cleanBlackCar} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .45 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 40% 45%, rgba(9,9,11,.35) 0%, rgba(9,9,11,.85) 75%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34, paddingBottom: 40 }}>
              <Image src="/brands/frescura.svg" alt="Frescura" width={260} height={24} style={{ width: '62%', height: 'auto', maxWidth: 260 }} />
              <Image src="/brands/virtus.svg" alt="Virtus" width={110} height={114} style={{ width: 'auto', height: 110 }} />
            </div>
            {/* PRO CENTER badge overlay */}
            <div style={{ position: 'absolute', bottom: 24, left: 24, background: '#C9971A', color: '#111', fontSize: 11, fontWeight: 800, padding: '6px 14px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '.1em' }}>
              <EditableText doc="home" path={'proCenter.badge'} value={siteHome.proCenter.badge} />
            </div>
          </div>
          {/* Right — text */}
          <Reveal>
            <div style={{ padding: '48px 40px 48px 48px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.22em' }}><EditableText doc="home" path={'proCenter.eyebrow'} value={siteHome.proCenter.eyebrow} /></p>
              <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,38px)', fontWeight: 700, color: '#F0EDE8', lineHeight: 1.1 }}>
                <EditableText doc="home" path={'proCenter.heading'} value={siteHome.proCenter.heading} />
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(240,237,232,.55)', lineHeight: 1.7, maxWidth: 480 }}>
                <EditableText doc="home" path={'proCenter.sub'} value={siteHome.proCenter.sub} multiline />
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: 28 }}>
                {siteHome.proCenter.bullets.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(240,237,232,.65)' }}>
                    <Check size={14} color="#C9971A" strokeWidth={2.5} />
                    <EditableText doc="home" path={`proCenter.bullets.${i}`} value={item} />
                  </div>
                ))}
              </div>
              {!authUser ? (
                <Link href="/aterforsaljare" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 26px', borderRadius: 7, background: '#C9971A', color: '#111', fontSize: 14, fontWeight: 800, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '.06em', boxShadow: '0 4px 16px rgba(201,151,26,.3)' }}>
                  <EditableText doc="home" path={'proCenter.ctaLabel'} value={siteHome.proCenter.ctaLabel} /> <ArrowRight size={15} />
                </Link>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 7, background: 'rgba(201,151,26,.12)', border: '1px solid rgba(201,151,26,.25)', color: '#C9971A', fontSize: 13, fontWeight: 600 }}>
                  <Check size={14} /> Inloggad som kund
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── BRAND STORY — lab image + text ── */}
      <section style={{ background: 'transparent', padding: '72px 24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }} className="brand-story-grid">
          <Reveal>
            <div style={{ borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3', background: 'linear-gradient(135deg, #0a0c10 0%, #1a1400 60%, #0d0f13 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 32, boxSizing: 'border-box' }}>
              {storyBrand === 'virtus'
                ? <Image key="virtus" src="/brands/virtus.svg" alt="Virtus" width={200} height={207} style={{ width: 'auto', height: '52%', animation: 'fadeIn .3s ease' }} />
                : <Image key="frescura" src="/brands/frescura.svg" alt="Frescura" width={420} height={38} style={{ width: '72%', height: 'auto', animation: 'fadeIn .3s ease' }} />}
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(240,237,232,.7)' }}>
                {storyBrand === 'virtus' ? 'Italiensk nanoteknologi sedan 1957' : 'For car loving people'}
              </span>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 14 }}><EditableText doc="home" path={'brandStory.eyebrow'} value={siteHome.brandStory.eyebrow} /></p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 700, color: 'var(--shop-text)', margin: '0 0 18px', lineHeight: 1.15 }}>
                <EditableText doc="home" path={'brandStory.heading'} value={siteHome.brandStory.heading} />
              </h2>
              {siteHome.brandStory.paragraphs.map((p, i) => (
                <p key={i} style={{ fontSize: 15, color: 'var(--shop-text2)', lineHeight: 1.8, marginBottom: i === siteHome.brandStory.paragraphs.length - 1 ? 28 : 20 }}>
                  <EditableText doc="home" path={`brandStory.paragraphs.${i}`} value={p} multiline />
                </p>
              ))}
              <div style={{ display: 'flex', gap: 24 }}>
                {([['brand1', siteHome.brandStory.brand1], ['brand2', siteHome.brandStory.brand2]] as const).map(([key, label]) => {
                  const brand = /virtus/i.test(label) ? 'virtus' : 'frescura'
                  const on = storyBrand === brand
                  return (
                    <div key={key} role="button" tabIndex={0} aria-pressed={on} onClick={() => setStoryBrand(brand)} onKeyDown={e => { if (e.key === 'Enter') setStoryBrand(brand) }}
                      style={{ paddingBottom: 8, borderBottom: `2px solid ${on ? '#E8B84B' : 'transparent'}`, cursor: 'pointer' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: on ? 'var(--shop-text)' : 'var(--shop-text2)' }}><EditableText doc="home" path={`brandStory.${key}`} value={label} /></span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── WHY PROLUX — feature grid ── */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <h2 className="sec-title" style={{ marginBottom: 36 }}>
            <EditableText doc="home" path={'why.heading'} value={siteHome.why.heading} />
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 28 }} className="features-grid">
            {siteHome.why.features.map((f, i) => (
              <Reveal key={i}>
                <div style={{ background: 'var(--shop-surface)', borderRadius: 10, padding: '28px 24px', border: '1px solid var(--shop-line)', height: '100%', boxSizing: 'border-box' }}>
                  {(() => { const Icon = featureIcon(f.icon); return (
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(232,184,75,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                      <Icon size={22} color="#E8B84B" strokeWidth={1.75} />
                    </div>
                  ) })()}
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--shop-text)', marginBottom: 8 }}><EditableText doc="home" path={`why.features.${i}.title`} value={f.title} /></div>
                  <div style={{ fontSize: 14, color: 'var(--shop-text2)', lineHeight: 1.7 }}><EditableText doc="home" path={`why.features.${i}.desc`} value={f.desc} multiline /></div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── B2B CTA banner ── */}
      <section style={{ background: '#141417', borderTop: '1px solid rgba(255,255,255,.06)', padding: '44px 24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 8 }}>Partner &amp; Distributör</p>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px,2.5vw,30px)', fontWeight: 700, color: '#F0EDE8', margin: '0 0 8px' }}>
              Bli auktoriserad återförsäljare
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(240,237,232,.5)', maxWidth: 520, lineHeight: 1.6, margin: 0 }}>
              Driver du bilvårdsföretag, reparerar eller budgetar? Få tillgång till exklusiva inköpspriser av Virtus och Frescura samt teknisk support och produktutbildning.
            </p>
          </div>
          <button onClick={openLogin} style={{ padding: '14px 32px', background: '#C9971A', color: '#0F1115', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Skicka ansökan
          </button>
        </div>
      </section>

      {/* ── CUSTOMER PORTAL SECTION (logged in only) ── */}
      {authUser && userRole(authUser) === 'portal' && (
        <CustomerPortalSection customer={customer} authUser={authUser} openLogin={openLogin} />
      )}

      {/* ── CTA (not logged in) ── */}
      {!authUser && (
        <section id="om-prolux" style={{ background: 'transparent', padding: '72px 24px' }}>
          <Reveal>
            <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,44px)', fontWeight: 700, color: 'var(--shop-text)', margin: '0 0 12px', lineHeight: 1.1 }}>
                Redo att beställa?
              </h2>
              <p style={{ fontSize: 15, color: 'var(--shop-text2)', margin: '0 0 28px', lineHeight: 1.7 }}>
                Logga in på din kundportal och beställ med dina avtalspriser.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={openLogin} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 32px', borderRadius: 7, background: '#E8B84B', color: '#111', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Logga in <ArrowRight size={15} />
                </button>
                <a href="mailto:info@proluxshine.com" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 24px', borderRadius: 7, background: 'transparent', border: '2px solid rgba(255,255,255,.2)', color: 'var(--shop-text)', fontSize: 14, fontWeight: 600, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Kontakta oss
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        @keyframes slideIn { from{opacity:0;transform:scale(1.04)} to{opacity:1;transform:scale(1)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.4} }
        .hero { position: relative; height: clamp(500px, 74vh, 780px); overflow: hidden; background: #0D0D0F; }
        .hero-inner { position: absolute; inset: 0; z-index: 3; display: flex; align-items: center; max-width: 1320px; margin: 0 auto; padding: 0 24px; }
        .hero-label { margin: 0 0 14px; font-size: 13px; font-weight: 700; color: #E8B84B; text-transform: uppercase; letter-spacing: .2em; }
        .hero-title { margin: 0 0 18px; font-family: var(--font-sans); font-size: clamp(44px, 7.4vw, 112px); font-weight: 900; line-height: .95; letter-spacing: -.035em; color: #fff; white-space: pre-line; }
        .hero-sub { margin: 0 0 32px; max-width: 560px; font-size: clamp(16px, 1.6vw, 20px); line-height: 1.55; color: rgba(237,237,234,.88); }
        .hero-dots { position: absolute; bottom: 32px; right: 32px; z-index: 4; display: flex; gap: 8px; }
        .btn-white { display: inline-flex; align-items: center; gap: 10px; padding: 16px 24px; border-radius: 4px; background: #fff; color: #111; font-size: 16px; font-weight: 700; text-decoration: none; }
        .btn-white:hover { background: #E8B84B; }
        .btn-ghost { display: inline-flex; align-items: center; gap: 10px; padding: 16px 24px; border-radius: 4px; border: 1px solid rgba(255,255,255,.35); color: #fff; font-size: 16px; font-weight: 600; text-decoration: none; }
        .btn-ghost:hover { border-color: #fff; }
        .usp-band { background: #141417; border-top: 1px solid rgba(255,255,255,.07); border-bottom: 1px solid rgba(255,255,255,.07); }
        .usp-grid { max-width: 1320px; margin: 0 auto; padding: 0 24px; display: grid; }
        .usp { display: flex; align-items: center; gap: 14px; padding: 24px 12px; }
        .usp-icon { width: 42px; height: 42px; border-radius: 50%; background: rgba(255,255,255,.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .usp-title { font-size: 14px; font-weight: 600; color: var(--shop-text); }
        .usp-sub { font-size: 13px; color: var(--shop-text2); margin-top: 2px; }
        .home-sec { max-width: 1320px; margin: 0 auto; padding: 72px 24px 0; }
        .sec-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
        .sec-head-split { align-items: flex-end; margin-bottom: 36px; }
        .sec-title { margin: 0; font-family: var(--font-sans); font-size: clamp(30px, 4vw, 52px); font-weight: 800; letter-spacing: -.03em; line-height: 1.02; color: var(--shop-text); }
        .sec-title-xl { font-size: clamp(36px, 5vw, 64px); }
        .sec-lead { margin: 0; max-width: 460px; font-size: 16px; line-height: 1.65; color: var(--shop-text2); }
        .sec-link { font-size: 15px; color: var(--shop-text); text-decoration: underline; text-underline-offset: 4px; white-space: nowrap; }
        .sec-link:hover { color: #E8B84B; }
        .cat-row { display: grid; grid-auto-flow: column; grid-auto-columns: calc((100% - 3 * 12px) / 4); gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
        .cat-row::-webkit-scrollbar { display: none; }
        .cat-tile { position: relative; display: block; aspect-ratio: 3 / 4; border-radius: 6px; overflow: hidden; background: #1a1a1d; scroll-snap-align: start; text-decoration: none; }
        .cat-tile img { transition: transform .5s ease; }
        .cat-tile:hover img { transform: scale(1.05); }
        .cat-shade { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.8) 0%, rgba(0,0,0,.2) 45%, rgba(0,0,0,0) 70%); }
        .cat-name { position: absolute; left: 20px; right: 20px; bottom: 18px; display: flex; align-items: center; justify-content: space-between; color: #fff; font-size: clamp(20px, 2vw, 28px); font-weight: 800; letter-spacing: -.02em; }
        .brand-strip { display: flex; align-items: center; justify-content: center; gap: 28px; flex-wrap: wrap; padding: 26px 24px; border-bottom: 1px solid rgba(255,255,255,.07); }
        .brand-strip-label { font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--shop-text2); }
        .brand-strip-dot { width: 5px; height: 5px; border-radius: 50%; background: #E8B84B; }
        .promo { display: grid; grid-template-columns: 1.15fr 1fr; background: #141417; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; overflow: hidden; }
        .promo-img { position: relative; min-height: 380px; overflow: hidden; background: #0D0D0F; }
        .promo-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .promo-graphic { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: radial-gradient(70% 80% at 40% 40%, rgba(232,184,75,.28) 0%, rgba(232,184,75,.06) 45%, #0D0D0F 80%), repeating-linear-gradient(135deg, rgba(255,255,255,.025) 0 2px, transparent 2px 14px); }
        .promo-tape { position: absolute; left: -12%; right: -12%; bottom: 34px; transform: rotate(-6deg); background: repeating-linear-gradient(90deg, #E8B84B 0 34px, #111 34px 40px); color: #111; font-size: 13px; font-weight: 900; letter-spacing: .3em; text-transform: uppercase; white-space: nowrap; overflow: hidden; padding: 9px 0; text-align: center; box-shadow: 0 6px 18px rgba(0,0,0,.4); }
        .promo-tape { background: #E8B84B; }
        .promo-text { padding: clamp(28px, 4vw, 56px); display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }
        .guide-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .guide-card { display: flex; flex-direction: column; background: #141417; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; overflow: hidden; text-decoration: none; transition: border-color .2s, transform .2s; }
        .guide-card:hover { border-color: rgba(232,184,75,.45); transform: translateY(-3px); }
        .guide-img { position: relative; aspect-ratio: 16 / 9; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .guide-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .guide-tag { position: absolute; top: 12px; left: 12px; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; color: #111; }
        .guide-body { padding: 18px 20px 22px; }
        .guide-meta { font-size: 12px; color: var(--shop-text2); margin-bottom: 8px; }
        .guide-title { margin: 0 0 8px; font-size: 19px; font-weight: 700; line-height: 1.3; color: var(--shop-text); }
        .guide-desc { margin: 0; font-size: 14px; line-height: 1.6; color: var(--shop-text2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .team-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .team-card { display: flex; flex-direction: column; text-decoration: none; }
        .team-img { position: relative; aspect-ratio: 4 / 5; border-radius: 8px; overflow: hidden; background: linear-gradient(160deg, #26262b 0%, #141417 70%); display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .team-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .team-initial { font-size: 96px; font-weight: 900; color: rgba(232,184,75,.35); letter-spacing: -.04em; }
        .team-name { font-size: 20px; font-weight: 800; color: var(--shop-text); }
        .team-role { font-size: 14px; color: var(--shop-text2); margin-top: 2px; }
        .team-contact { background: linear-gradient(140deg, #2a2110 0%, #141417 70%); border: 1px solid rgba(232,184,75,.3); border-radius: 8px; padding: 26px 24px; aspect-ratio: auto; min-height: 260px; }
        .team-contact-title { font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: var(--shop-text); margin-bottom: 10px; }
        .team-contact-sub { font-size: 15px; line-height: 1.6; color: var(--shop-text2); margin-bottom: 20px; }
        @media (max-width: 860px) {
          .promo { grid-template-columns: 1fr; }
          .promo-img { min-height: 240px; }
          .guide-row { grid-template-columns: 1fr; }
        }
        @media (max-width: 860px) {
          .usp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .sec-head-split { flex-direction: column; align-items: flex-start; }
          .cat-row { grid-auto-columns: 46%; }
          .home-sec { padding-top: 52px; }
          .hero-inner { align-items: flex-end; padding-bottom: 64px; }
        }
        @media (max-width: 480px) { .usp-grid { grid-template-columns: 1fr !important; } .usp { padding: 14px 4px; } .cat-row { grid-auto-columns: 72%; } }
        .cat-grid          { grid-template-columns: repeat(4,1fr); }
        .b2b-grid          { grid-template-columns: 420px 1fr; }
        .brand-story-grid  { grid-template-columns: 1fr 1fr; }
        .features-grid     { grid-template-columns: repeat(4,1fr); }
        @media (max-width: 860px) {
          .b2b-grid          { grid-template-columns: 1fr !important; }
          .b2b-img           { display: none !important; }
          .trust-grid        { grid-template-columns: repeat(2,1fr) !important; }
          .cat-grid          { grid-template-columns: repeat(3,1fr) !important; }
          .brand-story-grid  { grid-template-columns: 1fr !important; }
          .features-grid     { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 480px) {
          .cat-grid      { grid-template-columns: repeat(2,1fr) !important; }
          .features-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}

/* ════════════════════════════════════════════════════════
   ROOT
════════════════════════════════════════════════════════ */
function HomeContent() {
  const openLogin = useLoginModal()
  const [authUser, setAuthUser]       = useState<SupaUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [products, setProducts]       = useState<any[]>([])
  const [allImages, setAllImages]     = useState<string[]>([])
  const [customer, setCustomer]       = useState<any>(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null)
      setAuthChecked(true)
      if (session?.user) {
        sb.from('customers').select('*').eq('auth_user_id', session.user.id).single()
          .then(({ data }) => {
            if (data) setCustomer(data)
          })
      }
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setAuthUser(session?.user ?? null)
      if (session?.user) {
        sb.from('customers').select('*').eq('auth_user_id', session.user.id).single()
          .then(({ data }) => { if (data) setCustomer(data) })
      } else {
        setCustomer(null)
      }
    })
    sb.from('products').select('*').eq('active', true).order('sort_order').limit(40)
      .then(({ data }) => {
        if (data) {
          setProducts(data)
          setAllImages(data.filter(p => p.image_url).map((p: any) => p.image_url))
        }
      })
    return () => subscription.unsubscribe()
  }, [])

  // Scroll to portal when user just logged in (sessionStorage flag set by login handler)
  useEffect(() => {
    if (!authChecked || !authUser) return
    const role = userRole(authUser)
    if (role === 'admin' || role === 'crm') return
    if (sessionStorage.getItem('scrollToPortal') !== '1') return
    sessionStorage.removeItem('scrollToPortal')
    // Poll until #min-portal is rendered (it appears after React processes authUser state)
    let attempts = 0
    const poll = setInterval(() => {
      const el = document.getElementById('min-portal')
      if (el) {
        clearInterval(poll)
        el.scrollIntoView({ behavior: 'smooth' })
      } else if (++attempts > 40) {
        clearInterval(poll)
      }
    }, 50)
    return () => clearInterval(poll)
  }, [authChecked, authUser])

  if (!authChecked) return <div style={{ minHeight: '100vh' }} />
  return <MarketingHome products={products} allImages={allImages} openLogin={openLogin} authUser={authUser} customer={customer}
    onProductCreated={p => setProducts(ps => [...ps, p])} />
}

export default function HomePage() {
  return <PublicShell tone="dark"><HomeContent /></PublicShell>
}
