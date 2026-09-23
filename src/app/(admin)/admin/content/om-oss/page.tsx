'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Save, Plus, Trash2, Upload, Loader } from 'lucide-react'
import { getSiteContent, saveSiteContent, DEFAULT_OM_OSS, OmOssContent } from '@/lib/site-content'

function label(s: string) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 6 }}>{s}</label>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'var(--bg3)',
  border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)',
  fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

const sectionCard: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '22px 24px', marginBottom: 20 }

function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 8 }}>
          <input style={inputStyle} value={item} placeholder={placeholder}
            onChange={e => onChange(items.map((it, idx) => idx === i ? e.target.value : it))} />
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', flexShrink: 0 }}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', width: 'fit-content' }}>
        <Plus size={13} /> Lägg till
      </button>
    </div>
  )
}

function ImageUploadField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setUploading(true)
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await sb.storage.from('om-oss-images').upload(filename, file, { upsert: false })
    if (!error) {
      const { data } = sb.storage.from('om-oss-images').getPublicUrl(filename)
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
          {uploading ? <Loader size={14} /> : <Upload size={14} />} Ladda upp
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
    </div>
  )
}

export default function AdminContentOmOss() {
  const [form, setForm] = useState<OmOssContent>(DEFAULT_OM_OSS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    getSiteContent('om_oss', DEFAULT_OM_OSS).then(c => { setForm(c); setLoading(false) })
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function save() {
    setSaving(true)
    const { error } = await saveSiteContent('om_oss', form)
    setSaving(false)
    showToast(error ? 'Kunde inte spara: ' + error.message : 'Sparat — publicerat på webbshopen')
  }

  function updateStat(i: number, field: 'value' | 'label' | 'sub', value: string) {
    setForm(f => ({ ...f, stats: f.stats.map((s, idx) => idx === i ? { ...s, [field]: value } : s) }))
  }
  function updateBrand(i: number, field: 'name' | 'tagline' | 'desc' | 'img', value: string) {
    setForm(f => ({ ...f, brands: f.brands.map((b, idx) => idx === i ? { ...b, [field]: value } : b) }))
  }
  function updateBrandItems(i: number, items: string[]) {
    setForm(f => ({ ...f, brands: f.brands.map((b, idx) => idx === i ? { ...b, items } : b) }))
  }

  return (
    <div style={{ padding: 32, maxWidth: 760 }}>
      <Link href="/admin/content" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', textDecoration: 'none', marginBottom: 16 }}>
        <ChevronLeft size={14} /> Innehåll
      </Link>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Om oss</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, margin: '4px 0 0' }}>Innehållet på /om-oss</p>
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
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Hero</h2>
          <div style={sectionCard}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                {label('Etikett')}
                <input style={inputStyle} value={form.hero.label} onChange={e => setForm(f => ({ ...f, hero: { ...f.hero, label: e.target.value } }))} />
              </div>
              <div>
                {label('Rubrik (radbryt med Enter)')}
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.hero.heading} onChange={e => setForm(f => ({ ...f, hero: { ...f.hero, heading: e.target.value } }))} />
              </div>
              <div>
                {label('Brödtext')}
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.hero.sub} onChange={e => setForm(f => ({ ...f, hero: { ...f.hero, sub: e.target.value } }))} />
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Vår historia</h2>
          <div style={sectionCard}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                {label('Rubrik (radbryt med Enter)')}
                <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={form.historia.heading} onChange={e => setForm(f => ({ ...f, historia: { ...f.historia, heading: e.target.value } }))} />
              </div>
              <div>
                {label('Brödtextstycken')}
                <ListEditor items={form.historia.paragraphs} onChange={paragraphs => setForm(f => ({ ...f, historia: { ...f.historia, paragraphs } }))} placeholder="Stycke..." />
              </div>
              <div>
                {label('Punktlista')}
                <ListEditor items={form.historia.punkter} onChange={punkter => setForm(f => ({ ...f, historia: { ...f.historia, punkter } }))} placeholder="Punkt..." />
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Statistik (4 rutor)</h2>
          <div style={sectionCard}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {form.stats.map((s, i) => (
                <div key={i} style={{ display: 'grid', gap: 8 }}>
                  <input style={inputStyle} value={s.value} onChange={e => updateStat(i, 'value', e.target.value)} placeholder="Värde, t.ex. 240+" />
                  <input style={inputStyle} value={s.label} onChange={e => updateStat(i, 'label', e.target.value)} placeholder="Etikett" />
                  <input style={inputStyle} value={s.sub} onChange={e => updateStat(i, 'sub', e.target.value)} placeholder="Underrubrik" />
                </div>
              ))}
            </div>
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Varumärken</h2>
          {form.brands.map((b, i) => (
            <div key={i} style={sectionCard}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 14 }}>{b.name || `Varumärke ${i + 1}`}</div>
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    {label('Namn')}
                    <input style={inputStyle} value={b.name} onChange={e => updateBrand(i, 'name', e.target.value)} />
                  </div>
                  <div>
                    {label('Slogan')}
                    <input style={inputStyle} value={b.tagline} onChange={e => updateBrand(i, 'tagline', e.target.value)} />
                  </div>
                </div>
                <div>
                  {label('Beskrivning')}
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={b.desc} onChange={e => updateBrand(i, 'desc', e.target.value)} />
                </div>
                <div>
                  {label('Produktpunkter')}
                  <ListEditor items={b.items} onChange={items => updateBrandItems(i, items)} placeholder="T.ex. Keramisk coating" />
                </div>
                <ImageUploadField value={b.img} onChange={v => updateBrand(i, 'img', v)} />
              </div>
            </div>
          ))}

          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Avslutande CTA</h2>
          <div style={sectionCard}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                {label('Rubrik')}
                <input style={inputStyle} value={form.cta.heading} onChange={e => setForm(f => ({ ...f, cta: { ...f.cta, heading: e.target.value } }))} />
              </div>
              <div>
                {label('Brödtext')}
                <input style={inputStyle} value={form.cta.sub} onChange={e => setForm(f => ({ ...f, cta: { ...f.cta, sub: e.target.value } }))} />
              </div>
            </div>
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
