'use client'
// Building blocks of the CRM order form (Ny order / Kassan).
import { Fragment, useEffect, useState } from 'react'
import { Product, Customer } from '@/types'
import { custPrice, fmt } from '@/lib/utils'
import { withVat } from '@/lib/pricing'
import { stockStatus } from '@/lib/stock'
import { Plus, Minus, Search, Package, X, UserPlus } from 'lucide-react'

// Product picture in the cart; the icon stands in when a product has none.
export function Thumb({ p, size = 36 }: { p: Product; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 6, background: '#F4F2EE', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {p.image_url
        ? <img src={p.image_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        : <Package size={Math.round(size * 0.45)} color="#999" />}
    </div>
  )
}

// Catalogue card: big picture, name, price and +/- right on the card.
export function ProductCard({ p, selectedCustomer, qty, onAdd, onRemove, onOpen, badge, inCar = 0 }: {
  p: Product
  inCar?: number
  selectedCustomer: Customer | null
  qty: number
  onAdd: () => void
  onRemove: () => void
  onOpen: () => void
  badge?: 'köpt' | 'rec'
}) {
  const price = custPrice(p.list_price, selectedCustomer?.price_list_id || 'Standard')
  const stock = stockStatus(p.stock_qty)
  return (
    <div style={{ background: 'var(--bg3)', border: `1px solid ${qty > 0 ? 'rgba(232,184,75,.55)' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <button type="button" onClick={onOpen} aria-label={`Visa ${p.name}`}
        style={{ position: 'relative', height: 190, padding: 14, background: '#fff', border: 'none', cursor: 'zoom-in', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {p.image_url ? <img src={p.image_url} alt="" loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Package size={48} strokeWidth={1.2} color="#bbb" />}
        {badge && (
          <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.05em',
            background: badge === 'köpt' ? '#E8B84B' : '#4A8FD4', color: badge === 'köpt' ? '#111' : '#fff' }}>
            {badge === 'köpt' ? 'Köpt tidigare' : 'Tips'}
          </span>
        )}
        {qty > 0 && (
          <span style={{ position: 'absolute', top: 10, right: 10, minWidth: 26, height: 26, padding: '0 7px', borderRadius: 13, background: '#111', color: '#E8B84B', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>{qty}</span>
        )}
      </button>
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{p.brand}</div>
        <button type="button" onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{p.name}</button>
        <div style={{ fontSize: 11, color: stock.color }}>{stock.label}{p.unit ? ` · ${p.unit}` : ''}</div>
        {inCar > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: '#6AAFF0' }}>I bilen: {inCar} st</div>}
        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>{fmt(price)} kr</span>
            {price < p.list_price && <span style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'line-through' }}>{fmt(p.list_price)}</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>exkl. moms · {fmt(withVat(price))} kr inkl.</div>
          {qty === 0 ? (
            <button type="button" onClick={onAdd} style={{ width: '100%', height: 40, borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Plus size={15} /> Lägg till
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={onRemove} aria-label={`Minska ${p.name}`} style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={15} /></button>
              <span style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{qty}</span>
              <button type="button" onClick={onAdd} aria-label={`Öka ${p.name}`} style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#111', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={15} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Search existing customers, or add a new one. Results show only while typing,
// so the catalogue stays in focus.
export function CustomerPicker({ customers, onPick, onNew, autoFocus = false }: {
  customers: Customer[]
  onPick: (c: Customer) => void
  onNew: (company: string) => void
  autoFocus?: boolean
}) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const hits = term ? customers.filter(c =>
    c.company.toLowerCase().includes(term) || (c.contact_name || '').toLowerCase().includes(term) ||
    (c.org_nr || '').replace(/\D/g, '').includes(term.replace(/\D/g, '') || '§') || (c.email || '').toLowerCase().includes(term)).slice(0, 8) : []
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input autoFocus={autoFocus} placeholder="Sök kund – företag, namn, org.nr eller e-post" value={q} onChange={e => setQ(e.target.value)} aria-label="Sök kund"
            style={{ width: '100%', padding: '10px 12px 10px 32px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <button type="button" onClick={() => onNew(q.trim())}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <UserPlus size={15} /> Ny kund
        </button>
      </div>
      {term && (
        <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: 'calc(100% + 6px)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,.45)' }}>
          {hits.map(c => (
            <button key={c.id} type="button" onClick={() => { onPick(c); setQ('') }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border2)', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,184,75,.05)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span>
                <span style={{ display: 'block', fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{c.company}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{[c.contact_name, c.city].filter(Boolean).join(' · ')}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Prislista {c.price_list_id}</span>
            </button>
          ))}
          <button type="button" onClick={() => { onNew(q.trim()); setQ('') }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>
            <UserPlus size={14} /> {hits.length ? 'Ingen av dessa – skapa ny kund' : `Ingen träff – skapa "${q.trim()}" som ny kund`}
          </button>
        </div>
      )}
    </div>
  )
}

// Large picture and details, to show the customer on site.
export function ProductSheet({ p, categoryName, selectedCustomer, qty, onAdd, onRemove, onClose }: {
  p: Product
  categoryName: string
  selectedCustomer: Customer | null
  qty: number
  onAdd: () => void
  onRemove: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const pl    = selectedCustomer?.price_list_id || 'Standard'
  const price = custPrice(p.list_price, pl)
  const stock = stockStatus(p.stock_qty)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div role="dialog" aria-modal="true" aria-label={p.name} onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 880, maxHeight: '96vh', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, padding: 24, position: 'relative' }}>
          {p.image_url
            ? <img src={p.image_url} alt={p.name} style={{ maxWidth: '100%', maxHeight: '62vh', objectFit: 'contain' }} />
            : <Package size={96} strokeWidth={1} color="#bbb" />}
        </div>
        <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{p.brand}</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: '4px 0 0', lineHeight: 1.2 }}>{p.name}</h2>
            </div>
            <button onClick={onClose} aria-label="Stäng" style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', padding: 6, display: 'flex' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>{fmt(price)} kr</span>
            {price < p.list_price && <span style={{ fontSize: 15, color: 'var(--text2)', textDecoration: 'line-through' }}>{fmt(p.list_price)} kr</span>}
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>exkl. moms · {fmt(withVat(price))} kr inkl. moms{selectedCustomer ? ` · prislista ${pl}` : ''}</span>
          </div>
          <span style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: stock.color, background: stock.bg, padding: '4px 10px', borderRadius: 20 }}>{stock.label}</span>
          {p.description && (
            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{p.description}</p>
          )}
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: 0, fontSize: 13 }}>
            {([['Artikelnr', p.sku], ['Kategori', categoryName], ['Enhet', p.unit]] as const).filter(([, v]) => v).map(([k, v]) => (
              <Fragment key={k}><dt style={{ color: 'var(--text2)' }}>{k}</dt><dd style={{ margin: 0, color: 'var(--text)' }}>{v}</dd></Fragment>
            ))}
          </dl>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
            {qty > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={onRemove} aria-label="Minska" style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={16} /></button>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', minWidth: 24, textAlign: 'center' }}>{qty}</span>
              </div>
            )}
            <button onClick={onAdd} style={{ flex: 1, height: 44, borderRadius: 10, background: 'var(--gold)', border: 'none', color: '#111', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Plus size={16} /> {qty > 0 ? 'Lägg till en till' : 'Lägg i varukorgen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
