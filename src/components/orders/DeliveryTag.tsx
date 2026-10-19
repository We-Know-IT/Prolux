'use client'
// How one order line reaches the customer, with the date: handed over from
// the car (when the order was placed), shipped from the warehouse, or still
// to be sent.
import { Car, Check, Truck } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { awaitingShipment } from '@/lib/shipping'

export function deliveryOf(line: { delivery?: string | null }, order: { status: string; created_at: string; shipped_at?: string | null }) {
  if (line.delivery === 'car') return { kind: 'car' as const, label: 'Levererad från bilen', date: order.created_at }
  if (order.shipped_at || order.status === 'shipped' || order.status === 'delivered') return { kind: 'sent' as const, label: 'Skickad från lagret', date: order.shipped_at ?? null }
  if (awaitingShipment(order.status)) return { kind: 'waiting' as const, label: 'Att skicka från lagret', date: null }
  return { kind: 'none' as const, label: 'Frakt', date: null }
}

export default function DeliveryTag({ line, order }: { line: { delivery?: string | null }; order: { status: string; created_at: string; shipped_at?: string | null } }) {
  const d = deliveryOf(line, order)
  const color = d.kind === 'waiting' ? 'var(--blue)' : d.kind === 'none' ? 'var(--text2)' : 'var(--green)'
  const Icon = d.kind === 'car' ? Car : d.kind === 'sent' ? Check : Truck
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color, marginTop: 2 }}>
      <Icon size={12} /> {d.label}{d.date ? ` ${formatDate(d.date)}` : ''}
    </span>
  )
}
