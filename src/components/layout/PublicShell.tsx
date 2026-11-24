'use client'
import { ReactNode, useState, useEffect, createContext, useContext, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, ChevronRight, ShoppingCart, User, LogOut, Package, ChevronDown, Minus, Plus, Trash2, FileText, MailCheck, Search, Phone, ArrowRight } from 'lucide-react'
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

// Secondary pages, under "Mer" in the menu.
const NAV_MORE = [
  { href: '/aterforsaljare', label: 'Bli återförsäljare' },
  { href: '/guider',         label: 'Utbildning & guider' },
  { href: '/om-oss',         label: 'Om oss' },
  { href: '/om-oss#kontakta-oss', label: 'Kontakt' },
]

// The shop's colours. "dark" is the webshop look (start page, products);
// "light" is kept for the pages not yet moved over (Om oss, kassa …).
const TONES = {
  dark:  { '--shop-bg': '#0D0D0F', '--shop-surface': '#18181B', '--shop-surface2': '#222226', '--shop-line': 'rgba(255,255,255,.09)', '--shop-text': '#EDEDEA', '--shop-text2': '#A8A8A3', '--shop-accent': '#E8B84B', '--shop-sale': '#FF4D5E' },
  light: { '--shop-bg': '#e8e4dc', '--shop-surface': '#ffffff', '--shop-surface2': '#F5F3EE', '--shop-line': 'rgba(0,0,0,.08)', '--shop-text': '#111111', '--shop-text2': '#666666', '--shop-accent': '#C9971A', '--shop-sale': '#C0392B' },
} as const

// Admins can edit the page's texts in place (see components/site-edit).
export function PublicShell({ children, tone = 'light' }: { children: ReactNode; tone?: 'dark' | 'light' }) {
  return <SiteEditProvider><PublicShellInner tone={tone}>{children}</PublicShellInner></SiteEditProvider>
}

