'use client'
import { Lock } from 'lucide-react'
import { fmt } from '@/lib/utils'
import { netPrice, withVat } from '@/lib/pricing'
import { usePublicCart, useLoginModal } from '@/components/layout/PublicShell'

const SIZES = {
  sm: { main: 15, sub: 10 },
  md: { main: 18, sub: 11 },
  lg: { main: 32, sub: 13 },
}

// A product's price for whoever is looking: business customers see their
// price-list price excl. VAT with the incl. VAT amount under it, private
// customers the price incl. VAT, and visitors who are not logged in a button
// to log in instead.
export default function Price({ listPrice, size = 'md', showListPrice = false }: { listPrice: number; size?: keyof typeof SIZES; showListPrice?: boolean }) {
  const { authUser, authLoading, priceList, isPrivate } = usePublicCart()
  const openLogin = useLoginModal()
  const s = SIZES[size]

  if (authLoading) return <div style={{ height: s.main + s.sub + 6 }} />
  if (!authUser) return (
    <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); openLogin() }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: size === 'lg' ? '10px 18px' : '7px 12px', borderRadius: 8, background: '#F5F2ED', border: '1px solid rgba(0,0,0,.1)', color: '#111', fontSize: size === 'lg' ? 14 : 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      <Lock size={size === 'lg' ? 14 : 12} /> Logga in för pris
    </button>
  )

  const net = netPrice(listPrice, priceList)
  const discounted = net < listPrice
  if (isPrivate) return (
    <div>
      <div style={{ fontSize: s.main, fontWeight: 800, color: '#111', lineHeight: 1.15 }}>{fmt(withVat(net))} kr</div>
      <div style={{ fontSize: s.sub, color: '#777' }}>inkl. moms</div>
    </div>
  )
  return (
    <div>
      <div style={{ fontSize: s.main, fontWeight: 800, color: '#111', lineHeight: 1.15 }}>
        {fmt(net)} kr <span style={{ fontSize: s.sub, fontWeight: 600, color: '#777' }}>exkl. moms</span>
      </div>
      <div style={{ fontSize: s.sub, color: '#777' }}>
        {fmt(withVat(net))} kr inkl. moms
        {showListPrice && discounted && <> · <s>{fmt(listPrice)} kr</s></>}
      </div>
    </div>
  )
}
