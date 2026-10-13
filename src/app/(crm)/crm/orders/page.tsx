'use client'
import { Fragment, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Product, Customer, Category, CartItem, Order, OrderItem, OrderStatus, ORDER_STATUS_LABEL } from '@/types'
import { custPrice, fmt, formatDateTime } from '@/lib/utils'
import IncVat from '@/components/orders/IncVat'
import { withVat } from '@/lib/pricing'
import { invoiceInVismaInBackground } from '@/lib/visma'
import { Plus, Minus, ShoppingCart, Search, Package, ArrowLeft, ChevronDown, Tag, Truck, Star, X, RefreshCw, Trash2, UserPlus, Check, FileDown, Mail, Copy } from 'lucide-react'
import NewCustomerModal from '@/components/crm/NewCustomerModal'
import Portal from '@/components/ui/Portal'
import { recommendFor } from '@/lib/recommend'
import { buildQuotePdf, downloadBlob, type QuotePdfInput } from '@/lib/quote-pdf'
import { buildQuoteHtml } from '@/lib/quote-html'
import { DEFAULT_CONTACT } from '@/lib/site-content'
import { readCart, writeCart, OPEN_CART_EVENT, deleteOpenOrder as removeOpenOrder, findMyLatestDraft, startOfToday, cleanOldCarts } from '@/lib/crm-cart'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { currentStaff, canConfirmOrder, NOT_LIVE_FILTER } from '@/lib/team'
import { useTeam, teamOptions } from '@/hooks/useTeam'
import ShipOrderForm from '@/components/orders/ShipOrderForm'
import { stockStatus } from '@/lib/stock'

const supabase = createClient()
type View = 'new' | 'confirm' | 'history'

