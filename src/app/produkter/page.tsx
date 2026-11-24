'use client'
export const dynamic = 'force-dynamic'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PublicShell, useLoginModal, usePublicCart } from '@/components/layout/PublicShell'
import { Search, Package, ShoppingCart, ChevronRight, ChevronLeft, LayoutGrid } from 'lucide-react'
import Link from 'next/link'
import { PRODUCT_BADGE } from '@/lib/product-badge'
import AddProductCard from '@/components/site-edit/AddProductCard'
import { popElement } from '@/lib/pop'
import ProductCard from '@/components/shop/ProductCard'

const SORT_OPTIONS = ['Populärast', 'Lägsta pris', 'Högsta pris', 'Namn A–Ö']

const PAGE_SIZE = 24

function ProductsContent() {
  const openLogin = useLoginModal()
  const cart = usePublicCart()
  const [products, setProducts]   = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [sort, setSort]           = useState('Popularast')
  const [page, setPage]           = useState(1)
  const [onlySale, setOnlySale]   = useState(false)
  const params = useSearchParams()

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('products').select('*').eq('active', true).order('name'),
      sb.from('categories').select('*').order('name'),
    ]).then(([{ data: p }, { data: c }]) => {
      setProducts(p || [])
      setCategories(c || [])
      setLoading(false)
    })
  }, [])

  const { customer, priceList } = cart

  // The header's search, category menu and Kampanj link arrive as ?q=, ?kategori=
  // (id), ?kat= (name) and ?kampanj=1 – also while already on this page.
  useEffect(() => {
    const kat = params.get('kat')?.toLowerCase()
    const byName = kat ? categories.find(c => String(c.name).toLowerCase() === kat)?.id : null
    /* eslint-disable react-hooks/set-state-in-effect */
    setSelectedCat(params.get('kategori') || byName || 'all')
    setSearch(params.get('q') || '')
    setOnlySale(params.get('kampanj') === '1')
    setPage(1)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [params, categories])

  // Filter
  let filtered = products.filter(p => {
    const matchCat = (selectedCat === 'all' || p.category_id === selectedCat) && (!onlySale || p.badge === 'sale')
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

  const catName = categories.find(c => c.id === selectedCat)?.name
  const title = onlySale ? 'Kampanj' : catName || (search ? `Sök: ”${search}”` : 'Alla produkter')

  return (
    <div className="shop-page">
      <style>{`
        .shop-page { max-width: 1320px; margin: 0 auto; padding: 36px 24px 80px; }
        .shop-crumbs { font-size: 13px; color: var(--shop-text2); margin-bottom: 10px; }
        .shop-crumbs a { color: var(--shop-text2); text-decoration: none; }
        .shop-crumbs a:hover { color: var(--shop-text); }
        .shop-title { margin: 0; font-size: clamp(34px, 5vw, 60px); font-weight: 800; letter-spacing: -.03em; line-height: 1.02; color: var(--shop-text); }
        .shop-chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; margin: 26px 0 18px; padding-bottom: 2px; }
        .shop-chips::-webkit-scrollbar { display: none; }
        .shop-chip { flex-shrink: 0; padding: 9px 16px; border-radius: 999px; border: 1px solid var(--shop-line); background: var(--shop-surface); color: var(--shop-text); font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; font-family: inherit; }
        .shop-chip:hover { border-color: rgba(255,255,255,.3); }
        .shop-chip.is-on { background: #EDEDEA; color: #111; border-color: #EDEDEA; font-weight: 700; }
        .shop-chip.is-sale.is-on { background: #E50019; border-color: #E50019; color: #fff; }
        .shop-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 0; border-top: 1px solid var(--shop-line); border-bottom: 1px solid var(--shop-line); margin-bottom: 24px; }
        .shop-count { font-size: 14px; color: var(--shop-text2); }
        .shop-search { flex: 1; min-width: 200px; max-width: 420px; position: relative; margin-left: auto; }
        .shop-search input { width: 100%; padding: 11px 36px; border-radius: 6px; border: 1px solid var(--shop-line); background: var(--shop-surface); color: var(--shop-text); font-size: 14px; outline: none; box-sizing: border-box; font-family: inherit; }
        .shop-search input:focus { border-color: #E8B84B; }
        .shop-select { padding: 11px 12px; border-radius: 6px; border: 1px solid var(--shop-line); background: var(--shop-surface); color: var(--shop-text); font-size: 14px; cursor: pointer; outline: none; font-family: inherit; color-scheme: dark; }
        .shop-pages { display: flex; justify-content: center; align-items: center; gap: 8px; padding-top: 40px; }
        .shop-page-btn { min-width: 40px; height: 40px; border-radius: 6px; border: 1px solid var(--shop-line); background: var(--shop-surface); color: var(--shop-text); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; font-family: inherit; }
        .shop-page-btn.is-on { background: #E8B84B; border-color: #E8B84B; color: #111; font-weight: 800; }
        .shop-page-btn:disabled { opacity: .35; cursor: default; }
        .shop-b2b { margin-top: 56px; background: linear-gradient(110deg, #1d1708 0%, #141417 60%); border: 1px solid rgba(232,184,75,.25); border-radius: 10px; padding: 34px 36px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; }
        @media (max-width: 760px) { .shop-page { padding: 24px 14px 60px; } .shop-search { max-width: none; margin-left: 0; flex-basis: 100%; order: 3; } }
      `}</style>

      <div className="shop-crumbs"><Link href="/">Hem</Link> / <Link href="/produkter">Produkter</Link>{catName ? <> / {catName}</> : null}</div>
      <h1 className="shop-title">{title}</h1>

      {/* Categories */}
      <div className="shop-chips" role="tablist" aria-label="Kategorier">
        <button role="tab" aria-selected={selectedCat === 'all' && !onlySale} className={`shop-chip${selectedCat === 'all' && !onlySale ? ' is-on' : ''}`} onClick={() => { selectCat('all'); setOnlySale(false) }}>Alla</button>
        {categories.map(cat => (
          <button key={cat.id} role="tab" aria-selected={selectedCat === cat.id} className={`shop-chip${selectedCat === cat.id ? ' is-on' : ''}`} onClick={() => selectCat(cat.id)}>{cat.name}</button>
        ))}
        <button role="tab" aria-selected={onlySale} className={`shop-chip is-sale${onlySale ? ' is-on' : ''}`} onClick={() => { setOnlySale(o => !o); setPage(1) }}>Kampanj</button>
      </div>

      {/* Count, search and sorting */}
      <div className="shop-bar">
        <span className="shop-count">{loading ? 'Laddar…' : `${filtered.length} produkter`}</span>
        <div className="shop-search">
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--shop-text2)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Sök produkt eller varumärke" aria-label="Sök produkt" />
          {search && <button onClick={() => setSearch('')} aria-label="Rensa sökningen" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--shop-text2)', fontSize: 18, lineHeight: 1 }}>×</button>}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sortera" className="shop-select">
          {SORT_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Products */}
      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--shop-text2)' }}>Laddar produkter…</div>
      ) : paged.length === 0 ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--shop-text2)' }}>
          <Package size={48} style={{ marginBottom: 16 }} />
          <p>Inga produkter hittades.</p>
        </div>
      ) : (
        <div className="pcard-grid">
          {paged.map(p => <ProductCard key={p.id} p={p} />)}
          <AddProductCard onCreated={p => setProducts(ps => [...ps, p])} />
        </div>
      )}

      {totalPages > 1 && (
        <div className="shop-pages">
          <button className="shop-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Föregående sida"><ChevronLeft size={16} /></button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} className={`shop-page-btn${page === i + 1 ? ' is-on' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
          ))}
          <button className="shop-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Nästa sida"><ChevronRight size={16} /></button>
        </div>
      )}

      {/* Company customers */}
      {!cart.authLoading && !customer && (
        <div className="shop-b2b">
          <div>
            <p style={{ color: '#E8B84B', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', margin: '0 0 6px' }}>För företag</p>
            <h3 style={{ color: 'var(--shop-text)', fontSize: 24, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-.01em' }}>Handla till företagspris</h3>
            <p style={{ color: 'var(--shop-text2)', fontSize: 15, margin: 0 }}>Registrera dig som företagskund och få upp till 40 % rabatt.</p>
          </div>
          <button onClick={() => openLogin(true, 'business')} style={{ padding: '14px 26px', background: '#E8B84B', color: '#111', borderRadius: 6, border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
            Bli företagskund
          </button>
        </div>
      )}
    </div>
  )
}

export default function ProdukterPage() {
  return (
    <PublicShell tone="dark">
      <Suspense fallback={null}><ProductsContent /></Suspense>
    </PublicShell>
  )
}
