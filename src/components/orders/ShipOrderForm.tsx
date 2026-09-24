'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CARRIERS, trackingUrl } from '@/lib/shipping'
import { Truck, ExternalLink } from 'lucide-react'

export interface ShippableOrder {
  id: string
  status: string
  carrier?: string | null
  transport_order_id?: string | null
}

// Carrier + tracking number, and the button that marks the order as shipped.
// Used in the admin order panel and the CRM order history.
export default function ShipOrderForm({ order, onShipped, readOnly = false }: {
  order: ShippableOrder
  readOnly?: boolean
  onShipped: (patch: { status: 'shipped'; carrier: string | null; transport_order_id: string | null }) => void
}) {
  const [carrier, setCarrier]   = useState(order.carrier || 'PostNord')
  const [tracking, setTracking] = useState(order.transport_order_id || '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const shipped = order.status === 'shipped'
  if (readOnly || order.status === 'cancelled' || order.status === 'delivered') {
    const url = trackingUrl(order.carrier, order.transport_order_id)
    if (!order.transport_order_id) return null
    return (
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>
        {order.carrier || 'Frakt'} · {order.transport_order_id}
        {url && <a href={url} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: 'var(--blue)' }}>Spåra</a>}
      </div>
    )
  }

  async function ship() {
    setSaving(true); setError('')
    const { data: ok, error: err } = await createClient().rpc('ship_order', { p_order_id: order.id, p_carrier: carrier, p_tracking: tracking })
    setSaving(false)
    if (err || !ok) { setError('Kunde inte spara. Har migration 0007 körts i Supabase?'); return }
    onShipped({ status: 'shipped', carrier: carrier || null, transport_order_id: tracking.trim() || null })
  }

  const field = { padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', minWidth: 0 } as const
  const url = shipped ? trackingUrl(order.carrier, order.transport_order_id) : null

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={carrier} onChange={e => setCarrier(e.target.value)} style={{ ...field, flex: '0 0 auto', cursor: 'pointer' }}>
          {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Spårningsnummer"
          style={{ ...field, flex: '1 1 140px' }} />
        <button onClick={ship} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', opacity: saving ? .6 : 1,
            ...(shipped
              ? { background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }
              : { background: 'var(--gold)', border: 'none', color: '#111' }) }}>
          <Truck size={13} /> {saving ? 'Sparar…' : shipped ? 'Uppdatera' : 'Markera som skickad'}
        </button>
      </div>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, color: 'var(--blue)' }}>
          Öppna spårning hos {order.carrier} <ExternalLink size={11} />
        </a>
      )}
      {error && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)' }}>{error}</div>}
    </div>
  )
}