// Product picture in the cart; the icon stands in when a product has none.
function Thumb({ p, size = 36 }: { p: Product; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 6, background: '#F4F2EE', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {p.image_url
        ? <img src={p.image_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        : <Package size={Math.round(size * 0.45)} color="#999" />}
    </div>
  )
}

// Catalogue card: big picture, name, price and +/- right on the card.
function ProductCard({ p, selectedCustomer, qty, onAdd, onRemove, onOpen, badge, inCar = 0 }: {
  p: Product
  inCar?: number
  selectedCustomer: Customer | null
  qty: number
  onAdd: () => void
  onRemove: () => void
  onOpen: () => void
  badge?: 'köpt' | 'rec'
}) {
  const price = custPrice(p.list_price, selectedCustomer?.price_list_id || 'Standard')
  const stock = stockStatus(p.stock_qty)
  return (
    <div style={{ background: 'var(--bg3)', border: `1px solid ${qty > 0 ? 'rgba(232,184,75,.55)' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <button type="button" onClick={onOpen} aria-label={`Visa ${p.name}`}
        style={{ position: 'relative', height: 190, padding: 14, background: '#fff', border: 'none', cursor: 'zoom-in', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {p.image_url ? <img src={p.image_url} alt="" loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Package size={48} strokeWidth={1.2} color="#bbb" />}
        {badge && (
          <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.05em',
            background: badge === 'köpt' ? '#E8B84B' : '#4A8FD4', color: badge === 'köpt' ? '#111' : '#fff' }}>
            {badge === 'köpt' ? 'Köpt tidigare' : 'Tips'}
          </span>
        )}
        {qty > 0 && (
          <span style={{ position: 'absolute', top: 10, right: 10, minWidth: 26, height: 26, padding: '0 7px', borderRadius: 13, background: '#111', color: '#E8B84B', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>{qty}</span>
        )}
      </button>
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{p.brand}</div>
        <button type="button" onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{p.name}</button>
        <div style={{ fontSize: 11, color: stock.color }}>{stock.label}{p.unit ? ` · ${p.unit}` : ''}</div>
        {inCar > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#6AAFF0' }}>I bilen: {inCar} st</div>}
        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>{fmt(price)} kr</span>
            {price < p.list_price && <span style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'line-through' }}>{fmt(p.list_price)}</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>exkl. moms · {fmt(withVat(price))} kr inkl.</div>
          {qty === 0 ? (
            <button type="button" onClick={onAdd} style={{ width: '100%', height: 40, borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Plus size={15} /> Lägg till
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={onRemove} aria-label={`Minska ${p.name}`} style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={15} /></button>
              <span style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{qty}</span>
              <button type="button" onClick={onAdd} aria-label={`Öka ${p.name}`} style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#111', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={15} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Search existing customers, or add a new one. Results show only while typing,
// so the catalogue stays in focus.
function CustomerPicker({ customers, onPick, onNew, autoFocus = false }: {
  customers: Customer[]
  onPick: (c: Customer) => void
  onNew: (company: string) => void
  autoFocus?: boolean
}) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const hits = term ? customers.filter(c =>
    c.company.toLowerCase().includes(term) || (c.contact_name || '').toLowerCase().includes(term) ||
    (c.org_nr || '').replace(/\D/g, '').includes(term.replace(/\D/g, '') || '§') || (c.email || '').toLowerCase().includes(term)).slice(0, 8) : []
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input autoFocus={autoFocus} placeholder="Sök kund – företag, namn, org.nr eller e-post" value={q} onChange={e => setQ(e.target.value)} aria-label="Sök kund"
            style={{ width: '100%', padding: '10px 12px 10px 32px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <button type="button" onClick={() => onNew(q.trim())}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <UserPlus size={15} /> Ny kund
        </button>
      </div>
      {term && (
        <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: 'calc(100% + 6px)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,.45)' }}>
          {hits.map(c => (
            <button key={c.id} type="button" onClick={() => { onPick(c); setQ('') }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border2)', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,184,75,.05)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span>
                <span style={{ display: 'block', fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{c.company}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{[c.contact_name, c.city].filter(Boolean).join(' · ')}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Prislista {c.price_list_id}</span>
            </button>
          ))}
          <button type="button" onClick={() => { onNew(q.trim()); setQ('') }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>
            <UserPlus size={14} /> {hits.length ? 'Ingen av dessa – skapa ny kund' : `Ingen träff – skapa "${q.trim()}" som ny kund`}
          </button>
        </div>
      )}
    </div>
  )
}

// Large picture and details, to show the customer on site.
function ProductSheet({ p, categoryName, selectedCustomer, qty, onAdd, onRemove, onClose }: {
  p: Product
  categoryName: string
  selectedCustomer: Customer | null
  qty: number
  onAdd: () => void
  onRemove: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const pl    = selectedCustomer?.price_list_id || 'Standard'
  const price = custPrice(p.list_price, pl)
  const stock = stockStatus(p.stock_qty)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div role="dialog" aria-modal="true" aria-label={p.name} onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 880, maxHeight: '96vh', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, padding: 24, position: 'relative' }}>
          {p.image_url
            ? <img src={p.image_url} alt={p.name} style={{ maxWidth: '100%', maxHeight: '62vh', objectFit: 'contain' }} />
            : <Package size={96} strokeWidth={1} color="#bbb" />}
        </div>
        <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{p.brand}</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: '4px 0 0', lineHeight: 1.2 }}>{p.name}</h2>
            </div>
            <button onClick={onClose} aria-label="Stäng" style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', padding: 6, display: 'flex' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>{fmt(price)} kr</span>
            {price < p.list_price && <span style={{ fontSize: 15, color: 'var(--text2)', textDecoration: 'line-through' }}>{fmt(p.list_price)} kr</span>}
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>exkl. moms · {fmt(withVat(price))} kr inkl. moms{selectedCustomer ? ` · prislista ${pl}` : ''}</span>
          </div>
          <span style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: stock.color, background: stock.bg, padding: '4px 10px', borderRadius: 20 }}>{stock.label}</span>
          {p.description && (
            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{p.description}</p>
          )}
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: 0, fontSize: 13 }}>
            {([['Artikelnr', p.sku], ['Kategori', categoryName], ['Enhet', p.unit]] as const).filter(([, v]) => v).map(([k, v]) => (
              <Fragment key={k}><dt style={{ color: 'var(--text2)' }}>{k}</dt><dd style={{ margin: 0, color: 'var(--text)' }}>{v}</dd></Fragment>
            ))}
          </dl>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
            {qty > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={onRemove} aria-label="Minska" style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={16} /></button>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', minWidth: 24, textAlign: 'center' }}>{qty}</span>
              </div>
            )}
            <button onClick={onAdd} style={{ flex: 1, height: 44, borderRadius: 10, background: 'var(--gold)', border: 'none', color: '#111', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Plus size={16} /> {qty > 0 ? 'Lägg till en till' : 'Lägg i varukorgen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CrmOrdersPage() {
  const SALESPEOPLE = useTeam()
  const searchParams = useSearchParams()
  const router = useRouter()
  const autoSelectedRef = useRef(false)
  const [view, setView]                   = useState<View>(() => searchParams.get('view') === 'history' ? 'history' : 'new')
  const [orders, setOrders]               = useState<(Order & { customers?: Customer })[]>([])
  const [customers, setCustomers]         = useState<Customer[]>([])
  const [products, setProducts]           = useState<Product[]>([])
  const [categories, setCategories]       = useState<Category[]>([])
  const [loading, setLoading]             = useState(true)
  const [cart, setCart]                   = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [lastBought, setLastBought]       = useState<string[]>([])
  const [recommendations, setRecommendations] = useState<Product[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [toast, setToast]                 = useState('')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [orderItemsById, setOrderItemsById] = useState<Record<string, OrderItem[]>>({})
  const [discount, setDiscount]           = useState('')
  const [discountEnabled, setDiscountEnabled] = useState(false)
  // Extra discount in percent per cart line, on top of the price list.
  const [lineDisc, setLineDisc]           = useState<Record<string, string>>({})
  const [isMobile, setIsMobile]           = useState(false)
  const [showCart, setShowCart]           = useState(false)
  const [newCustomerFor, setNewCustomerFor] = useState<string | null>(null)   // prefilled company while the modal is open
  // Order or quote asked for without a customer: ask who it is, then carry on.
  const [afterCustomer, setAfterCustomer] = useState<'pending' | 'pdf' | 'mail' | null>(null)
  const [autoSavedAt, setAutoSavedAt]     = useState('')
  const [saveError, setSaveError]         = useState('')
  // What the logged-in seller has in the car (migration 0020).
  const [myCar, setMyCar]                 = useState<Record<string, number>>({})
  const [delivery, setDelivery]           = useState('Standard (2-3 dagar)')
  // Per cart line: handed over from the car, or shipped from the warehouse.
  // Units per line handed over from the car (-1 = all of them); the rest is shipped.
  const [carQty, setCarQty]               = useState<Record<string, number>>({})
  const fromCar = (i: CartItem) => { const v = carQty[i.product.id] ?? 0; return v < 0 ? i.qty : Math.min(i.qty, v) }
  const toShip  = (i: CartItem) => i.qty - fromCar(i)
  // A draft or quote being edited; saving updates it instead of creating a new order.
  const [editingOrder, setEditingOrder]   = useState<{ id: string; order_nr: number; status: string } | null>(null)
  // ?filter=carts (e.g. "Alla varukorgar" on the overview) opens the saved carts.
  const [historyFilter, setHistoryFilter] = useState<'all' | 'carts' | 'quotes' | 'orders'>(() => {
    const f = searchParams.get('filter')
    return f === 'carts' || f === 'quotes' || f === 'orders' ? f : 'all'
  })
  const [openProduct, setOpenProduct]     = useState<Product | null>(null)
  const [assignee, setAssignee]           = useState('')
  const [customerDeals, setCustomerDeals] = useState<{ id: string; title: string; value: number; stage: string }[]>([])
  const [dealId, setDealId]               = useState('')
  const [myName, setMyName]               = useState('')
  const [isAdmin, setIsAdmin]             = useState(false)
  const [confirmingId, setConfirmingId]   = useState<string | null>(null)
  const [onlyMine, setOnlyMine]           = useState(false)
  const [placing, setPlacing]             = useState(false)
  // The cart is saved as a draft automatically; these keep saves in order.
  const editingRef  = useRef<typeof editingOrder>(null)
  const autosaveRef = useRef<Promise<void> | null>(null)
  useEffect(() => { editingRef.current = editingOrder }, [editingOrder])

  // The menu's "Ny order" / "Ordrar" links switch view on the same page.
  const viewParam = searchParams.get('view')
  const filterParam = searchParams.get('filter')
  useEffect(() => { if (filterParam === 'carts' || filterParam === 'quotes' || filterParam === 'orders') setHistoryFilter(filterParam) }, [filterParam])
  const firstViewRef = useRef(true)
  useEffect(() => {
    if (firstViewRef.current) { firstViewRef.current = false; return }
    setView(viewParam === 'history' ? 'history' : 'new')
  }, [viewParam])
  // ...and the address follows the view, so those links always switch it.
  useEffect(() => {
    const url = new URL(window.location.href)
    const has = url.searchParams.get('view') === 'history'
    if ((view === 'history') === has) return
    if (view === 'history') url.searchParams.set('view', 'history'); else url.searchParams.delete('view')
    router.replace(url.pathname + url.search, { scroll: false })
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function loadOrders() {
    supabase.from('orders').select('*,customers(id,company)').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setOrders(data as any) })
  }

  useLiveRefresh(['orders'], loadOrders)

  useEffect(() => {
    Promise.all([
      supabase.from('orders').select('*,customers(id,company)').order('created_at', { ascending: false }).limit(50),
      supabase.from('customers').select('id,company,contact_name,price_list_id,address,postal_code,city,org_nr,phone,email,account_manager,customer_type').neq('status', 'inactive').order('company'),
      supabase.from('products').select('id,sku,name,brand,unit,list_price,stock_qty,active,image_url,category_id,description').eq('active', true).order('sort_order'),
      supabase.from('categories').select('id,name,sort_order').order('sort_order'),
    ]).then(([o, c, p, cat]) => {
      if (o.data)   setOrders(o.data as any)
      if (c.data)   setCustomers(c.data as any)
      if (p.data)   setProducts(p.data as any)
      if (cat.data) setCategories(cat.data as any)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (loading || autoSelectedRef.current) return
    const customerId = searchParams.get('customer')
    if (!customerId) return
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return
    autoSelectedRef.current = true
    setSelectedCustomer(customer)
    setAssignee(customer.account_manager || '')
    setCart([])
    loadLastBought(customer)
    loadCustomerDeals(customer)
    const productName = searchParams.get('product')
    if (productName) {
      const prod = products.find(p => p.name.toLowerCase() === productName.toLowerCase())
      if (prod) {
        const unitPrice = custPrice(prod.list_price, customer.price_list_id || 'Standard')
        setCart([{ product: prod, qty: 1, unitPrice }])
      }
    }
  }, [loading, customers, products])

  // ?edit=<order id> (e.g. from the admin order list) opens a draft or quote in the form.
  // ?reorder=<order id> starts a new order with the same products.
  const editOpenedRef = useRef(false)
  useEffect(() => {
    const reorderId = searchParams.get('reorder')
    const editId = searchParams.get('edit') || reorderId
    if (loading || !editId || editOpenedRef.current || customers.length === 0) return
    editOpenedRef.current = true
    supabase.from('orders').select('*,customers(id,company)').eq('id', editId).single().then(({ data }) => {
      if (!data) { showToast('Ordern hittades inte'); return }
      if (reorderId) { openForEdit(data, true); return }
      if (data.status !== 'draft' && data.status !== 'quote') { setView('history'); showToast(`#${data.order_nr} är redan en order`); return }
      openForEdit(data)
    })
  }, [loading, customers]) // eslint-disable-line react-hooks/exhaustive-deps

  // The cart is remembered in this browser: coming back to Ny order picks up the
  // saved draft again, and the cart icon in the top bar shows it.
  const [cartRestored, setCartRestored] = useState(false)
  useEffect(() => {
    if (loading || cartRestored || !myName) return
    const fromLink = ['edit', 'reorder', 'customer'].some(k => searchParams.get(k))
    if (fromLink) { setCartRestored(true); return }
    ;(async () => {
      // This browser's cart, else the seller's latest cart from the database
      // (so it is the same in Safari, Chrome and on the phone).
      cleanOldCarts(supabase, myName).catch(() => {})
      const local = readCart()?.draftId
      const id = local || (await findMyLatestDraft(supabase, myName))?.id
      if (id) {
        const { data } = await supabase.from('orders').select('*,customers(id,company)').eq('id', id).maybeSingle()
        // The active cart lasts until midnight; older ones stay under Sparade varukorgar.
        if (data && data.status === 'draft' && data.created_at >= startOfToday()) await openForEdit(data, false, true)
        else writeCart(null)
      }
      setCartRestored(true)
    })()
  }, [loading, myName]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!cartRestored) return
    writeCart({ draftId: editingOrder?.status === 'draft' ? editingOrder.id : null, count: cart.reduce((n, i) => n + i.qty, 0) })
  }, [cart, editingOrder, cartRestored])
  // The top bar's cart icon: ?cart=1 from another page, or an event on this one.
  const cartParam = searchParams.get('cart')
  useEffect(() => { if (cartParam) setShowCart(true) }, [cartParam])
  useEffect(() => {
    const open = () => setShowCart(true)
    window.addEventListener(OPEN_CART_EVENT, open)
    return () => window.removeEventListener(OPEN_CART_EVENT, open)
  }, [])

  async function loadLastBought(customer: Customer) {
    const { data } = await supabase
      .from('orders')
      .select('order_items(product_id,product_name)')
      .eq('customer_id', customer.id)
      .not('status', 'in', '(draft,quote,cancelled)')
      .order('created_at', { ascending: false })
      .limit(3)
    if (data) {
      const lines = data.flatMap((o: any) => o.order_items || [])
      const names: string[] = [...new Set(lines.map((i: any) => i.product_name as string))].slice(0, 5)
      setLastBought(names)
      // What others bought together with these, from real orders.
      const ids = await recommendFor(supabase, lines.map((i: any) => i.product_id).filter(Boolean), 4, new Set(products.map(p => p.id)))
      setRecommendations(ids.map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p))
    } else {
      setLastBought([])
      setRecommendations([])
    }
  }

  async function toggleOrderExpand(orderId: string) {
    if (expandedOrderId === orderId) { setExpandedOrderId(null); return }
    setExpandedOrderId(orderId)
    if (orderItemsById[orderId]) return
    const { data } = await supabase.from('order_items').select('*').eq('order_id', orderId)
    if (data) setOrderItemsById(items => ({ ...items, [orderId]: data as OrderItem[] }))
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    currentStaff(supabase).then(me => { setMyName(me.name); setIsAdmin(me.isAdmin) })
  }, [])
  function loadMyCar() {
    if (!myName) return
    supabase.from('car_stock').select('product_id,qty').eq('salesperson', myName)
      .then(({ data }) => setMyCar(Object.fromEntries((data ?? []).map((r: any) => [r.product_id, r.qty]))))
  }
  useEffect(loadMyCar, [myName]) // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(['car_stock'], loadMyCar)

  // Choosing (or changing) the customer keeps the cart, at the new price list.
  function selectCustomerAndLoad(c: Customer) {
    setSelectedCustomer(c)
    setAssignee(c.account_manager || myName)
    setCart(items => items.map(i => ({ ...i, unitPrice: custPrice(i.product.list_price, c.price_list_id || 'Standard') })))
    loadLastBought(c)
    loadCustomerDeals(c)
  }

  function clearCustomer() {
    setSelectedCustomer(null)
    setCart(items => items.map(i => ({ ...i, unitPrice: custPrice(i.product.list_price, 'Standard') })))
    setCustomerSearch(''); setLastBought([]); setRecommendations([]); setCustomerDeals([]); setDealId('')
  }

  function removeLine(productId: string) {
    setCart(items => items.filter(i => i.product.id !== productId))
    setLineDisc(d => { const n = { ...d }; delete n[productId]; return n })
  }

  // Deals the order can be linked to, so a won deal and its order are only
  // counted once in the budget. Pre-selects the most likely one: a won deal
  // without an order, else the furthest-along open deal.
  async function loadCustomerDeals(c: Customer) {
    setCustomerDeals([]); setDealId('')
    const [{ data: deals }, { data: linked, error }] = await Promise.all([
      supabase.from('deals').select('id,title,value,stage').eq('customer_id', c.id).neq('stage', 'Förlorad').order('created_at', { ascending: false }),
      supabase.from('orders').select('deal_id').eq('customer_id', c.id).not('deal_id', 'is', null).not('status', 'in', NOT_LIVE_FILTER),
    ])
    if (error || !deals) return // orders.deal_id missing: migration 0006 not run yet
    const taken = new Set((linked || []).map((o: any) => o.deal_id))
    const open = deals.filter((d: any) => !taken.has(d.id))
    setCustomerDeals(open as any)
    const pick = ['Vunnen', 'Förhandling', 'Offert'].map(st => open.find((d: any) => d.stage === st)).find(Boolean)
    setDealId((pick as any)?.id || '')
  }

  function addToCart(p: Product) {
    const pl = selectedCustomer?.price_list_id || 'Standard'
    const unitPrice = custPrice(p.list_price, pl)
    setCart(items => {
      const existing = items.find(i => i.product.id === p.id)
      if (existing) return items.map(i => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...items, { product: p, qty: 1, unitPrice }]
    })
  }

  function updateQty(productId: string, delta: number) {
    setCart(items => items.map(i => i.product.id === productId ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0))
  }

  function getQty(productId: string) {
    return cart.find(i => i.product.id === productId)?.qty || 0
  }

  const pctOf = (v: string | undefined) => Math.min(100, Math.max(0, parseFloat((v || '').replace(',', '.')) || 0))
  const linePct   = (i: CartItem) => pctOf(lineDisc[i.product.id])
  const linePrice = (i: CartItem) => Math.round(i.unitPrice * (1 - linePct(i) / 100))

  const allFromCar  = cart.length > 0 && cart.every(i => toShip(i) === 0)
  const subtotal    = cart.reduce((s, i) => s + i.qty * linePrice(i), 0)
  const discountPct = discountEnabled ? pctOf(discount) : 0
  const discountAmt = Math.round(subtotal * discountPct / 100)
  const afterDiscount = Math.max(0, subtotal - discountAmt)
  const vat   = Math.round(afterDiscount * 0.25)
  const total = afterDiscount + vat

  function resetOrderForm() {
    editingRef.current = null; setAutoSavedAt('')
    setCart([]); setSelectedCustomer(null); setCustomerSearch(''); setProductSearch('')
    setDiscount(''); setDiscountEnabled(false); setDelivery('Standard (2-3 dagar)'); setCarQty({}); setLineDisc({})
    setLastBought([]); setSelectedCategory('all'); setCustomerDeals([]); setDealId(''); setEditingOrder(null)
  }

  function orderFields(status: OrderStatus) {
    const carLines  = cart.filter(i => fromCar(i) > 0).length
    const shipLines = cart.filter(i => toShip(i) > 0).length
    const deliveryNote = [
      carLines  ? `Från bilen (${carLines} rad${carLines > 1 ? 'er' : ''})` : '',
      shipLines ? `Frakt: ${delivery}` : '',
    ].filter(Boolean).join(' · ')
    const c = selectedCustomer
    return {
      customer_id: c?.id ?? null,
      status,
      price_list_id: c?.price_list_id || 'Standard',
      delivery_name: c?.company ?? null,
      delivery_city: c?.city ?? null,
      subtotal: afterDiscount, vat_amount: vat, total,
      // Empty lets the database default it to the customer's account manager.
      // No manager on the customer: the salesperson placing it receives it.
      assigned_to: assignee || (c?.account_manager ? null : myName || null),
      // Only when linked: orders.deal_id needs migration 0006.
      ...(dealId ? { deal_id: dealId } : {}),
      notes: `Leverans: ${deliveryNote}${discountAmt ? ` | Rabatt: ${String(discountPct).replace('.', ',')} % (${discountAmt} kr)` : ''}`,
    }
  }

  // Writes the order and its lines: updates the draft/quote being edited, else creates one.
  async function writeOrder(status: OrderStatus): Promise<any | null> {
    const editing = editingRef.current
    const fields = orderFields(status)
    let order: any = null
    let error: any = null
    // The old lines, to put back if saving fails half-way (never lose a cart).
    let oldLines: any[] = []
    const restore = async () => {
      if (!editing || oldLines.length === 0) return
      await supabase.from('orders').update({ status: editing.status }).eq('id', editing.id)
      await supabase.from('order_items').insert(oldLines.map(({ id: _id, created_at: _c, ...l }) => l))
    }
    if (editing) {
      // The draft/quote holds no stock, so its old lines can simply be replaced.
      const { data: old } = await supabase.from('order_items').select('*').eq('order_id', editing.id)
      oldLines = old ?? []
      await supabase.from('order_items').delete().eq('order_id', editing.id)
      ;({ data: order, error } = await supabase.from('orders').update(fields).eq('id', editing.id).select().single())
    } else {
      ;({ data: order, error } = await supabase.from('orders').insert({ ...fields, created_by: myName || null }).select().single())
    }
    if (error || !order) {
      await restore()
      const msg = error?.message?.includes('customer_id') ? 'Kör migration 0019 för utkast utan kund' : `Kunde inte spara: ${error?.message || 'okänt fel'}`
      setSaveError(msg); showToast(msg); return null
    }

    // A line split between the car and shipping becomes two rows.
    const { error: itemsError } = await supabase.from('order_items').insert(cart.flatMap(i =>
      ([['car', fromCar(i)], ['ship', toShip(i)]] as const).filter(([, q]) => q > 0).map(([delivery, qty]) => ({
        order_id: order.id, product_id: i.product.id,
        product_name: i.product.name, product_sku: i.product.sku,
        qty, unit_price: linePrice(i), list_price: i.product.list_price,
        total_price: qty * linePrice(i),
        delivery,
      }))))
    if (itemsError) {
      if (!editing) await supabase.from('orders').delete().eq('id', order.id)
      else await restore()
      const msg = `Orderraderna kunde inte sparas: ${itemsError.message}`
      setSaveError(msg); showToast(msg)
      return null
    }
    setSaveError('')
    return order
  }

  // The cart is kept as a draft while you work, so you can show the customer
  // something else (or close the page) and pick it up again from the order list
  // or the customer card. Quotes being edited are not touched.
  useEffect(() => {
    if (loading || placing || view === 'history' || cart.length === 0) return
    const editing = editingRef.current
    if (editing && editing.status !== 'draft') return
    const t = setTimeout(() => {
      const run = async () => {
        if (autosaveRef.current) await autosaveRef.current
        if (editingRef.current && editingRef.current.status !== 'draft') return
        const order = await writeOrder('draft')
        if (!order) return
        if (!editingRef.current) {
          const e = { id: order.id, order_nr: order.order_nr, status: 'draft' }
          editingRef.current = e
          setEditingOrder(e)
        }
        const saved = { ...order, customers: selectedCustomer }
        setOrders(os => os.some(o => o.id === order.id) ? os.map(o => o.id === order.id ? saved : o) : [saved, ...os])
        setAutoSavedAt(new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }))
      }
      autosaveRef.current = run().finally(() => { autosaveRef.current = null })
    }, 1500)
    return () => clearTimeout(t)
  }, [cart, selectedCustomer, lineDisc, carQty, discount, discountEnabled, assignee, delivery, dealId, loading, placing, view]) // eslint-disable-line react-hooks/exhaustive-deps

  // Starts an empty cart. With something in the current one, ask first:
  // keep it under Sparade varukorgar, or empty it.
  const [askNewCart, setAskNewCart] = useState(false)
  function newCart() {
    if (cart.length > 0 && editingRef.current?.status !== 'quote') { setAskNewCart(true); return }
    resetOrderForm(); setShowCart(false); setView('new')
  }
  async function finishNewCart(keep: boolean) {
    setAskNewCart(false)
    if (autosaveRef.current) await autosaveRef.current
    const e = editingRef.current
    if (!keep && e && e.status === 'draft') {
      await removeOpenOrder(supabase, e.id)
      setOrders(os => os.filter(o => o.id !== e.id))
    }
    resetOrderForm(); setShowCart(false); setView('new')
    showToast(keep ? `Varukorgen #${e?.order_nr ?? ''} finns under Sparade varukorgar` : 'Varukorgen är tömd')
  }

  async function discardCart() {
    const editing = editingRef.current
    if (!confirm(editing ? `Radera varukorgen (utkast #${editing.order_nr})?` : 'Tömma varukorgen?')) return
    if (autosaveRef.current) await autosaveRef.current
    const e = editingRef.current
    if (e && e.status === 'draft') {
      await supabase.from('order_items').delete().eq('order_id', e.id)
      await supabase.from('orders').delete().eq('id', e.id)
      setOrders(os => os.filter(o => o.id !== e.id))
    }
    resetOrderForm(); setShowCart(false); setView('new')
  }

  // Draft (utkast) and quote (offert) are saved without affecting stock or
  // budget; "pending" is a real order the salesperson then confirms.
  // A quote also becomes a lead in the pipeline (stage Offert).
  // A saved quote stays open in the checkout (to mail it or turn it into an order).
  async function saveOrder(status: 'draft' | 'quote' | 'pending'): Promise<any | null> {
    if (cart.length === 0 || placing) return null
    if (!selectedCustomer && status !== 'draft') { showToast('Välj eller skapa en kund först'); return null }
    setPlacing(true)
    if (autosaveRef.current) await autosaveRef.current
    const wasEditing = editingRef.current
    const shipLines = cart.filter(i => toShip(i) > 0).length
    // Everything handed over from the car: the order is already delivered,
    // no confirmation needed. Anything to ship keeps the normal flow.
    const handedOver = status === 'pending' && shipLines === 0
    const finalStatus: OrderStatus = handedOver ? 'delivered' : status

    const order = await writeOrder(finalStatus)
    if (!order) { setPlacing(false); return null }

    // An order on a deal means the deal is won.
    const linkedDeal = customerDeals.find(d => d.id === dealId)
    if (status === 'pending' && linkedDeal && linkedDeal.stage !== 'Vunnen') {
      await supabase.from('deals').update({ stage: 'Vunnen', updated_at: new Date().toISOString() }).eq('id', linkedDeal.id)
    }
    // A quote is a lead: it goes into the pipeline at "Offert" with the quote's value.
    let leadNote = ''
    if (status === 'quote' && selectedCustomer) {
      const now = new Date().toISOString()
      const existing = linkedDeal || (order.deal_id ? { id: order.deal_id, stage: '' } : null)
      if (existing) {
        const move = ['Prospekt', 'Kontaktad', ''].includes(existing.stage) ? { stage: 'Offert' } : {}
        await supabase.from('deals').update({ ...move, value: afterDiscount, updated_at: now }).eq('id', existing.id)
      } else {
        const { data: deal } = await supabase.from('deals').insert({
          title: `Offert #${order.order_nr}`, customer_id: selectedCustomer.id, value: afterDiscount, stage: 'Offert',
          assigned_to: order.assigned_to || selectedCustomer.account_manager || myName || null,
          notes: `Offert #${order.order_nr} från orderformuläret`, source: 'crm',
        }).select('id').single()
        if (deal) { await supabase.from('orders').update({ deal_id: deal.id }).eq('id', order.id); order.deal_id = deal.id }
      }
      leadNote = ' · lead i pipelinen'
    }

    const saved = { ...order, customers: selectedCustomer }
    setOrders(os => os.some(o => o.id === order.id) ? os.map(o => o.id === order.id ? saved : o) : [saved, ...os])
    if (status === 'quote') {
      const e = { id: order.id, order_nr: order.order_nr, status: 'quote' }
      editingRef.current = e; setEditingOrder(e)
      if (order.deal_id) setDealId(order.deal_id)
      setPlacing(false); setView('confirm')
      showToast(`Offert #${order.order_nr} sparad${leadNote}`)
      return saved
    }
    resetOrderForm()
    setPlacing(false); setView('history')
    if (handedOver) invoiceInVismaInBackground(order.id)   // delivered at once: invoice now
    showToast(status === 'draft' ? `Utkast #${order.order_nr} sparat${selectedCustomer ? '' : ' utan kund'}`
      : handedOver ? `Order #${order.order_nr} levererad från bilen`
      : `Order #${order.order_nr} ${wasEditing?.status === 'quote' ? 'skapad från offerten' : 'skapad'} — bekräfta den när den är klar`)
    return saved
  }

  // The usual flow: save the cart as a quote (and lead), then PDF or e-mail.
  async function makeQuote(then: 'pdf' | 'mail') {
    if (!selectedCustomer) { setShowCart(false); setAfterCustomer(then); return }
    setShowCart(false)
    const o = await saveOrder('quote')
    if (!o) return
    if (then === 'pdf') await downloadQuote(o)
    else await mailQuote(o)
  }

  // Once the customer is chosen or created, finish what was asked for.
  useEffect(() => {
    if (!afterCustomer || !selectedCustomer) return
    const next = afterCustomer
    setAfterCustomer(null)
    if (next === 'pending') saveOrder('pending')
    else makeQuote(next)
  }, [selectedCustomer]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reopen a draft or quote in the order form. copy: start a new order with
  // the same products and quantities at today's prices ("Lägg ordern igen").
  async function openForEdit(o: any, copy = false, stay = false) {
    // A draft can be without a customer; one is chosen in the checkout.
    const customerId = o.customers?.id || o.customer_id
    let customer = customers.find(c => c.id === customerId) || null
    if (customerId && !customer) {
      // Not in the list (e.g. an inactive customer): fetch the card itself.
      const { data } = await supabase.from('customers').select('id,company,contact_name,price_list_id,address,postal_code,city,org_nr,phone,email,account_manager,customer_type').eq('id', customerId).maybeSingle()
      if (!data) { showToast('Kunden hittades inte'); return }
      customer = data as Customer
      setCustomers(cs => [...cs, data as Customer])
    }
    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', o.id)
    const lines: CartItem[] = []
    const from: Record<string, number> = {}
    const disc: Record<string, string> = {}
    const pl = customer?.price_list_id || 'Standard'
    for (const it of items || []) {
      const product = products.find(p => p.id === it.product_id)
      if (!product) continue
      if (copy && product.active === false) continue
      // Price list price as base; anything below it was a line discount.
      const base = custPrice(product.list_price, pl)
      const paid = Number(it.unit_price)
      const pct = base > 0 && paid < base ? Math.round((1 - paid / base) * 1000) / 10 : 0
      if (pct > 0) disc[product.id] = String(pct).replace('.', ',')
      const unitPrice = copy || pct > 0 ? base : paid
      const same = lines.find(l => l.product.id === product.id)
      if (same) same.qty += it.qty
      else lines.push({ product, qty: it.qty, unitPrice })
      if (it.delivery === 'car') from[product.id] = (from[product.id] ?? 0) + it.qty
    }
    if (copy && lines.length === 0) { showToast('Produkterna i ordern finns inte längre'); return }
    setSelectedCustomer(customer)
    setCart(lines); setCarQty(from); setLineDisc(disc)
    setAssignee(o.assigned_to || '')
    if (customer) loadLastBought(customer)
    else { setLastBought([]); setRecommendations([]) }
    // Order discount in percent of the lines after their own discounts.
    const linesTotal = lines.reduce((sum, l) => sum + l.qty * Math.round(l.unitPrice * (1 - pctOf(disc[l.product.id]) / 100)), 0)
    const orderPct = linesTotal > 0 ? Math.round((linesTotal - (o.subtotal || 0)) / linesTotal * 1000) / 10 : 0
    setDiscountEnabled(orderPct > 0); setDiscount(orderPct > 0 ? String(orderPct).replace('.', ',') : '')
    if (copy) {
      setEditingOrder(null); editingRef.current = null
      if (customer) await loadCustomerDeals(customer)
      setView('confirm')
      const skipped = (items || []).length - lines.length
      showToast(`Kopierat från #${o.order_nr} med dagens priser${skipped > 0 ? ` · ${skipped} rad${skipped > 1 ? 'er' : ''} utgått` : ''}`)
      return
    }
    if (customer) await loadCustomerDeals(customer)
    else { setCustomerDeals([]); setDealId('') }
    if (o.deal_id) setDealId(o.deal_id)
    const e = { id: o.id, order_nr: o.order_nr, status: o.status }
    editingRef.current = e
    setEditingOrder(e)
    if (!stay) setView('confirm')
  }

  async function deleteOpenOrder(o: any) {
    const kind = o.status === 'quote' ? 'offerten' : 'utkastet'
    if (!confirm(`Radera ${kind} #${o.order_nr}?`)) return
    await supabase.from('order_items').delete().eq('order_id', o.id)
    const { error } = await supabase.from('orders').delete().eq('id', o.id)
    if (error) { showToast('Kunde inte radera'); return }
    setOrders(os => os.filter(x => x.id !== o.id))
    showToast(`${kind[0].toUpperCase() + kind.slice(1)} raderat`)
  }

  // Opens Gmail with the quote written out, like the quote tool on the customer card.
  // Everything the PDF and the e-mail show for a saved quote.
  async function quoteInput(o: any): Promise<QuotePdfInput | null> {
    const customer = customers.find(c => c.id === (o.customers?.id || o.customer_id))
    const { data: items } = await supabase.from('order_items').select('product_id,product_name,product_sku,qty,unit_price,list_price,delivery').eq('order_id', o.id)
    if (!items?.length) { showToast('Offerten har inga rader'); return null }
    const { data: { user } } = await supabase.auth.getUser()
    return {
      orderNr: o.order_nr, date: o.created_at || new Date().toISOString(),
      customer: customer || { company: o.delivery_name || '' },
      items: items.map((it: any) => {
        const p = products.find(x => x.id === it.product_id)
        return { name: it.product_name, sku: it.product_sku, brand: p?.brand, description: p?.description, qty: it.qty,
          unitPrice: Number(it.unit_price), listPrice: Number(it.list_price) || null, delivery: it.delivery, imageUrl: p?.image_url }
      }),
      subtotal: o.subtotal, vat: o.vat_amount, total: o.total,
      seller: o.assigned_to || myName, sellerEmail: user?.email, contact: DEFAULT_CONTACT,
    }
  }

  // The quote as a PDF; uploaded so the e-mail can link to it (migration 0020).
  async function quotePdf(o: any, input?: QuotePdfInput | null): Promise<{ blob: Blob; url: string | null; name: string } | null> {
    const q = input ?? await quoteInput(o)
    if (!q) return null
    const blob = await buildQuotePdf(q)
    const name = `Offert-${o.order_nr}-ProLuxShine.pdf`
    const path = `${o.id}/${crypto.randomUUID()}/${name}`
    const { error } = await supabase.storage.from('quotes').upload(path, blob, { contentType: 'application/pdf', upsert: false })
    const url = error ? null : supabase.storage.from('quotes').getPublicUrl(path).data.publicUrl
    return { blob, url, name }
  }

  async function downloadQuote(o: any) {
    showToast('Skapar PDF…')
    const pdf = await quotePdf(o)
    if (pdf) downloadBlob(pdf.blob, pdf.name)
  }

  // E-mail: Gmail links can only carry plain text, so the quote (looking like
  // the PDF) is shown here to copy, then pasted into the Gmail draft.
  const [share, setShare] = useState<{ html: string; text: string; to: string; subject: string; pdf: { blob: Blob; url: string | null; name: string } | null } | null>(null)
  const [copied, setCopied] = useState(false)
  async function mailQuote(o: any) {
    const customer = customers.find(c => c.id === (o.customers?.id || o.customer_id))
    showToast('Förbereder offerten…')
    const q = await quoteInput(o)
    if (!q) return
    const pdf = await quotePdf(o, q).catch(() => null)
    const { html, text } = buildQuoteHtml({ ...q, logoUrl: `${window.location.origin}/email/logo.png`, pdfUrl: pdf?.url })
    setCopied(false)
    setShare({ html, text, to: customer?.email || '', subject: `Offert #${o.order_nr} från ProLuxShine`, pdf })
  }
  async function copyShare() {
    if (!share) return
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([share.html], { type: 'text/html' }),
        'text/plain': new Blob([share.text], { type: 'text/plain' }),
      })])
    } catch {
      // Older browsers: copy the rendered preview as a selection.
      const el = document.getElementById('quote-share-copy')
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r); document.execCommand('copy'); sel?.removeAllRanges() }
    }
    setCopied(true)
  }
  function openGmail() {
    if (!share) return
    window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(share.to)}&su=${encodeURIComponent(share.subject)}`, '_blank')
  }

  async function confirmOrder(id: string) {
    setConfirmingId(id)
    const { data: ok, error } = await supabase.rpc('confirm_order', { p_order_id: id })
    setConfirmingId(null)
    if (error || !ok) { showToast('Kunde inte bekräfta ordern'); return }
    setOrders(os => os.map(o => o.id === id ? { ...o, status: 'confirmed' as OrderStatus } : o))
    invoiceInVismaInBackground(id)
    showToast('Order bekräftad')
  }

  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.company.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const filteredProducts = products.filter(p => {
    const matchSearch = !productSearch ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.brand.toLowerCase().includes(productSearch.toLowerCase())
    const matchCat = selectedCategory === 'all' || p.category_id === selectedCategory
    return matchSearch && matchCat
  })

  // Products matching lastBought names (case-insensitive)
  const lastBoughtProducts: Product[] = lastBought
    .map(name => products.find(p => p.name.toLowerCase() === name.toLowerCase()))
    .filter((p): p is Product => !!p)

  // IDs to exclude from main list when pinned
  const pinnedIds = new Set([
    ...lastBoughtProducts.map(p => p.id),
    ...recommendations.map(p => p.id),
  ])
  const mainProducts = filteredProducts.filter(p => !pinnedIds.has(p.id))

  const newCartModal = askNewCart && (
    <Portal>
      <div onClick={() => setAskNewCart(false)} style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div role="dialog" aria-modal="true" aria-label="Ny varukorg" onClick={e => e.stopPropagation()}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 440, padding: '22px 22px 18px' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Ny varukorg</h2>
          <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
            Vad ska hända med den nuvarande varukorgen ({cart.reduce((n, i) => n + i.qty, 0)} st{selectedCustomer ? `, ${selectedCustomer.company}` : ''})?
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <button onClick={() => finishNewCart(true)} style={{ padding: '13px 0', borderRadius: 10, background: 'var(--gold)', border: 'none', color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Spara till senare</button>
            <button onClick={() => finishNewCart(false)} style={{ padding: '13px 0', borderRadius: 10, background: 'transparent', border: '1px solid rgba(224,82,82,.4)', color: 'var(--red)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Töm varukorgen</button>
            <button onClick={() => setAskNewCart(false)} style={{ padding: '10px 0', borderRadius: 10, background: 'transparent', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Avbryt</button>
          </div>
        </div>
      </div>
    </Portal>
  )

  const customerNeeded = afterCustomer && !selectedCustomer && newCustomerFor === null && (
    <Portal>
      <div onClick={() => setAfterCustomer(null)} style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 16px 16px' }}>
        <div role="dialog" aria-modal="true" aria-label="Vem är kunden?" onClick={e => e.stopPropagation()}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 560, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Vem är kunden?</h2>
            <button onClick={() => setAfterCustomer(null)} aria-label="Stäng" style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', padding: 6, display: 'flex' }}><X size={16} /></button>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text2)' }}>
            Sök en befintlig kund eller skapa en ny – {afterCustomer === 'pending' ? 'sedan läggs ordern direkt' : 'sedan skapas offerten direkt'}.
          </p>
          <CustomerPicker customers={customers} autoFocus onPick={selectCustomerAndLoad} onNew={company => setNewCustomerFor(company)} />
          <button onClick={() => setNewCustomerFor('')}
            style={{ marginTop: 14, width: '100%', padding: '12px 0', background: 'var(--gold)', border: 'none', borderRadius: 10, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <UserPlus size={16} /> Ny kund
          </button>
        </div>
      </div>
    </Portal>
  )

  const shareModal = share && (
    <Portal>
      <div onClick={() => setShare(null)} style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <div role="dialog" aria-modal="true" aria-label="Mejla offerten" onClick={e => e.stopPropagation()}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mail size={18} color="var(--gold)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{share.subject}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Till {share.to || '(kunden saknar e-post)'}</div>
            </div>
            <button onClick={() => setShare(null)} aria-label="Stäng" style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', padding: 6, display: 'flex' }}><X size={16} /></button>
          </div>
          <div style={{ padding: '14px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--text)', flex: '1 1 220px' }}><b>1.</b> Kopiera offerten <b style={{ marginLeft: 8 }}>2.</b> Öppna Gmail och klistra in (⌘V / Ctrl+V)</span>
            <button onClick={copyShare} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 9, background: copied ? 'var(--green)' : 'var(--gold)', border: 'none', color: copied ? '#fff' : '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {copied ? <><Check size={15} /> Kopierad</> : <><Copy size={15} /> Kopiera offerten</>}
            </button>
            <button onClick={openGmail} disabled={!share.to} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 9, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: share.to ? 'pointer' : 'not-allowed' }}>
              <Mail size={15} /> Öppna Gmail
            </button>
            {share.pdf && (
              <button onClick={() => downloadBlob(share.pdf!.blob, share.pdf!.name)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
                <FileDown size={15} /> PDF
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', background: '#f3f1ec', borderRadius: '0 0 16px 16px' }}>
            <div id="quote-share-copy" dangerouslySetInnerHTML={{ __html: share.html }} />
          </div>
        </div>
      </div>
    </Portal>
  )

  // ── HISTORY VIEW ───────────────────────────────────────────
  if (view === 'history') return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{onlyMine ? 'Mina ordrar' : 'Alla ordrar'}</h1>
        <button onClick={() => setOnlyMine(m => !m)} style={{ marginLeft: 'auto', marginRight: 10, padding: '8px 14px', background: onlyMine ? 'rgba(232,184,75,.12)' : 'transparent', border: `1px solid ${onlyMine ? 'rgba(232,184,75,.35)' : 'var(--line)'}`, borderRadius: 8, color: onlyMine ? 'var(--gold)' : 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {onlyMine ? 'Visa alla' : 'Bara mina'}
        </button>
        <button onClick={() => { resetOrderForm(); setView('new') }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={15} /> Ny order
        </button>
      </div>
      <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['all', 'Alla'], ['carts', `Varukorgar (${orders.filter(o => o.status === 'draft').length})`], ['quotes', `Offerter (${orders.filter(o => o.status === 'quote').length})`], ['orders', 'Ordrar']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={historyFilter === k} onClick={() => setHistoryFilter(k)}
            style={{ padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: historyFilter === k ? 'rgba(232,184,75,.12)' : 'transparent',
              border: `1px solid ${historyFilter === k ? 'rgba(232,184,75,.35)' : 'var(--line)'}`,
              color: historyFilter === k ? 'var(--text)' : 'var(--text2)' }}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 480 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Order', 'Datum', 'Kund', 'Säljare', 'Summa', 'Status'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Laddar...</td></tr>
            ) : orders
              .filter(o => !onlyMine || o.assigned_to === myName || o.created_by === myName)
              .filter(o => historyFilter === 'all'
                || (historyFilter === 'carts' && o.status === 'draft')
                || (historyFilter === 'quotes' && o.status === 'quote')
                || (historyFilter === 'orders' && o.status !== 'draft' && o.status !== 'quote'))
              .map(o => {
              const isOpen = o.status === 'draft' || o.status === 'quote'
              const expanded = expandedOrderId === o.id
              const items = orderItemsById[o.id]
              return (
                <Fragment key={o.id}>
                  <tr onClick={() => toggleOrderExpand(o.id)} style={{ borderBottom: expanded ? 'none' : '1px solid var(--border2)', cursor: 'pointer', background: expanded ? 'rgba(232,184,75,.04)' : 'transparent' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)' }}>#{o.order_nr}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>{formatDateTime(o.created_at)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 500 }}>{(o as any).customers?.company || 'Utan kund'}</td>
                    <td style={{ padding: '12px 16px', color: o.assigned_to ? 'var(--text2)' : 'var(--red)' }}>{o.assigned_to || 'Saknas'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--gold)', fontWeight: 700 }}>{fmt(o.subtotal)} kr <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text2)' }}>exkl.</span><IncVat net={o.subtotal} total={o.total} /></td>
                    <td style={{ padding: '12px 16px' }}>
                      {isOpen ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: o.status === 'quote' ? 'rgba(155,110,232,.14)' : 'var(--bg4)', color: 'var(--text)', fontWeight: 700 }}>
                            {ORDER_STATUS_LABEL[o.status]}
                          </span>
                          <button onClick={e => { e.stopPropagation(); openForEdit(o) }}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, background: 'var(--gold)', border: 'none', color: '#111', fontWeight: 700, cursor: 'pointer' }}>Öppna</button>
                        </div>
                      ) : o.status === 'pending' && canConfirmOrder(o, myName, isAdmin) ? (
                        <button onClick={e => { e.stopPropagation(); confirmOrder(o.id) }} disabled={confirmingId === o.id}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, background: 'var(--gold)', border: 'none', color: '#111', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', opacity: confirmingId === o.id ? .6 : 1 }}>
                          {confirmingId === o.id ? 'Bekräftar…' : 'Bekräfta'}
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: o.status === 'pending' ? 'rgba(232,184,75,.12)' : 'rgba(76,175,125,.12)', color: o.status === 'pending' ? 'var(--text2)' : 'var(--green)', fontWeight: 700 }}>
                          {ORDER_STATUS_LABEL[o.status] || o.status}
                        </span>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr style={{ borderBottom: '1px solid var(--border2)' }}>
                      <td colSpan={6} style={{ padding: '4px 16px 16px', background: 'rgba(232,184,75,.02)' }}>
                        {!items ? (
                          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>Laddar produkter...</div>
                        ) : items.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>Inga produktrader</div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 8 }}>
                            {items.map(item => (
                              <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '5px 10px 5px 5px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)' }}>
                                {(() => { const p = products.find(x => x.id === item.product_id); return p ? <Thumb p={p} size={40} /> : null })()}
                                {item.product_name} ×{item.qty}{(item as any).delivery === 'car' ? ' · från bilen' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {isOpen && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                            {o.status === 'quote' && (
                              <button onClick={() => downloadQuote(o)} style={{ padding: '7px 12px', borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ladda ner PDF</button>
                            )}
                            {o.status === 'quote' && (
                              <button onClick={() => mailQuote(o)} style={{ padding: '7px 12px', borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Mejla offerten</button>
                            )}
                            <button onClick={() => openForEdit(o)} style={{ padding: '7px 12px', borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              {o.status === 'quote' ? 'Gör om till order' : 'Fortsätt med utkastet'}
                            </button>
                            <button onClick={() => deleteOpenOrder(o)} style={{ padding: '7px 12px', borderRadius: 7, background: 'transparent', border: '1px solid rgba(224,82,82,.35)', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}>Radera</button>
                          </div>
                        )}
                        {!isOpen && (
                          <button onClick={() => openForEdit(o, true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '7px 12px', borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            <RefreshCw size={12} /> Lägg ordern igen
                          </button>
                        )}
                        {!isOpen && o.status !== 'pending' && (canConfirmOrder(o, myName, isAdmin) || o.transport_order_id) && (
                          <div style={{ marginTop: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Frakt & spårning</div>
                            {canConfirmOrder(o, myName, isAdmin)
                              ? <ShipOrderForm order={o} onShipped={patch => {
                                  setOrders(os => os.map(x => x.id === o.id ? { ...x, ...patch } : x))
                                  showToast(`Order #${o.order_nr} markerad som skickad`)
                                }} />
                              : <ShipOrderForm order={o} readOnly onShipped={() => {}} />}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Inga ordrar</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {shareModal}
      {customerNeeded}
      {newCartModal}
      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 999 }}>{toast}</div>}
    </div>
  )

  // ── CONFIRM VIEW ───────────────────────────────────────────
  const card: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }
  const selectStyle: React.CSSProperties = { width: '100%', padding: '11px 36px 11px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', appearance: 'none', cursor: 'pointer' }
  const smallBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const noCustomer = !selectedCustomer
  if (view === 'confirm') return (
    <div style={{ padding: '24px 20px 60px', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          {editingOrder?.status === 'quote' ? `Offert #${editingOrder.order_nr}` : 'Kassan'}
        </h1>
        {editingOrder?.status === 'draft' && (
          <span style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Check size={13} color="var(--green)" /> Sparas automatiskt som utkast #{editingOrder.order_nr}
          </span>
        )}
        {editingOrder?.status === 'quote' && (
          <button onClick={() => { const o = orders.find(x => x.id === editingOrder.id); if (o) downloadQuote(o) }}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
            Ladda ner PDF
          </button>
        )}
        <button onClick={() => setView('new')} style={{ marginLeft: editingOrder?.status === 'quote' ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Lägg till fler produkter
        </button>
      </div>

      {/* Kassan: lines, discounts and totals first */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Produkt', 'Leverans', 'Antal', 'Rabatt', 'À-pris', 'Summa', ''].map((h, i) => (
                <th key={i} style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text2)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cart.map(i => {
              const price = linePrice(i)
              const hasDiscount = price < i.product.list_price
              return (
                <tr key={i.product.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button type="button" onClick={() => setOpenProduct(i.product)} aria-label={`Visa ${i.product.name}`} style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in' }}>
                        <Thumb p={i.product} size={60} />
                      </button>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{i.product.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{i.product.brand} · {i.product.unit}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {(() => {
                      const id = i.product.id
                      const car = fromCar(i), ship = toShip(i)
                      const mode = car === 0 ? 'ship' : ship === 0 ? 'car' : 'split'
                      const opts: [string, string][] = [['car', 'Bilen'], ['ship', 'Frakt'], ...(i.qty > 1 ? [['split', 'Dela']] as [string, string][] : [])]
                      const pick = (m: string) => setCarQty(c => ({ ...c, [id]: m === 'car' ? -1 : m === 'ship' ? 0 : Math.max(1, Math.floor(i.qty / 2)) }))
                      const setCar = (n: number) => setCarQty(c => ({ ...c, [id]: Math.max(1, Math.min(i.qty - 1, n)) }))
                      return (
                        <div>
                          <div role="group" aria-label={`Leverans för ${i.product.name}`} style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
                            {opts.map(([v, label]) => {
                              const on = mode === v
                              return (
                                <button key={v} type="button" aria-pressed={on} onClick={() => pick(v)}
                                  style={{ padding: '6px 10px', fontSize: 12, fontWeight: on ? 700 : 500, border: 'none', cursor: 'pointer',
                                    background: on ? 'rgba(232,184,75,.15)' : 'var(--bg4)', color: on ? 'var(--text)' : 'var(--text2)' }}>
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                          {car > 0 && Object.keys(myCar).length > 0 && car > (myCar[id] ?? 0) && (
                            <div style={{ marginTop: 6, fontSize: 11, color: '#E0A85A' }}>Du har {myCar[id] ?? 0} st i bilen</div>
                          )}
                          {mode === 'split' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                              <span>Bilen</span>
                              <button type="button" onClick={() => setCar(car - 1)} disabled={car <= 1} aria-label="Färre från bilen" style={{ ...smallBtn, width: 24, height: 24, opacity: car <= 1 ? .4 : 1 }}><Minus size={11} /></button>
                              <strong style={{ color: 'var(--text)', minWidth: 14, textAlign: 'center' }}>{car}</strong>
                              <button type="button" onClick={() => setCar(car + 1)} disabled={ship <= 1} aria-label="Fler från bilen" style={{ ...smallBtn, width: 24, height: 24, opacity: ship <= 1 ? .4 : 1 }}><Plus size={11} /></button>
                              <span>· <strong style={{ color: 'var(--text)' }}>{ship}</strong> frakt</span>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button type="button" onClick={() => updateQty(i.product.id, -1)} aria-label={`Minska ${i.product.name}`} style={smallBtn}><Minus size={13} /></button>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 22, textAlign: 'center' }}>{i.qty}</span>
                      <button type="button" onClick={() => updateQty(i.product.id, 1)} aria-label={`Öka ${i.product.name}`} style={smallBtn}><Plus size={13} /></button>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ position: 'relative', width: 78 }}>
                      <input type="text" inputMode="decimal" aria-label={`Rabatt i procent för ${i.product.name}`} placeholder="0"
                        value={lineDisc[i.product.id] ?? ''} onChange={e => setLineDisc(d => ({ ...d, [i.product.id]: e.target.value.replace(/[^\d,.]/g, '') }))}
                        style={{ width: '100%', padding: '6px 24px 6px 10px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', textAlign: 'right' }} />
                      <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)', fontSize: 12 }}>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    {hasDiscount && <div style={{ fontSize: 11, color: 'var(--text2)', textDecoration: 'line-through' }}>{fmt(i.product.list_price)} kr</div>}
                    <div style={{ color: hasDiscount ? 'var(--green)' : 'var(--text)', fontWeight: 600 }}>{fmt(price)} kr</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmt(i.qty * price)} kr<IncVat net={i.qty * price} /></td>
                  <td style={{ padding: '12px 10px' }}>
                    <button type="button" onClick={() => removeLine(i.product.id)} aria-label={`Ta bort ${i.product.name}`} title="Ta bort raden"
                      style={{ ...smallBtn, background: 'transparent', border: '1px solid rgba(224,82,82,.3)', color: 'var(--red)' }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              )
            })}
            {cart.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text2)' }}>Varukorgen är tom. <button onClick={() => setView('new')} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 13 }}>Lägg till produkter</button></td></tr>
            )}
          </tbody>
        </table>
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              <input type="checkbox" checked={discountEnabled} onChange={e => setDiscountEnabled(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }} />
              <Tag size={13} /> Rabatt på hela ordern
            </label>
            {discountEnabled && (
              <div style={{ position: 'relative', width: 110 }}>
                <input type="text" inputMode="decimal" placeholder="t.ex. 10" aria-label="Orderrabatt i procent" autoFocus value={discount} onChange={e => setDiscount(e.target.value.replace(/[^\d,.]/g, ''))}
                  style={{ width: '100%', padding: '7px 26px 7px 10px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', textAlign: 'right' }} />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)', fontSize: 13 }}>%</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)' }}>
            <span>Varor exkl. moms</span><span>{fmt(subtotal)} kr</span>
          </div>
          {discountAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--green)' }}>
              <span>Rabatt {String(discountPct).replace('.', ',')} %</span><span>−{fmt(discountAmt)} kr</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text)' }}>
            <span>Summa exkl. moms</span><span>{fmt(afterDiscount)} kr</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)' }}>
            <span>Moms (25%)</span><span>{fmt(vat)} kr</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, color: 'var(--text)', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span>Totalt inkl. moms</span><span style={{ color: 'var(--gold)' }}>{fmt(total)} kr</span>
          </div>
        </div>
      </div>

      {/* Customer */}
      <div id="kund" style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Kund</h3>
          {selectedCustomer && (
            <button onClick={clearCustomer} style={{ padding: '6px 12px', borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>Byt kund</button>
          )}
        </div>
        {selectedCustomer ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{selectedCustomer.company}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', margin: '2px 0 14px' }}>Org.nr: {selectedCustomer.org_nr || '—'} · Prislista {selectedCustomer.price_list_id}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 28px' }}>
              {[
                { label: 'Kontaktperson', value: selectedCustomer.contact_name || '—' },
                { label: 'E-post', value: selectedCustomer.email || '—' },
                { label: 'Telefon', value: selectedCustomer.phone || '—' },
                { label: 'Ort', value: selectedCustomer.city || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflowWrap: 'anywhere' }}>{value}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 12px' }}>
              Valfritt nu – trycker du Lägg order eller Offert utan kund får du välja eller skapa kunden direkt efteråt.
            </p>
            <CustomerPicker customers={customers} onPick={selectCustomerAndLoad} onNew={company => setNewCustomerFor(company)} />
          </>
        )}
      </div>

      {selectedCustomer && (
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Säljare</h3>
          <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 12px' }}>Säljaren som hanterar ordern och får den på sin budget.</p>
          <div style={{ position: 'relative' }}>
            <select value={assignee} onChange={e => setAssignee(e.target.value)} style={selectStyle}>
              <option value="">{selectedCustomer.account_manager ? `Kundansvarig (${selectedCustomer.account_manager})` : '— Ingen säljare —'}</option>
              {teamOptions(SALESPEOPLE, assignee).map(sp => <option key={sp} value={sp}>{sp}{sp === selectedCustomer.account_manager ? ' (kundansvarig)' : ''}</option>)}
            </select>
            <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          </div>
        </div>
      )}
      {selectedCustomer && customerDeals.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Koppla till affär</h3>
          <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 12px' }}>Affären markeras som vunnen och räknas via ordern, så budgeten inte räknar samma försäljning två gånger.</p>
          <div style={{ position: 'relative' }}>
            <select value={dealId} onChange={e => setDealId(e.target.value)} style={selectStyle}>
              <option value="">— Ingen affär —</option>
              {customerDeals.map(d => <option key={d.id} value={d.id}>{d.title} · {d.stage} · {fmt(d.value || 0)} kr</option>)}
            </select>
            <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          </div>
        </div>
      )}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={15} color="var(--text2)" /> Leverans
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 12px' }}>
          Välj per rad i kassan: <strong style={{ color: 'var(--text)' }}>Bilen</strong> lämnas direkt till kunden och dras inte från lagret, <strong style={{ color: 'var(--text)' }}>Frakt</strong> skickas från lagret. <strong style={{ color: 'var(--text)' }}>Dela</strong> när en del finns i bilen och resten ska fraktas.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: cart.some(i => toShip(i) > 0) ? 12 : 0 }}>
          <button type="button" onClick={() => setCarQty(Object.fromEntries(cart.map(i => [i.product.id, -1])))}
            style={{ padding: '7px 12px', borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>Allt från bilen</button>
          <button type="button" onClick={() => setCarQty({})}
            style={{ padding: '7px 12px', borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>Allt med frakt</button>
        </div>
        {cart.some(i => toShip(i) > 0) && (
          <div style={{ position: 'relative' }}>
            <select value={delivery} onChange={e => setDelivery(e.target.value)} aria-label="Fraktsätt" style={selectStyle}>
              <option>Standard (2-3 dagar)</option>
              <option>Express (nästa dag)</option>
            </select>
            <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        <button onClick={() => makeQuote('pdf')} disabled={placing || cart.length === 0}
          title="Sparar offerten (och lead i pipelinen) och laddar ner den som PDF"
          style={{ padding: '14px 0', background: 'var(--gold)', border: 'none', borderRadius: 10, color: '#111', fontSize: 14, fontWeight: 700, cursor: placing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <FileDown size={16} /> {editingOrder?.status === 'quote' ? 'Uppdatera offert (PDF)' : 'Offert som PDF'}
        </button>
        <button onClick={() => makeQuote('mail')} disabled={placing || cart.length === 0}
          title={noCustomer ? 'Du väljer eller skapar kunden i nästa steg' : 'Sparar offerten och visar den färdig att klistra in i mejlet'}
          style={{ padding: '14px 0', background: 'var(--bg3)', border: '1px solid rgba(232,184,75,.5)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: placing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Mail size={16} /> Mejla offert
        </button>
        <button onClick={() => noCustomer ? setAfterCustomer('pending') : saveOrder('pending')} disabled={placing || cart.length === 0}
          title={noCustomer ? 'Du väljer eller skapar kunden i nästa steg' : undefined}
          style={{ padding: '14px 0', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: placing ? 'not-allowed' : 'pointer' }}>
          {placing ? 'Sparar…' : allFromCar ? 'Lägg order · levererad' : 'Lägg order'}
        </button>
        <button onClick={() => saveOrder('draft')} disabled={placing || cart.length === 0}
          style={{ padding: '14px 0', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text2)', fontSize: 14, fontWeight: 600, cursor: placing ? 'not-allowed' : 'pointer' }}>
          {noCustomer ? 'Spara utkast utan kund' : 'Spara utkast'}
        </button>
      </div>
      {allFromCar && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>Allt levereras från bilen — ordern markeras direkt som levererad.</p>}
      <p style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', margin: '10px 0 0' }}>
        Offerten sparas som lead i pipelinen. Utkast och offerter påverkar inte lager eller budget förrän de blir en order.
      </p>

      {newCustomerFor !== null && (<Portal>
        <NewCustomerModal initialCompany={newCustomerFor} accountManager={myName}
          onClose={() => setNewCustomerFor(null)}
          onCreated={c => { setCustomers(cs => [...cs, c].sort((a, b) => a.company.localeCompare(b.company))); selectCustomerAndLoad(c); setNewCustomerFor(null); showToast(`${c.company} skapad`) }} />
      </Portal>)}
      {openProduct && (<Portal>
        <ProductSheet p={openProduct} selectedCustomer={selectedCustomer} qty={getQty(openProduct.id)}
          categoryName={categories.find(c => c.id === openProduct.category_id)?.name || ''}
          onAdd={() => addToCart(openProduct)} onRemove={() => updateQty(openProduct.id, -1)}
          onClose={() => setOpenProduct(null)} />
      </Portal>)}
      {shareModal}
      {customerNeeded}
      {newCartModal}
      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 1200 }}>{toast}</div>}
    </div>
  )

  // ── NEW ORDER VIEW ─────────────────────────────────────────
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const drawerBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  return (
    <div>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px 14px 110px' : '24px 24px 110px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {editingOrder?.status === 'quote' ? `Offert #${editingOrder.order_nr}` : 'Skapa ny order'}
          </h1>
          {saveError ? (
            <span role="alert" style={{ fontSize: 12, color: 'var(--red)' }}>{saveError}</span>
          ) : editingOrder?.status === 'draft' && autoSavedAt && (
            <span style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Check size={13} color="var(--green)" /> Sparad som utkast #{editingOrder.order_nr} {autoSavedAt}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {editingOrder && (
              <button onClick={newCart} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                Ny varukorg
              </button>
            )}
            <button onClick={() => setView('history')} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
              Alla ordrar →
            </button>
            <button onClick={() => setShowCart(true)} aria-label={`Varukorg, ${cartCount} varor`}
              style={{ position: 'relative', width: 44, height: 44, borderRadius: 10, background: cartCount ? 'rgba(232,184,75,.12)' : 'var(--bg3)', border: `1px solid ${cartCount ? 'rgba(232,184,75,.4)' : 'var(--border)'}`, color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={19} />
              {cartCount > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: 'var(--gold)', color: '#111', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>{cartCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Saved carts: drafts to pick up again */}
        {(() => {
          const drafts = orders.filter(o => o.status === 'draft' && o.id !== editingOrder?.id).slice(0, 8)
          if (drafts.length === 0) return null
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Sparade varukorgar</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {drafts.map(o => (
                  <div key={o.id} style={{ flexShrink: 0, display: 'flex', alignItems: 'stretch', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, minWidth: 190 }}>
                    <button type="button" onClick={() => openForEdit(o)}
                      style={{ flex: 1, textAlign: 'left', padding: '9px 6px 9px 14px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShoppingCart size={13} color="var(--gold)" /> #{o.order_nr} · {(o as any).customers?.company || 'Utan kund'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{fmt(o.subtotal)} kr · {formatDateTime(o.created_at)}</div>
                    </button>
                    <button type="button" aria-label={`Ta bort varukorg #${o.order_nr}`} title="Ta bort varukorgen"
                      onClick={async () => {
                        if (!confirm(`Ta bort varukorg #${o.order_nr}?`)) return
                        if (await removeOpenOrder(supabase, o.id)) { setOrders(os => os.filter(x => x.id !== o.id)); showToast(`Varukorg #${o.order_nr} borttagen`) }
                      }}
                      style={{ padding: '0 12px', background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Customer: optional here — the catalogue works without one */}
        {selectedCustomer ? (
          <div style={{ background: 'rgba(232,184,75,.06)', border: '1px solid rgba(232,184,75,.25)', borderRadius: 12, marginBottom: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Kund</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{selectedCustomer.company}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                {selectedCustomer.contact_name && `${selectedCustomer.contact_name} · `}Prislista {selectedCustomer.price_list_id}
              </div>
            </div>
            <button onClick={clearCustomer}
              style={{ padding: '7px 14px', borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Byt kund
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <CustomerPicker customers={customers} onPick={selectCustomerAndLoad} onNew={company => setNewCustomerFor(company)} />
            <p style={{ margin: '6px 2px 0', fontSize: 12, color: 'var(--text2)' }}>Kund är valfritt här – du kan välja eller skapa kunden i kassan.</p>
          </div>
        )}

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, overflowX: 'auto' }}>
          <button onClick={() => setSelectedCategory('all')}
            style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
              background: selectedCategory === 'all' ? 'var(--gold)' : 'var(--bg3)',
              borderColor: selectedCategory === 'all' ? 'var(--gold)' : 'var(--border)',
              color: selectedCategory === 'all' ? '#111' : 'var(--text3)', fontWeight: selectedCategory === 'all' ? 700 : 400 }}>
            Alla
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
              style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                background: selectedCategory === cat.id ? 'rgba(232,184,75,.12)' : 'var(--bg3)',
                borderColor: selectedCategory === cat.id ? 'rgba(232,184,75,.4)' : 'var(--border)',
                color: selectedCategory === cat.id ? 'var(--gold)' : 'var(--text3)', fontWeight: selectedCategory === cat.id ? 600 : 400 }}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input placeholder="Sök produkt..." value={productSearch} onChange={e => setProductSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 34px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Catalogue */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Laddar produkter...</div>
        ) : (() => {
          const card = (p: Product, badge?: 'köpt' | 'rec') => (
            <ProductCard key={p.id} p={p} badge={badge} selectedCustomer={selectedCustomer} qty={getQty(p.id)} inCar={myCar[p.id] ?? 0}
              onAdd={() => addToCart(p)} onRemove={() => updateQty(p.id, -1)} onOpen={() => setOpenProduct(p)} />
          )
          const grid = (items: React.ReactNode) => (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 160 : 210}px, 1fr))`, gap: isMobile ? 10 : 16 }}>{items}</div>
          )
          const section = (key: string, title: React.ReactNode, items: React.ReactNode) => (
            <section key={key} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>{title}</h2>
              {grid(items)}
            </section>
          )
          // Whole catalogue: one section per category, like a printed catalogue.
          const byCategory = selectedCategory === 'all' && !productSearch
          const groups = byCategory
            ? [...categories.map(c => ({ key: c.id, name: c.name, items: mainProducts.filter(p => p.category_id === c.id) })),
               { key: 'none', name: 'Övrigt', items: mainProducts.filter(p => !categories.some(c => c.id === p.category_id)) }].filter(g => g.items.length)
            : []
          return (
            <>
              {lastBoughtProducts.length > 0 && section('bought', <><Star size={14} color="var(--gold)" /> Köpt tidigare av {selectedCustomer?.company}</>, lastBoughtProducts.map(p => card(p, 'köpt')))}
              {recommendations.length > 0 && section('rec', <><Tag size={14} color="#6AAFF0" /> Rekommenderas</>, recommendations.map(p => card(p, 'rec')))}
              {byCategory
                ? groups.map(g => section(g.key, <>{g.name} <span style={{ fontWeight: 500, color: 'var(--text2)' }}>· {g.items.length}</span></>, g.items.map(p => card(p))))
                : mainProducts.length > 0 && grid(mainProducts.map(p => card(p)))}
              {mainProducts.length === 0 && lastBoughtProducts.length === 0 && recommendations.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>Inga produkter hittades</div>
              )}
            </>
          )
        })()}
      </div>

      {/* Cart button that follows along while scrolling */}
      {cart.length > 0 && !showCart && (
        <button onClick={() => setShowCart(true)} style={{ position: 'fixed', bottom: 20, right: isMobile ? '50%' : 28, transform: isMobile ? 'translateX(50%)' : undefined, background: 'var(--gold)', border: 'none', borderRadius: 30, color: '#111', fontSize: 14, fontWeight: 700, padding: '14px 24px', cursor: 'pointer', zIndex: 500, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 6px 24px rgba(0,0,0,.45)' }}>
          <ShoppingCart size={17} /> {cartCount} st · {fmt(afterDiscount)} kr
        </button>
      )}

      {/* Cart drawer */}
      {showCart && (<Portal>
        <div onClick={() => setShowCart(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 900 }}>
          <aside role="dialog" aria-modal="true" aria-label="Varukorg" onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(560px, 100vw)', background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(0,0,0,.4)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShoppingCart size={18} color="var(--gold)" />
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Varukorg</span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{selectedCustomer ? `${selectedCustomer.company} · prislista ${selectedCustomer.price_list_id}` : 'Ingen kund vald'}{editingOrder ? ` · ${editingOrder.status === 'quote' ? 'offert' : 'utkast'} #${editingOrder.order_nr}` : ''}</span>
              <button onClick={() => setShowCart(false)} aria-label="Stäng" style={{ ...drawerBtn, marginLeft: 'auto' }}><X size={16} /></button>
            </div>
            {cart.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text2)' }}>
                <ShoppingCart size={36} strokeWidth={1.2} />
                <span style={{ fontSize: 13 }}>Varukorgen är tom</span>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px' }}>
                  {cart.map(i => {
                    const price = linePrice(i)
                    return (
                      <div key={i.product.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border2)' }}>
                        <button type="button" onClick={() => setOpenProduct(i.product)} aria-label={`Visa ${i.product.name}`} style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in' }}>
                          <Thumb p={i.product} size={68} />
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{i.product.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text2)', margin: '2px 0 8px' }}>
                            {fmt(price)} kr/st{linePct(i) > 0 ? ` · −${String(linePct(i)).replace('.', ',')} %` : ''}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={() => updateQty(i.product.id, -1)} aria-label={`Minska ${i.product.name}`} style={drawerBtn}><Minus size={13} /></button>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 22, textAlign: 'center' }}>{i.qty}</span>
                            <button onClick={() => updateQty(i.product.id, 1)} aria-label={`Öka ${i.product.name}`} style={drawerBtn}><Plus size={13} /></button>
                            <button onClick={() => removeLine(i.product.id)} aria-label={`Ta bort ${i.product.name}`} title="Ta bort raden"
                              style={{ ...drawerBtn, marginLeft: 6, background: 'transparent', border: '1px solid rgba(224,82,82,.3)', color: 'var(--red)' }}><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(i.qty * price)} kr<IncVat net={i.qty * price} /></div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
                  {discountAmt > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: 'var(--green)' }}>
                      <span>Rabatt {String(discountPct).replace('.', ',')} %</span><span>−{fmt(discountAmt)} kr</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: 'var(--text)' }}>
                    <span>Summa exkl. moms</span><span>{fmt(afterDiscount)} kr</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13, color: 'var(--text2)' }}>
                    <span>Moms (25%)</span><span>{fmt(vat)} kr</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 14, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <span>Totalt inkl. moms</span><span style={{ color: 'var(--gold)' }}>{fmt(total)} kr</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={() => makeQuote('pdf')} disabled={placing}
                      style={{ padding: '14px 0', background: 'var(--gold)', border: 'none', borderRadius: 10, color: '#111', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <FileDown size={16} /> Offert som PDF
                    </button>
                    <button onClick={() => { setShowCart(false); setView('confirm') }}
                      style={{ padding: '14px 0', background: 'var(--bg3)', border: '1px solid rgba(232,184,75,.5)', borderRadius: 10, color: 'var(--text)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                      Till kassan →
                    </button>
                  </div>
                  {!selectedCustomer && <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text2)', textAlign: 'center' }}>Ingen kund vald – du väljer eller skapar kunden i nästa steg.</p>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={newCart} style={{ flex: 1, padding: '10px 0', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Ny varukorg</button>
                    <button onClick={discardCart} style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid rgba(224,82,82,.3)', borderRadius: 9, color: 'var(--red)', fontSize: 13, cursor: 'pointer' }}>Radera varukorgen</button>
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--text2)', textAlign: 'center' }}>
                    Varukorgen sparas automatiskt och finns kvar resten av dagen – även om du byter sida eller enhet.
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      </Portal>)}

      {newCustomerFor !== null && (<Portal>
        <NewCustomerModal initialCompany={newCustomerFor} accountManager={myName}
          onClose={() => setNewCustomerFor(null)}
          onCreated={c => { setCustomers(cs => [...cs, c].sort((a, b) => a.company.localeCompare(b.company))); selectCustomerAndLoad(c); setNewCustomerFor(null); showToast(`${c.company} skapad`) }} />
      </Portal>)}
      {openProduct && (<Portal>
        <ProductSheet p={openProduct} selectedCustomer={selectedCustomer} qty={getQty(openProduct.id)}
          categoryName={categories.find(c => c.id === openProduct.category_id)?.name || ''}
          onAdd={() => addToCart(openProduct)} onRemove={() => updateQty(openProduct.id, -1)}
          onClose={() => setOpenProduct(null)} />
      </Portal>)}

      {shareModal}
      {customerNeeded}
      {newCartModal}
      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 1200 }}>{toast}</div>}
    </div>
  )
}
