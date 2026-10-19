'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Truck, PackageCheck, Package, Check, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { useMe } from '@/hooks/useMe'
import { type ShipLine } from '@/lib/shipping'
import { usePathname } from 'next/navigation'
import ShipOrderForm from '@/components/orders/ShipOrderForm'
import PackingForm from '@/components/orders/PackingForm'

const supabase = createClient()
type Tab = 'pack' | 'pickup' | 'sent'

interface ShipOrder {
  id: string; order_nr: number; status: string; created_at: string
  assigned_to: string | null; created_by: string | null; delivery_name: string | null; delivery_city: string | null
  packed_by: string | null; packed_at: string | null; pickup_at: string | null; shipped_at: string | null
  carrier: string | null; transport_order_id: string | null; notes: string | null
  customers: { id: string; company: string } | null
  ship_lines: ShipLine[]
}

// Leveranser: orders with goods to send from the warehouse. Packing records
// who packed and when; "hämtad" records when the carrier picked it up.
export default function ShippingPage() {
  const me = useMe()
  const inAdmin = (usePathname() || '').startsWith('/admin')
  // The order itself: the admin order panel, or the order in the CRM list.
  const orderHref = (id: string) => inAdmin || me.role === 'admin' ? `/admin/orders?order=${id}` : `/crm/orders?view=history&open=${id}`
  const [pics, setPics] = useState<Record<string, string | null>>({})
  useEffect(() => {
    supabase.from('products').select('id,image_url').then(({ data }) => setPics(Object.fromEntries((data ?? []).map((p: any) => [p.id, p.image_url]))))
  }, [])
  const [orders, setOrders] = useState<ShipOrder[] | null>(null)
  const [tab, setTab] = useState<Tab>('pack')
  const [focus, setFocus] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  function load() {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    supabase.from('orders')
      .select(`id,order_nr,status,created_at,assigned_to,created_by,delivery_name,delivery_city,packed_by,packed_at,pickup_at,shipped_at,carrier,transport_order_id,notes,customers(id,company),ship_lines:order_items(qty,delivery,product_name,product_id)`)
      .or(`status.in.(pending,confirmed,packed),and(status.in.(shipped,delivered),shipped_at.gte."${since}")`)
      .order('created_at', { ascending: true }).limit(300)
      .then(({ data, error }) => {
        if (error) { setMsg(/packed|pickup/.test(error.message) ? 'Kör migration 0023 och 0024 i Supabase för packning.' : error.message); setOrders([]); return }
        setOrders(((data ?? []) as any[]).filter(o => shipQty(o) > 0))
      })
  }
  useEffect(load, [])
  useLiveRefresh(['orders'], load)

  // ?order=<id> opens the right tab and highlights the order.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('order')
    if (!id || !orders) return
    const o = orders.find(x => x.id === id)
    if (!o) return
    setTab(tabOf(o)); setFocus(id)
    setTimeout(() => document.getElementById(`ship-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
  }, [orders])



  const list = orders ?? []
  const byTab = (t: Tab) => list.filter(o => tabOf(o) === t)
  const shown = byTab(tab).sort((a, b) => tab === 'sent' ? (b.shipped_at ?? '').localeCompare(a.shipped_at ?? '') : 0)
  const canShip = (o: ShipOrder) => me.role === 'admin' || o.assigned_to === me.name || o.created_by === me.name

  const tabs: [Tab, string, typeof Truck][] = [['pack', 'Att packa', Package], ['pickup', 'Packade – väntar på hämtning', PackageCheck], ['sent', 'Skickade (30 dagar)', Truck]]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Truck size={22} color="#4FC1D9" />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Leveranser</h1>
      </div>
      <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--text2)' }}>
        Varor som ska skickas från lagret. Markera ordern som packad när den är klar, och som hämtad när transportören har tagit den.
      </p>

      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabs.map(([t, label, Icon]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              background: tab === t ? 'rgba(79,193,217,.14)' : 'transparent', border: `1px solid ${tab === t ? 'rgba(79,193,217,.45)' : 'var(--line)'}`, color: tab === t ? 'var(--text)' : 'var(--text2)' }}>
            <Icon size={15} /> {label} <span style={{ fontWeight: 800 }}>{byTab(t).length}</span>
          </button>
        ))}
      </div>

      {msg && <div role="alert" style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 14, background: 'rgba(224,82,82,.1)', border: '1px solid rgba(224,82,82,.3)', color: 'var(--text)', fontSize: 13 }}>{msg}</div>}
      {orders === null && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text2)' }}>Laddar…</div>}
      {orders && shown.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 14 }}>
          {tab === 'pack' ? 'Inget att packa just nu.' : tab === 'pickup' ? 'Inga packade ordrar väntar på hämtning.' : 'Inget skickat de senaste 30 dagarna.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shown.map(o => {
          const lines = o.ship_lines.filter(l => (l.delivery ?? 'ship') === 'ship')
          const carLines = o.ship_lines.filter(l => l.delivery === 'car')
          return (
            <article key={o.id} id={`ship-${o.id}`} style={{ background: 'var(--bg3)', border: `1px solid ${focus === o.id ? 'var(--gold)' : 'rgba(79,193,217,.3)'}`, borderRadius: 12, padding: '14px 18px', boxShadow: focus === o.id ? '0 0 0 3px rgba(232,184,75,.18)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {o.customers ? <Link href={`/crm/customers/${o.customers.id}`} style={{ color: 'var(--text)' }}>{o.customers.company}</Link> : o.delivery_name || 'Utan kund'}
                </span>
                <Link href={orderHref(o.id)} style={{ fontSize: 14, color: 'var(--text)', fontFamily: 'var(--font-mono)', textDecoration: 'underline', textUnderlineOffset: 3 }}>#{o.order_nr}</Link>
                {o.status === 'pending' && <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: 'rgba(232,184,75,.14)', color: 'var(--gold)' }}>Ej bekräftad</span>}
                <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text2)' }}>Order lagd {formatDateTime(o.created_at)}{o.assigned_to ? ` · ${o.assigned_to}` : ''}</span>
              </div>

              <Link href={orderHref(o.id)} title="Öppna ordern" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(79,193,217,.6)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <ul style={{ flex: 1, margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lines.map((l, i) => {
                    const src = (l as any).product_id ? pics[(l as any).product_id] : null
                    return (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, color: 'var(--text)' }}>
                        <span style={{ width: 52, height: 52, borderRadius: 8, background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 3, boxSizing: 'border-box' }}>
                          {src ? <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Package size={20} color="#999" />}
                        </span>
                        <span><strong>{l.qty} st</strong> {l.product_name}</span>
                      </li>
                    )
                  })}
                </ul>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Öppna ordern <ChevronRight size={16} /></span>
              </Link>
              {carLines.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--green)' }}>Redan lämnat från bilen: {carLines.map(l => `${l.qty} × ${l.product_name}`).join(', ')}</div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 12, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 9, fontSize: 13 }}>
                <Step done={!!o.packed_at} title="Packad" text={o.packed_at ? `${formatDateTime(o.packed_at)}${o.packed_by ? ` av ${o.packed_by}` : ''}` : 'Inte packad ännu'} />
                <Step done={!!o.shipped_at} title="Hämtad av transportör" text={o.shipped_at ? `${formatDateTime(o.shipped_at)}${o.carrier ? ` · ${o.carrier}` : ''}${o.transport_order_id ? ` · ${o.transport_order_id}` : ''}` : o.pickup_at ? `Ska hämtas ${formatDateTime(o.pickup_at)}` : 'Inte hämtad ännu'} />
              </div>

              {tab !== 'sent' && (
                <div style={{ marginTop: 12 }}>
                  <PackingForm order={o} onSaved={patch => setOrders(os => (os ?? []).map(x => x.id === o.id ? { ...x, ...patch } as ShipOrder : x))} />
                </div>
              )}
              {tab === 'pickup' && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>När transportören har hämtat paketet: välj transportör, fyll i spårningsnummer och tryck på knappen.</div>
                  {canShip(o)
                    ? <ShipOrderForm order={o} onShipped={() => load()} />
                    : <span style={{ fontSize: 13, color: 'var(--text2)' }}>{o.assigned_to || 'Säljaren'} eller admin markerar den som skickad.</span>}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function Step({ done, title, text }: { done: boolean; title: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
        background: done ? 'var(--green)' : 'transparent', border: `2px solid ${done ? 'var(--green)' : 'rgba(255,255,255,.25)'}` }}>
        {done && <Check size={12} color="#0F1115" strokeWidth={3} />}
      </span>
      <div>
        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        <div style={{ color: done ? 'var(--text)' : 'var(--text2)' }}>{text}</div>
      </div>
    </div>
  )
}

function shipQty(o: { ship_lines?: ShipLine[] }) {
  return (o.ship_lines ?? []).filter(l => (l.delivery ?? 'ship') === 'ship').reduce((n, l) => n + (l.qty || 0), 0)
}
function tabOf(o: { status: string; shipped_at: string | null }): Tab {
  if (o.status === 'shipped' || o.status === 'delivered' || o.shipped_at) return 'sent'
  if (o.status === 'packed') return 'pickup'
  return 'pack'
}
