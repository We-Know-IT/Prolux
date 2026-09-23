'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Save, Upload, Loader, Plus, Trash2 } from 'lucide-react'
import { getSiteContent, saveSiteContent, DEFAULT_HOME, HomeContent } from '@/lib/site-content'

function label(s: string) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 6 }}>{s}</label>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'var(--bg3)',
  border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)',
  fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

function ImageUploadField({ value, onChange, bucket }: { value: string; onChange: (url: string) => void; bucket: string }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setUploading(true)
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await sb.storage.from(bucket).upload(filename, file, { upsert: false })
    if (!error) {
      const { data } = sb.storage.from(bucket).getPublicUrl(filename)
      onChange(data.publicUrl)
    }
    setUploading(false)
  }

  return (
    <div>
      {label('Bild')}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {value && <img src={value} alt="" style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
        <input style={{ ...inputStyle, flex: 1 }} value={value} onChange={e => onChange(e.target.value)} placeholder="https://..." />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
          {uploading ? <Loader size={14} className="spin" /> : <Upload size={14} />} Ladda upp
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
    </div>
  )
}

export default function AdminContentHem() {
  const [form, setForm] = useState<HomeContent>(DEFAULT_HOME)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    getSiteContent('home', DEFAULT_HOME).then(c => { setForm(c); setLoading(false) })
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function save() {
    setSaving(true)
    const { error } = await saveSiteContent('home', form)
    setSaving(false)
    showToast(error ? 'Kunde inte spara: ' + error.message : 'Sparat — publicerat på webbshopen')
  }

  function updateHero(i: number, field: keyof HomeContent['hero'][0], value: string) {
    setForm(f => ({ ...f, hero: f.hero.map((h, idx) => idx === i ? { ...h, [field]: value } : h) }))
  }
  function updateCategory(i: number, field: 'name' | 'img', value: string) {
    setForm(f => ({ ...f, categories: f.categories.map((c, idx) => idx === i ? { ...c, [field]: value } : c) }))
  }
  function addCategory() {
    setForm(f => ({ ...f, categories: [...f.categories, { name: '', img: '' }] }))
  }
  function removeCategory(i: number) {
    setForm(f => ({ ...f, categories: f.categories.filter((_, idx) => idx !== i) }))
  }

  const sectionCard: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '22px 24px', marginBottom: 20 }

  return (
    <div style={{ padding: 32, maxWidth: 760 }}>
      <Link href="/admin/content" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', textDecoration: 'none', marginBottom: 16 }}>
        <ChevronLeft size={14} /> Innehåll
      </Link>
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Startsidan</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, margin: '4px 0 0' }}>Hero-slider och kategorikort på www.proluxshine.com</p>
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
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Hero-slider (3 bilder)</h2>
          {form.hero.map((slide, i) => (
            <div key={i} style={sectionCard}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 14 }}>Bild {i + 1}</div>
              <div style={{ display: 'grid', gap: 14 }}>
                <ImageUploadField value={slide.image_url} onChange={v => updateHero(i, 'image_url', v)} bucket="hero-images" />
                <div>
                  {label('Etikett (liten text ovanför rubriken)')}
                  <input style={inputStyle} value={slide.label} onChange={e => updateHero(i, 'label', e.target.value)} />
                </div>
                <div>
                  {label('Rubrik (radbryt med Enter)')}
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={slide.heading} onChange={e => updateHero(i, 'heading', e.target.value)} />
                </div>
                <div>
                  {label('Brödtext')}
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={slide.sub} onChange={e => updateHero(i, 'sub', e.target.value)} />
                </div>
              </div>
            </div>
          ))}

          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 28, marginBottom: 12 }}>Kategorikort</h2>
          {form.categories.map((cat, i) => (
            <div key={i} style={sectionCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>Kategori {i + 1}</div>
                <button onClick={() => removeCategory(i)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <Trash2 size={13} /> Ta bort
                </button>
              </div>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  {label('Namn')}
                  <input style={inputStyle} value={cat.name} onChange={e => updateCategory(i, 'name', e.target.value)} />
                </div>
                <ImageUploadField value={cat.img} onChange={v => updateCategory(i, 'img', v)} bucket="category-images" />
              </div>
            </div>
          ))}
          <button onClick={addCategory} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 7, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
            <Plus size={14} /> Lägg till kategori
          </button>
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
