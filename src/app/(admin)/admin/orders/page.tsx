'use client'
import { qtyToShip, SHIP_LINES_SELECT } from '@/lib/shipping'
import OrderDrawer from '@/components/orders/OrderDrawer'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import IncVat from '@/components/orders/IncVat'
import { withVat } from '@/lib/pricing'
import { invoiceInVismaInBackground } from '@/lib/visma'
import { fmt, formatDateTime } from '@/lib/utils'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { useTeam, teamOptions } from '@/hooks/useTeam'


const STATUS_LABELS: Record<string, string> = {
  draft: 'Varukorg', quote: 'Offert', pending: 'Väntande', confirmed: 'Bekräftad',
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
  quote:     { bg: 'rgba(155,110,232,.12)', color: '#9B6EE8' },
}

export default function AdminOrders() {
  const SALESPEOPLE = useTeam()
  const [orders, setOrders]           = useState<any[]>([])
  const [filtered, setFiltered]       = useState<any[]>([])
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sellerFilter, setSellerFilter] = useState('')
  const [fromDate, setFromDate]       = useState('')
  const [toDate, setToDate]           = useState('')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [toast, setToast]             = useState('')

  function loadOrders() {
    const sb = createClient()
    return sb.from('orders')
      .select(`*,customers(company,contact_name,email),${SHIP_LINES_SELECT}`)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = data || []
        setOrders(list)
        // Keep an open detail panel in step with changes made on other devices.
        setSelectedOrder((prev: any) => prev ? (list.find(o => o.id === prev.id) ?? prev) : prev)
        return list
      })
  }

  // ?status=… (e.g. from the overview's boxes) opens the list filtered.
  useEffect(() => {
    const st = new URLSearchParams(window.location.search).get('status')
    if (st) setStatusFilter(st)
  }, [])

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
    else if (statusFilter === 'ship') list = list.filter(o => qtyToShip(o) > 0)
    else if (statusFilter === 'today') list = list.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString())
    else if (statusFilter) list = list.filter(o => o.status === statusFilter)
    if (sellerFilter) list = list.filter(o => o.assigned_to === sellerFilter || o.created_by === sellerFilter)
    if (fromDate) list = list.filter(o => o.created_at.slice(0, 10) >= fromDate)
    if (toDate) list = list.filter(o => o.created_at.slice(0, 10) <= toDate)
    setFiltered(list)
  }, [search, statusFilter, sellerFilter, fromDate, toDate, orders])

  function openOrder(order: any) { setSelectedOrder(order) }





  async function updateStatus(id: string, status: string) {
    // An order from the CRM needs a customer before it can be placed or delivered.
    const o = orders.find(x => x.id === id)
    if (o && !o.customer_id && o.created_by && !['draft', 'quote', 'cancelled'].includes(status)) {
      showToast('Ordern saknar kund – koppla en kund först (öppna ordern)')
      return
    }
    const sb = createClient()
    await sb.from('orders').update({ status }).eq('id', id)
    // Placed orders get their Visma invoice (when automatic invoicing is on).
    if (['confirmed', 'packed', 'shipped', 'delivered'].includes(status)) invoiceInVismaInBackground(id)
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
      'Order #,Kund,Datum,Belopp exkl. moms,Belopp inkl. moms,Status',
      ...filtered.map(o =>
        `${o.order_nr},${o.customers?.company || o.delivery_name || ''},${formatDateTime(o.created_at)},${o.subtotal},${o.total ?? withVat(o.subtotal)},${STATUS_LABELS[o.status] || o.status}`
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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={exportCSV} style={{ padding: '9px 18px', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)' }}>
            ↓ Exportera CSV
          </button>
          <Link href="/admin/crm/orders" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--gold)', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            + Ny order
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '20px 40px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Sök order, kund…"
          style={{ flex: 1, maxWidth: 320, padding: '9px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: '14px', outline: 'none' }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: '14px', outline: 'none' }}
        >
          <option value="">Alla statusar</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          <option value="unassigned">Saknar säljare</option>
          <option value="ship">Att skicka</option>
          <option value="today">Lagda idag</option>
        </select>
        <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)} aria-label="Säljare"
          style={{ padding: '8px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: '14px', outline: 'none' }}>
          <option value="">Alla säljare</option>
          {teamOptions(SALESPEOPLE, sellerFilter).map(sp => <option key={sp} value={sp}>{sp}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)' }}>Från
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: '7px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 14, colorScheme: 'dark' }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)' }}>Till
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: '7px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 14, colorScheme: 'dark' }} />
        </label>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text3)' }}>{filtered.length} ordrar</span>
      </div>

      {/* Table */}
      <div style={{ padding: '0 40px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'Datum', 'Kund', 'Säljare', 'Prislista', 'Belopp', 'Status', 'Ändra status'].map(h => (
                <th key={h} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '14px 0', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const sc = STATUS_CSS[o.status] || STATUS_CSS.draft
              return (
                <tr key={o.id} onClick={() => openOrder(o)} style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--gold)', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,.04)' }}>#{o.order_nr}</td>
                  <td style={{ padding: '16px 0', fontSize: '14px', color: 'var(--text)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{formatDateTime(o.created_at)}</td>
                  <td style={{ padding: '16px 0', fontSize: '14px', color: 'var(--text)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{o.customers?.company || o.delivery_name || '—'}</td>
                  <td style={{ padding: '16px 0', fontSize: '14px', color: o.assigned_to ? 'var(--text2)' : 'var(--red)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    {o.assigned_to || 'Saknas'}
                    {o.created_by && o.created_by !== o.assigned_to && <div style={{ fontSize: 11, color: 'var(--text2)' }}>såld av {o.created_by}</div>}
                  </td>
                  <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: 'rgba(232,184,75,.15)', color: 'var(--gold)' }}>{o.price_list_id || 'Standard'}</span>
                  </td>
                  <td style={{ padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--gold)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{fmt(o.subtotal)} kr <span style={{ fontSize: 11, color: 'var(--text2)' }}>exkl.</span><IncVat net={o.subtotal} total={o.total} /></td>
                  <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: sc.bg, color: sc.color }}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                    {qtyToShip(o) > 0 && <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: 'var(--blue)', whiteSpace: 'nowrap' }}>{qtyToShip(o)} st att skicka</div>}
                  </td>
                  <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <select
                      value={o.status}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { e.stopPropagation(); updateStatus(o.id, e.target.value) }}
                      style={{ fontSize: '12px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
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

      {/* One order: the same detailed view as everywhere else */}
      {selectedOrder && (
        <OrderDrawer orderId={selectedOrder.id} onClose={() => setSelectedOrder(null)}
          onChanged={o => setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ...o } : x))} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '12px 20px', fontSize: 14, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </div>
  )
}
