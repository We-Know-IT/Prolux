'use client'
// Demo page – no auth required, uses mock data to showcase the CRM UI
import { useState } from 'react'
import { Plus, Minus, Search, ShoppingCart, Package, ArrowLeft, ChevronDown, Tag, Truck,
         LayoutDashboard, GitBranch, Users, FileText, LogOut, Menu, X,
         Clock, ChevronRight, Eye, TrendingUp, Target, ShoppingBag } from 'lucide-react'
import Image from 'next/image'
import { fmt, custPrice } from '@/lib/utils'
import type { Customer, Product, CartItem, PriceList } from '@/types'

// ── MOCK DATA ──────────────────────────────────────────────
const MOCK_CUSTOMERS: Customer[] = [
  { id:'1', email:'anna@bilverkstad.se', company:'Bilverkstad Stockholm AB', contact_name:'Anna Lindberg', contact_role:'Inköpsansvarig', phone:'073-456 78 90', city:'Stockholm', org_nr:'556123-4567', price_list_id:'A', status:'active', notes:null, birthday:null, last_order_at:'2026-06-20', created_at:'2025-01-15' },
  { id:'2', email:'erik@cleancars.se', company:'Clean Cars Göteborg', contact_name:'Erik Svensson', contact_role:'VD', phone:'031-987 65 43', city:'Göteborg', org_nr:'556234-5678', price_list_id:'B', status:'active', notes:null, birthday:null, last_order_at:'2026-06-18', created_at:'2025-02-10' },
  { id:'3', email:'maja@prodetailing.se', company:'Pro Detailing Malmö', contact_name:'Maja Johansson', contact_role:'Inköpare', phone:'040-123 45 67', city:'Malmö', org_nr:'556345-6789', price_list_id:'C', status:'active', notes:null, birthday:null, last_order_at:'2026-06-15', created_at:'2025-03-05' },
]

const MOCK_PRODUCTS: Product[] = [
  { id:'1', sku:'FRE-RAP-25', name:'Rapidet', description:'Kraftfullt alkaliskt avfettningsmedel', category_id:'1', brand:'Frescura', list_price:998, unit:'25 kg', stock_qty:45, badge:'top', image_url:'https://proluxshine.com/cdn/rapidet.jpg', active:true, sort_order:1 },
  { id:'2', sku:'FRE-MAG-25', name:'Magic', description:'Neutralt bilvårdsmedel', category_id:'1', brand:'Frescura', list_price:582, unit:'25 kg', stock_qty:32, badge:null, image_url:'https://proluxshine.com/cdn/magic.jpg', active:true, sort_order:2 },
  { id:'3', sku:'FRE-GOM-25', name:'Gommalux Liquido', description:'Gummiskydd och förnyare', category_id:'2', brand:'Frescura', list_price:748, unit:'25 kg', stock_qty:28, badge:null, image_url:null, active:true, sort_order:3 },
  { id:'4', sku:'FRE-GRE-25', name:'Green Power', description:'Miljövänligt bilvårdsmedel', category_id:'1', brand:'Frescura', list_price:1165, unit:'25 kg', stock_qty:19, badge:'new', image_url:null, active:true, sort_order:4 },
  { id:'5', sku:'VIR-WAX-01', name:'Premium Carnauba Vax', description:'Högkvalitativt carnauba-vax för långvarigt skydd', category_id:'3', brand:'Virtus', list_price:638, unit:'1 L', stock_qty:55, badge:'top', image_url:null, active:true, sort_order:5 },
  { id:'6', sku:'VIR-COA-01', name:'Keramisk Coating', description:'Professionell keramisk coating', category_id:'3', brand:'Virtus', list_price:1700, unit:'50 mL', stock_qty:12, badge:null, image_url:null, active:true, sort_order:6 },
]

type Screen = 'dashboard' | 'new-order' | 'confirm' | 'pipeline' | 'customers'

const NAV = [
  { key: 'dashboard', label: 'Översikt', icon: LayoutDashboard, href: '#' },
  { key: 'pipeline', label: 'Pipeline', icon: GitBranch, href: '#' },
  { key: 'customers', label: 'Kunder', icon: Users, href: '#' },
  { key: 'new-order', label: 'Ordrar', icon: FileText, href: '#' },
]

