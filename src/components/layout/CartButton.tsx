'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { CART_EVENT, OPEN_CART_EVENT, readCart } from '@/lib/crm-cart'

// Cart icon in the admin/CRM top bar: shows the current order's item count
// and opens the cart (from anywhere: goes to Ny order with the cart open).
export default function CartButton({ href = '/crm/orders' }: { href?: string }) {
  const pathname = usePathname()
  const [count, setCount] = useState(0)
  useEffect(() => {
    const update = () => setCount(readCart()?.count ?? 0)
    update()
    window.addEventListener(CART_EVENT, update)
    window.addEventListener('storage', update)
    return () => { window.removeEventListener(CART_EVENT, update); window.removeEventListener('storage', update) }
  }, [])
  const onOrderPage = pathname === '/crm/orders' || pathname === '/admin/crm/orders'
  return (
    <Link href={`${onOrderPage ? pathname : href}?cart=1`} data-tour="cart" aria-label={count ? `Varukorg, ${count} varor` : 'Varukorg'} title="Varukorg"
      onClick={e => { if (onOrderPage) { e.preventDefault(); window.dispatchEvent(new Event(OPEN_CART_EVENT)) } }}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: count ? 'rgba(232,184,75,.12)' : 'rgba(255,255,255,.04)', border: `1px solid ${count ? 'rgba(232,184,75,.3)' : 'var(--line)'}`, color: count ? 'var(--gold)' : 'var(--text2)' }}>
      <ShoppingCart size={16} />
      {count > 0 && (
        <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--gold)', color: '#111', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingInline: 3 }}>{count}</span>
      )}
    </Link>
  )
}
