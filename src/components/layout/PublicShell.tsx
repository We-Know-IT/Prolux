'use client'
import { ReactNode, useState, useEffect, createContext, useContext, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, ChevronRight, ShoppingCart, User, LogOut, Package, ChevronDown, Minus, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'
import type { User as SupaUser } from '@supabase/supabase-js'

export const LoginModalContext = createContext<() => void>(() => {})
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
}
export const CartContext = createContext<CartCtx>({
  items: [], addItem: () => {}, removeItem: () => {}, updateQty: () => {}, clearCart: () => {},
  count: 0, subtotal: 0, openCart: () => {},
})
export function usePublicCart() { return useContext(CartContext) }

const DISCOUNT: Record<string, number> = { A: 0.40, B: 0.30, C: 0.20, Standard: 0 }

const NAV_PUBLIC = [
  { href: '/',             label: 'Hem' },
  { href: '/produkter',    label: 'Produkter' },
  { href: '/#pro-center',  label: 'Bli Återförsäljare' },
  { href: '/guider',       label: 'Bilvårdsutbildning' },
  { href: '/om-oss',       label: 'Om Oss' },
  { href: '/om-oss',       label: 'Kontakt' },
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

export function PublicShell({ children }: { children: ReactNode }) {
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
  const [orderPlacing, setOrderPlacing] = useState(false)
  const [orderDone, setOrderDone] = useState<number | null>(null)
  const [guestForm, setGuestForm] = useState({ name: '', company: '', email: '', address: '', city: '', phone: '' })
  const [guestStep, setGuestStep] = useState(false)
  const [regMode, setRegMode] = useState(false)
  const [regForm, setRegForm] = useState({ email: '', password: '', company: '', contact_name: '', phone: '' })
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regDone, setRegDone] = useState(false)

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null)
      setAuthLoading(false)
      if (session?.user) fetchCustomer(sb, session.user.id)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null)
      if (session?.user) fetchCustomer(sb, session.user.id)
      else { setCustomer(null); setCartItems([]) }
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

  function openLogin(startReg = false)  { setLoginOpen(true); setMenuOpen(false); setError(''); setRegError(''); setRegMode(startReg) }
  function closeLogin() { setLoginOpen(false); setEmail(''); setPassword(''); setError(''); setRegMode(false); setRegForm({ email: '', password: '', company: '', contact_name: '', phone: '' }); setRegError(''); setRegDone(false) }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const sb = createClient()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) { setError('Fel lösenord eller e-post. Försök igen.'); setLoading(false); return }
    setAuthUser(data.user)
    closeLogin()
    setLoading(false)
    const role = data.user?.user_metadata?.role
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
    if (!regForm.company.trim()) { setRegError('Företagsnamn krävs'); return }
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
        company: regForm.company,
        contact_name: regForm.contact_name,
        email: regForm.email,
        phone: regForm.phone,
        auth_user_id: data.user.id,
        price_list_id: 'Standard',
        status: 'active',
      }).select().single()
      if (!custErr && custData) {
        await sb.from('activities').insert({
          customer_id: custData.id,
          type: 'note',
          title: 'Nytt konto skapat',
          body: `Kund registrerade sig via webbshoppen.\n\nFöretag: ${custData.company}\nKontakt: ${custData.contact_name || '—'}\nE-post: ${custData.email}\nTelefon: ${custData.phone || '—'}`,
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
    const role = authUser?.user_metadata?.role
    if (role === 'admin') { window.location.href = '/admin/dashboard' }
    else if (role === 'crm') { window.location.href = '/crm/dashboard' }
    else { sessionStorage.setItem('scrollToPortal', '1'); window.location.pathname === '/' ? (() => { const el = document.getElementById('min-portal'); el ? el.scrollIntoView({ behavior: 'smooth' }) : null })() : (window.location.href = '/') }
    setUserDropOpen(false)
  }

  // Cart helpers
  const priceList = customer?.price_list_id || authUser?.user_metadata?.price_list_id || 'Standard'

  const addItem = useCallback((p: { id: string; name: string; brand: string; list_price: number; image_url: string | null; unit: string }, pl: string) => {
    const disc = DISCOUNT[pl] ?? 0
    const unit_price = Math.round(p.list_price * (1 - disc))
    setCartItems(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: p.id, name: p.name, brand: p.brand, unit_price, qty: 1, image_url: p.image_url, unit: p.unit, list_price: p.list_price }]
    })
    setCartOpen(true)
  }, [])

  const removeItem = useCallback((id: string) => setCartItems(prev => prev.filter(i => i.id !== id)), [])
  const updateQty  = useCallback((id: string, qty: number) => {
    if (qty <= 0) { removeItem(id); return }
    setCartItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i))
  }, [removeItem])
  const clearCart  = useCallback(() => setCartItems([]), [])
  const count      = cartItems.reduce((s, i) => s + i.qty, 0)
  const subtotal   = cartItems.reduce((s, i) => s + i.unit_price * i.qty, 0)

  async function placeOrder(deliveryOverride?: typeof guestForm) {
    if (cartItems.length === 0) return
    setOrderPlacing(true)
    const sb = createClient()
    const delivery = deliveryOverride || guestForm
    const { data: orderData, error: orderErr } = await sb.from('orders').insert({
      customer_id: customer?.id || null,
      price_list_id: priceList,
      status: 'pending',
      delivery_name: customer ? (customer.contact_name || customer.company) : delivery.name,
      delivery_address: delivery.address || customer?.address || '',
      delivery_city: customer?.city || delivery.city || '',
      notes: delivery.company ? `Företag: ${delivery.company}` : null,
      subtotal,
      vat_amount: Math.round(subtotal * 0.25),
      total: subtotal + Math.round(subtotal * 0.25),
    }).select().single()

    if (!orderErr && orderData) {
      const items = cartItems.map(i => ({
        order_id: orderData.id,
        product_id: i.id,
        product_name: i.name,
        product_sku: '',
        qty: i.qty,
        unit_price: i.unit_price,
        list_price: i.list_price,
        total_price: i.unit_price * i.qty,
      }))
      await sb.from('order_items').insert(items)
      setOrderDone(orderData.order_nr)
      setGuestStep(false)
      clearCart()
    }
    setOrderPlacing(false)
  }

  const role = authUser?.user_metadata?.role
  const displayName = customer?.contact_name || authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Kund'
  const isCustomer = authUser && role !== 'admin' && role !== 'crm'

  const navBg = scrolled ? 'rgba(13,15,20,.97)' : 'rgba(13,15,20,.92)'

  const cartCtx: CartCtx = { items: cartItems, addItem, removeItem, updateQty, clearCart, count, subtotal, openCart: () => setCartOpen(true) }

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
      <header style={{
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
          <Image src="/logo-mark.svg" alt="Prolux Shine" width={36} height={48} priority style={{ display: 'block' }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, gap: 2 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, letterSpacing: '.1em', color: '#fff', textTransform: 'uppercase' }}>Prolux Shine</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 8, fontWeight: 500, letterSpacing: '.18em', color: 'rgba(255,255,255,.45)', textTransform: 'uppercase' }}>Bilvårdsprodukter & Drömmar</span>
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#E8B84B', letterSpacing: '.06em', border: '1px solid rgba(232,184,75,.4)', padding: '1px 5px', borderRadius: 3 }}>FRESCURA</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,.5)', letterSpacing: '.06em', border: '1px solid rgba(255,255,255,.2)', padding: '1px 5px', borderRadius: 3 }}>VIRTUS</span>
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="pub-desktop-nav" style={{ display: 'none', gap: 0, flex: 1, alignItems: 'center', marginLeft: 24 }}>
          {NAV_PUBLIC.map(({ href, label }) => {
            const active = !href.includes('#') && href !== '/' && pathname.startsWith(href)
            return (
              <Link key={label} href={href} style={{
                padding: '7px 12px',
                color: active ? '#E8B84B' : 'rgba(255,255,255,.78)',
                fontSize: 13, fontWeight: active ? 700 : 600,
                textDecoration: 'none', transition: 'color .15s', whiteSpace: 'nowrap',
                letterSpacing: '.04em', textTransform: 'uppercase',
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
                  <button onClick={() => { sessionStorage.setItem('scrollToPortal', '1'); window.location.pathname === '/' ? (() => { const el = document.getElementById('min-portal'); el ? el.scrollIntoView({ behavior: 'smooth' }) : null })() : (window.location.href = '/') }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, transition: 'all .2s' }}>
                    <Package size={15} /> Min portal
                  </button>
                )}
                {/* Cart button for customers */}
                {isCustomer && (
                  <button onClick={() => setCartOpen(true)} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: count > 0 ? '#E8B84B' : 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', color: count > 0 ? '#111' : '#fff', fontSize: 13, fontWeight: 600, transition: 'all .2s' }}>
                    <ShoppingCart size={16} />
                    {count > 0 ? `${count} vara${count > 1 ? 'r' : ''}` : 'Varukorg'}
                    {count > 0 && (
                      <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#fff', color: '#111', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {count}
                      </span>
                    )}
                  </button>
                )}

                {/* User dropdown */}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setUserDropOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px 7px 10px', borderRadius: 8, background: '#E8B84B', color: '#0D0900', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#111', flexShrink: 0 }}>
                      {displayName[0]?.toUpperCase()}
                    </div>
                    {displayName}
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
                <button onClick={() => openLogin(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 22px', borderRadius: 24, background: '#E8B84B', color: '#0D0900', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '.04em' }}>
                  Skapa Konto
                </button>
                <button onClick={() => openLogin()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, background: 'transparent', color: 'rgba(255,255,255,.8)', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Logga In
                </button>
              </>
            )
          )}
        </div>

        {/* Mobile: cart icon + hamburger */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {isCustomer && count > 0 && (
            <button onClick={() => setCartOpen(true)} className="pub-mobile-btn" style={{ position: 'relative', padding: 8, background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
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
            {count > 0 && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{count} vara{count > 1 ? 'r' : ''} · {fmt(subtotal)} kr exkl. moms</div>}
          </div>
          <button onClick={() => setCartOpen(false)} style={{ padding: 8, background: '#F5F3EE', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {orderDone ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F0FDF4', border: '2px solid #4CAF7D', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, fontSize: 28 }}>✓</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, color: '#111', marginBottom: 8 }}>Order lagd!</div>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Order #{orderDone} har mottagits.</div>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 28 }}>Vi behandlar din beställning och hör av oss.</div>
            <button onClick={() => { setOrderDone(null); setCartOpen(false) }} style={{ padding: '12px 28px', borderRadius: 9, background: '#111', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Stäng
            </button>
          </div>
        ) : cartItems.length === 0 ? (
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
              {cartItems.map(item => (
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
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#C9971A' }}>{fmt(item.unit_price * item.qty)} kr</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, color: '#888' }}>
                <span>Delsumma exkl. moms</span>
                <span style={{ fontWeight: 600, color: '#111' }}>{fmt(subtotal)} kr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 12, color: '#bbb' }}>
                <span>Moms 25%</span>
                <span>{fmt(Math.round(subtotal * 0.25))} kr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 16, fontWeight: 700, color: '#111', paddingTop: 12, borderTop: '1px solid rgba(0,0,0,.07)' }}>
                <span>Totalt inkl. moms</span>
                <span style={{ color: '#C9971A' }}>{fmt(subtotal + Math.round(subtotal * 0.25))} kr</span>
              </div>
              {!authUser ? (
                <button onClick={() => { setCartOpen(false); openLogin() }} style={{ width: '100%', padding: '14px', borderRadius: 9, background: '#111', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  Logga in för att beställa
                </button>
              ) : customer ? (
                <button onClick={() => placeOrder()} disabled={orderPlacing} style={{ width: '100%', padding: '14px', borderRadius: 9, background: orderPlacing ? '#ddd' : '#111', color: orderPlacing ? '#999' : '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: orderPlacing ? 'default' : 'pointer' }}>
                  {orderPlacing ? 'Lägger order…' : 'Lägg order'}
                </button>
              ) : guestStep ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 12 }}>Leveransuppgifter</div>
                  {[
                    { key: 'name', label: 'Namn *', placeholder: 'Anna Svensson' },
                    { key: 'company', label: 'Företag', placeholder: 'AB Bilservice (valfritt)' },
                    { key: 'address', label: 'Adress *', placeholder: 'Storgatan 1' },
                    { key: 'city', label: 'Stad *', placeholder: 'Stockholm' },
                    { key: 'phone', label: 'Telefon', placeholder: '070-123 45 67' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>
                      <input value={(guestForm as any)[key]} onChange={e => setGuestForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 7, fontSize: 13, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <button onClick={() => placeOrder(guestForm)} disabled={orderPlacing || !guestForm.name || !guestForm.address || !guestForm.city}
                    style={{ width: '100%', padding: '13px', borderRadius: 9, background: '#111', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 8, opacity: (!guestForm.name || !guestForm.address || !guestForm.city) ? 0.5 : 1 }}>
                    {orderPlacing ? 'Lägger order…' : 'Bekräfta order'}
                  </button>
                  <button onClick={() => setGuestStep(false)} style={{ width: '100%', padding: '10px', borderRadius: 9, background: 'transparent', color: '#888', fontSize: 13, border: 'none', cursor: 'pointer', marginTop: 4 }}>Tillbaka</button>
                </div>
              ) : (
                <button onClick={() => setGuestStep(true)} style={{ width: '100%', padding: '14px', borderRadius: 9, background: '#111', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  Gå till kassa
                </button>
              )}
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
                <Image src="/logo-mark.svg" alt="Prolux Shine" width={22} height={30} style={{ display: 'block' }} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, gap: 1 }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 400, letterSpacing: '.14em', color: '#fff', textTransform: 'uppercase' }}>Prolux</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 6.5, fontWeight: 700, letterSpacing: '.45em', color: '#E8B84B', textTransform: 'uppercase' }}>Shine</span>
                </div>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', lineHeight: 1.75, maxWidth: 240, marginBottom: 20 }}>
                Exklusiv distributör för premium bilvårdssystem i Norden. Vi levererar prestanda och resultat till professionella användare.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                <a href="mailto:info@proluxshine.com" style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', textDecoration: 'none' }}>info@proluxshine.com</a>
                <a href="tel:+46700000000" style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', textDecoration: 'none' }}>+46 70-000 00 00</a>
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
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 18 }}>Säkra betalningar</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.7, marginBottom: 20 }}>
                Vi samarbetar med Klarna och Swish för smidiga och säkra transaktioner.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ background: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#1B1F2E' }}>Klarna</div>
                <div style={{ background: '#0A9960', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#fff' }}>Swish</div>
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

      {/* ── LOGIN / REGISTER MODAL ──────────────────────────── */}
      {loginOpen && (
        <div onClick={closeLogin} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn .15s ease' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,.2)', padding: '36px 32px', position: 'relative' }}>
            <button onClick={closeLogin} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', padding: 6 }}>
              <X size={18} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Image src="/logo-mark.svg" alt="Prolux Shine" width={36} height={49} style={{ display: 'block' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 400, letterSpacing: '.18em', color: '#111', textTransform: 'uppercase' }}>Prolux</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 7.5, fontWeight: 700, letterSpacing: '.45em', color: '#C9971A', textTransform: 'uppercase' }}>Shine</span>
              </div>
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
                <div style={{ marginBottom: 16, padding: '12px 14px', background: '#F5F3EE', border: '1px solid rgba(0,0,0,.06)', borderRadius: 10, fontSize: 12, color: '#888', lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 600, color: '#555', marginBottom: 6 }}>Demo-konton · lösenord: <span style={{ color: '#C9971A' }}>prolux2024</span></div>
                  {[
                    { label: 'bashar@proluxshine.se',     role: 'Admin',   color: '#B8860B', em: 'bashar@proluxshine.se' },
                    { label: 'stefan@detailingproffs.se', role: 'Säljare', color: '#2563EB', em: 'stefan@detailingproffs.se' },
                    { label: 'demo@proluxshine.se',       role: 'Kund',    color: '#16A34A', em: 'demo@proluxshine.se' },
                  ].map(({ label, role, color, em }) => (
                    <div key={em} onClick={() => { setEmail(em); setPassword('prolux2024') }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: 6, padding: '2px 4px' }}>
                      <span style={{ color: '#333' }}>{label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${color}18`, color }}>{role}</span>
                    </div>
                  ))}
                </div>
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
                <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
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
                <p style={{ fontSize: 13, color: '#888', margin: '0 0 4px', textAlign: 'center' }}>Skapa ditt B2B-konto — det tar en minut</p>
                {[
                  { key: 'company', label: 'Företagsnamn *', placeholder: 'AB Bilservice', type: 'text' },
                  { key: 'contact_name', label: 'Kontaktperson', placeholder: 'Erik Lindgren', type: 'text' },
                  { key: 'email', label: 'E-post *', placeholder: 'erik@foretag.se', type: 'email' },
                  { key: 'password', label: 'Välj lösenord *', placeholder: 'Minst 6 tecken', type: 'password' },
                  { key: 'phone', label: 'Telefon', placeholder: '08-123 45 67', type: 'tel' },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</label>
                    <input type={type} value={(regForm as any)[key]} onChange={e => setRegForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={S.inp}
                      onFocus={e => { e.currentTarget.style.borderColor = '#C9971A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,151,26,.12)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.1)'; e.currentTarget.style.boxShadow = 'none' }} />
                  </div>
                ))}
                {regError && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>{regError}</div>}
                <button type="submit" disabled={regLoading || !regForm.company || !regForm.email || !regForm.password} style={{ width: '100%', padding: '13px', background: (regLoading || !regForm.company || !regForm.email || !regForm.password) ? '#ddd' : '#111', color: (regLoading || !regForm.company || !regForm.email || !regForm.password) ? '#999' : '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 8, cursor: (regLoading || !regForm.company || !regForm.email || !regForm.password) ? 'default' : 'pointer', marginTop: 4 }}>
                  {regLoading ? 'Skapar konto…' : 'Skapa konto'}
                </button>
                <p style={{ fontSize: 11, color: '#bbb', textAlign: 'center', margin: 0 }}>Ditt konto kopplas direkt till vår B2B-portal och CRM.</p>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        .pub-desktop-nav   { display: none !important; }
        .pub-desktop-right { display: none !important; }
        .pub-mobile-btn    { display: flex !important; }
        @media (min-width: 860px) {
          .pub-desktop-nav   { display: flex !important; }
          .pub-desktop-right { display: flex !important; }
          .pub-mobile-btn    { display: none !important; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
    </CartContext.Provider>
  )
}
