'use client'
export const dynamic = 'force-dynamic'

import { PublicShell } from '@/components/layout/PublicShell'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSiteContent, DEFAULT_GUIDES, GuidesContent, GuideItem, TAG_COLORS } from '@/lib/site-content'
import { SearchX } from 'lucide-react'
import { featureIcon } from '@/lib/feature-icons'

function guideBg(tag: string) {
  const color = TAG_COLORS[tag] || TAG_COLORS.Tips
  return `linear-gradient(135deg, #0a0c10 0%, ${color}22 60%, #0a0c10 100%)`
}

export default function GuiderPage() {
  const [guides, setGuides] = useState<GuideItem[]>(DEFAULT_GUIDES.items)
  const [activeCategory, setActiveCategory] = useState('Alla')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getSiteContent<GuidesContent>('guides', DEFAULT_GUIDES).then(c => setGuides(c.items))
  }, [])

  const categories = ['Alla', ...Array.from(new Set(guides.map(g => g.category).filter(Boolean)))]

  const filtered = guides.filter(g => {
    const matchCat = activeCategory === 'Alla' || g.category === activeCategory
    const matchSearch = !search || g.title.toLowerCase().includes(search.toLowerCase()) || g.desc.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <PublicShell>
      <style>{`
        .guides-hero { background: #0D0F13; padding: 64px 0 48px; text-align: center; }
        .guides-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        @media (max-width: 1100px) { .guides-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 760px) { .guides-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 500px) { .guides-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Hero */}
      <div className="guides-hero">
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
          <p style={{ color: '#E8B84B', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
            Kunskap & Inspiration
          </p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: '#F0EDE8', marginBottom: 16, lineHeight: 1.15 }}>
            Guider & Tips
          </h1>
          <p style={{ color: '#9BA0AB', fontSize: 16, lineHeight: 1.7, marginBottom: 36 }}>
            Lär dig mer om bilvård med våra expertguider. Från nybörjare till avancerade tekniker.
          </p>
          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Sök guider..."
              style={{ width: '100%', background: '#1E2128', border: '1px solid #2A2F3A', borderRadius: 8, padding: '12px 48px 12px 16px', color: '#F0EDE8', fontSize: 15, boxSizing: 'border-box', outline: 'none' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9BA0AB', cursor: 'pointer', fontSize: 18 }}>×</button>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: '#0F1115', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 24px' }}>

          {/* Category filter */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 40 }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 20,
                  border: activeCategory === cat ? '1px solid #E8B84B' : '1px solid #2A2F3A',
                  background: activeCategory === cat ? '#E8B84B' : 'transparent',
                  color: activeCategory === cat ? '#0F1115' : '#9BA0AB',
                  fontSize: 13,
                  fontWeight: activeCategory === cat ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {cat}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', color: '#5C6270', fontSize: 13, alignSelf: 'center' }}>
              {filtered.length} guider
            </span>
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#5C6270' }}>
              <SearchX size={40} strokeWidth={1.5} style={{ display: 'block', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 16 }}>Inga guider matchade sökningen.</p>
            </div>
          ) : (
            <div className="guides-grid">
              {filtered.map(guide => (
                <article key={guide.id} style={{ background: '#161920', borderRadius: 12, overflow: 'hidden', border: '1px solid #1E2128', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                >
                  <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', background: guideBg(guide.tag), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(() => { const Icon = featureIcon(guide.emoji); return <Icon size={52} strokeWidth={1.25} color="rgba(255,255,255,.75)" /> })()}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)' }} />
                    <span style={{ position: 'absolute', top: 12, left: 12, background: TAG_COLORS[guide.tag] || TAG_COLORS.Tips, color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.05em' }}>
                      {guide.tag}
                    </span>
                    <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: '#9BA0AB', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>
                      {guide.readTime} läsning
                    </span>
                  </div>
                  <div style={{ padding: 20 }}>
                    <p style={{ color: '#E8B84B', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      {guide.category}
                    </p>
                    <h3 style={{ color: '#F0EDE8', fontSize: 16, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>
                      {guide.title}
                    </h3>
                    <p style={{ color: '#9BA0AB', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                      {guide.desc}
                    </p>
                    <Link href={`/guider/${guide.id}`} style={{ color: '#E8B84B', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      Läs guide →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* CTA */}
          <div style={{ marginTop: 80, background: '#161920', border: '1px solid #1E2128', borderRadius: 16, padding: '48px 40px', textAlign: 'center' }}>
            <p style={{ color: '#E8B84B', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>B2B-partner</p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: '#F0EDE8', marginBottom: 12 }}>
              Köp professionella produkter till grossistpris
            </h2>
            <p style={{ color: '#9BA0AB', fontSize: 15, marginBottom: 28, maxWidth: 480, margin: '0 auto 28px' }}>
              Registrera dig som B2B-kund och få tillgång till exklusiva priser.
            </p>
            <Link href="/produkter" style={{ display: 'inline-block', background: '#E8B84B', color: '#0F1115', padding: '14px 32px', borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
              Se alla produkter
            </Link>
          </div>

        </div>
      </div>
    </PublicShell>
  )
}
