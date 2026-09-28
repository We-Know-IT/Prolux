'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useIsEditingSite } from '@/components/site-edit/SiteEdit'
import { PRODUCT_BADGE, PRODUCT_BRANDS, PRODUCT_UNITS } from '@/lib/product-badge'
import { Plus, X, ImageUp, Package } from 'lucide-react'

const EMPTY = { name: '', sku: '', brand: 'Frescura', category_id: '', list_price: '', unit: 'st', stock_qty: '', badge: '', description: '', image_url: '' }

// "+ Lägg till produkt" card in the webshop's product grids, shown to admins
// in "Redigera sida". Creates the product the same way Admin > Produkter does.
export default function AddProductCard({ onCreated, minHeight = 320 }: { onCreated: (p: any) => void; minHeight?: number }) {
  const editing = useIsEditingSite()
  const [open, setOpen] = useState(false)
  if (!editing) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        style={{ minHeight, width: '100%', height: '100%', borderRadius: 12, border: '2px dashed rgba(166,124,18,.55)', background: 'rgba(255,255,255,.6)',
          color: '#6B4E0B', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
        <Plus size={28} /> Lägg till produkt
      </button>
      {open && <ProductForm onClose={() => setOpen(false)} onCreated={p => { onCreated(p); setOpen(false) }} />}
    </>
  )
}

function ProductForm({ onClose, onCreated }: { onClose: () => void; onCreated: (p: any) => void }) {
  const [form, setForm] = useState(EMPTY)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const sb = createClient()

  useEffect(() => {
    sb.from('categories').select('id,name').order('name').then(({ data }) => setCategories(data || []))
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function upload(f: File) {
    setUploading(true); setError('')
    const name = `${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: err } = await sb.storage.from('product-images').upload(name, f, { upsert: false })
    setUploading(false)
    if (err) { setError('Bilden kunde inte laddas upp'); return }
    setForm(x => ({ ...x, image_url: sb.storage.from('product-images').getPublicUrl(name).data.publicUrl }))
  }

  async function save() {
    if (!form.name.trim() || !form.sku.trim()) { setError('Namn och artikelnummer krävs'); return }
    if (!(parseFloat(form.list_price) > 0)) { setError('Ange ett pris'); return }
    setSaving(true); setError('')
    const { data: last } = await sb.from('products').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
    const { data, error: err } = await sb.from('products').insert({
      name: form.name.trim(), sku: form.sku.trim().toUpperCase(), brand: form.brand,
      category_id: form.category_id || null, description: form.description.trim() || null,
      list_price: parseFloat(form.list_price), unit: form.unit, stock_qty: parseInt(form.stock_qty) || 0,
      badge: form.badge || null, image_url: form.image_url || null, active: true,
      sort_order: (last?.sort_order ?? 0) + 1,
    }).select('*').single()
    setSaving(false)
    if (err || !data) { setError(err?.message.includes('duplicate') ? 'Artikelnumret finns redan' : 'Kunde inte spara produkten'); return }
    onCreated(data)
  }

  const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid rgba(0,0,0,.12)', borderRadius: 8, fontSize: 14, color: '#111', background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Ny produkt" onClick={e => e.stopPropagation()}
        style={{ background: '#fff', color: '#111', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '94vh', overflowY: 'auto', padding: '22px 24px', boxShadow: '0 24px 70px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Ny produkt</h2>
          <button onClick={onClose} aria-label="Stäng" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 4, display: 'flex' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 18, alignItems: 'start' }} className="apf-grid">
          <div>
            <button type="button" onClick={() => file.current?.click()} disabled={uploading}
              style={{ width: 140, height: 140, borderRadius: 10, border: '1.5px dashed rgba(0,0,0,.2)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 8 }}>
              {form.image_url
                ? <img src={form.image_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#666', fontSize: 12 }}>{uploading ? 'Laddar upp…' : <><ImageUp size={22} /> Välj bild</>}</span>}
            </button>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div><label style={label} htmlFor="np-name">Namn *</label><input id="np-name" autoFocus value={form.name} onChange={set('name')} style={input} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={label} htmlFor="np-sku">Artikelnummer *</label><input id="np-sku" value={form.sku} onChange={set('sku')} style={input} /></div>
              <div><label style={label} htmlFor="np-price">Listpris exkl. moms *</label><input id="np-price" type="number" min={0} value={form.list_price} onChange={set('list_price')} style={input} /></div>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 14 }}>
          <div><label style={label} htmlFor="np-brand">Varumärke</label>
            <select id="np-brand" value={form.brand} onChange={set('brand')} style={input}>{PRODUCT_BRANDS.map(b => <option key={b}>{b}</option>)}</select></div>
          <div><label style={label} htmlFor="np-cat">Kategori</label>
            <select id="np-cat" value={form.category_id} onChange={set('category_id')} style={input}>
              <option value="">Välj…</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label style={label} htmlFor="np-unit">Enhet</label>
            <select id="np-unit" value={form.unit} onChange={set('unit')} style={input}>{PRODUCT_UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
          <div><label style={label} htmlFor="np-stock">Lagersaldo</label><input id="np-stock" type="number" min={0} value={form.stock_qty} onChange={set('stock_qty')} style={input} /></div>
          <div><label style={label} htmlFor="np-badge">Etikett</label>
            <select id="np-badge" value={form.badge} onChange={set('badge')} style={input}>
              <option value="">Ingen</option>{Object.entries(PRODUCT_BADGE).map(([k, b]) => <option key={k} value={k}>{b.label}</option>)}
            </select></div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={label} htmlFor="np-desc">Beskrivning</label>
          <textarea id="np-desc" rows={4} value={form.description} onChange={set('description')} style={{ ...input, resize: 'vertical' }} />
        </div>
        {error && <div role="alert" style={{ marginTop: 12, fontSize: 13, color: '#A93226' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '11px 18px', borderRadius: 9, border: '1.5px solid rgba(0,0,0,.15)', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Avbryt</button>
          <button onClick={save} disabled={saving || uploading}
            style={{ padding: '11px 22px', borderRadius: 9, border: 'none', background: '#111', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={15} /> {saving ? 'Sparar…' : 'Lägg till produkten'}
          </button>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 12, color: '#666' }}>Produkten publiceras direkt. Den kan ändras eller döljas under Produkter i admin.</p>
        <style>{`@media (max-width: 520px) { .apf-grid { grid-template-columns: 1fr !important; } }`}</style>
      </div>
    </div>
  )
}
