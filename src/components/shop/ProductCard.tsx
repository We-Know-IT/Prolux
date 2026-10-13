'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Package, ShoppingCart, Check, ArrowRight } from 'lucide-react'
import Price from '@/components/shop/Price'
import { usePublicCart } from '@/components/layout/PublicShell'
import { PRODUCT_BADGE } from '@/lib/product-badge'
import { stockStatus } from '@/lib/stock'
import { popElement } from '@/lib/pop'

export interface CardProduct {
  id: string
  name: string
  brand?: string | null
  list_price: number
  image_url?: string | null
  unit?: string | null
  badge?: string | null
  stock_qty?: number | null
}

// One spelling per brand, however it was typed in admin ("PROLUXSHINE", "Prolux Shine" …).
export function brandLabel(brand?: string | null) {
  const b = (brand || '').trim()
  if (!b || /^pro\s*lux\s*shine$/i.test(b)) return 'ProLux Shine'
  if (/^frescura$/i.test(b)) return 'Frescura'
  if (/^virtus$/i.test(b)) return 'Virtus'
  return b
}

// Product card for the webshop (home page and Produkter): soft image stage,
// brand and stock, two-line name, price, and an add-to-cart button for customers.
export default function ProductCard({ p }: { p: CardProduct }) {
  const cart = usePublicCart()
  const [added, setAdded] = useState(false)
  const badge = p.badge ? PRODUCT_BADGE[p.badge] : undefined
  const stock = p.stock_qty === undefined ? null : stockStatus(p.stock_qty)
  const href = `/produkter/${p.id}`

  function add(e: React.MouseEvent<HTMLButtonElement>) {
    popElement(e.currentTarget)
    cart.addItem({ id: p.id, name: p.name, brand: p.brand || '', list_price: p.list_price, image_url: p.image_url ?? null, unit: p.unit || '' }, cart.priceList)
    setAdded(true)
    setTimeout(() => setAdded(false), 1400)
  }

  return (
    <article className="pcard">
      <Link href={href} className="pcard-stage" aria-label={p.name}>
        {p.image_url
          ? <img src={p.image_url} alt="" loading="lazy" className="pcard-img" />
          : <Package size={56} color="#C8C2B8" strokeWidth={1} />}
        {badge && <span className="pcard-badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>}
      </Link>

      <div className="pcard-body">
        <div className="pcard-meta">
          <span className="pcard-brand">{brandLabel(p.brand)}</span>
          {stock && <span className="pcard-stock" style={{ color: stock.color }}><i style={{ background: stock.color }} />{stock.label}</span>}
        </div>
        <Link href={href} className="pcard-name">{p.name}</Link>

        <div className="pcard-foot">
          <Price listPrice={p.list_price} size="sm" showListPrice />
          {cart.canShop ? (
            <button type="button" onClick={add} aria-label={`Lägg ${p.name} i varukorgen`} className={`pcard-add${added ? ' is-added' : ''}`}>
              {added ? <Check size={16} strokeWidth={2.5} /> : <ShoppingCart size={16} strokeWidth={2.2} />}
            </button>
          ) : cart.authUser ? (
            <Link href={href} aria-label={`Visa ${p.name}`} className="pcard-view"><ArrowRight size={16} /></Link>
          ) : null}
        </div>
      </div>

    </article>
  )
}