const PIPELINE_DEALS = [
  { id:'1', stage:'Prospekt', company:'AutoGlans Nordic', value:24000 },
  { id:'2', stage:'Kontaktad', company:'Carshine Pro', value:8500 },
  { id:'3', stage:'Offert', company:'Bilservice AB', value:12400 },
  { id:'4', stage:'Förhandling', company:'Detailing Stockholm', value:31000 },
  { id:'5', stage:'Vunnen', company:'ProCar Wash', value:15600 },
  { id:'6', stage:'Förlorad', company:'BilCenter Väst', value:7200 },
]

const STAGE_COLORS: Record<string, string> = {
  Prospekt: 'var(--text3)', Kontaktad: 'var(--blue)', Offert: 'var(--gold)',
  Förhandling: '#9B6EE8', Vunnen: 'var(--green)', Förlorad: 'var(--red)'
}
const STAGES = ['Prospekt','Kontaktad','Offert','Förhandling','Vunnen','Förlorad']

// ── SHELL ──────────────────────────────────────────────────
function CrmShell({ screen, setScreen, children }: { screen: Screen, setScreen: (s: Screen) => void, children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        height: 58, position: 'sticky', top: 0, zIndex: 200,
        background: 'rgba(8,10,14,.88)',
        backdropFilter: 'saturate(180%) blur(24px)',
        WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        boxShadow: '0 1px 0 rgba(255,255,255,.03) inset',
        display: 'flex', alignItems: 'center', paddingInline: 20, gap: 12,
      }}>
        <button onClick={() => setScreen('dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0, display: 'flex', alignItems: 'center' }}>
          <Image src="/logo.svg" alt="Prolux Shine" width={166} height={30} priority style={{ display: 'block', height: 30, width: 'auto' }} />
        </button>
        <nav style={{ display: 'none', gap: 2, flex: 1, justifyContent: 'center' }} className="desktop-nav-demo">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = screen === key || (key === 'new-order' && screen === 'confirm')
            return (
              <button key={key} onClick={() => setScreen(key as Screen)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 7, background: active ? 'rgba(232,184,75,.09)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text3)', fontSize: 13, fontWeight: active ? 600 : 400, border: `1px solid ${active ? 'rgba(232,184,75,.22)' : 'transparent'}`, cursor: 'pointer', transition: 'all .15s' }}>
                <Icon size={14} style={{ opacity: active ? 1 : 0.6 }} /> {label}
              </button>
            )
          })}
        </nav>
        <button onClick={() => setMenuOpen(o => !o)} className="mobile-menu-btn-demo" style={{ marginLeft: 'auto', padding: 8, background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      {menuOpen && (
        <div style={{ position: 'fixed', top: 58, left: 0, right: 0, bottom: 0, background: 'rgba(8,10,14,.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', zIndex: 199, padding: '20px 16px 32px', display: 'flex', flexDirection: 'column', gap: 6, animation: 'fadeIn .15s ease' }}>
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = screen === key
            return (
              <button key={key} onClick={() => { setScreen(key as Screen); setMenuOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 10, background: active ? 'rgba(232,184,75,.08)' : 'rgba(255,255,255,.03)', color: active ? 'var(--gold)' : 'var(--text)', fontSize: 15, fontWeight: active ? 600 : 400, border: `1px solid ${active ? 'rgba(232,184,75,.22)' : 'rgba(255,255,255,.06)'}`, cursor: 'pointer', textAlign: 'left', boxShadow: active ? '0 0 20px rgba(232,184,75,.08)' : 'none' }}>
                <Icon size={18} style={{ color: active ? 'var(--gold)' : 'var(--text3)', opacity: active ? 1 : 0.7 }} /> {label}
              </button>
            )
          })}
          <div style={{ flex: 1 }} />
          <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
            Demo-läge — mock-data
          </div>
        </div>
      )}
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <style>{`
        @media (min-width: 768px) {
          .desktop-nav-demo { display: flex !important; }
          .mobile-menu-btn-demo { display: none !important; }
        }
      `}</style>
    </div>
  )
}

// ── SCREENS ────────────────────────────────────────────────

