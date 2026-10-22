'use client'
// One order, everything about it in one place: customer and salespeople, every
// line with how and when it was delivered and by whom, packing, shipping,
// status and Visma. Used by every order list (admin, CRM, customer card,
// Leveranser), so an order always looks the same wherever it is opened.
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X, RefreshCw, ExternalLink, Check, Car, PackageCheck, Truck, ShoppingBag, CircleDot } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDateTime } from '@/lib/utils'
import { ORDER_STATUS_LABEL, type OrderStatus, type Product } from '@/types'
import { useMe } from '@/hooks/useMe'
import { useTeam, teamOptions } from '@/hooks/useTeam'
import { canConfirmOrder } from '@/lib/team'
import { trackingUrl } from '@/lib/shipping'
import { callVisma, invoiceInVismaInBackground, VISMA_STATUS } from '@/lib/visma'
import Portal from '@/components/ui/Portal'
import OrderDetails from '@/components/crm/order/OrderDetails'
import PackingForm from '@/components/orders/PackingForm'
import ShipOrderForm from '@/components/orders/ShipOrderForm'

const LIVE = ['pending', 'confirmed', 'packed', 'shipped', 'delivered']
const STATUS_ORDER: OrderStatus[] = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled']

export default function OrderDrawer({ orderId, onClose, onChanged, extra }: {
  orderId: string
  onClose: () => void
  onChanged?: (order: any) => void
  extra?: (order: any) => ReactNode     // e.g. the CRM's quote buttons (PDF, mail)
}) {
  const sb = createClient()
  const me = useMe()
  const team = useTeam()
  const base = (usePathname() || '').startsWith('/admin') ? '/admin/crm' : '/crm'
  const [o, setO] = useState<any | null>(null)
  const [items, setItems] = useState<any[] | undefined>(undefined)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<{ id: string; company: string; city: string | null }[]>([])
  const [msg, setMsg] = useState('')
  const [vismaBusy, setVismaBusy] = useState(false)

  async function load() {
    const { data } = await sb.from('orders').select('*,customers(id,company,contact_name,email,phone,city)').eq('id', orderId).maybeSingle()
    setO(data)
    const { data: its } = await sb.from('order_items').select('*').eq('order_id', orderId)
    setItems(its ?? [])
    const ids = [...new Set((its ?? []).map((i: any) => i.product_id).filter(Boolean))]
    if (ids.length) {
      const { data: ps } = await sb.from('products').select('id,name,brand,unit,sku,list_price,image_url').in('id', ids)
      setProducts((ps ?? []) as Product[])
    }
  }
  useEffect(() => { load() }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!o || o.customer_id || customers.length) return
    sb.from('customers').select('id,company,city').neq('status', 'inactive').order('company').then(({ data }) => setCustomers(data ?? []))
  }, [o]) // eslint-disable-line react-hooks/exhaustive-deps

  function patch(p: any) {
    setO((prev: any) => { const next = { ...prev, ...p }; onChanged?.(next); return next })
  }
  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3500) }

  async function setStatus(status: OrderStatus) {
    if (!o || o.status === status) return
    if (!o.customer_id && o.created_by && LIVE.includes(status)) { flash('Ordern saknar kund – koppla en kund först.'); return }
    const { data, error } = await sb.from('orders').update({ status }).eq('id', o.id).select('*,customers(id,company,contact_name,email,phone,city)').single()
    if (error) { flash(`Kunde inte ändra status: ${error.message}`); return }
    if (['confirmed', 'packed', 'shipped', 'delivered'].includes(status)) invoiceInVismaInBackground(o.id)
    patch(data); flash(`Status: ${ORDER_STATUS_LABEL[status]}`)
  }
  async function setAssignee(name: string) {
    const assigned_to = name || null
    await sb.from('orders').update({ assigned_to }).eq('id', o.id)
    patch({ assigned_to })
  }
  async function linkCustomer(id: string) {
    const c = customers.find(x => x.id === id)
    if (!c) return
    const { error } = await sb.from('orders').update({ customer_id: c.id, delivery_name: c.company, delivery_city: c.city }).eq('id', o.id)
    if (error) { flash(`Kunde inte koppla kunden: ${error.message}`); return }
    patch({ customer_id: c.id, delivery_name: c.company, delivery_city: c.city, customers: { id: c.id, company: c.company, city: c.city } })
    flash(`${c.company} kopplad till ordern`)
  }
  async function sendToVisma() {
    setVismaBusy(true)
    try {
      const r = await callVisma<{ invoice_number?: number; already?: boolean }>('sync-order', { order_id: o.id })
      flash(r.already ? 'Ordern finns redan i Visma' : r.invoice_number ? `Faktura ${r.invoice_number} skapad i Visma` : 'Fakturautkast skapat i Visma')
    } catch (e) { flash((e as Error).message) }
    setVismaBusy(false)
    load()
  }

  const isAdmin = me.role === 'admin'
  const mayManage = !!o && (isAdmin || canConfirmOrder(o, me.name, false))
  const open = o && (o.status === 'draft' || o.status === 'quote')
  const live = o && LIVE.includes(o.status)
  const shipLines = (items ?? []).filter(i => i.delivery !== 'car')
  const carLines = (items ?? []).filter(i => i.delivery === 'car')
  const section: React.CSSProperties = { marginTop: 18, padding: '14px 16px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--border)' }
  const h: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }

  return (
    <Portal>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 950 }}>
        <aside role="dialog" aria-modal="true" aria-label={o ? `Order #${o.order_nr}` : 'Order'} onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(760px, 100vw)', background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(0,0,0,.4)' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)' }}>{o?.status === 'quote' ? 'Offert' : o?.status === 'draft' ? 'Varukorg' : 'Order'} {o ? `#${o.order_nr}` : ''}</span>
            {o && <span style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: 'var(--bg4)', color: 'var(--text)' }}>{ORDER_STATUS_LABEL[o.status as OrderStatus] || o.status}</span>}
            {o && <span style={{ fontSize: 13, color: 'var(--text2)' }}>{formatDateTime(o.created_at)}</span>}
            <button onClick={onClose} aria-label="Stäng" style={{ marginLeft: 'auto', width: 36, height: 36, borderRadius: 9, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 22px 32px' }}>
            {!o && <p style={{ color: 'var(--text2)', padding: '24px 0' }}>{items === undefined ? 'Laddar…' : 'Ordern hittades inte.'}</p>}
            {o && (<>
              {msg && <div role="status" style={{ margin: '12px 0 0', padding: '10px 14px', borderRadius: 9, background: 'rgba(232,184,75,.1)', border: '1px solid rgba(232,184,75,.35)', fontSize: 14, color: 'var(--text)' }}>{msg}</div>}

              {/* Customer missing on a CRM order: link one */}
              {!o.customer_id && (
                <div style={{ ...section, borderColor: 'rgba(224,82,82,.4)' }}>
                  <div style={h}>Ordern saknar kund</div>
                  <select defaultValue="" onChange={e => linkCustomer(e.target.value)} aria-label="Koppla kund"
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
                    <option value="">Koppla kund…</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.company}{c.city ? ` · ${c.city}` : ''}</option>)}
                  </select>
                </div>
              )}

              <OrderDetails o={o} items={items} products={products} />

              {extra?.(o)}

              {/* The order's history, in order */}
              {(live || o.status === 'cancelled') && (
                <div style={section}>
                  <div style={h}>Historik</div>
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {o.quoted_at && <Step icon={CircleDot} done title="Offert" text={formatDateTime(o.quoted_at)} />}
                    <Step icon={ShoppingBag} done title="Order lagd" text={`${formatDateTime(o.created_at)} · ${o.created_by || 'Webbshoppen'}${o.assigned_to && o.assigned_to !== o.created_by ? ` · räknas på ${o.assigned_to}` : ''}`} />
                    {carLines.length > 0 && <Step icon={Car} done title="Levererat från bilen" text={`${carLines.map(l => `${l.qty} × ${l.product_name}`).join(', ')} · ${formatDateTime(o.created_at)} · ${o.created_by || o.assigned_to || '—'}`} />}
                    {shipLines.length > 0 && <>
                      <Step icon={PackageCheck} done={!!o.packed_at} title="Packad på lagret" text={o.packed_at ? `${formatDateTime(o.packed_at)} · ${o.packed_by || '—'}` : 'Inte packad ännu'} />
                      {o.pickup_at && !o.shipped_at && <Step icon={Truck} done={false} title="Hämtas av transportör" text={formatDateTime(o.pickup_at)} />}
                      <Step icon={Truck} done={!!o.shipped_at} title="Skickad från lagret"
                        text={o.shipped_at ? `${formatDateTime(o.shipped_at)}${o.shipped_by ? ` · ${o.shipped_by}` : ''}${o.carrier ? ` · ${o.carrier}` : ''}${o.transport_order_id ? ` · ${o.transport_order_id}` : ''}` : 'Inte skickad ännu'}
                        link={trackingUrl(o.carrier, o.transport_order_id)} />
                    </>}
                    {(o.status === 'delivered' || o.delivered_at) && <Step icon={Check} done title="Levererad" text={`${o.delivered_at ? formatDateTime(o.delivered_at) : ''}${o.delivered_by ? ` · ${o.delivered_by}` : ''}` || 'Levererad'} />}
                    {o.status === 'cancelled' && <Step icon={X} done title="Avbruten" text="" />}
                  </ol>
                </div>
              )}

              {live && shipLines.length > 0 && (
                <div style={{ ...section, borderColor: 'rgba(79,193,217,.4)' }}>
                  <div style={h}><PackageCheck size={16} color="#4FC1D9" /> {['shipped', 'delivered'].includes(o.status) ? 'Packning & leverans från lagret' : 'Packning på lagret'}</div>
                  <PackingForm order={o} onSaved={p => patch(p)} />
                </div>
              )}
              {live && shipLines.length > 0 && (
                <div style={section}>
                  <div style={h}><Truck size={16} color="var(--text2)" /> Frakt & spårning</div>
                  {mayManage
                    ? <ShipOrderForm order={o} onShipped={() => { load(); flash(`Order #${o.order_nr} markerad som skickad`) }} />
                    : <ShipOrderForm order={o} readOnly onShipped={() => {}} />}
                  {!mayManage && !o.transport_order_id && <span style={{ fontSize: 13, color: 'var(--text2)' }}>{o.assigned_to || 'Säljaren'} eller admin markerar ordern som skickad.</span>}
                </div>
              )}

              {/* Salesperson, status and Visma */}
              {!open && (
                <div style={section}>
                  <div style={h}>Hantera</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                    <span style={{ fontSize: 14, color: 'var(--text2)', minWidth: 90 }}>Räknas på</span>
                    <select value={o.assigned_to || ''} onChange={e => setAssignee(e.target.value)} disabled={!mayManage}
                      style={{ padding: '8px 10px', background: 'var(--bg4)', border: `1px solid ${o.assigned_to ? 'var(--border)' : 'var(--red)'}`, borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
                      <option value="">— Ingen —</option>
                      {teamOptions(team, o.assigned_to || '').map(sp => <option key={sp} value={sp}>{sp}</option>)}
                    </select>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
                      {STATUS_ORDER.map(st => (
                        <button key={st} onClick={() => setStatus(st)} aria-pressed={o.status === st}
                          style={{ padding: '9px 6px', borderRadius: 8, fontSize: 13, fontWeight: o.status === st ? 700 : 500, cursor: 'pointer',
                            background: o.status === st ? 'rgba(232,184,75,.14)' : 'var(--bg4)', border: `1px solid ${o.status === st ? 'var(--gold)' : 'var(--border)'}`, color: 'var(--text)' }}>
                          {ORDER_STATUS_LABEL[st]}
                        </button>
                      ))}
                    </div>
                  )}
                  {live && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, color: 'var(--text2)', minWidth: 90 }}>Visma</span>
                      {o.visma_status && VISMA_STATUS[o.visma_status] && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 5, background: VISMA_STATUS[o.visma_status].bg, color: VISMA_STATUS[o.visma_status].color }}>
                          {VISMA_STATUS[o.visma_status].label}{o.visma_invoice_number ? ` · nr ${o.visma_invoice_number}` : ''}
                        </span>
                      )}
                      {mayManage && (!o.visma_status || o.visma_status === 'error') && (
                        <button onClick={sendToVisma} disabled={vismaBusy} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: vismaBusy ? 'wait' : 'pointer' }}>
                          {vismaBusy ? 'Skickar…' : o.visma_status === 'error' ? 'Försök igen' : 'Skapa faktura i Visma'}
                        </button>
                      )}
                      {o.visma_status === 'error' && <span style={{ flexBasis: '100%', fontSize: 12, color: 'var(--red)' }}>{o.visma_error}</span>}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
                {open ? (
                  <Link href={`${base}/orders?edit=${o.id}`} style={{ padding: '10px 16px', borderRadius: 9, background: 'var(--gold)', color: '#111', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                    {o.status === 'quote' ? 'Öppna och redigera offerten' : 'Fortsätt med varukorgen'}
                  </Link>
                ) : (
                  <Link href={`${base}/orders?reorder=${o.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 9, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                    <RefreshCw size={14} /> Lägg ordern igen
                  </Link>
                )}
                {o.customers?.id && (
                  <Link href={`/crm/customers/${o.customers.id}`} style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, textDecoration: 'none' }}>Kundkort</Link>
                )}
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text2)' }}>Summa {fmt(o.total || 0)} kr inkl. moms</div>
            </>)}
          </div>
        </aside>
      </div>
    </Portal>
  )
}

function Step({ icon: Icon, done, title, text, link }: { icon: typeof Check; done: boolean; title: string; text: string; link?: string | null }) {
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: done ? 'rgba(76,175,125,.18)' : 'transparent', border: `2px solid ${done ? 'var(--green)' : 'rgba(255,255,255,.25)'}` }}>
        <Icon size={13} color={done ? 'var(--green)' : 'var(--text2)'} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {text && <div style={{ fontSize: 13, color: done ? 'var(--text)' : 'var(--text2)' }}>{text}
          {link && <a href={link} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>Spåra <ExternalLink size={11} /></a>}
        </div>}
      </div>
    </li>
  )
}
