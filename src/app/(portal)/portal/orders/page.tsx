import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fmt, formatDate } from '@/lib/utils'
import { ORDER_STATUS_LABEL, OrderStatus } from '@/types'
import Link from 'next/link'
import { portalCustomer } from '@/lib/portal-customer'

const STATUS_CSS: Record<string, { background: string; color: string }> = {
  pending:   { background: 'rgba(212,138,58,.12)',  color: '#D48A3A' },
  confirmed: { background: 'rgba(232,184,75,.12)',  color: '#E8B84B' },
  packed:    { background: 'rgba(232,184,75,.12)',  color: '#E8B84B' },
  shipped:   { background: 'rgba(66,153,225,.12)',  color: '#4299E1' },
  delivered: { background: 'rgba(76,175,125,.12)', color: '#4CAF7D' },
  cancelled: { background: 'rgba(224,82,82,.12)',   color: '#E05252' },
}

export default async function OrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { orderOwnerIds } = await portalCustomer(supabase, user.id)

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .in('customer_id', orderOwnerIds)
    .order('created_at', { ascending: false })

  const orderList = orders || []

  return (
    <div style={{ padding: '48px' }}>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--gold)',
          textTransform: 'uppercase',
          letterSpacing: '.1em',
          marginBottom: 14,
          display: 'block',
        }}
      >
        Historik
      </span>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '44px',
          fontWeight: 500,
          color: 'var(--text)',
          lineHeight: 1.1,
          marginBottom: 36,
        }}
      >
        Mina <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>ordrar</em>
      </div>

      {orderList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text3)' }}>
          <p>Inga ordrar ännu.</p>
          <Link
            href="/portal/catalog"
            style={{ color: 'var(--gold)', display: 'inline-block', marginTop: 12 }}
          >
            Börja handla →
          </Link>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Order #', 'Datum', 'Produkter', 'Belopp', 'Status', ''].map(h => (
                <th
                  key={h}
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text3)',
                    textTransform: 'uppercase',
                    letterSpacing: '.08em',
                    padding: '12px 0',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderList.map(order => {
              const css = STATUS_CSS[order.status] || {
                background: 'rgba(155,163,176,.08)',
                color: 'var(--text2)',
              }
              return (
                <tr key={order.id}>
                  <td
                    style={{
                      padding: '16px 0',
                      borderBottom: '1px solid rgba(255,255,255,.04)',
                    }}
                  >
                    <Link
                      href={`/portal/orders/${order.id}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '14px',
                        color: 'var(--gold)',
                        fontWeight: 500,
                        textDecoration: 'none',
                      }}
                    >
                      #{order.order_nr}
                    </Link>
                  </td>
                  <td
                    style={{
                      padding: '16px 0',
                      fontSize: '13px',
                      color: 'var(--text2)',
                      borderBottom: '1px solid rgba(255,255,255,.04)',
                    }}
                  >
                    {formatDate(order.created_at)}
                  </td>
                  <td
                    style={{
                      padding: '16px 0',
                      fontSize: '13px',
                      color: 'var(--text2)',
                      borderBottom: '1px solid rgba(255,255,255,.04)',
                    }}
                  >
                    {(order.order_items || []).length} produkter
                  </td>
                  <td
                    style={{
                      padding: '16px 0',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      color: 'var(--text)',
                      borderBottom: '1px solid rgba(255,255,255,.04)',
                    }}
                  >
                    {fmt(order.subtotal)} kr
                  </td>
                  <td
                    style={{
                      padding: '16px 0',
                      borderBottom: '1px solid rgba(255,255,255,.04)',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: 4,
                        background: css.background,
                        color: css.color,
                      }}
                    >
                      {ORDER_STATUS_LABEL[order.status as OrderStatus] || order.status}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '16px 0',
                      borderBottom: '1px solid rgba(255,255,255,.04)',
                    }}
                  >
                    <Link
                      href={`/portal/orders/${order.id}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        color: 'var(--text3)',
                        fontSize: '11px',
                        fontWeight: 600,
                        textDecoration: 'none',
                        textTransform: 'uppercase',
                        letterSpacing: '.04em',
                      }}
                    >
                      Spåra →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
