'use client'
import { Fragment, useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Product, Customer, Category, CartItem, Order, OrderItem, OrderStatus, ORDER_STATUS_LABEL } from '@/types'
import { custPrice, fmt, formatDateTime } from '@/lib/utils'
import { Plus, Minus, ShoppingCart, Search, Package, ArrowLeft, ChevronDown, Tag, Truck, Star } from 'lucide-react'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { SALESPEOPLE, salespersonName, canConfirmOrder } from '@/lib/team'
import ShipOrderForm from '@/components/orders/ShipOrderForm'

const supabase = createClient()
type View = 'new' | 'confirm' | 'history'

const AFFINITY: Record<string, string[]> = {
  'rapidet':   ['magic', 'gommalux', 'green power'],
  'magic':     ['rapidet', 'carnauba', 'keramisk'],
  'gommalux':  ['rapidet', 'magic'],
  'carnauba':  ['keramisk', 'magic', 'polish'],
  'keramisk':  ['carnauba', 'polish', 'magic'],
  'green':     ['magic', 'rapidet'],
  'polish':    ['carnauba', 'keramisk'],
}

function getRecommendations(boughtNames: string[], allProducts: Product[]): Product[] {
  const recs = new Set<string>()
  for (const name of boughtNames) {
    const key = Object.keys(AFFINITY).find(k => name.toLowerCase().includes(k))
    if (key) {
      for (const recKey of AFFINITY[key]) {
        const match = allProducts.find(p =>
          p.name.toLowerCase().includes(recKey) &&
          !boughtNames.some(b => b.toLowerCase() === p.name.toLowerCase())
        )
        if (match) recs.add(match.id)
      }
    }
  }
  return allProducts.filter(p => recs.has(p.id)).slice(0, 4)
}

function ProductRow({ p, selectedCustomer, getQty, addToCart, updateQty, badge }: {
  p: Product
  selectedCustomer: Customer | null
  getQty: (id: string) => number
  addToCart: (p: Product) => void
  updateQty: (id: string, delta: number) => void
  badge?: 'köpt' | 'rec'
}) {
  const qty   = getQty(p.id)
  const price = custPrice(p.list_price, selectedCustomer?.price_list_id || 'Standard')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: '1px solid var(--border2)', background: badge === 'köpt' ? 'rgba(232,184,75,.03)' : badge === 'rec' ? 'rgba(74,143,212,.02)' : 'transparent' }}>
      <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={20} color="var(--text3)" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
          {badge === 'köpt' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(232,184,75,.15)', color: 'var(--gold)', fontWeight: 700 }}>Köpt</span>}
          {badge === 'rec'  && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(74,143,212,.15)', color: '#6AAFF0', fontWeight: 700 }}>Rekommenderas</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.brand} · {p.unit}</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)', flexShrink: 0 }}>{fmt(price)} kr</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={() => updateQty(p.id, -1)} style={{ width: 28, height: 28, borderRadius: 6, background: qty > 0 ? 'var(--bg4)' : 'transparent', border: `1px solid ${qty > 0 ? 'var(--border)' : 'transparent'}`, color: 'var(--text)', cursor: qty > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: qty > 0 ? 1 : 0 }}>
          <Minus size={12} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: qty > 0 ? 'var(--gold)' : 'var(--text3)', minWidth: 20, textAlign: 'center' }}>{qty > 0 ? qty : '+'}</span>
        <button onClick={() => addToCart(p)} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

