'use client'
import { ReactNode, useState, useEffect, createContext, useContext, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, ChevronRight, ShoppingCart, User, LogOut, Package, ChevronDown, Minus, Plus, Trash2, FileText, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'
import { DEFAULT_CONTACT, ContactContent } from '@/lib/site-content'
import { SiteEditProvider, useSiteContent, EditableText } from '@/components/site-edit/SiteEdit'
import type { User as SupaUser } from '@supabase/supabase-js'
import { userRole } from '@/lib/roles'
import { loginErrorMessage } from '@/lib/auth-errors'
import { DISCOUNT, VAT_RATE, withVat, customerTypeOf, VISITOR_TYPE_KEY, type CustomerType } from '@/lib/pricing'
import VisitorTypeModal from '@/components/shop/VisitorTypeModal'

export const LoginModalContext = createContext<(startReg?: boolean, type?: 'business' | 'private') => void>(() => {})
export function useLoginModal() { return useContext(LoginModalContext) }

/* ── Cart context ───────────────────────────────────────── */
interface CartItem { id: string; name: string; brand: string; unit_price: number; qty: number; image_url: string | null; unit: string; list_price: number }
interface CartCtx {
  items: CartItem[]
  addItem: (p: { id: string; name: string; brand: string; list_price: number; image_url: string | null; unit: string }, priceList: string) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  clearCart: () => void
  count: number
  subtotal: number
  openCart: () => void
  authUser: SupaUser | null
  authLoading: boolean
  customer: any
  priceList: string
  isPrivate: boolean   // private customers see prices incl. VAT
  canShop: boolean     // logged-in customers; everyone else must log in first
}
export const CartContext = createContext<CartCtx>({
  items: [], addItem: () => {}, removeItem: () => {}, updateQty: () => {}, clearCart: () => {},
  count: 0, subtotal: 0, openCart: () => {},
  authUser: null, authLoading: true, customer: null, priceList: 'Standard', isPrivate: false, canShop: false,
})
export function usePublicCart() { return useContext(CartContext) }

const CART_KEY = 'prolux-cart'

const NAV_PUBLIC = [
  { href: '/',             label: 'Hem' },
  { href: '/produkter',    label: 'Produkter' },
  { href: '/#pro-center',  label: 'Återförsäljare' },
  { href: '/guider',       label: 'Utbildning' },
  { href: '/om-oss',       label: 'Om Oss' },
  { href: '/om-oss#kontakta-oss', label: 'Kontakt' },
]


const S = {
  inp: {
    width: '100%', padding: '12px 14px',
    background: 'rgba(0,0,0,.04)',
    border: '1px solid rgba(0,0,0,.1)',
    borderRadius: 8, color: '#111',
    fontFamily: 'inherit', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color .15s, box-shadow .15s',
  } as React.CSSProperties,
}

// Admins can edit the page's texts in place (see components/site-edit).
export function PublicShell({ children }: { children: ReactNode }) {
  return <SiteEditProvider><PublicShellInner>{children}</PublicShellInner></SiteEditProvider>
}

function PublicShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen]   = useState(false)
  const [scrolled, setScrolled]   = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [userDropOpen, setUserDropOpen] = useState(false)
  const [cartOpen, setCartOpen]   = useState(false)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [authUser, setAuthUser]   = useState<SupaUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [customer, setCustomer]   = useState<any>(null)
  const [regMode, setRegMode] = useState(false)
  const EMPTY_REG = { email: '', password: '', company: '', org_nr: '', contact_name: '', phone: '' }
  const [regForm, setRegForm] = useState(EMPTY_REG)
  const [regType, setRegType] = useState<CustomerType>('business')
  const [visitorOpen, setVisitorOpen] = useState(false)
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regDone, setRegDone] = useState(false)
  const contact = useSiteContent<ContactContent>('contact', DEFAULT_CONTACT)

  // Cart state. Kept in localStorage so it survives moving between pages
  // (every page mounts its own PublicShell) and reaching the checkout.
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const cartLoaded = useRef(false)
  const [cartBump, setCartBump] = useState(0)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
      // localStorage is only readable after mount, so the cart is restored here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved) && saved.length) setCartItems(saved)
    } catch { /* storage unavailable: start empty */ }
    cartLoaded.current = true
  }, [])

  useEffect(() => {
    if (!cartLoaded.current) return
    try { localStorage.setItem(CART_KEY, JSON.stringify(cartItems)) } catch { /* ignore */ }
  }, [cartItems])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null)
      setAuthLoading(false)
      if (session?.user) fetchCustomer(sb, session.user.id)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user ?? null)
      if (session?.user) fetchCustomer(sb, session.user.id)
      else setCustomer(null)
      // Guests keep their cart; only an explicit sign-out empties it.
      if (event === 'SIGNED_OUT') setCartItems([])
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchCustomer(sb: any, userId: string) {
    const { data } = await sb.from('customers').select('*').eq('auth_user_id', userId).single()
    if (data) setCustomer(data)
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function openLogin(startReg = false, type?: CustomerType) {
    setLoginOpen(true); setMenuOpen(false); setError(''); setRegError(''); setRegMode(startReg === true)
    let t = type
    if (!t) { try { t = localStorage.getItem(VISITOR_TYPE_KEY) === 'private' ? 'private' : 'business' } catch { t = 'business' } }
    setRegType(t)
  }
  function closeLogin() { setLoginOpen(false); setEmail(''); setPassword(''); setError(''); setRegMode(false); setRegForm(EMPTY_REG); setRegError(''); setRegDone(false) }

  // First visit without an account: ask "Företag eller privat?" once.
  useEffect(() => {
    if (authLoading || authUser) return
    let chosen: string | null = null
    try { chosen = localStorage.getItem(VISITOR_TYPE_KEY) } catch { /* storage blocked: ask anyway */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!chosen) setVisitorOpen(true)
  }, [authLoading, authUser])

  function rememberVisitorType(t: CustomerType | 'unknown') {
    try { if (!localStorage.getItem(VISITOR_TYPE_KEY) || t !== 'unknown') localStorage.setItem(VISITOR_TYPE_KEY, t) } catch { /* ignore */ }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const sb = createClient()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) { setError(loginErrorMessage(error)); setLoading(false); return }
    setAuthUser(data.user)
    closeLogin()
    setLoading(false)
    const role = userRole(data.user)
    if (role === 'admin') { window.location.href = '/admin/dashboard'; return }
    if (role === 'crm')   { window.location.href = '/crm/dashboard';   return }
    // Signal HomeContent to scroll to portal once auth state propagates
    sessionStorage.setItem('scrollToPortal', '1')
    if (window.location.pathname !== '/') {
      window.location.href = '/'
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    const priv = regType === 'private'
    if (priv ? !regForm.contact_name.trim() : !regForm.company.trim()) { setRegError(priv ? 'Namn krävs' : 'Företagsnamn krävs'); return }
    setRegLoading(true); setRegError('')
    const sb = createClient()
    const { data, error: signUpErr } = await sb.auth.signUp({
      email: regForm.email,
      password: regForm.password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (signUpErr) { setRegError(signUpErr.message); setRegLoading(false); return }
    if (data.user) {
      const { data: custData, error: custErr } = await sb.from('customers').insert({
        company: priv ? regForm.contact_name.trim() : regForm.company.trim(),
        contact_name: regForm.contact_name,
        org_nr: priv ? null : (regForm.org_nr.trim() || null),
        email: regForm.email,
        phone: regForm.phone,
        auth_user_id: data.user.id,
        price_list_id: 'Standard',
        status: 'active',
        customer_type: regType,
      }).select().single()
      if (!custErr && custData) {
        await sb.from('activities').insert({
          customer_id: custData.id,
          type: 'note',
          title: 'Nytt konto skapat',
          body: `${priv ? 'Privatkund' : 'Företagskund'} registrerade sig via webbshoppen.\n\n${priv ? 'Namn' : 'Företag'}: ${custData.company}\nKontakt: ${custData.contact_name || '—'}\nE-post: ${custData.email}\nTelefon: ${custData.phone || '—'}`,
          created_by: 'System',
        })
      }
    }
    setRegLoading(false)
    setRegDone(true)
  }

  async function handleLogout() {
    const sb = createClient()
    await sb.auth.signOut()
    setAuthUser(null); setCustomer(null); setCartItems([])
    setUserDropOpen(false)
  }

  function goToPortal() {
    const role = userRole(authUser)
    if (role === 'admin') { window.location.href = '/admin/dashboard' }
    else if (role === 'crm') { window.location.href = '/crm/dashboard' }
    else { sessionStorage.setItem('scrollToPortal', '1'); window.location.pathname === '/' ? (() => { const el = document.getElementById('min-portal'); el ? el.scrollIntoView({ behavior: 'smooth' }) : null })() : (window.location.href = '/') }
    setUserDropOpen(false)
  }

  // Cart helpers
  // Same source the database prices orders from (place_order): the customer card.
  const priceList = customer?.price_list_id || 'Standard'

  // Prices follow the current price list, so items added as a guest show
  // the customer's price after logging in.
  const pricedItems = useMemo(() => {
    const disc = DISCOUNT[priceList] ?? 0
    return cartItems.map(i => ({ ...i, unit_price: Math.round(i.list_price * (1 - disc)) }))
  }, [cartItems, priceList])

  const role = userRole(authUser)
  const isCustomer = !!authUser && role !== 'admin' && role !== 'crm'
  const isPrivate = customerTypeOf(customer) === 'private'
  // Prices and the cart are for logged-in customers only.
  const canShop = isCustomer

  const addItem = useCallback((p: { id: string; name: string; brand: string; list_price: number; image_url: string | null; unit: string }, pl: string) => {
    if (!canShop) { openLogin(); return }
    const disc = DISCOUNT[pl] ?? 0
    const unit_price = Math.round(p.list_price * (1 - disc))
    setCartItems(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: p.id, name: p.name, brand: p.brand, unit_price, qty: 1, image_url: p.image_url, unit: p.unit, list_price: p.list_price }]
    })
    // The cart stays closed; its counter pops instead (see cartBump).
    setCartBump(b => b + 1)
  }, [canShop]) // eslint-disable-line react-hooks/exhaustive-deps

  const removeItem = useCallback((id: string) => setCartItems(prev => prev.filter(i => i.id !== id)), [])
  const updateQty  = useCallback((id: string, qty: number) => {
    if (qty <= 0) { removeItem(id); return }
    setCartItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i))
  }, [removeItem])
  const clearCart  = useCallback(() => setCartItems([]), [])
  const count      = cartItems.reduce((s, i) => s + i.qty, 0)
  const subtotal   = pricedItems.reduce((s, i) => s + i.unit_price * i.qty, 0)

  const regBlocked = regLoading || !regForm.email || !regForm.password || !(regType === 'private' ? regForm.contact_name : regForm.company).trim()
  const displayName = customer?.contact_name || authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Kund'
  const showCart = canShop

  // Compact: icon with a count badge, so the header never runs out of room.
  const cartButton = showCart ? (
    <button key={`cart-${cartBump}`} className={cartBump ? 'pl-pop' : undefined} onClick={() => setCartOpen(true)}
      aria-label={count ? `Varukorg, ${count} ${count === 1 ? 'vara' : 'varor'}` : 'Varukorg'} title="Varukorg"
      style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, background: count > 0 ? '#E8B84B' : 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', color: count > 0 ? '#111' : '#fff', flexShrink: 0, transition: 'background .2s' }}>
      <ShoppingCart size={18} />
      {count > 0 && (
        <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9, background: '#fff', color: '#111', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
          {count}
        </span>
      )}
    </button>
  ) : null

  const navBg = scrolled ? 'rgba(13,15,20,.97)' : 'rgba(13,15,20,.92)'

  const cartCtx: CartCtx = { items: pricedItems, addItem, removeItem, updateQty, clearCart, count, subtotal, openCart: () => setCartOpen(true), authUser, authLoading, customer, priceList, isPrivate, canShop }

  return (
    <CartContext.Provider value={cartCtx}>
    <div style={{ minHeight: '100vh', background: '#e8e4dc', display: 'flex', flexDirection: 'column', color: '#111', position: 'relative' }}>

      {/* ── Polygon background ─────────────────────────────── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} xmlns="http://www.w3.org/2000/svg">
          <rect width="1440" height="900" fill="#e8e4dc"/>
          <polygon points="0,0 320,0 180,200" fill="rgba(232,184,75,0.18)"/>
          <polygon points="320,0 600,0 500,180 180,200" fill="rgba(232,184,75,0.10)"/>
          <polygon points="600,0 900,0 820,220 500,180" fill="rgba(200,160,60,0.12)"/>
          <polygon points="900,0 1200,0 1100,160 820,220" fill="rgba(232,184,75,0.08)"/>
          <polygon points="1200,0 1440,0 1440,200 1100,160" fill="rgba(74,143,212,0.14)"/>
          <polygon points="0,0 180,200 0,350" fill="rgba(74,143,212,0.10)"/>
          <polygon points="180,200 500,180 420,420 80,400" fill="rgba(255,255,255,0.30)"/>
          <polygon points="500,180 820,220 780,460 420,420" fill="rgba(232,184,75,0.07)"/>
          <polygon points="820,220 1100,160 1120,400 780,460" fill="rgba(255,255,255,0.22)"/>
          <polygon points="1100,160 1440,200 1440,450 1120,400" fill="rgba(74,143,212,0.10)"/>
          <polygon points="0,350 80,400 0,580" fill="rgba(232,184,75,0.12)"/>
          <polygon points="80,400 420,420 380,660 40,640" fill="rgba(74,143,212,0.08)"/>
          <polygon points="420,420 780,460 740,680 380,660" fill="rgba(255,255,255,0.28)"/>
          <polygon points="780,460 1120,400 1140,640 740,680" fill="rgba(232,184,75,0.09)"/>
          <polygon points="1120,400 1440,450 1440,680 1140,640" fill="rgba(255,255,255,0.20)"/>
          <polygon points="0,580 40,640 0,900" fill="rgba(74,143,212,0.12)"/>
          <polygon points="40,640 380,660 300,900 0,900" fill="rgba(232,184,75,0.10)"/>
          <polygon points="380,660 740,680 720,900 300,900" fill="rgba(255,255,255,0.25)"/>
          <polygon points="740,680 1140,640 1200,900 720,900" fill="rgba(232,184,75,0.07)"/>
          <polygon points="1140,640 1440,680 1440,900 1200,900" fill="rgba(74,143,212,0.13)"/>
        </svg>
      </div>

      {/* ── Topbar ─────────────────────────────────────────── */}
      <header className="pub-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        height: 64,
        background: navBg,
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,.08)' : '1px solid rgba(0,0,0,.06)',
        transition: 'all .3s ease',
        display: 'flex', alignItems: 'center',
        paddingInline: 24, gap: 16,
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,.06)' : 'none',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Image src="/logo.svg" alt="Prolux Shine" width={166} height={30} priority style={{ display: 'block', height: 30, width: 'auto' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 8, fontWeight: 500, letterSpacing: '.18em', color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', paddingLeft: 32 }}>Bilvårdsprodukter & Drömmar</span>
          </div>
          {/* Shown only where the header has room (see .pub-brand-logos below). */}
          <div className="pub-brand-logos" style={{ alignItems: 'center', gap: 10, paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,.15)' }}>
            <Image className="pub-logo-frescura" src="/brands/frescura.svg" alt="Frescura" width={100} height={9} style={{ display: 'block', height: 10, width: 'auto' }} />
            <Image className="pub-logo-virtus" src="/brands/virtus.svg" alt="Virtus" width={25} height={26} style={{ display: 'block', height: 28, width: 'auto' }} />
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="pub-desktop-nav" style={{ display: 'none', gap: 0, flex: 1, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
          {NAV_PUBLIC.map(({ href, label }) => {
            const active = !href.includes('#') && href !== '/' && pathname.startsWith(href)
            return (
              <Link key={label} href={href} className="pub-nav-link" style={{
                padding: '7px 9px',
                color: active ? '#E8B84B' : 'rgba(255,255,255,.8)',
                fontSize: 12, fontWeight: active ? 700 : 600,
                textDecoration: 'none', transition: 'color .15s', whiteSpace: 'nowrap',
                letterSpacing: '.03em', textTransform: 'uppercase',
              }}>
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="pub-desktop-right" style={{ display: 'none', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          {!authLoading && (
            authUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Min portal button for customers */}
                {isCustomer && (
                  <button title="Min portal" aria-label="Min portal" className="pub-portal-btn" onClick={() => { sessionStorage.setItem('scrollToPortal', '1'); window.location.pathname === '/' ? (() => { const el = document.getElementById('min-portal'); el ? el.scrollIntoView({ behavior: 'smooth' }) : null })() : (window.location.href = '/') }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, transition: 'all .2s' }}>
                    <Package size={15} /> <span className="pub-portal-label">Min portal</span>
                  </button>
                )}
                {cartButton}

                {/* User dropdown */}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setUserDropOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px 7px 10px', borderRadius: 8, background: '#E8B84B', color: '#0D0900', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#111', flexShrink: 0 }}>
                      {displayName[0]?.toUpperCase()}
                    </div>
                    <span className="pub-user-name" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                    {priceList && priceList !== 'Standard' && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,0,0,.15)', color: '#111', fontWeight: 700 }}>{priceList}</span>}
                    <ChevronDown size={13} />
                  </button>
                  {userDropOpen && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 210, background: '#fff', border: '1px solid rgba(0,0,0,.1)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)', overflow: 'hidden', zIndex: 999 }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,.06)', fontSize: 12, color: '#888' }}>
                        {authUser.email}
                        {customer?.company && <div style={{ fontWeight: 600, color: '#555', marginTop: 2 }}>{customer.company}</div>}
                      </div>
                      {isCustomer && <>
                        <button onClick={() => { setUserDropOpen(false); sessionStorage.setItem('scrollToPortal', '1'); window.location.pathname === '/' ? (() => { const el = document.getElementById('min-portal'); el ? el.scrollIntoView({ behavior: 'smooth' }) : null })() : (window.location.href = '/') }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', fontSize: 14, color: '#111', cursor: 'pointer', textAlign: 'left' }}>
                          <Package size={14} color="#C9971A" /> Min portal
                        </button>
                        <button onClick={() => { setCartOpen(true); setUserDropOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', fontSize: 14, color: '#111', cursor: 'pointer', textAlign: 'left' }}>
                          <ShoppingCart size={14} color="#555" /> Varukorg {count > 0 && `(${count})`}
                        </button>
                      </>}
                      {role === 'admin' && <button onClick={goToPortal} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', fontSize: 14, color: '#111', cursor: 'pointer', textAlign: 'left' }}><Package size={14} color="#C9971A" /> Admin</button>}
                      {role === 'crm' && <button onClick={goToPortal} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', fontSize: 14, color: '#111', cursor: 'pointer', textAlign: 'left' }}><Package size={14} color="#C9971A" /> CRM</button>}
                      <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', fontSize: 14, color: '#E05252', cursor: 'pointer', borderTop: '1px solid rgba(0,0,0,.06)', textAlign: 'left' }}>
                        <LogOut size={14} /> Logga ut
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {cartButton}
                <button onClick={() => openLogin(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 24, background: '#E8B84B', color: '#0D0900', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
                  Skapa Konto
                </button>
                <button onClick={() => openLogin()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, background: 'transparent', color: 'rgba(255,255,255,.8)', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Logga In
                </button>
              </>
            )
          )}
        </div>

        {/* Mobile: cart icon + hamburger */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {showCart && count > 0 && (
            <button key={`mcart-${cartBump}`} onClick={() => setCartOpen(true)} className={`pub-mobile-btn${cartBump ? ' pl-pop' : ''}`} aria-label={`Varukorg, ${count} varor`} style={{ position: 'relative', padding: 8, background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
              <ShoppingCart size={22} />
              <span style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: '#E8B84B', color: '#111', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
            </button>
          )}
          <button onClick={() => setMenuOpen(o => !o)} className="pub-mobile-btn" aria-label="Meny" style={{ padding: 8, background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, bottom: 0, background: 'rgba(13,15,20,.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', zIndex: 199, padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 8, animation: 'fadeIn .15s ease' }}>
          {NAV_PUBLIC.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', color: '#F0EDE8', fontSize: 16, fontWeight: 500, textDecoration: 'none' }}>
              {label} <ChevronRight size={16} color="rgba(255,255,255,.4)" />
            </Link>
          ))}
          <div style={{ flex: 1 }} />
          {authUser ? (
            <>
              {isCustomer && (
                <button onClick={() => { setCartOpen(true); setMenuOpen(false) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 20px', borderRadius: 10, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', color: '#F0EDE8', fontSize: 16, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                  <ShoppingCart size={17} /> Varukorg {count > 0 && `(${count})`}
                </button>
              )}
              <button onClick={() => { goToPortal(); setMenuOpen(false) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 20px', borderRadius: 10, background: '#E8B84B', border: 'none', color: '#0D0900', fontSize: 16, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                <Package size={17} /> Min portal
              </button>
              <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 20px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(224,82,82,.3)', color: '#E05252', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 4 }}>
                <LogOut size={15} /> Logga ut
              </button>
            </>
          ) : (
            <>
              <button onClick={() => openLogin(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 20px', borderRadius: 10, background: '#E8B84B', border: 'none', color: '#0D0900', fontSize: 16, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                Skapa Konto
              </button>
              <button onClick={() => openLogin()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 20px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.8)', fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                Logga in
              </button>
            </>
          )}
        </div>
      )}

      {userDropOpen && <div onClick={() => setUserDropOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 198 }} />}

      <LoginModalContext.Provider value={openLogin}>
        <main style={{ flex: 1, paddingTop: 64, position: 'relative', zIndex: 1 }}>
          {children}
        </main>
      </LoginModalContext.Provider>

      {/* ── CART DRAWER ──────────────────────────────────────── */}
      {cartOpen && <div onClick={() => setCartOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 300, backdropFilter: 'blur(4px)' }} />}
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 100vw)', background: '#fff', boxShadow: '-8px 0 40px rgba(0,0,0,.15)', zIndex: 301, display: 'flex', flexDirection: 'column', transform: cartOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .3s cubic-bezier(.22,.68,0,1.1)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111' }}>Varukorg</div>
            {count > 0 && <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{count} {count === 1 ? 'vara' : 'varor'} · {isPrivate ? `${fmt(withVat(subtotal))} kr inkl. moms` : `${fmt(subtotal)} kr exkl. moms`}</div>}
          </div>
          <button onClick={() => setCartOpen(false)} style={{ padding: 8, background: '#F5F3EE', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
            <ShoppingCart size={48} color="#ddd" strokeWidth={1} style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 6 }}>Varukorgen är tom</div>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>Lägg till produkter för att beställa</div>
            <button onClick={() => setCartOpen(false)} style={{ padding: '11px 24px', borderRadius: 8, background: '#F5F3EE', border: 'none', color: '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Fortsätt handla
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {pricedItems.map(item => (
                <div key={item.id} style={{ display: 'flex', gap: 14, paddingBlock: 14, borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 8, background: '#F9F7F3', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={24} color="#ccc" strokeWidth={1} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#bbb', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{item.brand}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.3, marginBottom: 8 }}>{item.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid rgba(0,0,0,.1)', borderRadius: 7, overflow: 'hidden' }}>
                        <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F3EE', border: 'none', cursor: 'pointer', color: '#555' }}>
                          <Minus size={12} />
                        </button>
                        <span style={{ width: 32, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#111' }}>{item.qty}</span>
                        <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F3EE', border: 'none', cursor: 'pointer', color: '#555' }}>
                          <Plus size={12} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ textAlign: 'right', lineHeight: 1.2 }}>
                          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#C9971A' }}>{fmt(isPrivate ? withVat(item.unit_price * item.qty) : item.unit_price * item.qty)} kr</span>
                          <span style={{ display: 'block', fontSize: 10, color: '#777' }}>{isPrivate ? 'inkl. moms' : `exkl. moms · ${fmt(withVat(item.unit_price * item.qty))} kr inkl.`}</span>
                        </span>
                        <button onClick={() => removeItem(item.id)} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: '#ccc' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '16px 24px 24px', borderTop: '1px solid rgba(0,0,0,.07)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, color: '#666' }}>
                <span>Delsumma exkl. moms</span>
                <span style={{ fontWeight: 600, color: '#111' }}>{fmt(subtotal)} kr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 12, color: '#777' }}>
                <span>{isPrivate ? 'Varav moms 25 %' : 'Moms 25 %'}</span>
                <span>{fmt(Math.round(subtotal * VAT_RATE))} kr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 16, fontWeight: 700, color: '#111', paddingTop: 12, borderTop: '1px solid rgba(0,0,0,.07)' }}>
                <span>Totalt inkl. moms</span>
                <span style={{ color: '#C9971A' }}>{fmt(withVat(subtotal))} kr</span>
              </div>
              <Link href="/kassa" onClick={() => setCartOpen(false)}
                style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 9, background: '#111', color: '#fff', fontSize: 15, fontWeight: 700, textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
                Till kassan
              </Link>
              <button onClick={() => setCartOpen(false)} style={{ width: '100%', padding: '11px', borderRadius: 9, background: 'transparent', color: '#666', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', marginTop: 8 }}>
                Fortsätt handla
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer id="kontakt" style={{ background: '#0D0F13', color: '#fff', padding: '64px 24px 32px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 40, marginBottom: 52 }}>

            {/* Col 1 — Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Image src="/logo.svg" alt="Prolux Shine" width={188} height={34} style={{ display: 'block', height: 34, width: 'auto' }} />
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.65)', lineHeight: 1.75, maxWidth: 240, marginBottom: 20 }}>
                Exklusiv distributör för premium bilvårdssystem i Norden. Vi levererar prestanda och resultat till professionella användare.
              </p>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 10 }}>Officiell distributör av</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Image src="/brands/frescura.svg" alt="Frescura" width={110} height={10} style={{ display: 'block', height: 12, width: 'auto' }} />
                  <Image src="/brands/virtus.svg" alt="Virtus" width={34} height={36} style={{ display: 'block', height: 36, width: 'auto' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                <a href={`mailto:${contact.email}`} style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', textDecoration: 'none' }}><EditableText doc="contact" path="email" value={contact.email} /></a>
                <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', textDecoration: 'none' }}><EditableText doc="contact" path="phone" value={contact.phone} /></a>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                {['IG', 'FB', 'YT'].map(s => (
                  <span key={s} style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', fontWeight: 700, cursor: 'pointer' }}>{s}</span>
                ))}
              </div>
            </div>

            {/* Col 2 — Produkter */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 18 }}>Produkter</div>
              {['Exteriör rengöring', 'Interiörvård', 'Polermedel & Trissor', 'Keramiskt Lackskydd', 'Paketerbjudanden'].map(c => (
                <Link key={c} href="/produkter" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,.55)', textDecoration: 'none', marginBottom: 12, lineHeight: 1.5 }}>{c}</Link>
              ))}
            </div>

            {/* Col 3 — Kundtjänst */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 18 }}>Kundtjänst</div>
              {['Kontakta Oss', 'Köpvillkor & Returer', 'Frakt & Leverans', 'Vanliga Frågor (FAQ)', 'Säkerhetsdatablad'].map(c => (
                <Link key={c} href="/om-oss" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,.55)', textDecoration: 'none', marginBottom: 12, lineHeight: 1.5 }}>{c}</Link>
              ))}
            </div>

            {/* Col 4 — Betalning */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 18 }}>Betalning</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', lineHeight: 1.7, marginBottom: 20 }}>
                Företag handlar mot faktura. Fakturan skickas när vi har bekräftat ordern.
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                <FileText size={14} /> Faktura
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.25)' }}>© {new Date().getFullYear()} ProLuxShine Sverige AB. Alla rättigheter reserverade.</p>
            <div style={{ display: 'flex', gap: 20 }}>
              <Link href="/om-oss" style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', textDecoration: 'none' }}>Integritetspolicy</Link>
              <Link href="/om-oss" style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', textDecoration: 'none' }}>Allmänna villkor</Link>
            </div>
          </div>
        </div>
      </footer>

      {visitorOpen && !loginOpen && (
        <VisitorTypeModal
          onChoose={t => rememberVisitorType(t)}
          onClose={() => { rememberVisitorType('unknown'); setVisitorOpen(false) }}
          onLogin={() => { setVisitorOpen(false); openLogin(false) }}
          onSignup={t => { setVisitorOpen(false); openLogin(true, t) }}
        />
      )}

      {/* ── LOGIN / REGISTER MODAL ──────────────────────────── */}
      {loginOpen && (
        <div onClick={closeLogin} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn .15s ease' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,.2)', padding: '36px 32px', position: 'relative' }}>
            <button onClick={closeLogin} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', padding: 6 }}>
              <X size={18} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Image src="/logo-full-dark.svg" alt="Prolux Shine" width={124} height={91} style={{ display: 'block', height: 88, width: 'auto' }} />
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', background: '#F5F3EE', borderRadius: 10, padding: 3, marginBottom: 20 }}>
              <button onClick={() => { setRegMode(false); setRegError(''); setError('') }} style={{ flex: 1, padding: '9px', borderRadius: 8, background: !regMode ? '#fff' : 'transparent', color: !regMode ? '#111' : '#888', fontSize: 13, fontWeight: !regMode ? 700 : 500, border: 'none', cursor: 'pointer', boxShadow: !regMode ? '0 1px 4px rgba(0,0,0,.08)' : 'none', transition: 'all .15s' }}>
                Logga in
              </button>
              <button onClick={() => { setRegMode(true); setError(''); setRegError('') }} style={{ flex: 1, padding: '9px', borderRadius: 8, background: regMode ? '#fff' : 'transparent', color: regMode ? '#111' : '#888', fontSize: 13, fontWeight: regMode ? 700 : 500, border: 'none', cursor: 'pointer', boxShadow: regMode ? '0 1px 4px rgba(0,0,0,.08)' : 'none', transition: 'all .15s' }}>
                Skapa konto
              </button>
            </div>

            {!regMode ? (
              <>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>E-post</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="namn@foretag.se" autoFocus style={S.inp}
                      onFocus={e => { e.currentTarget.style.borderColor = '#C9971A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,151,26,.12)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.1)'; e.currentTarget.style.boxShadow = 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>Lösenord</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={S.inp}
                      onFocus={e => { e.currentTarget.style.borderColor = '#C9971A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,151,26,.12)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.1)'; e.currentTarget.style.boxShadow = 'none' }} />
                  </div>
                  {error && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>{error}</div>}
                  <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: loading ? '#ddd' : '#111', color: loading ? '#999' : '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, letterSpacing: '.03em', border: 'none', borderRadius: 8, cursor: loading ? 'default' : 'pointer', marginTop: 4 }}>
                    {loading ? 'Loggar in…' : 'Logga in'}
                  </button>
                </form>
              </>
            ) : regDone ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <MailCheck size={40} strokeWidth={1.5} color="#C9971A" style={{ display: 'block', margin: '0 auto 16px' }} />
                <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 10 }}>Kolla din inkorg!</div>
                <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7, margin: '0 0 20px' }}>
                  Vi har skickat en bekräftelse till <strong>{regForm.email}</strong>.<br />
                  Klicka på länken i mailet för att aktivera ditt konto.
                </p>
                <button onClick={closeLogin} style={{ padding: '11px 28px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Stäng
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div role="radiogroup" aria-label="Kontotyp" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {([['business', 'Företag'], ['private', 'Privat']] as const).map(([t, l]) => (
                    <button key={t} type="button" role="radio" aria-checked={regType === t} onClick={() => { setRegType(t); setRegError(''); rememberVisitorType(t) }}
                      style={{ padding: '10px', borderRadius: 8, border: `1.5px solid ${regType === t ? '#111' : 'rgba(0,0,0,.12)'}`, background: regType === t ? '#111' : '#fff', color: regType === t ? '#fff' : '#333', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {l}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 13, color: '#666', margin: '0 0 4px', textAlign: 'center' }}>
                  {regType === 'private' ? 'Skapa ditt konto — priser visas inkl. moms' : 'Skapa ditt företagskonto — priser visas exkl. moms'}
                </p>
                {(regType === 'private' ? [
                  { key: 'contact_name', label: 'Namn *', placeholder: 'Erik Lindgren', type: 'text' },
                  { key: 'email', label: 'E-post *', placeholder: 'erik@exempel.se', type: 'email' },
                  { key: 'password', label: 'Välj lösenord *', placeholder: 'Minst 6 tecken', type: 'password' },
                  { key: 'phone', label: 'Telefon', placeholder: '070-123 45 67', type: 'tel' },
                ] : [
                  { key: 'company', label: 'Företagsnamn *', placeholder: 'AB Bilservice', type: 'text' },
                  { key: 'org_nr', label: 'Org.nr', placeholder: '556123-4567', type: 'text' },
                  { key: 'contact_name', label: 'Kontaktperson', placeholder: 'Erik Lindgren', type: 'text' },
                  { key: 'email', label: 'E-post *', placeholder: 'erik@foretag.se', type: 'email' },
                  { key: 'password', label: 'Välj lösenord *', placeholder: 'Minst 6 tecken', type: 'password' },
                  { key: 'phone', label: 'Telefon', placeholder: '08-123 45 67', type: 'tel' },
                ]).map(({ key, label, placeholder, type }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</label>
                    <input type={type} value={(regForm as any)[key]} onChange={e => setRegForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={S.inp}
                      onFocus={e => { e.currentTarget.style.borderColor = '#C9971A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,151,26,.12)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.1)'; e.currentTarget.style.boxShadow = 'none' }} />
                  </div>
                ))}
                {regError && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>{regError}</div>}
                <button type="submit" disabled={regBlocked} style={{ width: '100%', padding: '13px', background: regBlocked ? '#ddd' : '#111', color: regBlocked ? '#777' : '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 8, cursor: regBlocked ? 'default' : 'pointer', marginTop: 4 }}>
                  {regLoading ? 'Skapar konto…' : 'Skapa konto'}
                </button>
                <p style={{ fontSize: 11, color: '#888', textAlign: 'center', margin: 0 }}>Du behöver ett konto för att se priser och beställa.</p>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        .pub-desktop-nav   { display: none !important; }
        .pub-desktop-right { display: none !important; }
        .pub-mobile-btn    { display: flex !important; }
        /* The closed cart drawer and decorative shapes sit off-screen; never let them scroll the page sideways. */
        html, body { overflow-x: clip; }
        .pub-brand-logos   { display: none; }
        @media (min-width: 560px) { .pub-brand-logos { display: flex; } }
        /* Small laptops: a slightly tighter header so the brand logos fit next to the full menu. */
        @media (min-width: 1260px) and (max-width: 1365px) {
          .pub-header          { gap: 12px !important; padding-inline: 18px !important; }
          .pub-nav-link        { padding: 7px 7px !important; }
          .pub-brand-logos     { gap: 8px !important; padding-left: 10px !important; }
          .pub-logo-frescura   { height: 8px !important; }
          .pub-logo-virtus     { height: 24px !important; }
        }
        /* Logged-in customers: "Min portal" as an icon and a shorter name until there is room. */
        @media (min-width: 1260px) and (max-width: 1535px) {
          .pub-portal-label    { display: none; }
          .pub-portal-btn      { padding: 8px 10px !important; }
          .pub-user-name       { max-width: 110px !important; }
        }
        @media (min-width: 1260px) {
          .pub-desktop-nav   { display: flex !important; }
          .pub-desktop-right { display: flex !important; }
          .pub-mobile-btn    { display: none !important; }
        }
        .pl-pop { animation: pl-pop .45s cubic-bezier(.3,1.4,.5,1); }
        @keyframes pl-pop {
          0% { transform: scale(1); } 35% { transform: scale(1.18); } 65% { transform: scale(.96); } 100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) { .pl-pop { animation: none; } }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
    </CartContext.Provider>
  )
}
