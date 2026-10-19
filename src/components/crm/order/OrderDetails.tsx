'use client'
// What an order holds, shown when a row in the order list is opened: who it
// belongs to, every line with its price and how it is delivered, and the sums.
import Link from 'next/link'
import { PenLine } from 'lucide-react'
import type { OrderItem, Product } from '@/types'
import { fmt, formatDateTime } from '@/lib/utils'
import DeliveryTag from '@/components/orders/DeliveryTag'
import { Thumb } from '@/components/crm/order/parts'

export default function OrderDetails({ o, items, products }: { o: any; items?: OrderItem[]; products: Product[] }) {
  const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }
  const value: React.CSSProperties = { fontSize: 13, color: 'var(--text)', fontWeight: 600 }

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, padding: '10px 0 14px' }}>
        <div>
          <div style={label}>Kund</div>
          {o.customers?.id
            ? <Link href={`/crm/customers/${o.customers.id}`} onClick={e => e.stopPropagation()} style={{ ...value, textDecoration: 'underline', textUnderlineOffset: 3 }}>{o.customers.company}</Link>
            : <div style={{ ...value, color: 'var(--red)' }}>Utan kund</div>}
        </div>
        <div><div style={label}>Räknas på</div><div style={value}>{o.assigned_to || '—'}</div></div>
        <div><div style={label}>Såld av</div><div style={value}>{o.created_by || 'Webbshoppen'}</div></div>
        {o.packed_at && (
          <div><div style={label}>Packad</div><div style={value}>{formatDateTime(o.packed_at)}{o.packed_by ? ` · ${o.packed_by}` : ''}</div></div>
        )}
        {o.pickup_at && !o.shipped_at && (
          <div><div style={label}>Hämtas</div><div style={value}>{formatDateTime(o.pickup_at)}</div></div>
        )}
        {(o.shipped_at || o.carrier || o.transport_order_id) && (
          <div><div style={label}>Hämtad av transportör</div><div style={value}>{[o.shipped_at && formatDateTime(o.shipped_at), o.carrier, o.transport_order_id].filter(Boolean).join(' · ')}</div></div>
        )}
      </div>

      {!items ? (
        <div style={{ fontSize: 12, color: 'var(--text2)', padding: '8px 0' }}>Laddar produkter…</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text2)', padding: '8px 0' }}>Inga produktrader</div>
      ) : (
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          {items.map((it, i) => {
            const p = products.find(x => x.id === it.product_id)
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderTop: i ? '1px solid var(--border2)' : 'none', background: 'var(--bg2)' }}>
                {p ? <Thumb p={p} size={44} /> : (
                  <div title="Egen rad" style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><PenLine size={18} color="var(--text2)" /></div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{it.product_name}</div>
                  <DeliveryTag line={it as any} order={o} />
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                  {it.qty} × {fmt(Number(it.unit_price))} kr
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{fmt(Number(it.total_price ?? it.qty * Number(it.unit_price)))} kr</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 12 }}>
        {o.notes ? <p style={{ flex: '1 1 220px', margin: 0, fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-line' }}>{o.notes}</p> : <span />}
        <div style={{ minWidth: 200, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: 'var(--text2)' }}><span>Summa exkl. moms</span><span>{fmt(o.subtotal || 0)} kr</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: 'var(--text2)' }}><span>Moms</span><span>{fmt(o.vat_amount || 0)} kr</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: 'var(--text)', fontWeight: 700, fontSize: 14, marginTop: 2 }}><span>Totalt</span><span style={{ color: 'var(--gold)' }}>{fmt(o.total || 0)} kr</span></div>
        </div>
      </div>
    </div>
  )
}
