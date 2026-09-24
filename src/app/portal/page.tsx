'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PublicShell, usePublicCart } from '@/components/layout/PublicShell'
import { fmt } from '@/lib/utils'
import {
  Package, ShoppingCart, User, Save, Check, ClipboardList, RefreshCw, ArrowRight, ExternalLink
} from 'lucide-react'
import type { User as SupaUser } from '@supabase/supabase-js'
import OrderTracking from '@/components/portal/OrderTracking'

const DISCOUNT: Record<string, number> = { A: 0.40, B: 0.30, C: 0.20, Standard: 0 }
const STATUS_LABEL: Record<string, string> = { pending: 'Mottagen', confirmed: 'Bekräftad', packed: 'Packad', shipped: 'Skickad', delivered: 'Levererad', cancelled: 'Avbruten' }
const STATUS_COLOR: Record<string, string> = { pending: '#D48A3A', confirmed: '#C9971A', packed: '#C9971A', shipped: '#4A8FD4', delivered: '#4CAF7D', cancelled: '#E05252' }

function PortalContent({ user }: { user: SupaUser }) {
  const router = useRouter()
  const cart   = usePublicCart()

  const [customer, setCustomer]     = useState<any>(null)
  const [orders, setOrders]         = useState<any[]>([])
  const [products, setProducts]     = useState<any[]>([])
  const [loaded, setLoaded]         = useState(false)
  const [tab, setTab]               = useState<'overview'|'orders'|'account'>('overview')
  const [form, setForm]             = useState({ contact_name: '', phone: '', address: '' })
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [pwNew, setPwNew]           = useState('')
  const [pwMsg, setPwMsg]           = useState('')

  const role = user.user_metadata?.role
  useEffect(() => {
    if (role === 'admin') { router.replace('/admin/dashboard'); return }
    if (role === 'crm')   { router.replace('/crm/dashboard');   return }

    const sb = createClient()
    Promise.all([
      sb.from('customers').select('*').eq('auth_user_id', user.id).maybeSingle(),
      sb.from('orders')
        .select('*,order_items(product_id,product_name,qty,unit_price,list_price)')
        .or(`customer_id.eq.${user.user_metadata?.customer_id ?? 'none'}`)
        .order('created_at', { ascending: false }).limit(20),
      sb.from('products').select('id,name,list_price,image_url,unit,brand').limit(12),
    ]).then(([{ data: c }, { data: o }, { data: p }]) => {
      if (c) {
        setCustomer(c)
        setForm({ contact_name: c.contact_name || '', phone: c.phone || '', address: c.address || '' })
        // Re-fetch orders by customer id if we have one
        sb.from('orders')
          .select('*,order_items(product_id,product_name,qty,unit_price,list_price)')
          .eq('customer_id', c.id)
          .order('created_at', { ascending: false }).limit(20)
          .then(({ data: orders2 }) => { if (orders2) setOrders(orders2) })
      }
      if (o) setOrders(o)
      if (p) setProducts(p)
      setLoaded(true)
    })
  }, [user])

  async function saveProfile() {
    if (!customer?.id) return
    setSaving(true)
    await createClient().from('customers').update({ contact_name: form.contact_name, phone: form.phone }).eq('id', customer.id)
    setSaved(true); setSaving(false)
    setTimeout(() => setSaved(false), 2500)
  }

  async function changePassword() {
    if (!pwNew || pwNew.length < 6) { setPwMsg('Minst 6 tecken'); return }
    const { error } = await createClient().auth.updateUser({ password: pwNew })
    if (error) setPwMsg('Fel: ' + error.message)
    else { setPwMsg('Lösenord uppdaterat!'); setPwNew('') }
    setTimeout(() => setPwMsg(''), 4000)
  }

  const pl           = customer?.price_list_id || 'Standard'
  const disc         = DISCOUNT[pl] ?? 0
  const totalSpend   = orders.reduce((s, o) => s + (o.subtotal || 0), 0)
  const latestOrder  = orders[0]
  const savings      = totalSpend && disc ? Math.round(totalSpend * disc / (1 - disc)) : 0
  const ordersYear   = orders.filter(o => new Date(o.created_at).getFullYear() === new Date().getFullYear()).length

  const productFreq: Record<string, { name: string; qty: number }> = {}
  orders.forEach(o => o.order_items?.forEach((i: any) => {
    if (!productFreq[i.product_id]) productFreq[i.product_id] = { name: i.product_name, qty: 0 }
    productFreq[i.product_id].qty += i.qty
  }))
  const topProducts  = Object.entries(productFreq).sort((a, b) => b[1].qty - a[1].qty).slice(0, 4)
  const topIds       = new Set(topProducts.map(([id]) => id))
  const recommended  = products.filter(p => !topIds.has(p.id)).slice(0, 4)

  function reorder(o: any) {
    if (!o.order_items?.length) return
    o.order_items.forEach((item: any) => {
      for (let i = 0; i < item.qty; i++)
        cart.addItem({ id: item.product_id || item.id, name: item.product_name, brand: '', list_price: item.list_price || item.unit_price, image_url: null, unit: '' }, pl)
    })
    cart.openCart()
  }

  const TABS = [
    { id: 'overview', label: 'Översikt',    icon: Package },
    { id: 'orders',   label: 'Mina ordrar', icon: ClipboardList },
    { id: 'account',  label: 'Mitt konto',  icon: User },
  ] as const

  if (!loaded) {
    return (
      <div style={{ paddingTop: 80, minHeight: '100vh', background: '#F8F5F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(0,0,0,.08)', borderTopColor: '#C9971A', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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
                {customer?.company || user.email?.split('@')[0]}
              </h1>
              {pl !== 'Standard' && (
                <p style={{ margin: '3px 0 0', fontSize: 13, color: '#888' }}>
                  Prislista <strong style={{ color: '#C9971A' }}>{pl}</strong> · {Math.round(disc * 100)}% B2B-rabatt
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 1, background: 'rgba(0,0,0,.06)', borderRadius: 10, overflow: 'hidden', flexWrap: 'wrap' }}>
              {[
                { label: 'Total inköpt',  value: totalSpend ? `${fmt(totalSpend)} kr` : '—' },
                { label: 'Ordrar i år',   value: `${ordersYear}` },
                { label: 'Besparingar',   value: savings ? `${fmt(savings)} kr` : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '12px 20px', background: '#fff', textAlign: 'center', minWidth: 100 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, borderTop: '1px solid rgba(0,0,0,.06)' }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id as any)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '14px 22px', background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: tab === id ? 700 : 400,
                color: tab === id ? '#111' : '#888',
                borderBottom: tab === id ? '2px solid #C9971A' : '2px solid transparent',
                transition: 'all .15s',
              }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

            {/* Latest order */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>Senaste order</div>
              {!latestOrder ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#bbb', fontSize: 13 }}>Inga ordrar ännu</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
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
                  {/* Progress */}
                  {['pending','confirmed','packed','shipped','delivered'].includes(latestOrder.status) && (() => {
                    const steps = ['pending','confirmed','packed','shipped','delivered']
                    const idx = steps.indexOf(latestOrder.status)
                    return (
                      <div style={{ margin: '0 0 14px' }}>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {steps.map((s, i) => <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= idx ? '#C9971A' : '#E8E4DC', transition: 'background .3s' }} />)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          {['Mottagen','Bekräftad','Packad','Skickad','Levererad'].map(l => (
                            <span key={l} style={{ fontSize: 9, color: '#bbb', fontWeight: 600 }}>{l}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                  <OrderTracking order={latestOrder} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    {latestOrder.order_items?.slice(0, 3).map((item: any, i: number) => (
                      <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: '#F5F3EE', borderRadius: 4, color: '#666' }}>
                        {item.product_name} ×{item.qty}
                      </span>
                    ))}
                  </div>
                  <button onClick={() => reorder(latestOrder)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, background: '#111', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                    <RefreshCw size={12} /> Beställ igen
                  </button>
                </>
              )}
            </div>

            {/* Most purchased */}
            {topProducts.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 14, padding: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>Mest köpt</div>
                {topProducts.map(([, { name, qty }], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < topProducts.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: '#F5F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#C9971A' }}>{i + 1}</div>
                      <span style={{ fontSize: 13, color: '#111' }}>{name}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{qty} st totalt</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommended */}
            {recommended.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 14, padding: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>Rekommenderat för dig</div>
                {recommended.map(p => {
                  const price = Math.round(p.list_price * (1 - disc))
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{p.brand}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#C9971A' }}>{fmt(price)} kr</span>
                        <button onClick={() => cart.addItem(p, pl)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, background: '#111', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                          + Lägg till
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Quick actions */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16 }}>Snabbåtgärder</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <a href="/produkter" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#F8F5F0', borderRadius: 10, textDecoration: 'none', color: '#111', fontWeight: 600, fontSize: 14 }}>
                  <ShoppingCart size={16} color="#C9971A" /> Gå till butiken <ArrowRight size={14} style={{ marginLeft: 'auto', color: '#aaa' }} />
                </a>
                <button onClick={() => setTab('orders')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#F8F5F0', borderRadius: 10, border: 'none', cursor: 'pointer', color: '#111', fontWeight: 600, fontSize: 14, textAlign: 'left' }}>
                  <ClipboardList size={16} color="#4A8FD4" /> Mina ordrar <ArrowRight size={14} style={{ marginLeft: 'auto', color: '#aaa' }} />
                </button>
                <button onClick={() => setTab('account')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#F8F5F0', borderRadius: 10, border: 'none', cursor: 'pointer', color: '#111', fontWeight: 600, fontSize: 14, textAlign: 'left' }}>
                  <User size={16} color="#888" /> Mitt konto <ArrowRight size={14} style={{ marginLeft: 'auto', color: '#aaa' }} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ORDERS ── */}
        {tab === 'orders' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, color: '#111', marginBottom: 20 }}>Orderhistorik</h2>
            {orders.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,.07)' }}>
                <Package size={40} style={{ display: 'block', margin: '0 auto 14px', color: '#ddd' }} />
                <div style={{ fontSize: 15, color: '#aaa' }}>Du har inga ordrar ännu</div>
                <a href="/produkter" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 18, padding: '11px 22px', background: '#111', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                  Handla nu <ArrowRight size={14} />
                </a>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {orders.map(o => (
                  <div key={o.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 14, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Order #{o.order_nr}</span>
                        <span style={{ fontSize: 12, color: '#aaa', marginLeft: 10 }}>{o.created_at?.slice(0, 10)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#C9971A' }}>{fmt(o.subtotal)} kr</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: `${STATUS_COLOR[o.status] || '#999'}18`, color: STATUS_COLOR[o.status] || '#999' }}>
                          {STATUS_LABEL[o.status] || o.status}
                        </span>
                      </div>
                    </div>
                    <OrderTracking order={o} />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {o.order_items?.map((item: any, i: number) => (
                        <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: '#F5F3EE', borderRadius: 4, color: '#555' }}>
                          {item.product_name} ×{item.qty}
                        </span>
                      ))}
                    </div>
                    <button onClick={() => reorder(o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, background: 'transparent', border: '1px solid rgba(0,0,0,.15)', color: '#111', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <RefreshCw size={11} /> Beställ igen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ACCOUNT ── */}
        {tab === 'account' && (
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
                  <input value={user.email || ''} disabled style={{ width: '100%', padding: '10px 13px', background: '#eee', border: '1px solid rgba(0,0,0,.06)', borderRadius: 8, fontSize: 14, color: '#999', boxSizing: 'border-box' }} />
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
    </div>
  )
}

function PortalGate() {
  const router = useRouter()
  const [user, setUser] = useState<SupaUser | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.replace('/?login=1'); return }
      setUser(session.user)
      setChecked(true)
    })
  }, [])

  if (!checked) return (
    <div style={{ minHeight: '100vh', background: '#F8F5F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(0,0,0,.08)', borderTopColor: '#C9971A', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (!user) return null
  return <PortalContent user={user} />
}

export default function PortalPage() {
  return <PublicShell><PortalGate /></PublicShell>
}