function Dashboard({ setScreen }: { setScreen: (s: Screen) => void }) {
  const kpis = [
    { label: 'Aktiva kunder', value: '24', icon: Users, color: 'var(--blue)' },
    { label: 'Deals i pipeline', value: '8', icon: Target, color: 'var(--gold)' },
    { label: 'Pipeline-värde', value: '182 400 kr', icon: TrendingUp, color: 'var(--green)' },
    { label: 'Intäkt denna månad', value: '48 600 kr', icon: ShoppingBag, color: 'var(--gold)' },
  ]

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 60px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Välkommen, Bashar</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14, margin: '6px 0 0' }}>Välkommen till säljportalen. Vad vill du göra?</p>
      </div>

      {/* Ny order – big CTA */}
      <button onClick={() => setScreen('new-order')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px', background: 'var(--gold)', borderRadius: 14, border: 'none', cursor: 'pointer', marginBottom: 16, width: '100%' }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(0,0,0,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={20} color="#111" strokeWidth={2.5} />
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#111' }}>Ny order</div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,.5)', marginTop: 2 }}>Välj kund → Lägg till produkter → skicka order</div>
        </div>
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'Ny offert', sub: 'Välj kund → Lägg till produkter → skicka offert som pdf', icon: Plus, screen: 'pipeline' as Screen },
          { label: 'Skapa ny kund', sub: 'Registrera en ny kund i systemet.', icon: Plus, screen: 'customers' as Screen },
          { label: 'Kunder', sub: 'Sök kunder, se kundkort, historik och skapa ordrar.', icon: Users, screen: 'customers' as Screen },
          { label: 'Alla ordrar', sub: 'Se, öppna och kopiera alla ordrar.', icon: FileText, screen: 'new-order' as Screen },
          { label: 'Visa produkter', sub: 'Se alla produkter och beskrivning.', icon: Package, screen: 'new-order' as Screen },
        ].map(({ label, sub, icon: Icon, screen }) => (
          <button key={label} onClick={() => setScreen(screen)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={16} color="var(--gold)" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>{sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* KPI strip (desktop) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        {kpis.slice(0,4).map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} color={color} />
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Customer questions */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Clock size={15} color="var(--text3)" />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Frågor från kunder</h2>
        </div>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {['Vad är skillnaden mellan den här och Magic?', 'Pris om vi beställer 20 st istället för 10?', 'Få den här produkten med leverans denna vecka?'].map((q, i, arr) => (
            <div key={q} style={{ padding: '13px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 400 }}>{q}</span>
              <ChevronRight size={14} color="var(--text3)" />
            </div>
          ))}
        </div>
      </div>

      {/* Sent quotes */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Clock size={15} color="var(--text3)" />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Skickade offerter</h2>
        </div>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {[{ company: 'Bilverkstad Stockholm AB', date: '2026-06-28', value: 12400, followUp: true },
            { company: 'Clean Cars Göteborg', date: '2026-06-22', value: 8750, followUp: false },
            { company: 'Pro Detailing Malmö', date: '2026-06-23', value: 22000, followUp: false }].map((o, i, arr) => (
            <div key={o.company} style={{ padding: '13px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{o.company}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Skickades {o.date}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {o.followUp && <button onClick={() => setScreen('pipeline')} style={{ padding: '5px 10px', background: 'rgba(232,184,75,.12)', border: '1px solid rgba(232,184,75,.25)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: 'var(--gold)', cursor: 'pointer' }}>Följ upp</button>}
                <button onClick={() => setScreen('pipeline')} style={{ padding: '5px 10px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }}>Visa offert</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent customers */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Eye size={15} color="var(--text3)" />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Senaste visade kunder</h2>
        </div>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {['Bilverkstad Stockholm AB', 'Clean Cars Göteborg', 'Pro Detailing Malmö'].map((name, i, arr) => (
            <button key={name} onClick={() => setScreen('customers')} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', background: 'none', border: 'none', width: '100%', cursor: 'pointer', borderRadius: i === 0 ? '12px 12px 0 0' : i === arr.length - 1 ? '0 0 12px 12px' : '0' }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 500, textAlign: 'left' }}>{name}</span>
              <ChevronRight size={14} color="var(--text3)" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function NewOrder({ setScreen }: { setScreen: (s: Screen) => void }) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])

  function addToCart(p: Product) {
    const pl: PriceList = selectedCustomer?.price_list_id || 'Standard'
    const unitPrice = custPrice(p.list_price, pl)
    setCart(items => {
      const ex = items.find(i => i.product.id === p.id)
      if (ex) return items.map(i => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...items, { product: p, qty: 1, unitPrice }]
    })
  }
  function updateQty(id: string, delta: number) {
    setCart(items => items.map(i => i.product.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0))
  }
  const getQty = (id: string) => cart.find(i => i.product.id === id)?.qty || 0
  const subtotal = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0)

  const filteredCustomers = MOCK_CUSTOMERS.filter(c => !customerSearch || c.company.toLowerCase().includes(customerSearch.toLowerCase()))
  const filteredProducts = MOCK_PRODUCTS.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.brand.toLowerCase().includes(productSearch.toLowerCase()))

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 58px)', overflow: 'hidden' }}>
      {/* LEFT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Skapa ny order</h1>
          <button onClick={() => setScreen('dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>← Tillbaka</button>
        </div>

        {/* Customer selector */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={15} color="var(--text3)" /> Välj kund
            </span>
            <button style={{ padding: '6px 14px', background: 'var(--gold)', border: 'none', borderRadius: 6, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Skapa ny kund</button>
          </div>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input placeholder="Sök företag..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 30px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            {filteredCustomers.map(c => (
              <button key={c.id} onClick={() => { setSelectedCustomer(c); setCart([]) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: selectedCustomer?.id === c.id ? 'rgba(232,184,75,.08)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border2)', cursor: 'pointer' }}>
                <span style={{ fontSize: 13, color: selectedCustomer?.id === c.id ? 'var(--gold)' : 'var(--text)', fontWeight: selectedCustomer?.id === c.id ? 600 : 400 }}>{c.company}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Prislista {c.price_list_id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Product search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input placeholder="Sök produkt..." value={productSearch} onChange={e => setProductSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 34px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Product rows */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {filteredProducts.map((p, i) => {
            const pl: PriceList = selectedCustomer?.price_list_id || 'Standard'
            const price = custPrice(p.list_price, pl)
            const qty = getQty(p.id)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: i < filteredProducts.length - 1 ? '1px solid var(--border2)' : 'none' }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={20} color="var(--text3)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.brand} · {p.unit}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', minWidth: 70, textAlign: 'right' }}>{fmt(price)} kr</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => updateQty(p.id, -1)} disabled={qty === 0}
                    style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--bg4)', border: '1px solid var(--border)', color: qty === 0 ? 'var(--text3)' : 'var(--text)', cursor: qty === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Minus size={13} />
                  </button>
                  <span style={{ width: 26, textAlign: 'center', fontSize: 14, fontWeight: 700, color: qty > 0 ? 'var(--gold)' : 'var(--text3)' }}>{qty}</span>
                  <button onClick={() => addToCart(p)}
                    style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--gold)', border: 'none', color: '#111', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* RIGHT: cart */}
      <div style={{ width: 310, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg2)', flexShrink: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Varukorg</span>
          {selectedCustomer && <span style={{ fontSize: 11, color: 'var(--text2)' }}>{selectedCustomer.company}</span>}
        </div>
        {cart.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text3)' }}>
            <ShoppingCart size={36} strokeWidth={1.2} />
            <span style={{ fontSize: 13 }}>Varukorgen är tom</span>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Produkt','Antal','À-pris','Summa'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cart.map(i => (
                    <tr key={i.product.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                      <td style={{ padding: '9px 10px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12 }}>{i.product.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{i.product.brand} · {i.product.unit}</div>
                      </td>
                      <td style={{ padding: '9px 10px', color: 'var(--text2)' }}>{i.qty}</td>
                      <td style={{ padding: '9px 10px', color: 'var(--text2)' }}>{fmt(i.unitPrice)} kr</td>
                      <td style={{ padding: '9px 10px', fontWeight: 700, color: 'var(--text)' }}>{fmt(i.qty * i.unitPrice)} kr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                <span>Summa (ex. moms)</span><span>{fmt(subtotal)} kr</span>
              </div>
              {!selectedCustomer && <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 10 }}>Välj en kund för att fortsätta</p>}
              <button onClick={() => { if (selectedCustomer && cart.length > 0) setScreen('confirm') }}
                disabled={!selectedCustomer || cart.length === 0}
                style={{ width: '100%', padding: '13px 0', background: selectedCustomer && cart.length > 0 ? 'var(--gold)' : 'var(--bg4)', border: 'none', borderRadius: 9, color: selectedCustomer && cart.length > 0 ? '#111' : 'var(--text3)', fontSize: 14, fontWeight: 700, cursor: selectedCustomer && cart.length > 0 ? 'pointer' : 'not-allowed' }}>
                Skapa order
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Pipeline({ setScreen }: { setScreen: (s: Screen) => void }) {
  const [deals, setDeals] = useState(PIPELINE_DEALS)

  function moveDeal(id: string, dir: 1 | -1) {
    setDeals(ds => ds.map(d => {
      if (d.id !== id) return d
      const idx = STAGES.indexOf(d.stage)
      const newStage = STAGES[Math.max(0, Math.min(STAGES.length - 1, idx + dir))]
      return { ...d, stage: newStage }
    }))
  }

  return (
    <div style={{ padding: '24px 20px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Pipeline</h1>
        <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> Ny deal
        </button>
      </div>
      <div style={{ display: 'flex', gap: 12, minWidth: 'max-content', paddingBottom: 16 }}>
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage)
          const total = stageDeals.reduce((s, d) => s + d.value, 0)
          return (
            <div key={stage} style={{ width: 220, flexShrink: 0 }}>
              <div style={{ padding: '10px 14px', background: 'var(--bg3)', borderRadius: '10px 10px 0 0', border: '1px solid var(--border)', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: STAGE_COLORS[stage] }}>{stage}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{stageDeals.length} · {fmt(total)} kr</span>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '0 0 10px 10px', padding: '10px 10px', minHeight: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stageDeals.map(d => (
                  <div key={d.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{d.company}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>{fmt(d.value)} kr</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => moveDeal(d.id, -1)} disabled={STAGES.indexOf(d.stage) === 0}
                        style={{ flex: 1, padding: '5px 0', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text3)', fontSize: 10, cursor: 'pointer' }}>← Tillbaka</button>
                      <button onClick={() => moveDeal(d.id, 1)} disabled={STAGES.indexOf(d.stage) === STAGES.length - 1}
                        style={{ flex: 1, padding: '5px 0', background: 'rgba(232,184,75,.1)', border: '1px solid rgba(232,184,75,.2)', borderRadius: 5, color: 'var(--gold)', fontSize: 10, cursor: 'pointer' }}>Nästa →</button>
                    </div>
                  </div>
                ))}
                {stageDeals.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>Inga deals</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Customers({ setScreen }: { setScreen: (s: Screen) => void }) {
  const [selected, setSelected] = useState<Customer | null>(null)
  const PL_LABELS: Record<PriceList, string> = { A: 'Prislista A (–40%)', B: 'Prislista B (–30%)', C: 'Prislista C (–20%)', Standard: 'Standard (0%)' }
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 58px)', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Kunder</h1>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={14} /> Ny kund
          </button>
        </div>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {MOCK_CUSTOMERS.map((c, i) => (
            <button key={c.id} onClick={() => setSelected(c)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: selected?.id === c.id ? 'rgba(232,184,75,.06)' : 'transparent', border: 'none', borderBottom: i < MOCK_CUSTOMERS.length - 1 ? '1px solid var(--border2)' : 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{c.company[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: selected?.id === c.id ? 'var(--gold)' : 'var(--text)' }}>{c.company}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.contact_name} · {c.city}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg4)', padding: '3px 8px', borderRadius: 4 }}>PL {c.price_list_id}</span>
            </button>
          ))}
        </div>
      </div>
      {selected && (
        <div style={{ width: 340, borderLeft: '1px solid var(--border)', background: 'var(--bg2)', overflowY: 'auto' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{selected.company}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Org.nr: {selected.org_nr}</div>
          </div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[['Kontaktperson', selected.contact_name], ['E-post', selected.email], ['Telefon', selected.phone || '—'], ['Ort', selected.city || '—'], ['Prislista', PL_LABELS[selected.price_list_id]]].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{val}</div>
              </div>
            ))}
            <button onClick={() => setScreen('new-order')} style={{ padding: '11px 0', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
              Skapa order för {selected.company}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfirmOrder({ setScreen }: { setScreen: (s: Screen) => void }) {
  const customer = MOCK_CUSTOMERS[0]
  const exampleCart: CartItem[] = [
    { product: MOCK_PRODUCTS[0], qty: 4, unitPrice: custPrice(MOCK_PRODUCTS[0].list_price, 'A') },
    { product: MOCK_PRODUCTS[1], qty: 1, unitPrice: custPrice(MOCK_PRODUCTS[1].list_price, 'A') },
    { product: MOCK_PRODUCTS[3], qty: 2, unitPrice: custPrice(MOCK_PRODUCTS[3].list_price, 'A') },
  ]
  const [discountEnabled, setDiscountEnabled] = useState(false)
  const [discount, setDiscount] = useState('')
  const [delivery, setDelivery] = useState('Direkt')
  const subtotal = exampleCart.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const discountAmt = discountEnabled ? parseInt(discount) || 0 : 0
  const afterDiscount = Math.max(0, subtotal - discountAmt)
  const vat = Math.round(afterDiscount * 0.25)
  const total = afterDiscount + vat

  return (
    <div style={{ padding: '24px 20px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Bekräfta order</h1>
        <button onClick={() => setScreen('new-order')} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Gå tillbaka och ändra order
        </button>
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{customer.company}</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 20px' }}>Org.nr: {customer.org_nr}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 32px' }}>
          {[['Kontaktperson', customer.contact_name], ['E-post', customer.email], ['Telefon', customer.phone || '—'], ['Adress', customer.city || '—'], ['Fakturaadress', customer.city || '—'], ['Referens', customer.contact_name]].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: discountEnabled ? 14 : 0 }}>
          <input type="checkbox" checked={discountEnabled} onChange={e => setDiscountEnabled(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Lägg till rabatt</span>
        </label>
        {discountEnabled && (
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input type="number" placeholder="Ange belopp" value={discount} onChange={e => setDiscount(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none' }} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 13 }}>kr</span>
            </div>
            <button style={{ padding: '11px 20px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Lägg till rabatt</button>
          </div>
        )}
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={15} color="var(--text3)" /> Leverans
        </h3>
        <div style={{ position: 'relative' }}>
          <select value={delivery} onChange={e => setDelivery(e.target.value)} style={{ width: '100%', padding: '11px 36px 11px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', appearance: 'none', cursor: 'pointer' }}>
            <option>Direkt</option><option>Standard (2-3 dagar)</option><option>Express (nästa dag)</option>
          </select>
          <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
        </div>
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Kassan</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Produkt','Antal','À-pris','Summa'].map(h => <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {exampleCart.map(i => (
              <tr key={i.product.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                <td style={{ padding: '11px 20px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{i.product.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i.product.brand} · {i.product.unit}</div>
                </td>
                <td style={{ padding: '11px 20px', color: 'var(--text2)' }}>{i.qty}</td>
                <td style={{ padding: '11px 20px', color: 'var(--text2)' }}>{fmt(i.unitPrice)} kr</td>
                <td style={{ padding: '11px 20px', fontWeight: 700, color: 'var(--text)' }}>{fmt(i.qty * i.unitPrice)} kr</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {discountAmt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--green)' }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Tag size={13} /> Rabatt</span><span>-{fmt(discountAmt)} kr</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)' }}><span>Moms (25%)</span><span>{fmt(vat)} kr</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--text)', paddingTop: 8, borderTop: '1px solid var(--border)' }}><span>Totalt inkl. moms</span><span style={{ color: 'var(--gold)' }}>{fmt(total)} kr</span></div>
        </div>
      </div>
      <button onClick={() => { alert('✅ Order skapad! (Demo-läge)'); setScreen('dashboard') }}
        style={{ width: '100%', padding: '15px 0', background: 'var(--gold)', border: 'none', borderRadius: 10, color: '#111', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        Bekräfta och skapa order
      </button>
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────
export default function DemoPage() {
  const [screen, setScreen] = useState<Screen>('dashboard')

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard': return <Dashboard setScreen={setScreen} />
      case 'new-order': return <NewOrder setScreen={setScreen} />
      case 'confirm':   return <ConfirmOrder setScreen={setScreen} />
      case 'pipeline':  return <Pipeline setScreen={setScreen} />
      case 'customers': return <Customers setScreen={setScreen} />
    }
  }

  return (
    <CrmShell screen={screen} setScreen={setScreen}>
      {/* Demo banner */}
      <div style={{ background: 'rgba(232,184,75,.08)', borderBottom: '1px solid rgba(232,184,75,.15)', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--gold)' }}>
        <span>🎯</span>
        <span style={{ fontWeight: 600 }}>Demo-läge</span>
        <span style={{ color: 'var(--text2)', fontWeight: 400 }}>— mock-data, ingen Supabase-koppling. Alla skärmar är klickbara.</span>
      </div>
      {renderScreen()}
    </CrmShell>
  )
}
