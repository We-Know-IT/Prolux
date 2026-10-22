'use client'
// How one order line reaches the customer, with the date and who did it:
// handed over from the car (when the order was placed, by the seller), sent
// from the warehouse, or still to be sent.
import { Car, Check, Truck } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { awaitingShipment } from '@/lib/shipping'

interface DeliveryOrder {
  status: string; created_at: string; created_by?: string | null; assigned_to?: string | null
  shipped_at?: string | null; shipped_by?: string | null; delivered_at?: string | null; delivered_by?: string | null
  packed_by?: string | null
}

export function deliveryOf(line: { delivery?: string | null }, order: DeliveryOrder) {
  if (line.delivery === 'car') return { kind: 'car' as const, label: 'Levererad från bilen', date: order.created_at, by: order.created_by || order.assigned_to || null }
  if (order.shipped_at || order.status === 'shipped' || order.status === 'delivered') {
    const who = [order.packed_by && `packad av ${order.packed_by}`, order.shipped_by && `skickad av ${order.shipped_by}`].filter(Boolean).join(', ')
    return { kind: 'sent' as const, label: 'Skickad från lagret', date: order.shipped_at ?? order.delivered_at ?? null, by: who || 'vem som packade/skickade saknas' }
  }
  if (awaitingShipment(order.status)) return { kind: 'waiting' as const, label: 'Att skicka från lagret', date: null, by: null }
  return { kind: 'none' as const, label: 'Frakt', date: null, by: null }
}

export default function DeliveryTag({ line, order }: { line: { delivery?: string | null }; order: DeliveryOrder }) {
  const d = deliveryOf(line, order)
  const color = d.kind === 'waiting' ? 'var(--blue)' : d.kind === 'none' ? 'var(--text2)' : 'var(--green)'
  const Icon = d.kind === 'car' ? Car : d.kind === 'sent' ? Check : Truck
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color, marginTop: 2 }}>
      <Icon size={12} /> {d.label}{d.date ? ` ${formatDate(d.date)}` : ''}{d.by ? ` · ${d.by}` : ''}
    </span>
  )
}
