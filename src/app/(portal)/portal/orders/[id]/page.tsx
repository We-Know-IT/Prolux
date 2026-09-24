import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { fmt, formatDate } from '@/lib/utils'
import { ORDER_STATUS_LABEL, OrderStatus, OrderItem } from '@/types'
import Link from 'next/link'
import { ArrowLeft, Clock, CheckCircle, Package, Truck, Home } from 'lucide-react'
import { ElementType } from 'react'
import { portalCustomer } from '@/lib/portal-customer'

interface Step {
  status: string
  label: string
  icon: ElementType
  desc: string
}

const STEPS: Step[] = [
  {
    status: 'pending',
    label: 'Order mottagen',
    icon: Clock,
    desc: 'Din order har registrerats och väntar på bekräftelse.',
  },
  {
    status: 'confirmed',
    label: 'Bekräftad',
    icon: CheckCircle,
    desc: 'Ordern är bekräftad och förbereds.',
  },
  {
    status: 'packed',
    label: 'Packad',
    icon: Package,
    desc: 'Ordern har packats och är redo för upphämtning.',
  },
  {
    status: 'shipped',
    label: 'Skickad',
    icon: Truck,
    desc: 'Ordern är på väg till dig.',
  },
  {
    status: 'delivered',
    label: 'Levererad',
    icon: Home,
    desc: 'Ordern har levererats.',
  },
]

const STATUS_ORDER = ['pending', 'confirmed', 'packed', 'shipped', 'delivered']

const STATUS_CSS: Record<string, { background: string; color: string }> = {
  pending:   { background: 'rgba(212,138,58,.12)',  color: '#D48A3A' },
  confirmed: { background: 'rgba(232,184,75,.12)',  color: '#E8B84B' },
  packed:    { background: 'rgba(232,184,75,.12)',  color: '#E8B84B' },
  shipped:   { background: 'rgba(66,153,225,.12)',  color: '#4299E1' },
  delivered: { background: 'rgba(76,175,125,.12)', color: '#4CAF7D' },
  cancelled: { background: 'rgba(224,82,82,.12)',   color: '#E05252' },
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { orderOwnerIds } = await portalCustomer(supabase, user.id)

  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .in('customer_id', orderOwnerIds)
    .single()

  if (!order) notFound()

  const currentIdx = STATUS_ORDER.indexOf(order.status)
  const isCancelled = order.status === 'cancelled'
  const statusCss = STATUS_CSS[order.status] || { background: 'rgba(155,163,176,.08)', color: 'var(--text2)' }

  return (
    <div style={{ padding: '48px', maxWidth: 680 }}>
      <Link
        href="/portal/orders"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--text3)',
          marginBottom: 32,
          textDecoration: 'none',
        }}
      >
        <ArrowLeft size={14} /> Tillbaka till ordrar
      </Link>

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
        Orderstatus
      </span>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '44px',
          fontWeight: 500,
          color: 'var(--text)',
          marginBottom: 6,
          lineHeight: 1.1,
        }}
      >
        Spåra <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>order</em>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: '14px',
          color: 'var(--text3)',
          marginBottom: 40,
        }}
      >
        <span>Order #{order.order_nr}</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>{formatDate(order.created_at)}</span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 4,
            background: statusCss.background,
            color: statusCss.color,
          }}
        >
          {ORDER_STATUS_LABEL[order.status as OrderStatus] || order.status}
        </span>
      </div>

      {/* Cancelled notice */}
      {isCancelled && (
        <div
          style={{
            padding: '16px 20px',
            background: 'rgba(224,82,82,.08)',
            border: '1px solid rgba(224,82,82,.2)',
            borderRadius: 8,
            marginBottom: 32,
            fontSize: '14px',
            color: '#E05252',
          }}
        >
          Den här ordern är avbruten och kommer inte att levereras.
        </div>
      )}

      {/* Timeline */}
      {!isCancelled && (
        <div style={{ marginBottom: 40 }}>
          {STEPS.map((step, i) => {
            const StepIcon = step.icon
            const isDone = i < currentIdx
            const isCurrent = STATUS_ORDER[currentIdx] === step.status
            const isFuture = i > currentIdx

            return (
              <div key={step.status} style={{ display: 'flex', gap: 20, position: 'relative' }}>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 19,
                      top: 42,
                      bottom: 0,
                      width: 1,
                      background: isDone ? 'rgba(232,184,75,.3)' : 'var(--border)',
                    }}
                  />
                )}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: `1px solid ${
                      isCurrent
                        ? 'var(--gold)'
                        : isDone
                        ? 'rgba(232,184,75,.4)'
                        : 'var(--border)'
                    }`,
                    background: isCurrent
                      ? 'var(--gold)'
                      : isDone
                      ? 'rgba(232,184,75,.08)'
                      : 'var(--bg2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    zIndex: 1,
                  }}
                >
                  <StepIcon
                    size={15}
                    style={{
                      color: isCurrent ? '#111' : isDone ? 'var(--gold)' : 'var(--text3)',
                    }}
                  />
                </div>
                <div style={{ padding: '8px 0 36px', flex: 1 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 20,
                      fontWeight: 500,
                      color: isDone || isCurrent ? 'var(--text)' : 'var(--text3)',
                      marginBottom: 4,
                    }}
                  >
                    {step.label}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text3)', lineHeight: 1.6 }}>
                    {step.desc}
                  </div>
                  {isCurrent && (
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 6,
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--green)',
                      }}
                    >
                      ✓ Nuvarande status
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Order Items */}
      <div
        style={{
          padding: 20,
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text2)',
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            marginBottom: 14,
          }}
        >
          Orderinnehåll
        </div>
        {((order.order_items || []) as OrderItem[]).map(item => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid rgba(255,255,255,.04)',
              fontSize: 13,
              gap: 12,
            }}
          >
            <div style={{ flex: 1 }}>
              <span style={{ color: 'var(--text)' }}>{item.product_name}</span>
              <span style={{ color: 'var(--text3)', marginLeft: 6 }}>× {item.qty}</span>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: 2 }}>
                {item.product_sku} · {fmt(item.unit_price)} kr/st
              </div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', flexShrink: 0 }}>
              {fmt(item.total_price)} kr
            </span>
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px 0 4px',
            fontSize: 13,
            color: 'var(--text3)',
          }}
        >
          <span>Delsumma exkl. moms</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(order.subtotal)} kr</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '4px 0',
            fontSize: 13,
            color: 'var(--text3)',
          }}
        >
          <span>Moms (25%)</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(order.vat_amount)} kr</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 12,
            marginTop: 4,
            borderTop: '1px solid rgba(255,255,255,.04)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          <span>Totalt inkl. moms</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>
            {fmt(order.total)} kr
          </span>
        </div>

        {/* Delivery info */}
        {(order.delivery_name || order.delivery_city) && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid rgba(255,255,255,.04)',
              fontSize: '13px',
              color: 'var(--text3)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 6,
                color: 'var(--text2)',
              }}
            >
              Leveransadress
            </div>
            {order.delivery_name && <div>{order.delivery_name}</div>}
            {order.delivery_city && <div>{order.delivery_city}</div>}
          </div>
        )}

        {order.notes && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              background: 'var(--bg3)',
              borderRadius: 6,
              fontSize: '13px',
              color: 'var(--text2)',
            }}
          >
            <span style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Anteckning</span>
            {order.notes}
          </div>
        )}
      </div>
    </div>
  )
}
