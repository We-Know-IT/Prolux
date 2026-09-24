'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Save, Plus, Trash2 } from 'lucide-react'
import { getSiteContent, saveSiteContent, DEFAULT_GUIDES, GuidesContent, GuideItem, TAG_COLORS } from '@/lib/site-content'
import { FEATURE_ICONS, featureIconKey } from '@/lib/feature-icons'

function label(s: string) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 6 }}>{s}</label>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'var(--bg3)',
  border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)',
  fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

function newGuide(): GuideItem {
  return { id: Date.now().toString(36), title: '', category: '', desc: '', emoji: 'sparkles', readTime: '5 min', tag: 'Tips' }
}

export default function AdminContentGuider() {
  const [items, setItems] = useState<GuideItem[]>(DEFAULT_GUIDES.items)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    getSiteContent<GuidesContent>('guides', DEFAULT_GUIDES).then(c => { setItems(c.items); setLoading(false) })
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function save() {
    setSaving(true)
    const { error } = await saveSiteContent('guides', { items })
    setSaving(false)
    showToast(error ? 'Kunde inte spara: ' + error.message : 'Sparat — publicerat på webbshopen')
  }

  function update(i: number, field: keyof GuideItem, value: string) {
    setItems(list => list.map((g, idx) => idx === i ? { ...g, [field]: value } : g))
  }
  function addGuide() { setItems(list => [newGuide(), ...list]) }
  function removeGuide(i: number) { setItems(list => list.filter((_, idx) => idx !== i)) }

  return (
    <div style={{ padding: 'clamp(16px,4vw,32px)', maxWidth: 760 }}>
      <Link href="/admin/content" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', textDecoration: 'none', marginBottom: 16 }}>
        <ChevronLeft size={14} /> Innehåll
      </Link>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Guider</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, margin: '4px 0 0' }}>Artiklarna som visas på /guider</p>
        </div>
        <button onClick={save} disabled={saving || loading} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', background: 'var(--gold)', border: 'none',
          borderRadius: 7, color: '#111', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1, flexShrink: 0,
        }}>
          <Save size={15} /> {saving ? 'Sparar...' : 'Spara allt'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', padding: 40 }}>Laddar...</div>
      ) : (
        <>
          <button onClick={addGuide} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 7, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
            <Plus size={14} /> Ny guide
          </button>

          <div style={{ display: 'grid', gap: 16 }}>
            {items.map((g, i) => (
              <div key={g.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>{g.title || 'Ny guide'}</div>
                  <button onClick={() => removeGuide(i)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <Trash2 size={13} /> Ta bort
                  </button>
                </div>
                <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
                  <div>
                    {label('Titel')}
                    <input style={inputStyle} value={g.title} onChange={e => update(i, 'title', e.target.value)} />
                  </div>
                  <div>
                    {label('Kategori')}
                    <input style={inputStyle} value={g.category} onChange={e => update(i, 'category', e.target.value)} placeholder="Tvätt, Polering, Interiör..." />
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  {label('Beskrivning')}
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={g.desc} onChange={e => update(i, 'desc', e.target.value)} />
                </div>
                <div className="grid-3" style={{ gap: 14 }}>
                  <div>
                    {label('Ikon')}
                    <select style={inputStyle} value={featureIconKey(g.emoji) || ''} onChange={e => update(i, 'emoji', e.target.value)}>
                      {!featureIconKey(g.emoji) && <option value="">Välj ikon…</option>}
                      {Object.entries(FEATURE_ICONS).map(([key, { label: l }]) => <option key={key} value={key}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    {label('Lästid')}
                    <input style={inputStyle} value={g.readTime} onChange={e => update(i, 'readTime', e.target.value)} placeholder="5 min" />
                  </div>
                  <div>
                    {label('Nivå-tagg')}
                    <select style={inputStyle} value={g.tag} onChange={e => update(i, 'tag', e.target.value)}>
                      {Object.keys(TAG_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '12px 20px', fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