export default function CrmOrdersPage() {
  const searchParams = useSearchParams()
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
  const [isMobile, setIsMobile]           = useState(false)
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [delivery, setDelivery]           = useState('Direkt')
  const [assignee, setAssignee]           = useState('')
  const [customerDeals, setCustomerDeals] = useState<{ id: string; title: string; value: number; stage: string }[]>([])
  const [dealId, setDealId]               = useState('')
  const [myName, setMyName]               = useState('')
  const [isAdmin, setIsAdmin]             = useState(false)
  const [confirmingId, setConfirmingId]   = useState<string | null>(null)
  const [onlyMine, setOnlyMine]           = useState(false)
  const [placing, setPlacing]             = useState(false)

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
      supabase.from('customers').select('id,company,contact_name,price_list_id,city,org_nr,phone,email,account_manager').eq('status', 'active').order('company'),
      supabase.from('products').select('id,sku,name,brand,unit,list_price,stock_qty,active,image_url,category_id').eq('active', true).order('sort_order'),
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

  async function loadLastBought(customer: Customer) {
    const { data } = await supabase
      .from('orders')
      .select('order_items(product_name)')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(3)
    if (data) {
      const names: string[] = [...new Set(
        data.flatMap((o: any) => (o.order_items || []).map((i: any) => i.product_name as string))
      )].slice(0, 5)
      setLastBought(names)
      setRecommendations(getRecommendations(names, products))
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
    supabase.auth.getUser().then(({ data: { user } }) => { setMyName(salespersonName(user)); setIsAdmin(user?.user_metadata?.role === 'admin') })
  }, [])

  function selectCustomerAndLoad(c: Customer) {
    setSelectedCustomer(c)
    setAssignee(c.account_manager || myName)
    setCart([])
    loadLastBought(c)
    loadCustomerDeals(c)
  }

  // Deals the order can be linked to, so a won deal and its order are only
  // counted once in the budget. Pre-selects the most likely one: a won deal
  // without an order, else the furthest-along open deal.
  async function loadCustomerDeals(c: Customer) {
    setCustomerDeals([]); setDealId('')
    const [{ data: deals }, { data: linked, error }] = await Promise.all([
      supabase.from('deals').select('id,title,value,stage').eq('customer_id', c.id).neq('stage', 'Förlorad').order('created_at', { ascending: false }),
      supabase.from('orders').select('deal_id').eq('customer_id', c.id).not('deal_id', 'is', null).neq('status', 'cancelled'),
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

  const subtotal    = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const discountAmt = discountEnabled && discount ? parseInt(discount) || 0 : 0
  const afterDiscount = Math.max(0, subtotal - discountAmt)
  const vat   = Math.round(afterDiscount * 0.25)
  const total = afterDiscount + vat

  async function placeOrder() {
    if (!selectedCustomer || cart.length === 0 || placing) return
    setPlacing(true)
    const { data: order, error } = await supabase.from('orders').insert({
      customer_id: selectedCustomer.id,
      // Placed as pending: the salesperson confirms it from the history or dashboard.
      status: 'pending' as OrderStatus,
      created_by: myName || null,
      price_list_id: selectedCustomer.price_list_id,
      delivery_name: selectedCustomer.company,
      delivery_city: selectedCustomer.city,
      subtotal: afterDiscount, vat_amount: vat, total,
      // Empty lets the database default it to the customer's account manager.
      // No manager on the customer: the salesperson placing it receives it.
      assigned_to: assignee || (selectedCustomer.account_manager ? null : myName || null),
      ...(dealId ? { deal_id: dealId } : {}),
      notes: `Leverans: ${delivery}${discountAmt ? ` | Rabatt: ${discountAmt} kr` : ''}`
    }).select().single()
    if (error || !order) { showToast('Fel vid orderläggning'); setPlacing(false); return }
    // An order on a deal means the deal is won.
    const linkedDeal = customerDeals.find(d => d.id === dealId)
    if (linkedDeal && linkedDeal.stage !== 'Vunnen') {
      await supabase.from('deals').update({ stage: 'Vunnen', updated_at: new Date().toISOString() }).eq('id', linkedDeal.id)
    }
    await supabase.from('order_items').insert(cart.map(i => ({
      order_id: order.id, product_id: i.product.id,
      product_name: i.product.name, product_sku: i.product.sku,
      qty: i.qty, unit_price: i.unitPrice, list_price: i.product.list_price,
      total_price: i.qty * i.unitPrice
    })))
    setOrders(os => [{ ...order, customers: selectedCustomer }, ...os])
    setCart([]); setSelectedCustomer(null); setCustomerSearch(''); setProductSearch('')
    setDiscount(''); setDiscountEnabled(false); setDelivery('Direkt')
    setLastBought([]); setSelectedCategory('all'); setCustomerDeals([]); setDealId('')
    setPlacing(false); setView('history')
    showToast(`Order #${order.order_nr} skapad — bekräfta den när den är klar`)
  }

  async function confirmOrder(id: string) {
    setConfirmingId(id)
    const { data: ok, error } = await supabase.rpc('confirm_order', { p_order_id: id })
    setConfirmingId(null)
    if (error || !ok) { showToast('Kunde inte bekräfta ordern'); return }
    setOrders(os => os.map(o => o.id === id ? { ...o, status: 'confirmed' as OrderStatus } : o))
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

  // ── HISTORY VIEW ───────────────────────────────────────────
  if (view === 'history') return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{onlyMine ? 'Mina ordrar' : 'Alla ordrar'}</h1>
        <button onClick={() => setOnlyMine(m => !m)} style={{ marginLeft: 'auto', marginRight: 10, padding: '8px 14px', background: onlyMine ? 'rgba(232,184,75,.12)' : 'transparent', border: `1px solid ${onlyMine ? 'rgba(232,184,75,.35)' : 'var(--line)'}`, borderRadius: 8, color: onlyMine ? 'var(--gold)' : 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {onlyMine ? 'Visa alla' : 'Bara mina'}
        </button>
        <button onClick={() => setView('new')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={15} /> Ny order
        </button>
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 480 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Order', 'Datum', 'Kund', 'Säljare', 'Summa inkl. moms', 'Status'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Laddar...</td></tr>
            ) : orders.filter(o => !onlyMine || o.assigned_to === myName || o.created_by === myName).map(o => {
              const expanded = expandedOrderId === o.id
              const items = orderItemsById[o.id]
              return (
                <Fragment key={o.id}>
                  <tr onClick={() => toggleOrderExpand(o.id)} style={{ borderBottom: expanded ? 'none' : '1px solid var(--border2)', cursor: 'pointer', background: expanded ? 'rgba(232,184,75,.04)' : 'transparent' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)' }}>#{o.order_nr}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>{formatDateTime(o.created_at)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 500 }}>{(o as any).customers?.company || '—'}</td>
                    <td style={{ padding: '12px 16px', color: o.assigned_to ? 'var(--text2)' : 'var(--red)' }}>{o.assigned_to || 'Saknas'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--gold)', fontWeight: 700 }}>{fmt(o.total)} kr</td>
                    <td style={{ padding: '12px 16px' }}>
                      {o.status === 'pending' && canConfirmOrder(o, myName, isAdmin) ? (
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
                              <span key={item.id} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--text2)' }}>
                                {item.product_name} ×{item.qty}
                              </span>
                            ))}
                          </div>
                        )}
                        {o.status !== 'pending' && (canConfirmOrder(o, myName, isAdmin) || o.transport_order_id) && (
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
      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 999 }}>{toast}</div>}
    </div>
  )

  // ── CONFIRM VIEW ───────────────────────────────────────────
  if (view === 'confirm' && selectedCustomer) return (
    <div style={{ padding: '24px 20px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Bekräfta order</h1>
        <button onClick={() => setView('new')} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Gå tillbaka och ändra order
        </button>
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{selectedCustomer.company}</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 20px' }}>Org.nr: {selectedCustomer.org_nr || '—'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 32px' }}>
          {[
            { label: 'Kontaktperson', value: selectedCustomer.contact_name },
            { label: 'E-post', value: selectedCustomer.email },
            { label: 'Telefon', value: selectedCustomer.phone || '—' },
            { label: 'Adress', value: selectedCustomer.city || '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: discountEnabled ? 16 : 0 }}>
          <input type="checkbox" checked={discountEnabled} onChange={e => setDiscountEnabled(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Lägg till rabatt</span>
        </label>
        {discountEnabled && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input type="number" placeholder="Ange belopp" value={discount} onChange={e => setDiscount(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none' }} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 13 }}>kr</span>
            </div>
          </div>
        )}
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Säljare</h3>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 12px' }}>Säljaren som hanterar ordern och får den på sin budget.</p>
        <div style={{ position: 'relative' }}>
          <select value={assignee} onChange={e => setAssignee(e.target.value)}
            style={{ width: '100%', padding: '11px 36px 11px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', appearance: 'none', cursor: 'pointer' }}>
            <option value="">{selectedCustomer.account_manager ? `Kundansvarig (${selectedCustomer.account_manager})` : '— Ingen säljare —'}</option>
            {SALESPEOPLE.map(sp => <option key={sp} value={sp}>{sp}{sp === selectedCustomer.account_manager ? ' (kundansvarig)' : ''}</option>)}
          </select>
          <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
        </div>
      </div>
      {customerDeals.length > 0 && (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Koppla till affär</h3>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 12px' }}>Affären markeras som vunnen och räknas via ordern, så budgeten inte räknar samma försäljning två gånger.</p>
          <div style={{ position: 'relative' }}>
            <select value={dealId} onChange={e => setDealId(e.target.value)}
              style={{ width: '100%', padding: '11px 36px 11px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', appearance: 'none', cursor: 'pointer' }}>
              <option value="">— Ingen affär —</option>
              {customerDeals.map(d => <option key={d.id} value={d.id}>{d.title} · {d.stage} · {fmt(d.value || 0)} kr</option>)}
            </select>
            <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          </div>
        </div>
      )}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={15} color="var(--text3)" /> Leverans
        </h3>
        <div style={{ position: 'relative' }}>
          <select value={delivery} onChange={e => setDelivery(e.target.value)}
            style={{ width: '100%', padding: '11px 36px 11px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', appearance: 'none', cursor: 'pointer' }}>
            <option>Direkt</option>
            <option>Standard (2-3 dagar)</option>
            <option>Express (nästa dag)</option>
          </select>
          <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
        </div>
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Kassan</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Produkt', 'Antal', 'À-pris', 'Summa'].map(h => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cart.map(i => {
              const hasDiscount = i.unitPrice < i.product.list_price
              return (
                <tr key={i.product.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                  <td style={{ padding: '11px 20px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{i.product.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i.product.brand} · {i.product.unit}</div>
                  </td>
                  <td style={{ padding: '11px 20px', color: 'var(--text2)' }}>{i.qty}</td>
                  <td style={{ padding: '11px 20px' }}>
                    {hasDiscount && <div style={{ fontSize: 11, color: 'var(--text3)', textDecoration: 'line-through' }}>{fmt(i.product.list_price)} kr</div>}
                    <div style={{ color: hasDiscount ? 'var(--green)' : 'var(--text2)', fontWeight: hasDiscount ? 600 : 400 }}>{fmt(i.unitPrice)} kr</div>
                  </td>
                  <td style={{ padding: '11px 20px', fontWeight: 700, color: 'var(--text)' }}>{fmt(i.qty * i.unitPrice)} kr</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {discountAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--green)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Tag size={13} /> Rabatt</span>
              <span>-{fmt(discountAmt)} kr</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)' }}>
            <span>Moms (25%)</span><span>{fmt(vat)} kr</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--text)', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span>Totalt inkl. moms</span><span style={{ color: 'var(--gold)' }}>{fmt(total)} kr</span>
          </div>
        </div>
      </div>
      <button onClick={placeOrder} disabled={placing}
        style={{ width: '100%', padding: '15px 0', background: placing ? 'var(--bg4)' : 'var(--gold)', border: 'none', borderRadius: 10, color: placing ? 'var(--text3)' : '#111', fontSize: 15, fontWeight: 700, cursor: placing ? 'not-allowed' : 'pointer' }}>
        {placing ? 'Skapar order...' : 'Bekräfta och skapa order'}
      </button>
    </div>
  )

  // ── NEW ORDER VIEW ─────────────────────────────────────────
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 58px)', overflow: 'hidden' }}>

      {/* LEFT: customer + products */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 14px' : '24px 20px', paddingBottom: isMobile && cart.length > 0 ? 90 : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Skapa ny order</h1>
          <button onClick={() => setView('history')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>
            Alla ordrar →
          </button>
        </div>

        {/* Customer selector — collapses once a customer is chosen */}
        {selectedCustomer ? (
          <div style={{ background: 'rgba(232,184,75,.06)', border: '1.5px solid rgba(232,184,75,.25)', borderRadius: 12, marginBottom: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Kund</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{selectedCustomer.company}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                {selectedCustomer.contact_name && `${selectedCustomer.contact_name} · `}Prislista {selectedCustomer.price_list_id}
              </div>
            </div>
            <button onClick={() => { setSelectedCustomer(null); setCart([]); setCustomerSearch(''); setLastBought([]); setRecommendations([]); setCustomerDeals([]); setDealId('') }}
              style={{ padding: '7px 14px', borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Byt kund
            </button>
          </div>
        ) : (
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>👤 Välj kund</span>
            </div>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input autoFocus placeholder="Sök företag..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px 8px 30px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {filteredCustomers.slice(0, 10).map(c => (
                <button key={c.id} onClick={() => selectCustomerAndLoad(c)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border2)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,184,75,.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{c.company}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>Prislista {c.price_list_id}</span>
                </button>
              ))}
              {filteredCustomers.length === 0 && <p style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13, margin: 0 }}>Inga kunder hittades</p>}
            </div>
          </div>
        )}

{/* Strip removed — pinned rows now appear at top of product list */}

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

        {/* Product list */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Laddar produkter...</div>
          ) : (
            <>
              {/* ── Senast köpt — pinned ── */}
              {lastBoughtProducts.length > 0 && (
                <>
                  <div style={{ padding: '8px 16px', background: 'rgba(232,184,75,.06)', borderBottom: '1px solid rgba(232,184,75,.12)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Star size={11} color="var(--gold)" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Senast köpt</span>
                  </div>
                  {lastBoughtProducts.map((p) => <ProductRow key={p.id} p={p} selectedCustomer={selectedCustomer} getQty={getQty} addToCart={addToCart} updateQty={updateQty} badge="köpt" />)}
                </>
              )}

              {/* ── Rekommendationer — pinned ── */}
              {recommendations.length > 0 && (
                <>
                  <div style={{ padding: '8px 16px', background: 'rgba(74,143,212,.05)', borderBottom: '1px solid rgba(74,143,212,.12)', borderTop: lastBoughtProducts.length > 0 ? '1px solid var(--border2)' : undefined, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag size={11} color="#6AAFF0" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6AAFF0', textTransform: 'uppercase', letterSpacing: '.07em' }}>Rekommenderas</span>
                  </div>
                  {recommendations.map((p) => <ProductRow key={p.id} p={p} selectedCustomer={selectedCustomer} getQty={getQty} addToCart={addToCart} updateQty={updateQty} badge="rec" />)}
                </>
              )}

              {/* ── All other products ── */}
              {(lastBoughtProducts.length > 0 || recommendations.length > 0) && mainProducts.length > 0 && (
                <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,.02)', borderBottom: '1px solid var(--border2)', borderTop: '1px solid var(--border2)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Alla produkter</span>
                </div>
              )}
              {mainProducts.length === 0 && lastBoughtProducts.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Inga produkter i denna kategori</div>
              )}
              {mainProducts.map((p) => <ProductRow key={p.id} p={p} selectedCustomer={selectedCustomer} getQty={getQty} addToCart={addToCart} updateQty={updateQty} />)}
            </>
          )}
        </div>
      </div>

      {/* Mobile: floating cart button */}
      {isMobile && cart.length > 0 && !showMobileCart && (
        <button onClick={() => setShowMobileCart(true)} style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--gold)', border: 'none', borderRadius: 30, color: '#111', fontSize: 14, fontWeight: 700, padding: '14px 28px', cursor: 'pointer', zIndex: 500, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(232,184,75,.4)' }}>
          <ShoppingCart size={18} /> Varukorg ({cartCount}) · {fmt(subtotal)} kr
        </button>
      )}

      {/* Mobile: cart overlay */}
      {isMobile && showMobileCart && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 400 }} onClick={() => setShowMobileCart(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg2)', borderRadius: '16px 16px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Varukorg</span>
              <button onClick={() => setShowMobileCart(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
              {cart.map(i => (
                <div key={i.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line2)' }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{i.product.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i.qty} × {fmt(i.unitPrice)} kr</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => updateQty(i.product.id, -1)} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg4)', border: '1px solid var(--line)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={12} /></button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', minWidth: 20, textAlign: 'center' }}>{i.qty}</span>
                    <button onClick={() => updateQty(i.product.id, 1)} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg4)', border: '1px solid var(--line)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={12} /></button>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginLeft: 12, minWidth: 60, textAlign: 'right' }}>{fmt(i.qty * i.unitPrice)} kr</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                <span>Moms (25%)</span><span>{fmt(Math.round(subtotal * 0.25))} kr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
                <span>Totalt inkl. moms</span><span style={{ color: 'var(--gold)' }}>{fmt(subtotal + Math.round(subtotal * 0.25))} kr</span>
              </div>
              <button onClick={() => { setView('confirm'); setShowMobileCart(false) }} disabled={!selectedCustomer}
                style={{ width: '100%', padding: 14, background: selectedCustomer ? 'var(--gold)' : 'var(--bg4)', border: 'none', borderRadius: 10, color: selectedCustomer ? '#111' : 'var(--text3)', fontSize: 15, fontWeight: 700, cursor: selectedCustomer ? 'pointer' : 'not-allowed' }}>
                {selectedCustomer ? 'Gå till kassan →' : 'Välj kund först'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT: cart sidebar (desktop only) */}
      <div style={{ width: 320, borderLeft: '1px solid var(--line)', display: isMobile ? 'none' : 'flex', flexDirection: 'column', background: 'var(--bg2)', flexShrink: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Varukorg</span>
          {selectedCustomer && <span style={{ fontSize: 12, color: 'var(--text2)' }}>{selectedCustomer.company}</span>}
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
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Produkt</th>
                    <th style={{ padding: '8px 8px', textAlign: 'center', color: 'var(--text3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Antal</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(i => {
                    const hasDiscount = i.unitPrice < i.product.list_price
                    return (
                      <tr key={i.product.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12 }}>{i.product.name}</div>
                          {hasDiscount && <div style={{ fontSize: 10, color: 'var(--green)' }}>{fmt(i.unitPrice)} kr (ord. {fmt(i.product.list_price)})</div>}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                            <button onClick={() => updateQty(i.product.id, -1)} style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={10} /></button>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', minWidth: 18, textAlign: 'center' }}>{i.qty}</span>
                            <button onClick={() => addToCart(i.product)} style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={10} /></button>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>{fmt(i.qty * i.unitPrice)} kr</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--text2)' }}>
                <span>Delsumma</span><span>{fmt(subtotal)} kr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, color: 'var(--text2)' }}>
                <span>Moms (25%)</span><span>{fmt(Math.round(subtotal * 0.25))} kr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span>Totalt inkl. moms</span><span style={{ color: 'var(--gold)' }}>{fmt(subtotal + Math.round(subtotal * 0.25))} kr</span>
              </div>
              {!selectedCustomer && <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 10 }}>Välj en kund för att fortsätta</p>}
              <button onClick={() => { if (selectedCustomer && cart.length > 0) setView('confirm') }} disabled={!selectedCustomer || cart.length === 0}
                style={{ width: '100%', padding: '13px 0', background: selectedCustomer && cart.length > 0 ? 'var(--gold)' : 'var(--bg4)', border: 'none', borderRadius: 9, color: selectedCustomer && cart.length > 0 ? '#111' : 'var(--text3)', fontSize: 14, fontWeight: 700, cursor: selectedCustomer && cart.length > 0 ? 'pointer' : 'not-allowed' }}>
                Skapa order
              </button>
            </div>
          </>
        )}
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 999 }}>{toast}</div>}
    </div>
  )
}
