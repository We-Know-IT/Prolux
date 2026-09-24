import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fmt, custPrice, formatDate } from '@/lib/utils'
import { DISCOUNT, ORDER_STATUS_LABEL, PriceList, OrderStatus } from '@/types'
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

const CAT_ICON: Record<string, string> = {
  wash: '🧴', wheels: '⚙️', polish: '✨',
  exterior: '🚗', interior: '🪑', degreaser: '🧪',
}

export default async function PortalDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { orderOwnerIds } = await portalCustomer(supabase, user.id)

  const priceList = ((user.user_metadata?.price_list as string) || 'B') as PriceList
  const company = (user.user_metadata?.company as string) || 'Ditt företag'

  const [{ data: orders }, { data: products }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('customer_id', orderOwnerIds)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .limit(6),
  ])

  const orderList = orders || []
  const productList = products || []

  const totalSpent = orderList
    .filter(o => o.status !== 'cancelled')
    .reduce((s: number, o) => s + (o.subtotal || 0), 0)

  const thisYear = orderList.filter(
    o => new Date(o.created_at).getFullYear() === new Date().getFullYear()
  ).length

  const discountRate = DISCOUNT[priceList] || 0
  const savings = orderList.reduce((s: number, o) => s + (o.subtotal || 0) * discountRate, 0)

  return (
    <div>
      {/* Hero */}
      <div style={{ padding: '48px 48px 36px', borderBottom: '1px solid var(--border)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--gold)',
            textTransform: 'uppercase',
            letterSpacing: '.1em',
            marginBottom: 12,
          }}
        >
          Välkommen tillbaka
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '48px',
            fontWeight: 500,
            color: 'var(--text)',
            lineHeight: 1.1,
            marginBottom: 8,
          }}
        >
          Bilvård på{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>proffsnivå</em>
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text3)' }}>
          {company} · Prislista {priceList}
        </div>
      </div>

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {[
          { label: 'Total inköpt', value: `${fmt(totalSpent)} kr`, sub: 'exkl. moms' },
          { label: 'Ordrar i år', value: String(thisYear), sub: 'beställningar' },
          {
            label: 'Besparingar',
            value: `${fmt(savings)} kr`,
            sub: `vs listpris (${Math.round(discountRate * 100)}%)`,
          },
        ].map((kpi, i) => (
          <div
            key={i}
            style={{
              padding: '28px 36px',
              borderRight: i < 2 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text3)',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 12,
                display: 'block',
              }}
            >
              {kpi.label}
            </span>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '40px',
                fontWeight: 500,
                color: 'var(--text)',
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              {kpi.value}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{ padding: '36px 48px' }}>
        {/* Recent Orders */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
            }}
          >
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text2)',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
              }}
            >
              Senaste ordrar
            </div>
            <Link
              href="/portal/orders"
              style={{ fontSize: '12px', color: 'var(--text3)', textDecoration: 'none' }}
            >
              Visa alla →
            </Link>
          </div>
          {orderList.length === 0 ? (
            <p
              style={{ fontSize: '14px', color: 'var(--text3)', textAlign: 'center', padding: '40px 0' }}
            >
              Inga ordrar ännu.{' '}
              <Link href="/portal/catalog" style={{ color: 'var(--gold)' }}>
                Börja handla →
              </Link>
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Order #', 'Datum', 'Belopp', 'Status'].map(h => (
                    <th
                      key={h}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text3)',
                        textTransform: 'uppercase',
                        letterSpacing: '.08em',
                        padding: '10px 0',
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
                {orderList.slice(0, 5).map(order => {
                  const css = STATUS_CSS[order.status] || {
                    background: 'rgba(155,163,176,.08)',
                    color: 'var(--text2)',
                  }
                  return (
                    <tr key={order.id}>
                      <td
                        style={{
                          padding: '14px 0',
                          fontSize: '13px',
                          borderBottom: '1px solid rgba(255,255,255,.04)',
                        }}
                      >
                        <Link
                          href={`/portal/orders/${order.id}`}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '13px',
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
                          padding: '14px 0',
                          fontSize: '13px',
                          color: 'var(--text2)',
                          borderBottom: '1px solid rgba(255,255,255,.04)',
                        }}
                      >
                        {formatDate(order.created_at)}
                      </td>
                      <td
                        style={{
                          padding: '14px 0',
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
                          padding: '14px 0',
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Recommended Products */}
        {productList.length > 0 && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text2)',
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                }}
              >
                Rekommenderat för dig
              </div>
              <Link
                href="/portal/catalog"
                style={{ fontSize: '12px', color: 'var(--text3)', textDecoration: 'none' }}
              >
                Se alla produkter →
              </Link>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
                gap: 12,
              }}
            >
              {productList.map(p => {
                const price = custPrice(p.list_price, priceList)
                return (
                  <Link
                    key={p.id}
                    href="/portal/catalog"
                    style={{
                      background: 'var(--bg2)',
                      border: '1px solid rgba(255,255,255,.04)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      textDecoration: 'none',
                      display: 'block',
                    }}
                  >
                    <div
                      style={{
                        height: 140,
                        overflow: 'hidden',
                        background: 'var(--bg3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          alt={p.name}
                        />
                      ) : (
                        <span style={{ fontSize: 44 }}>{CAT_ICON[p.category_id] || '✨'}</span>
                      )}
                    </div>
                    <div style={{ padding: '14px 16px 16px' }}>
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: 'var(--text3)',
                          textTransform: 'uppercase',
                          letterSpacing: '.08em',
                          marginBottom: 4,
                        }}
                      >
                        {p.brand}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: '15px',
                          fontWeight: 500,
                          color: 'var(--text)',
                          marginBottom: 8,
                          lineHeight: 1.25,
                        }}
                      >
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span
                          style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: 'var(--gold)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {fmt(price)} kr
                        </span>
                        {price < p.list_price && (
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--text3)',
                              textDecoration: 'line-through',
                            }}
                          >
                            {fmt(p.list_price)} kr
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
