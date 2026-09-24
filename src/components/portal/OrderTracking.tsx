import { trackingUrl } from '@/lib/shipping'
import { Truck, ExternalLink } from 'lucide-react'

// Customer-facing shipping line on www: carrier, tracking number and a link
// to the carrier's tracking page. Renders nothing until the order is shipped.
export default function OrderTracking({ order }: { order: { status?: string; carrier?: string | null; transport_order_id?: string | null } }) {
  if (!order.transport_order_id || !['shipped', 'delivered'].includes(order.status || '')) return null
  const url = trackingUrl(order.carrier, order.transport_order_id)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '10px 0 12px', padding: '9px 12px', background: 'rgba(74,143,212,.08)', borderRadius: 8, fontSize: 12, color: '#333' }}>
      <Truck size={14} color="#4A8FD4" />
      <span>{order.carrier ? `Skickad med ${order.carrier}` : 'Skickad'} · <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{order.transport_order_id}</span></span>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto', color: '#2F6FB0', fontWeight: 700, textDecoration: 'none' }}>
          Spåra paket <ExternalLink size={11} />
        </a>
      )}
    </div>
  )
}
