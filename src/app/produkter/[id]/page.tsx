'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PublicShell, usePublicCart } from '@/components/layout/PublicShell'
import { fmt } from '@/lib/utils'
import { ShoppingCart, Truck, ShieldCheck, ChevronRight, Minus, Plus, Package } from 'lucide-react'
import Link from 'next/link'

const DISCOUNT: Record<string, number> = { A: 0.40, B: 0.30, C: 0.20, Standard: 0 }

function ProductDetailContent() {
  const { id } = useParams<{ id: string }>()
  const cart = usePublicCart()
  const router = useRouter()

  const [product, setProduct]   = useState<any>(null)
  const [related, setRelated]   = useState<any[]>([])
  const [authUser, setAuthUser] = useState<any>(null)
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [qty, setQty]           = useState(1)
  const [activeTab, setActiveTab] = useState<'beskrivning'|'specifikationer'>('beskrivning')
  const [added, setAdded]       = useState(false)

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
      sb.from('products').select('*').eq('id', id).single(),
      sb.from('products').select('*').neq('id', id).limit(4),
    ]).then(([{ data: p }, { data: r }]) => {
      setProduct(p)
      setRelated(r || [])
      setLoading(false)
    })
  }, [id])

  const priceList = customer?.price_list_id || 'Standard'
  const discount  = DISCOUNT[priceList] ?? 0
  const custPrice = product ? Math.round(product.list_price * (1 - discount)) : 0

  function addToCart() {
    for (let i = 0; i < qty; i++) {
      cart.addItem({ id: product.id, name: product.name, brand: product.brand, list_price: product.list_price, image_url: product.image_url, unit: product.unit }, priceList)
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (loading) return (
    <div style={{ background: '#fff', minHeight: '100vh', marginTop: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
      Laddar produkt...
    </div>
  )

  if (!product) return (
    <div style={{ background: '#fff', minHeight: '100vh', marginTop: 64, padding: '80px 48px', textAlign: 'center', color: '#aaa' }}>
      <p style={{ fontSize: 18 }}>Produkten hittades inte.</p>
      <Link href="/produkter" style={{ color: '#E8B84B', fontWeight: 600 }}>← Tillbaka till produkter</Link>
    </div>
  )

  return (
    <div style={{ background: '#fff', minHeight: '100vh', marginTop: 64 }}>
      <style>{`
        .pd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: start; }
        .rel-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
        @media (max-width: 860px) { .pd-grid { grid-template-columns: 1fr; gap: 32px; } }
        @media (max-width: 720px) { .rel-grid { grid-template-columns: repeat(2,1fr); } }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ padding: '14px 48px', borderBottom: '1px solid #ebebeb', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link href="/" style={{ color: '#888', fontSize: 13, textDecoration: 'none' }}>Hem</Link>
        <ChevronRight size={12} color="#ccc" />
        <Link href="/produkter" style={{ color: '#888', fontSize: 13, textDecoration: 'none' }}>Produkter</Link>
        <ChevronRight size={12} color="#ccc" />
        <Link href="/produkter" style={{ color: '#888', fontSize: 13, textDecoration: 'none' }}>Alla Produkter</Link>
        <ChevronRight size={12} color="#ccc" />
        <span style={{ color: '#111', fontSize: 13, fontWeight: 600 }}>{product.name}</span>
      </div>

      {/* Main product layout */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '40px 32px' }}>
        <div className="pd-grid">

          {/* Left — Image */}
          <div>
            <div style={{ background: '#f4f4f4', borderRadius: 8, aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, marginBottom: 16, overflow: 'hidden' }}>
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }} />
              ) : (
                <Package size={72} strokeWidth={1} color="#bbb" />
              )}
            </div>
            {/* Thumbnails */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[product.image_url, product.image_url].filter(Boolean).map((img: string, i: number) => (
                <div key={i} style={{ width: 80, height: 80, borderRadius: 6, border: i === 0 ? '2px solid #E8B84B' : '1px solid #e0e0e0', background: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', padding: 8 }}>
                  <img src={img} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Right — Info */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.1em', margin: '0 0 8px' }}>
              {product.brand || 'ProLuxShine'}
            </p>
            <h1 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: '#111', margin: '0 0 10px', lineHeight: 1.15 }}>
              {product.name}
            </h1>

            <p style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>Exkl. moms · Exkl. frakt</p>

            <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7, marginBottom: 28, maxWidth: 440 }}>
              {product.description || `${product.name} är ett professionellt rengöringsmedel för bilvård. Formulerat för att ge optimalt resultat med minimal ansträngning.`}
            </p>

            {/* Price */}
            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: '#111' }}>{fmt(custPrice)} kr</span>
              {discount > 0 && (
                <span style={{ fontSize: 16, color: '#aaa', textDecoration: 'line-through', marginLeft: 12 }}>{fmt(product.list_price)} kr</span>
              )}
            </div>

            {/* Qty + Add to cart */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 42, height: 52, border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
                  <Minus size={16} />
                </button>
                <span style={{ width: 48, textAlign: 'center', fontSize: 16, fontWeight: 600, color: '#111' }}>{qty}</span>
                <button onClick={() => setQty(q => q + 1)} style={{ width: 42, height: 52, border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
                  <Plus size={16} />
                </button>
              </div>
              <button
                onClick={addToCart}
                style={{ flex: 1, height: 52, background: added ? '#4CAF7D' : '#E8B84B', color: '#0F1115', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, letterSpacing: '.04em', textTransform: 'uppercase', transition: 'background .2s' }}
              >
                <ShoppingCart size={18} />
                {added ? 'Tillagd!' : 'Lägg i varukorg'}
              </button>
            </div>

            {/* Trust badges */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { icon: Truck, text: 'Fri frakt över 2 000 kr' },
                { icon: ShieldCheck, text: 'Betala mot faktura' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666' }}>
                  <Icon size={14} color="#888" />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ marginTop: 56, borderBottom: '1px solid #e8e8e8', display: 'flex', gap: 32 }}>
          {([['beskrivning', 'Beskrivning'], ['specifikationer', 'Specifikationer']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{ paddingBottom: 14, fontSize: 15, fontWeight: activeTab === key ? 700 : 400, color: activeTab === key ? '#111' : '#888', background: 'none', border: 'none', borderBottom: activeTab === key ? '2px solid #111' : '2px solid transparent', cursor: 'pointer', marginBottom: -1 }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: '32px 0 48px', maxWidth: 600 }}>
          {activeTab === 'beskrivning' && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 12 }}>
                Professionell bilvårdskvalitet
              </h3>
              <p style={{ fontSize: 14, color: '#444', lineHeight: 1.8, marginBottom: 20 }}>
                {product.name} är ett av ProLuxShines mest populära produkter. Det är speciellt framtaget för att hantera de tuffaste utmaningarna inom bilvård. Produkten arbetar snabbt och effektivt utan att skada lacken eller andra känsliga ytor. Perfekt för verkstäder, bilvårdsföretag och entusiaster som vill ha ett professionellt resultat.
              </p>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 10 }}>Användningsområden:</h4>
              <ol style={{ paddingLeft: 20, color: '#444', fontSize: 14, lineHeight: 2 }}>
                <li>Appliceras på den smutsiga ytan.</li>
                <li>Låt verka i 2–5 minuter beroende på smutsnivå.</li>
                <li>Skölj av med högtryckstvättat eller vatten.</li>
                <li>Vid behov, upprepa behandlingen på extra svåra fläckar.</li>
              </ol>
            </div>
          )}
          {activeTab === 'specifikationer' && (
            <div>
              {[
                ['Varumärke', product.brand || 'ProLuxShine'],
                ['Enhet', product.unit || '1 st'],
                ['Kategori', 'Bilvård'],
                ['Förpackning', 'Flaska / Dunk'],
                ['pH-värde', '6–8 (neutralt)'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 24, padding: '12px 0', borderBottom: '1px solid #f0f0f0', fontSize: 14 }}>
                  <span style={{ color: '#888', minWidth: 140 }}>{k}</span>
                  <span style={{ color: '#111', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>Kunder köpte även</h2>
              <Link href="/produkter" style={{ fontSize: 14, color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                Visa alla produkter <ChevronRight size={14} />
              </Link>
            </div>
            <div className="rel-grid">
              {related.map(p => {
                const rPrice = Math.round(p.list_price * (1 - discount))
                return (
                  <div key={p.id} style={{ border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                    <Link href={`/produkter/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ background: '#f4f4f4', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
                        ) : <Package size={40} strokeWidth={1} color="#bbb" />}
                      </div>
                    </Link>
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.08em', margin: 0 }}>{p.brand || 'ProLuxShine'}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#4CAF7D', background: '#e8f5ee', padding: '2px 8px', borderRadius: 20 }}>I lager</span>
                      </div>
                      <Link href={`/produkter/${p.id}`} style={{ textDecoration: 'none' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#111', margin: '4px 0 12px', lineHeight: 1.3 }}>{p.name}</p>
                      </Link>
                      <button
                        onClick={() => { cart.addItem({ id: p.id, name: p.name, brand: p.brand, list_price: p.list_price, image_url: p.image_url, unit: p.unit }, priceList) }}
                        style={{ width: '100%', padding: '8px 0', background: '#E8B84B', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#0F1115', letterSpacing: '.04em', textTransform: 'uppercase' }}
                      >
                        KÖP NU
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProductDetailPage() {
  return (
    <PublicShell>
      <ProductDetailContent />
    </PublicShell>
  )
}
