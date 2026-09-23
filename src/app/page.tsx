'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { PublicShell, useLoginModal, usePublicCart } from '@/components/layout/PublicShell'
import { fmt, formatDate } from '@/lib/utils'
import { getSiteContent, DEFAULT_HOME, HomeContent as SiteHomeContent } from '@/lib/site-content'
import {
  ArrowRight, ChevronRight, Package, Truck, Shield, Phone,
  ShoppingCart, ShoppingBag, ExternalLink, Star, User, Lock, Save, Check, ClipboardList, RefreshCw
} from 'lucide-react'
import type { User as SupaUser } from '@supabase/supabase-js'

const DISCOUNT: Record<string, number> = { A: 0.40, B: 0.30, C: 0.20, Standard: 0 }

const CATEGORIES = [
  { name: 'Exteriör', emoji: '🚗' },
  { name: 'Interiör', emoji: '🪑' },
  { name: 'Tvätt & Rengöring', emoji: '🫧' },
  { name: 'Vax & Polish', emoji: '✨' },
  { name: 'Fälgvård', emoji: '🔩' },
  { name: 'Avfettning', emoji: '⚗️' },
]

const TRUST = [
  { icon: Truck,  title: '1–2 dagars leverans', sub: 'Snabb och säker frakt' },
  { icon: Shield, title: 'Fri frakt över 2 000 kr', sub: 'Till valfritt ombud' },
  { icon: Star,   title: 'Professionell kvalitet', sub: 'Virtus & Frescura' },
  { icon: Phone,  title: 'Personlig säljare', sub: 'Telefon & mail mån–fre' },
]

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
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(22px)', transition: `opacity .55s ease ${delay}ms, transform .55s ease ${delay}ms` }}>
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

  const role      = user.user_metadata?.role
  const name      = user.user_metadata?.full_name || user.email?.split('@')[0] || 'kund'
  const priceList = user.user_metadata?.price_list_id || 'Standard'
  const disc      = DISCOUNT[priceList] ?? 0

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('customers').select('*').eq('email', user.email!).maybeSingle(),
      supabase.from('orders')
        .select('id,order_nr,status,total,created_at,order_items(product_name,qty,unit_price)')
        .eq('customer_id', user.user_metadata?.customer_id ?? '')
        .order('created_at', { ascending: false }),
    ]).then(([{ data: c }, { data: o }]) => {
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
                          <div style={{ fontSize: 17, fontWeight: 800, color: '#111' }}>{fmt(price)} kr</div>
                          {disc > 0 && <div style={{ fontSize: 10, color: '#bbb' }}><s>{fmt(p.list_price)}</s> listpris</div>}
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

function HeroSlider({ openLogin, loggedIn, heroImages, heroText }: { openLogin: () => void; loggedIn?: boolean; heroImages: string[]; heroText: typeof HERO_TEXT }) {
  const [current, setCurrent] = useState(0)
  const slides = heroImages.length >= 3 ? heroImages.slice(0, 3) : heroImages.length > 0 ? [heroImages[0], heroImages[0], heroImages[0]] : []
  const total = heroText.length

  useEffect(() => {
    const t = setInterval(() => {
      setCurrent(c => (c + 1) % total)
    }, 4000)
    return () => clearInterval(t)
  }, [total])

  const slide = heroText[current]

  return (
    <section style={{ position: 'relative', height: 'clamp(560px, 80vh, 860px)', overflow: 'hidden', marginTop: 0 }}>

      {/* Background images — smooth crossfade, all always mounted */}
      {slides.map((src, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, opacity: i === current ? 1 : 0, transition: 'opacity 1.2s ease-in-out', zIndex: i === current ? 1 : 0 }}>
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      ))}

      {/* Fallback dark bg when no images */}
      {slides.length === 0 && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a0c10, #1a1400)' }} />}

      {/* Dark overlay */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'linear-gradient(to right, rgba(0,0,0,.72) 0%, rgba(0,0,0,.35) 60%, rgba(0,0,0,.12) 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, zIndex: 2, background: 'linear-gradient(to top, rgba(0,0,0,.65), transparent)' }} />

      {/* Content — bottom left */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', zIndex: 3 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px 80px', width: '100%' }}>
          <div key={current} style={{ animation: 'fadeUp .5s ease' }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.65)', textTransform: 'uppercase', letterSpacing: '.2em' }}>
              {slide.label}
            </p>
            <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(42px, 6vw, 88px)', fontWeight: 800, color: '#fff', margin: '0 0 16px', lineHeight: 1.0, letterSpacing: '-.02em', whiteSpace: 'pre-line', textTransform: 'uppercase' }}>
              {slide.heading}
            </h1>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.75)', lineHeight: 1.65, margin: '0 0 32px', maxWidth: 480 }}>
              {slide.sub}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/produkter" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 40, background: '#E8B84B', color: '#0F1115', fontSize: 14, fontWeight: 700, textDecoration: 'none', letterSpacing: '.02em' }}>
                Utforska produkter <ArrowRight size={15} />
              </Link>
              {!loggedIn && (
                <button onClick={openLogin} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 40, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Logga in
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slide dots */}
      <div style={{ position: 'absolute', bottom: 32, right: 48, display: 'flex', gap: 8, zIndex: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)}
            style={{ width: i === current ? 24 : 8, height: 8, borderRadius: 4, background: i === current ? '#E8B84B' : 'rgba(255,255,255,.4)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all .3s ease' }}
          />
        ))}
      </div>
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
        sb.from('orders').select('id,order_nr,status,subtotal,total,created_at,order_items(product_id,product_name,qty,unit_price,list_price)')
          .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(20),
        sb.from('products').select('id,name,list_price,image_url,unit,brand').limit(12),
      ]).then(([{ data: o }, { data: p }]) => {
        if (o) setOrders(o)
        if (p) setProducts(p)
        setOrdersLoaded(true)
      })
    } else {
      sb.from('products').select('id,name,list_price,image_url,unit,brand').limit(6)
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

  function reorder(o: any) {
    if (!o.order_items?.length) return
    o.order_items.forEach((item: any) => {
      for (let i = 0; i < item.qty; i++) {
        cart.addItem({ id: item.product_id || item.id, name: item.product_name, brand: '', list_price: item.list_price || item.unit_price, image_url: null, unit: '' }, pl)
      }
    })
    cart.openCart()
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
                  const price = Math.round(p.list_price * (1 - disc))
                  return (
                    <div key={p.id} style={{ background: '#F9F7F3', border: '1px solid rgba(0,0,0,.06)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.3 }}>{p.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#C9971A' }}>{fmt(price)} kr</div>
                        <button onClick={() => cart.addItem({ id: p.id, name: p.name, brand: p.brand || '', list_price: p.list_price, image_url: p.image_url, unit: p.unit || '' }, pl)}
                          style={{ padding: '5px 10px', borderRadius: 6, background: '#111', color: '#fff', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                          + Lägg till
                        </button>
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
const BADGES = ['Storsäljare', 'Storsäljare', 'Nyhet', 'Storsäljare', 'Nyhet', 'Storsäljare', 'Storsäljare', 'Nyhet', 'Storsäljare', 'Nyhet', 'Storsäljare', 'Nyhet']


const GUIDES = [
  { title: 'Så tvättar du bilen på rätt sätt', desc: 'Steg-för-steg-guide för en säker och effektiv handtvätt.', img: 'https://proluxshine.com/wp-content/uploads/2025/11/a7ffd562-2bb4-4699-aaeb-ce4da03ba0ac.png' },
  { title: 'Polering – välj rätt pad och polermedel', desc: 'Så får du bästa resultatet utan att riskera lacken.', img: 'https://proluxshine.com/wp-content/uploads/2025/11/IMG_3023-removebg-preview.png' },
  { title: 'Interiörrengöring som gör skillnad', desc: 'Tips och produkter för ett rent och fräscht resultat.', img: 'https://proluxshine.com/wp-content/uploads/2025/11/80690ec5-0a73-4a38-aa98-1c6d03d6b8e7.png' },
  { title: 'Lackskydd – så håller det längre', desc: 'Allt du behöver veta om vax, sealant och keramiskt skydd.', img: 'https://proluxshine.com/wp-content/uploads/2025/11/df6ba40f-5d3d-4c32-8cfd-55f9c68de3e7.png' },
]

const BRAND_LOGOS = ['Virtus', 'Frescura', 'Virtus Pro', 'Frescura+', 'ProLux', 'Virtus Elite', 'Frescura Daily']

function MarketingHome({ products, allImages, openLogin, authUser, customer }: { products: any[]; allImages: string[]; openLogin: () => void; authUser?: any; customer?: any }) {
  const cart = usePublicCart()
  const priceList = customer?.price_list_id || 'Standard'
  const heroImg = products.find(p => p.image_url)?.image_url || null
  const [siteHome, setSiteHome] = useState<SiteHomeContent>(DEFAULT_HOME)

  useEffect(() => {
    getSiteContent('home', DEFAULT_HOME).then(setSiteHome)
  }, [])

  return (
    <>
      {/* ── ANNOUNCEMENT BAR ── */}
      <div style={{ background: '#111', padding: '8px 24px', marginTop: 0 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'center', gap: 'clamp(16px,4vw,48px)', flexWrap: 'wrap' }}>
          {[
            { icon: Truck,  text: '1–2 dagars leverans' },
            { icon: Shield, text: 'Fri frakt över 2 000 kr' },
            { icon: Star,   text: 'Professionell kvalitet' },
            { icon: Phone,  text: 'Personlig säljare' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgba(255,255,255,.72)', whiteSpace: 'nowrap' }}>
              <Icon size={13} color="#C9971A" strokeWidth={2} />
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* ── HERO — image slider ── */}
      <HeroSlider openLogin={openLogin} loggedIn={!!authUser} heroImages={siteHome.hero.map(h => h.image_url)} heroText={siteHome.hero} />

      {/* ── TRUST STRIP ── */}
      <section style={{ background: 'transparent', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div className="trust-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
            {TRUST.map(({ icon: Icon, title, sub }, i) => (
              <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 16px', borderRight: i < 3 ? '1px solid rgba(0,0,0,.07)' : 'none' }}>
                <Icon size={20} color="#C9971A" strokeWidth={1.5} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section style={{ background: 'transparent', padding: '48px 24px 56px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 800, color: '#111' }}>Utvalda kategorier</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }} className="cat-grid">
            {siteHome.categories.map((cat, i) => (
              <Reveal key={cat.name} delay={i * 50}>
                <Link href="/produkter" style={{ display: 'block', position: 'relative', borderRadius: 12, overflow: 'hidden', textDecoration: 'none', aspectRatio: '16/10', background: '#1a1a1a', transition: 'transform .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.02)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'none' }}>
                  <img src={cat.img} alt={cat.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.08)', transition: 'background .2s' }} />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCTS — Populära produkter ── */}
      {products.length > 0 && (
        <section style={{ background: 'transparent', padding: '0 24px 64px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid rgba(0,0,0,.12)' }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111', textTransform: 'uppercase', letterSpacing: '.08em' }}>Storsäljare just nu</h2>
              <Link href="/produkter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#C9971A', fontSize: 13, fontWeight: 700, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Se alla produkter <ArrowRight size={14} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 16 }}>
              {products.map((p, i) => (
                <Reveal key={p.id} delay={i * 40}>
                  <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all .2s', position: 'relative', cursor: 'pointer' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 8px 24px rgba(0,0,0,.1)'; el.style.borderColor = '#C9971A' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = 'none'; el.style.borderColor = '#eee' }}>
                    {BADGES[i] && (
                      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: BADGES[i] === 'Nyhet' ? '#111' : '#C9971A', color: BADGES[i] === 'Nyhet' ? '#fff' : '#111', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 4, letterSpacing: '.07em', textTransform: 'uppercase' }}>
                        {BADGES[i]}
                      </div>
                    )}
                    <div style={{ height: 200, background: '#F5F2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 12 }}>
                      {p.image_url ? <img src={p.image_url} alt={p.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} /> : <Package size={48} color="#ccc" strokeWidth={1} />}
                    </div>
                    <div style={{ padding: '12px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: 10, color: '#bbb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>{p.brand}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', flex: 1, lineHeight: 1.35, marginBottom: 12 }}>{p.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          {authUser && customer ? (
                            <>
                              <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{fmt(Math.round(p.list_price * (1 - (DISCOUNT[priceList] ?? 0))))} kr</div>
                              <div style={{ fontSize: 10, color: '#aaa' }}>{p.unit}</div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{fmt(Math.round(p.list_price * 0.6))} kr</div>
                              <div style={{ fontSize: 10, color: '#aaa' }}>exkl. moms</div>
                            </>
                          )}
                        </div>
                        {authUser ? (
                          <button onClick={() => cart.addItem(p, priceList)}
                            style={{ width: 36, height: 36, borderRadius: '50%', background: '#C9971A', color: '#111', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#C9971A'; (e.currentTarget as HTMLButtonElement).style.color = '#111' }}>
                            <ShoppingCart size={14} />
                          </button>
                        ) : (
                          <button onClick={openLogin}
                            style={{ width: 36, height: 36, borderRadius: '50%', background: '#C9971A', color: '#111', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <ShoppingCart size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PRO CENTER — full-width dark banner ── */}
      <section id="pro-center" style={{ background: '#0D0F13', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '420px 1fr', alignItems: 'center', minHeight: 360 }} className="b2b-grid">
          {/* Left — image placeholder with product */}
          <div className="b2b-img" style={{ height: '100%', position: 'relative', overflow: 'hidden', minHeight: 320 }}>
            {products.find(p => p.image_url) ? (
              <img src={products.find(p => p.image_url)?.image_url} alt="Pro Center" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(201,151,26,.05)' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 60%, #0D0F13 100%)' }} />
            {/* PRO CENTER badge overlay */}
            <div style={{ position: 'absolute', bottom: 24, left: 24, background: '#C9971A', color: '#111', fontSize: 11, fontWeight: 800, padding: '6px 14px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '.1em' }}>
              {siteHome.proCenter.badge}
            </div>
          </div>
          {/* Right — text */}
          <Reveal>
            <div style={{ padding: '48px 40px 48px 48px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.22em' }}>{siteHome.proCenter.eyebrow}</p>
              <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,38px)', fontWeight: 700, color: '#F0EDE8', lineHeight: 1.1 }}>
                {siteHome.proCenter.heading}
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(240,237,232,.55)', lineHeight: 1.7, maxWidth: 480 }}>
                {siteHome.proCenter.sub}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: 28 }}>
                {siteHome.proCenter.bullets.map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(240,237,232,.65)' }}>
                    <Check size={14} color="#C9971A" strokeWidth={2.5} />
                    {item}
                  </div>
                ))}
              </div>
              {!authUser ? (
                <button onClick={openLogin} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 26px', borderRadius: 7, background: '#C9971A', color: '#111', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.06em', boxShadow: '0 4px 16px rgba(201,151,26,.3)' }}>
                  {siteHome.proCenter.ctaLabel} <ArrowRight size={15} />
                </button>
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
            <div style={{ borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3', background: 'linear-gradient(135deg, #0a0c10 0%, #1a1400 60%, #0d0f13 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {allImages[0] ? (
                <img
                  src={allImages[0]}
                  alt="ProLuxShine produkter"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 24 }}
                />
              ) : (
                <div style={{ fontSize: 80 }}>✨</div>
              )}
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 14 }}>{siteHome.brandStory.eyebrow}</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 700, color: '#111', margin: '0 0 18px', lineHeight: 1.15 }}>
                {siteHome.brandStory.heading}
              </h2>
              {siteHome.brandStory.paragraphs.map((p, i) => (
                <p key={i} style={{ fontSize: 14, color: '#555', lineHeight: 1.8, marginBottom: i === siteHome.brandStory.paragraphs.length - 1 ? 28 : 20 }}>
                  {p}
                </p>
              ))}
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ paddingBottom: 8, borderBottom: '2px solid #111', cursor: 'pointer' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{siteHome.brandStory.brand1}</span>
                </div>
                <div style={{ paddingBottom: 8, borderBottom: '2px solid transparent', cursor: 'pointer' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#aaa' }}>{siteHome.brandStory.brand2}</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── WHY PROLUX — feature grid ── */}
      <section style={{ background: '#f9f9f9', padding: '64px 24px', borderTop: '1px solid #ebebeb' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 800, color: '#111', marginBottom: 36, textAlign: 'center' }}>
            {siteHome.why.heading}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 28 }} className="features-grid">
            {siteHome.why.features.map(f => (
              <Reveal key={f.title}>
                <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', border: '1px solid #e8e8e8' }}>
                  <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 8 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>{f.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── B2B CTA banner ── */}
      <section style={{ background: '#0D0F13', padding: '40px 24px' }}>
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
      {authUser && authUser.user_metadata?.role !== 'admin' && authUser.user_metadata?.role !== 'crm' && (
        <CustomerPortalSection customer={customer} authUser={authUser} openLogin={openLogin} />
      )}

      {/* ── CTA (not logged in) ── */}
      {!authUser && (
        <section id="om-prolux" style={{ background: 'transparent', padding: '64px 24px', borderTop: '1px solid rgba(0,0,0,.07)' }}>
          <Reveal>
            <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,44px)', fontWeight: 700, color: '#111', margin: '0 0 12px', lineHeight: 1.1 }}>
                Redo att beställa?
              </h2>
              <p style={{ fontSize: 15, color: '#888', margin: '0 0 28px', lineHeight: 1.7 }}>
                Logga in på din kundportal och beställ med dina avtalspriser.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={openLogin} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 32px', borderRadius: 7, background: '#111', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Logga in <ArrowRight size={15} />
                </button>
                <a href="mailto:info@proluxshine.com" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 24px', borderRadius: 7, background: 'transparent', border: '2px solid rgba(0,0,0,.15)', color: '#111', fontSize: 14, fontWeight: 600, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '.06em' }}>
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
        .trust-grid        { grid-template-columns: repeat(4,1fr); }
        .cat-grid          { grid-template-columns: repeat(6,1fr); }
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
    sb.from('products').select('id,name,brand,list_price,image_url,unit').eq('active', true).order('sort_order').limit(12)
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
    const role = authUser.user_metadata?.role
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

  if (!authChecked) return <div style={{ minHeight: '100vh', background: '#fff' }} />
  return <MarketingHome products={products} allImages={allImages} openLogin={openLogin} authUser={authUser} customer={customer} />
}

export default function HomePage() {
  return <PublicShell><HomeContent /></PublicShell>
}
