'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PublicShell, useLoginModal, usePublicCart } from '@/components/layout/PublicShell'
import { fmt } from '@/lib/utils'
import { Search, Package, ShoppingCart, ChevronRight, ChevronLeft, LayoutGrid } from 'lucide-react'
import Link from 'next/link'

const DISCOUNT: Record<string, number> = { A: 0.40, B: 0.30, C: 0.20, Standard: 0 }
const SORT_OPTIONS = ['Populärast', 'Lägsta pris', 'Högsta pris', 'Namn A–Ö']

const PAGE_SIZE = 8

function ProductsContent() {
  const openLogin = useLoginModal()
  const cart = usePublicCart()
  const [products, setProducts]   = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [authUser, setAuthUser]   = useState<any>(null)
  const [customer, setCustomer]   = useState<any>(null)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [sort, setSort]           = useState('Popularast')
  const [page, setPage]           = useState(1)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null)
      if (session?.user) {
        sb.from('customers').select('*').eq('auth_user_id', session.user.id).single()
          .then(({ data }) => setCustomer(data))
      }
    })
    Promise.all([
      sb.from('products').select('*').eq('active', true).order('name'),
      sb.from('categories').select('*').order('name'),
    ]).then(([{ data: p }, { data: c }]) => {
      setProducts(p || [])
      setCategories(c || [])
      setLoading(false)
    })
  }, [])

  const priceList = customer?.price_list_id || 'Standard'
  const discount  = DISCOUNT[priceList] ?? 0

  function custPrice(listPrice: number) {
    return Math.round(listPrice * (1 - discount))
  }

  // Filter
  let filtered = products.filter(p => {
    const matchCat = selectedCat === 'all' || p.category_id === selectedCat
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand || '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // Sort
  if (sort === 'Lägsta pris') filtered = [...filtered].sort((a, b) => a.list_price - b.list_price)
  else if (sort === 'Högsta pris') filtered = [...filtered].sort((a, b) => b.list_price - a.list_price)
  else if (sort === 'Namn A–Ö') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'sv'))

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function addToCart(p: any) {
    cart.addItem({ id: p.id, name: p.name, brand: p.brand, list_price: p.list_price, image_url: p.image_url, unit: p.unit }, priceList)
    setJustAdded(p.id)
    setTimeout(() => setJustAdded(null), 1600)
  }

  function selectCat(id: string) {
    setSelectedCat(id)
    setPage(1)
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <style>{`
        .prod-page-content { position: relative; z-index: 1; }
        .prod-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 20px; }
        @media (max-width:1100px) { .prod-grid { grid-template-columns: repeat(3,1fr); } }
        @media (max-width:720px)  { .prod-grid { grid-template-columns: repeat(2,1fr); } }
        @media (max-width:480px)  { .prod-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>

      <div className="prod-page-content">

      {/* ── HERO ── */}
      <div style={{ position: 'relative', overflow: 'hidden', background: '#0a0c10' }}>
        <img
          src="https://fopshubqliboxgokbhnr.supabase.co/storage/v1/object/public/hero-images/category-hero.png"
          alt="Alla Produkter"
          style={{ width: '100%', display: 'block', objectFit: 'cover' }}
        />
      </div>

      {/* ── TRUST STRIP ── */}
      <div style={{ background: 'rgba(255,255,255,.85)', borderBottom: '1px solid rgba(0,0,0,.08)', padding: '32px 48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 32 }} className="trust-strip">
          {[
            { title: 'Säker för alla ytor', text: 'Skonsamma men extremt effektiva formuleringar utvecklade för att aldrig skada känsliga material.' },
            { title: 'pH-balanserat', text: 'Perfekt komponerade pH-värden som skapar optimal rengöringseffekt utan att slita på befintliga lackskydd.' },
            { title: 'Effektiv avfettning', text: 'Våra kända alkaliska och kallavfettningar biter på nordisk vintervägssmuts med oöverträffad kraft.' },
            { title: 'Högsta kvalitet', text: 'Formulerat och tillverkat i Italien av ledande kemister med högsta certifieringar.' },
          ].map(({ title, text }) => (
            <div key={title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(232,184,75,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="#C9971A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: 0 }}>{title}</p>
              <p style={{ fontSize: 13, color: '#777', margin: 0, lineHeight: 1.55 }}>{text}</p>
            </div>
          ))}
        </div>
      </div>
      <style>{`.trust-strip { } @media(max-width:800px){.trust-strip{grid-template-columns:1fr 1fr!important}} @media(max-width:500px){.trust-strip{grid-template-columns:1fr!important}}`}</style>

      {/* ── CATEGORY ICONS ── */}
      <div style={{ borderBottom: '1px solid rgba(0,0,0,.08)', padding: '28px 48px', overflowX: 'auto', background: 'transparent' }}>
        <div style={{ display: 'flex', gap: 28, minWidth: 'max-content' }}>
          <button
            onClick={() => selectCat('all')}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', minWidth: 110 }}
          >
            <div style={{
              width: 110, height: 110, borderRadius: '50%',
              background: selectedCat === 'all' ? 'rgba(232,184,75,.15)' : '#f2f2f2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: selectedCat === 'all' ? '2.5px solid #E8B84B' : '2px solid #e0e0e0',
              transition: 'all .2s', overflow: 'hidden',
            }}>
              <LayoutGrid size={30} strokeWidth={1.5} color="#555" />
            </div>
            <span style={{ fontSize: 13, color: selectedCat === 'all' ? '#111' : '#555', fontWeight: selectedCat === 'all' ? 700 : 500, textAlign: 'center', lineHeight: 1.3 }}>Alla</span>
          </button>

          {categories.map(cat => {
            const isActive = selectedCat === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => selectCat(cat.id)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', minWidth: 110 }}
              >
                <div style={{
                  width: 110, height: 110, borderRadius: '50%',
                  background: isActive ? 'rgba(232,184,75,.12)' : '#f2f2f2',
                  border: isActive ? '2.5px solid #E8B84B' : '2px solid #e0e0e0',
                  transition: 'all .2s', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {cat.image_url ? (
                    <img src={cat.image_url} alt={cat.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                  ) : (
                    <Package size={36} color={isActive ? '#C9971A' : '#ccc'} strokeWidth={1.2} />
                  )}
                </div>
                <span style={{ fontSize: 13, color: isActive ? '#111' : '#555', fontWeight: isActive ? 700 : 500, textAlign: 'center', lineHeight: 1.3, maxWidth: 110 }}>
                  {cat.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── TOOLBAR: count + search + sort ── */}
      <div style={{ padding: '16px 48px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid #e8e8e8' }}>
        <span style={{ fontSize: 14, color: '#555', flexShrink: 0 }}>
          {loading ? '...' : `${filtered.length} produkter`}
        </span>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Sök produkt..."
            style={{ width: '100%', padding: '8px 36px 8px 36px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 14, color: '#111', background: 'rgba(255,255,255,.8)', outline: 'none', boxSizing: 'border-box' }}
          />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 16, lineHeight: 1 }}>×</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: '#555' }}>Sortera:</span>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 14, color: '#111', background: '#fff', cursor: 'pointer', outline: 'none' }}>
            {SORT_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── PRODUCT GRID ── */}
      {loading ? (
        <div style={{ padding: '80px 48px', textAlign: 'center', color: '#aaa' }}>Laddar produkter...</div>
      ) : paged.length === 0 ? (
        <div style={{ padding: '80px 48px', textAlign: 'center', color: '#aaa' }}>
          <Package size={48} style={{ marginBottom: 16 }} />
          <p>Inga produkter hittades.</p>
        </div>
      ) : (
        <div className="prod-grid" style={{ padding: '24px 40px', gap: 20 } as any}>
          {paged.map((p, i) => {
            const price = custPrice(p.list_price)
            const added = justAdded === p.id
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden', transition: 'box-shadow .2s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.12)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)')}
              >
                <Link href={`/produkter/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ background: '#ffffff', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, position: 'relative' }}>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} style={{ maxWidth: '82%', maxHeight: '82%', objectFit: 'contain', mixBlendMode: 'multiply' }} />
                    ) : (
                      <Package size={64} color="#ccc" strokeWidth={1} />
                    )}
                    {(i === 0 || i === 3) && (
                      <span style={{ position: 'absolute', top: 12, left: 12, background: '#E8B84B', color: '#111', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        Storsäljare
                      </span>
                    )}
                    {i === 2 && (
                      <span style={{ position: 'absolute', top: 12, left: 12, background: '#4CAF7D', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        Nyhet
                      </span>
                    )}
                  </div>
                </Link>
                <div style={{ padding: '14px 18px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.1em', margin: '0 0 4px' }}>
                    {p.brand || 'ProLuxShine'}
                  </p>
                  <Link href={`/produkter/${p.id}`} style={{ textDecoration: 'none' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: '0 0 14px', lineHeight: 1.3 }}>
                      {p.name}
                    </p>
                  </Link>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{fmt(price)} kr</div>
                      {discount > 0 ? (
                        <div style={{ fontSize: 12, color: '#bbb', textDecoration: 'line-through' }}>{fmt(p.list_price)} kr</div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#999' }}>exkl. moms</div>
                      )}
                    </div>
                    <button
                      onClick={() => addToCart(p)}
                      style={{ width: 40, height: 40, borderRadius: '50%', background: added ? '#4CAF7D' : '#E8B84B', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', flexShrink: 0 }}
                    >
                      <ShoppingCart size={16} color="#111" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── PAGINATION ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '40px 48px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e0e0e0', background: '#fff', cursor: page === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page === 1 ? .4 : 1 }}>
            <ChevronLeft size={16} color="#555" />
          </button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i + 1)} style={{ width: 36, height: 36, borderRadius: '50%', border: page === i + 1 ? 'none' : '1px solid #e0e0e0', background: page === i + 1 ? '#E8B84B' : '#fff', color: page === i + 1 ? '#111' : '#555', fontWeight: page === i + 1 ? 700 : 400, fontSize: 14, cursor: 'pointer' }}>
              {i + 1}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e0e0e0', background: '#fff', cursor: page === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page === totalPages ? .4 : 1 }}>
            <ChevronRight size={16} color="#555" />
          </button>
        </div>
      )}

      {/* ── B2B PROMPT ── */}
      {!customer && (
        <div style={{ margin: '0 40px 48px', background: '#0D0F13', borderRadius: 12, padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <p style={{ color: '#E8B84B', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>B2B-partner</p>
            <h3 style={{ color: '#F0EDE8', fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Handla till grossistpris</h3>
            <p style={{ color: '#9BA0AB', fontSize: 14, margin: 0 }}>Registrera dig som företagskund och få upp till 40% rabatt.</p>
          </div>
          <button onClick={openLogin} style={{ padding: '13px 28px', background: '#E8B84B', color: '#0F1115', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Bli B2B-kund
          </button>
        </div>
      )}
      </div>{/* end prod-page-content */}
    </div>
  )
}

export default function ProdukterPage() {
  return (
    <PublicShell>
      <ProductsContent />
    </PublicShell>
  )
}
