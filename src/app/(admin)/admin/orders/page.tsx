'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDateTime } from '@/lib/utils'
import { X } from 'lucide-react'
import ShipOrderForm from '@/components/orders/ShipOrderForm'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { SALESPEOPLE } from '@/lib/team'


const STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast', pending: 'Väntande', confirmed: 'Bekräftad',
  packed: 'Packad', shipped: 'Skickad', delivered: 'Levererad', cancelled: 'Avbruten',
}
const STATUS_CSS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: 'rgba(212,138,58,.12)',  color: '#D48A3A' },
  confirmed: { bg: 'rgba(232,184,75,.12)',  color: '#E8B84B' },
  packed:    { bg: 'rgba(232,184,75,.12)',  color: '#E8B84B' },
  shipped:   { bg: 'rgba(66,153,225,.12)',  color: '#4299E1' },
  delivered: { bg: 'rgba(76,175,125,.12)',  color: '#4CAF7D' },
  cancelled: { bg: 'rgba(224,82,82,.12)',   color: '#E05252' },
  draft:     { bg: 'rgba(155,163,176,.08)', color: '#9BA0AB' },
}

export default function AdminOrders() {
  const [orders, setOrders]           = useState<any[]>([])
  const [filtered, setFiltered]       = useState<any[]>([])
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [orderItems, setOrderItems]   = useState<any[]>([])
  const [toast, setToast]             = useState('')

  function loadOrders() {
    const sb = createClient()
    return sb.from('orders')
      .select('*,customers(company,contact_name,email)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = data || []
        setOrders(list)
        // Keep an open detail panel in step with changes made on other devices.
        setSelectedOrder((prev: any) => prev ? (list.find(o => o.id === prev.id) ?? prev) : prev)
        return list
      })
  }

  useEffect(() => {
    loadOrders().then(list => {
      const wantedId = new URLSearchParams(window.location.search).get('order')
      const wanted = wantedId && list.find(o => o.id === wantedId)
      if (wanted) openOrder(wanted)
    })
  }, [])

  useLiveRefresh(['orders'], loadOrders)

  useEffect(() => {
    let list = orders
    if (search) list = list.filter(o =>
      (o.customers?.company || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.delivery_name || '').toLowerCase().includes(search.toLowerCase()) ||
      String(o.order_nr).includes(search)
    )
    if (statusFilter === 'unassigned') list = list.filter(o => !o.assigned_to)
    else if (statusFilter) list = list.filter(o => o.status === statusFilter)
    setFiltered(list)
  }, [search, statusFilter, orders])

  async function openOrder(order: any) {
    setSelectedOrder(order)
    const sb = createClient()
    const { data } = await sb.from('order_items').select('*').eq('order_id', order.id)
    setOrderItems(data || [])
  }

  async function updateAssignee(id: string, assignee: string) {
    const sb = createClient()
    const assigned_to = assignee || null
    await sb.from('orders').update({ assigned_to }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, assigned_to } : o))
    setSelectedOrder((prev: any) => prev?.id === id ? { ...prev, assigned_to } : prev)
    showToast(assigned_to ? `Säljare: ${assigned_to}` : 'Säljare borttagen')
  }

  async function updateStatus(id: string, status: string) {
    const sb = createClient()
    await sb.from('orders').update({ status }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    if (selectedOrder?.id === id) setSelectedOrder((prev: any) => ({ ...prev, status }))
    showToast(`Status uppdaterad → ${STATUS_LABELS[status]}`)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function exportCSV() {
    const csv = [
      'Order #,Kund,Datum,Belopp,Status',
      ...filtered.map(o =>
        `${o.order_nr},${o.customers?.company || o.delivery_name || ''},${formatDateTime(o.created_at)},${o.subtotal},${STATUS_LABELS[o.status] || o.status}`
      ),
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'orders.csv'
    a.click()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: 12, display: 'block' }}>002 / Hantera</span>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '40px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.1 }}>Ordrar</div>
        </div>
        <button onClick={exportCSV} style={{ padding: '9px 18px', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)' }}>
          ↓ Exportera CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ padding: '20px 40px', display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Sök order, kund…"
          style={{ flex: 1, maxWidth: 320, padding: '9px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: '13px', outline: 'none' }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: '13px', outline: 'none' }}
        >
          <option value="">Alla statusar</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          <option value="unassigned">Saknar säljare</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text3)' }}>{filtered.length} ordrar</span>
      </div>

      {/* Table */}
      <div style={{ padding: '0 40px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'Datum', 'Kund', 'Säljare', 'Prislista', 'Belopp', 'Status', 'Ändra status'].map(h => (
                <th key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '14px 0', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const sc = STATUS_CSS[o.status] || STATUS_CSS.draft
              return (
                <tr key={o.id} onClick={() => openOrder(o)} style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--gold)', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,.04)' }}>#{o.order_nr}</td>
                  <td style={{ padding: '16px 0', fontSize: '13px', color: 'var(--text)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{formatDateTime(o.created_at)}</td>
                  <td style={{ padding: '16px 0', fontSize: '13px', color: 'var(--text)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{o.customers?.company || o.delivery_name || '—'}</td>
                  <td style={{ padding: '16px 0', fontSize: '13px', color: o.assigned_to ? 'var(--text2)' : 'var(--red)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{o.assigned_to || 'Saknas'}</td>
                  <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: 'rgba(232,184,75,.15)', color: 'var(--gold)' }}>{o.price_list_id || 'Standard'}</span>
                  </td>
                  <td style={{ padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--gold)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{fmt(o.subtotal)} kr</td>
                  <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: sc.bg, color: sc.color }}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <select
                      value={o.status}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { e.stopPropagation(); updateStatus(o.id, e.target.value) }}
                      style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
                    >
                      {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Order Detail Panel */}
      <div style={{ position: 'fixed', top: '58px', right: 0, bottom: 0, width: 480, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', zIndex: 80, transform: selectedOrder ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .28s cubic-bezier(.22,.68,0,1.1)', display: 'flex', flexDirection: 'column' }}>
        {selectedOrder && (
          <>
            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--gold)', fontWeight: 500 }}>Order #{selectedOrder.order_nr}</div>
              <button onClick={() => setSelectedOrder(null)} style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              {/* Order info */}
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.04)', display: 'block' }}>Orderinfo</span>
                {[
                  ['Status', (
                    <span key="s" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: (STATUS_CSS[selectedOrder.status] || STATUS_CSS.draft).bg, color: (STATUS_CSS[selectedOrder.status] || STATUS_CSS.draft).color }}>
                      {STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                    </span>
                  )],
                  ['Datum',     formatDateTime(selectedOrder.created_at)],
                  ['Prislista', selectedOrder.price_list_id || 'Standard'],
                  ['Kund',      selectedOrder.customers?.company || selectedOrder.delivery_name || '—'],
                  ['E-post',    selectedOrder.customers?.email || '—'],
                  ['Säljare', (
                    <select key="a" value={selectedOrder.assigned_to || ''} onChange={e => updateAssignee(selectedOrder.id, e.target.value)}
                      style={{ fontSize: 12, padding: '4px 8px', border: `1px solid ${selectedOrder.assigned_to ? 'var(--border)' : 'var(--red)'}`, borderRadius: 4, background: 'var(--bg3)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                      <option value="">— Ingen —</option>
                      {SALESPEOPLE.map(sp => <option key={sp} value={sp}>{sp}</option>)}
                    </select>
                  )],
                ].map(([k, v]) => (
                  <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13, gap: 12 }}>
                    <span style={{ color: 'var(--text2)', flexShrink: 0 }}>{k}</span>
                    <strong style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right' }}>{v as any}</strong>
                  </div>
                ))}
              </div>

              {/* Delivery */}
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.04)', display: 'block' }}>Leverans</span>
                {[
                  ['Namn',   selectedOrder.delivery_name || '—'],
                  ['Adress', selectedOrder.delivery_address || '—'],
                  ['Stad',   `${selectedOrder.delivery_city || '—'} ${selectedOrder.delivery_zip || ''}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13, gap: 12 }}>
                    <span style={{ color: 'var(--text2)', flexShrink: 0 }}>{k}</span>
                    <strong style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right' }}>{v}</strong>
                  </div>
                ))}
              </div>

              {/* Products */}
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.04)', display: 'block' }}>Produkter</span>
                {orderItems.length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)' }}>Inga rader</p>}
                {orderItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13 }}>
                    <div>
                      <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>{item.product_name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>× {item.qty} · {item.product_sku}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gold)', fontWeight: 500, whiteSpace: 'nowrap', marginLeft: 12 }}>{fmt(item.total_price)} kr</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>
                  <span>TOTALT</span>
                  <strong style={{ color: 'var(--gold)', fontSize: 18, fontWeight: 400 }}>{fmt(selectedOrder.subtotal)} kr</strong>
                </div>
              </div>

              {/* Status update */}
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, display: 'block' }}>Uppdatera status</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => {
                    const sc = STATUS_CSS[v] || STATUS_CSS.draft
                    const active = selectedOrder.status === v
                    return (
                      <button key={v} onClick={() => updateStatus(selectedOrder.id, v)}
                        style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${active ? sc.color : 'var(--border)'}`, background: active ? sc.bg : 'var(--bg3)', color: active ? sc.color : 'var(--text3)', fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer', transition: 'all .15s' }}>
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Shipping */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, display: 'block' }}>Frakt & spårning</span>
                <ShipOrderForm key={selectedOrder.id} order={selectedOrder} onShipped={patch => {
                  setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, ...patch } : o))
                  setSelectedOrder((prev: any) => ({ ...prev, ...patch }))
                  showToast(`Order #${selectedOrder.order_nr} markerad som skickad`)
                }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '12px 20px', fontSize: 13, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </div>
  )
}