function PublicShellInner({ children, tone }: { children: ReactNode; tone: 'dark' | 'light' }) {
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
  // Admin/säljare: the name from Team, not a customer card or old login metadata.
  const [staffName, setStaffName] = useState<string | null>(null)
  const [regMode, setRegMode] = useState(false)
  const EMPTY_REG = { email: '', password: '', company: '', org_nr: '', contact_name: '', phone: '' }
  const [regForm, setRegForm] = useState(EMPTY_REG)
  const [regType, setRegType] = useState<CustomerType>('business')
  const [visitorOpen, setVisitorOpen] = useState(false)
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regDone, setRegDone] = useState(false)
  const contact = useSiteContent<ContactContent>('contact', DEFAULT_CONTACT)
  const [navCats, setNavCats] = useState<{ id: string; name: string }[]>([])
  const [moreOpen, setMoreOpen] = useState(false)
  const [query, setQuery] = useState('')
  // The chosen category, marked in the menu (read after load: the address is not known on the server).
  const [activeCat, setActiveCat] = useState<string | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveCat(pathname === '/produkter' ? new URLSearchParams(window.location.search).get('kategori') || '' : null)
  }, [pathname])

  // The product categories make up the main menu.
  useEffect(() => {
    createClient().from('categories').select('*').then(({ data }) => {
      if (!data) return
      setNavCats([...data].sort((a: any, b: any) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || String(a.name).localeCompare(String(b.name), 'sv'))
        .map((c: any) => ({ id: String(c.id), name: String(c.name) })))
    })
  }, [])

  function search(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    setMenuOpen(false)
    setActiveCat(null)
    router.push(q ? `/produkter?q=${encodeURIComponent(q)}` : '/produkter')
  }

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
    const { data: { user } } = await sb.auth.getUser()
    if (user?.email && userRole(user) !== 'portal') {
      const { data: staff } = await sb.from('staff_members').select('full_name').ilike('email', user.email).maybeSingle()
      setStaffName(staff?.full_name || null)
    }
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
    setAuthUser(null); setCustomer(null); setStaffName(null); setCartItems([])
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
  const displayName = staffName || customer?.contact_name || authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Kund'
  const showCart = canShop

  const cartCtx: CartCtx = { items: pricedItems, addItem, removeItem, updateQty, clearCart, count, subtotal, openCart: () => setCartOpen(true), authUser, authLoading, customer, priceList, isPrivate, canShop }
  const dark = tone === 'dark'
  const goPortal = () => { sessionStorage.setItem('scrollToPortal', '1'); if (window.location.pathname === '/') document.getElementById('min-portal')?.scrollIntoView({ behavior: 'smooth' }); else window.location.href = '/' }
  const phoneHref = `tel:${contact.phone.replace(/[^+\d]/g, '')}`

  // Account: the login button for visitors, the name with a menu for those logged in.
  const account = !authLoading && (authUser ? (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setUserDropOpen(o => !o)} aria-label="Mitt konto" className="pub-icon-btn" style={{ gap: 8, width: 'auto', padding: '0 10px' }}>
        <User size={20} />
        <span className="pub-user-name">{displayName}</span>
        {priceList && priceList !== 'Standard' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(232,184,75,.18)', color: '#E8B84B', fontWeight: 800 }}>{priceList}</span>}
        <ChevronDown size={14} />
      </button>
      {userDropOpen && (
        <div className="pub-drop" style={{ right: 0, width: 230 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', fontSize: 12, color: '#A8A8A3' }}>
            {authUser.email}
            {customer?.company && <div style={{ fontWeight: 700, color: '#EDEDEA', marginTop: 2 }}>{customer.company}</div>}
          </div>
          {isCustomer && <>
            <button className="pub-drop-item" onClick={() => { setUserDropOpen(false); goPortal() }}><Package size={15} color="#E8B84B" /> Min portal</button>
            <button className="pub-drop-item" onClick={() => { setCartOpen(true); setUserDropOpen(false) }}><ShoppingCart size={15} /> Varukorg {count > 0 && `(${count})`}</button>
          </>}
          {role === 'admin' && <button className="pub-drop-item" onClick={goToPortal}><Package size={15} color="#E8B84B" /> Admin</button>}
          {role === 'crm' && <button className="pub-drop-item" onClick={goToPortal}><Package size={15} color="#E8B84B" /> CRM</button>}
          <button className="pub-drop-item" onClick={handleLogout} style={{ color: '#FF6B6B', borderTop: '1px solid rgba(255,255,255,.08)' }}><LogOut size={15} /> Logga ut</button>
        </div>
      )}
    </div>
  ) : (
    <button onClick={() => openLogin()} className="pub-icon-btn" style={{ gap: 8, width: 'auto', padding: '0 10px' }} aria-label="Logga in">
      <User size={20} /> <span className="pub-login-label">Logga in</span>
    </button>
  ))

  return (
    <CartContext.Provider value={cartCtx}>
    <div style={{ minHeight: '100vh', background: 'var(--shop-bg)', display: 'flex', flexDirection: 'column', color: 'var(--shop-text)', position: 'relative', ...(TONES[tone] as unknown as React.CSSProperties) }}>

      {/* ── Polygon background (light pages) ───────────────── */}
      {!dark && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} xmlns="http://www.w3.org/2000/svg">
          <rect width="1440" height="900" fill="#e8e4dc"/>
          <polygon points="0,0 320,0 180,200" fill="rgba(232,184,75,0.18)"/>
          <polygon points="320,0 600,0 500,180 180,200" fill="rgba(232,184,75,0.10)"/>
          <polygon points="600,0 900,0 820,220 500,180" fill="rgba(200,160,60,0.12)"/>
          <polygon points="900,0 1200,0 1100,160 820,220" fill="rgba(232,184,75,0.08)"/>
          <polygon points="1200,0 1440,0 1440,200 1100,160" fill="rgba(74,143,212,0.14)"/>
          <polygon points="180,200 500,180 420,420 80,400" fill="rgba(255,255,255,0.30)"/>
          <polygon points="820,220 1100,160 1120,400 780,460" fill="rgba(255,255,255,0.22)"/>
          <polygon points="420,420 780,460 740,680 380,660" fill="rgba(255,255,255,0.28)"/>
          <polygon points="380,660 740,680 720,900 300,900" fill="rgba(255,255,255,0.25)"/>
        </svg>
      </div>
      )}

      {/* ── Header: a top row (phone, company offer, search, account, cart)
             and the product categories under it ──────────────────────── */}
      <header className={`pub-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="pub-header-inner">
          <Link href="/" className="pub-logo" aria-label="Prolux Shine – startsidan">
            <Image src="/logo.svg" alt="Prolux Shine" width={166} height={30} priority style={{ display: 'block', height: 32, width: 'auto' }} />
          </Link>

          <div className="pub-rows">
            {/* Top row */}
            <div className="pub-top">
              <a href={phoneHref} className="pub-top-link pub-hide-md"><Phone size={14} /> {contact.phone}</a>
              {!authUser && (
                <button onClick={() => openLogin(true, 'business')} className="pub-top-link pub-hide-md" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Företagspriser för proffs <span style={{ color: '#E8B84B', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Registrera dig här <ArrowRight size={13} /></span>
                </button>
              )}
              <form onSubmit={search} role="search" className="pub-search pub-hide-sm">
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Sök produkter och varumärken" aria-label="Sök produkter" />
                <button type="submit" aria-label="Sök"><Search size={17} /></button>
              </form>
              <div className="pub-actions">
                <span className="pub-hide-sm">{account}</span>
                {showCart && (
                  <button key={`cart-${cartBump}`} className={`pub-icon-btn${cartBump ? ' pl-pop' : ''}`} onClick={() => setCartOpen(true)}
                    aria-label={count ? `Varukorg, ${count} ${count === 1 ? 'vara' : 'varor'}` : 'Varukorg'} title="Varukorg" style={{ position: 'relative' }}>
                    <ShoppingCart size={20} />
                    {count > 0 && <span className="pub-count">{count}</span>}
                  </button>
                )}
                <button onClick={() => setMenuOpen(o => !o)} className="pub-icon-btn pub-burger" aria-label="Meny" aria-expanded={menuOpen}>
                  {menuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
              </div>
            </div>

            {/* Category menu */}
            <nav className="pub-cats" aria-label="Kategorier">
              <Link href="/produkter" onClick={() => setActiveCat('')} className={`pub-cat${activeCat === '' ? ' is-active' : ''}`}>Alla produkter</Link>
              {navCats.map(c => (
                <Link key={c.id} href={`/produkter?kategori=${c.id}`} onClick={() => setActiveCat(c.id)} className={`pub-cat${activeCat === c.id ? ' is-active' : ''}`}>{c.name}</Link>
              ))}
              <div style={{ position: 'relative' }}>
                <button className="pub-pill" onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen}>Varumärken & mer <ChevronDown size={14} /></button>
                {moreOpen && (
                  <div className="pub-drop" style={{ left: 0, width: 240 }}>
                    <Link href="/produkter?q=Frescura" className="pub-drop-item" onClick={() => setMoreOpen(false)}>Frescura</Link>
                    <Link href="/produkter?q=Virtus" className="pub-drop-item" onClick={() => setMoreOpen(false)}>Virtus</Link>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,.08)' }} />
                    {NAV_MORE.map(n => <Link key={n.href} href={n.href} className="pub-drop-item" onClick={() => setMoreOpen(false)}>{n.label}</Link>)}
                  </div>
                )}
              </div>
              <Link href="/produkter?kampanj=1" className="pub-pill pub-pill-sale"><i /> Kampanj</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="pub-mobile-menu">
          <form onSubmit={search} role="search" className="pub-search" style={{ width: '100%', marginBottom: 8 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Sök produkter och varumärken" aria-label="Sök produkter" />
            <button type="submit" aria-label="Sök"><Search size={17} /></button>
          </form>
          <div className="pub-mm-title">Produkter</div>
          <Link href="/produkter" onClick={() => setMenuOpen(false)} className="pub-mm-link">Alla produkter <ChevronRight size={16} /></Link>
          {navCats.map(c => <Link key={c.id} href={`/produkter?kategori=${c.id}`} onClick={() => setMenuOpen(false)} className="pub-mm-link">{c.name} <ChevronRight size={16} /></Link>)}
          <Link href="/produkter?kampanj=1" onClick={() => setMenuOpen(false)} className="pub-mm-link" style={{ color: '#FF6B76' }}>Kampanj <ChevronRight size={16} /></Link>
          <div className="pub-mm-title">ProLux Shine</div>
          {NAV_MORE.map(n => <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="pub-mm-link">{n.label} <ChevronRight size={16} /></Link>)}
          <a href={phoneHref} className="pub-mm-link"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Phone size={15} /> {contact.phone}</span></a>
          <div style={{ height: 12 }} />
          {authUser ? (
            <>
              {isCustomer && (
                <button onClick={() => { setCartOpen(true); setMenuOpen(false) }} className="pub-mm-btn"><ShoppingCart size={17} /> Varukorg {count > 0 && `(${count})`}</button>
              )}
              <button onClick={() => { goToPortal(); setMenuOpen(false) }} className="pub-mm-btn is-gold"><Package size={17} /> {role === 'admin' ? 'Admin' : role === 'crm' ? 'CRM' : 'Min portal'}</button>
              <button onClick={handleLogout} className="pub-mm-btn" style={{ color: '#FF6B6B', borderColor: 'rgba(255,107,107,.35)' }}><LogOut size={15} /> Logga ut</button>
            </>
          ) : (
            <>
              <button onClick={() => openLogin(true)} className="pub-mm-btn is-gold">Skapa konto</button>
              <button onClick={() => openLogin()} className="pub-mm-btn">Logga in</button>
            </>
          )}
        </div>
      )}
      {moreOpen && <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 198 }} />}

      {userDropOpen && <div onClick={() => setUserDropOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 198 }} />}

      <LoginModalContext.Provider value={openLogin}>
        <main className="pub-main" style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          {children}
        </main>
      </LoginModalContext.Provider>

      {/* ── CART DRAWER ──────────────────────────────────────── */}
      {cartOpen && <div onClick={() => setCartOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 300, backdropFilter: 'blur(4px)' }} />}
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 100vw)', background: '#141417', color: '#EDEDEA', boxShadow: '-8px 0 40px rgba(0,0,0,.5)', zIndex: 301, display: 'flex', flexDirection: 'column', transform: cartOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .3s cubic-bezier(.22,.68,0,1.1)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#EDEDEA' }}>Varukorg</div>
            {count > 0 && <div style={{ fontSize: 12, color: '#A8A8A3', marginTop: 2 }}>{count} {count === 1 ? 'vara' : 'varor'} · {isPrivate ? `${fmt(withVat(subtotal))} kr inkl. moms` : `${fmt(subtotal)} kr exkl. moms`}</div>}
          </div>
          <button onClick={() => setCartOpen(false)} aria-label="Stäng varukorgen" style={{ padding: 8, background: '#222226', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#EDEDEA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
            <ShoppingCart size={48} color="#55555A" strokeWidth={1} style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#EDEDEA', marginBottom: 6 }}>Varukorgen är tom</div>
            <div style={{ fontSize: 13, color: '#A8A8A3', marginBottom: 24 }}>Lägg till produkter för att beställa</div>
            <button onClick={() => setCartOpen(false)} style={{ padding: '11px 24px', borderRadius: 8, background: '#222226', border: 'none', color: '#EDEDEA', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Fortsätt handla
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {pricedItems.map(item => (
                <div key={item.id} style={{ display: 'flex', gap: 14, paddingBlock: 14, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 8, background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={24} color="#ccc" strokeWidth={1} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#A8A8A3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{item.brand}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#EDEDEA', lineHeight: 1.3, marginBottom: 8 }}>{item.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid rgba(255,255,255,.14)', borderRadius: 7, overflow: 'hidden' }}>
                        <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F3EE', border: 'none', cursor: 'pointer', color: '#555' }}>
                          <Minus size={12} />
                        </button>
                        <span style={{ width: 32, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#EDEDEA' }}>{item.qty}</span>
                        <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F3EE', border: 'none', cursor: 'pointer', color: '#555' }}>
                          <Plus size={12} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ textAlign: 'right', lineHeight: 1.2 }}>
                          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#E8B84B' }}>{fmt(isPrivate ? withVat(item.unit_price * item.qty) : item.unit_price * item.qty)} kr</span>
                          <span style={{ display: 'block', fontSize: 10, color: '#A8A8A3' }}>{isPrivate ? 'inkl. moms' : `exkl. moms · ${fmt(withVat(item.unit_price * item.qty))} kr inkl.`}</span>
                        </span>
                        <button onClick={() => removeItem(item.id)} aria-label={`Ta bort ${item.name}`} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: '#8A8A85' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '16px 24px 24px', borderTop: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, color: '#A8A8A3' }}>
                <span>Delsumma exkl. moms</span>
                <span style={{ fontWeight: 600, color: '#EDEDEA' }}>{fmt(subtotal)} kr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 12, color: '#A8A8A3' }}>
                <span>{isPrivate ? 'Varav moms 25 %' : 'Moms 25 %'}</span>
                <span>{fmt(Math.round(subtotal * VAT_RATE))} kr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 16, fontWeight: 700, color: '#EDEDEA', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.08)' }}>
                <span>Totalt inkl. moms</span>
                <span style={{ color: '#E8B84B' }}>{fmt(withVat(subtotal))} kr</span>
              </div>
              <Link href="/kassa" onClick={() => setCartOpen(false)}
                style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 9, background: '#E8B84B', color: '#111', fontSize: 15, fontWeight: 800, textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
                Till kassan
              </Link>
              <button onClick={() => setCartOpen(false)} style={{ width: '100%', padding: '11px', borderRadius: 9, background: 'transparent', color: '#A8A8A3', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', marginTop: 8 }}>
                Fortsätt handla
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer id="kontakt" style={{ background: '#09090B', borderTop: '1px solid rgba(255,255,255,.07)', color: '#fff', padding: '64px 24px 32px', position: 'relative', zIndex: 1 }}>
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
        /* The closed cart drawer and decorative shapes sit off-screen; never let them scroll the page sideways. */
        html, body { overflow-x: clip; }
        .pub-header { position: fixed; top: 0; left: 0; right: 0; z-index: 200; background: rgba(9,9,11,.94); backdrop-filter: saturate(160%) blur(16px); -webkit-backdrop-filter: saturate(160%) blur(16px); border-bottom: 1px solid rgba(255,255,255,.08); transition: box-shadow .2s; }
        .pub-header.is-scrolled { box-shadow: 0 6px 24px rgba(0,0,0,.45); }
        .pub-header-inner { max-width: 1320px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; gap: 28px; min-height: 112px; }
        .pub-logo { flex-shrink: 0; display: flex; align-items: center; }
        .pub-rows { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .pub-top { display: flex; align-items: center; gap: 22px; height: 56px; }
        .pub-top-link { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: #C9C9C4; text-decoration: none; white-space: nowrap; font-family: inherit; }
        .pub-top-link:hover { color: #fff; }
        .pub-search { margin-left: auto; display: flex; align-items: center; width: min(340px, 34vw); border-bottom: 1px solid rgba(255,255,255,.25); }
        .pub-search input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: #EDEDEA; font-size: 14px; padding: 10px 2px; font-family: inherit; }
        .pub-search input::placeholder { color: #8A8A85; }
        .pub-search button { background: none; border: none; color: #C9C9C4; cursor: pointer; padding: 6px; display: flex; }
        .pub-search:focus-within { border-bottom-color: #E8B84B; }
        .pub-actions { display: flex; align-items: center; gap: 6px; }
        .pub-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 10px; background: transparent; border: none; color: #EDEDEA; cursor: pointer; font-size: 14px; font-weight: 600; font-family: inherit; white-space: nowrap; }
        .pub-icon-btn:hover { background: rgba(255,255,255,.08); }
        .pub-user-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
        .pub-count { position: absolute; top: 3px; right: 1px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: #E8B84B; color: #111; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
        .pub-cats { display: flex; align-items: center; gap: 4px; height: 56px; overflow-x: auto; scrollbar-width: none; }
        .pub-cats::-webkit-scrollbar { display: none; }
        .pub-cat { padding: 8px 12px; border-radius: 8px; font-size: 15px; font-weight: 500; color: #EDEDEA; text-decoration: none; white-space: nowrap; }
        .pub-cat:hover { background: rgba(255,255,255,.07); }
        .pub-cat.is-active { color: #E8B84B; }
        .pub-pill { display: inline-flex; align-items: center; gap: 7px; margin-left: 8px; padding: 7px 16px; border-radius: 999px; background: linear-gradient(#2A2A2F, #1B1B1F); border: 1px solid rgba(255,255,255,.14); box-shadow: inset 0 1px 0 rgba(255,255,255,.08); color: #EDEDEA; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; white-space: nowrap; font-family: inherit; }
        .pub-pill:hover { border-color: rgba(255,255,255,.3); }
        .pub-pill-sale { margin-left: auto; }
        .pub-pill-sale i { width: 9px; height: 9px; border-radius: 50%; background: #FF4D5E; box-shadow: 0 0 10px #FF4D5E; display: inline-block; }
        .pub-drop { position: absolute; top: calc(100% + 6px); background: #18181B; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,.5); overflow: hidden; z-index: 999; }
        .pub-drop-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 12px 16px; background: transparent; border: none; font-size: 14px; color: #EDEDEA; cursor: pointer; text-align: left; text-decoration: none; font-family: inherit; box-sizing: border-box; }
        .pub-drop-item:hover { background: rgba(255,255,255,.06); }
        .pub-burger { display: none; }
        .pub-main { padding-top: 112px; }
        .pub-mobile-menu { position: fixed; top: 64px; left: 0; right: 0; bottom: 0; background: #0D0D0F; z-index: 199; padding: 16px 20px 40px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; animation: fadeIn .15s ease; }
        .pub-mm-title { font-size: 11px; font-weight: 800; color: #8A8A85; text-transform: uppercase; letter-spacing: .12em; margin: 14px 4px 4px; }
        .pub-mm-link { display: flex; align-items: center; justify-content: space-between; padding: 14px 12px; border-bottom: 1px solid rgba(255,255,255,.06); color: #EDEDEA; font-size: 16px; font-weight: 500; text-decoration: none; }
        .pub-mm-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 15px 20px; margin-top: 8px; border-radius: 10px; background: transparent; border: 1px solid rgba(255,255,255,.16); color: #EDEDEA; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .pub-mm-btn.is-gold { background: #E8B84B; border-color: #E8B84B; color: #111; }
        @media (max-width: 1180px) { .pub-hide-md { display: none !important; } .pub-search { width: auto; flex: 1; max-width: 420px; } }
        @media (max-width: 860px) {
          .pub-header-inner { min-height: 64px; gap: 12px; padding: 0 14px; }
          .pub-top { height: 64px; justify-content: flex-end; }
          .pub-cats { display: none; }
          .pub-hide-sm { display: none !important; }
          .pub-burger { display: inline-flex; }
          .pub-main { padding-top: 64px; }
        }
        @media (max-width: 1320px) and (min-width: 861px) { .pub-login-label { display: none; } .pub-user-name { max-width: 90px; } }
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
