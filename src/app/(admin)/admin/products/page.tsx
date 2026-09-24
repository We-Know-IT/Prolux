'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'
import { X, Pencil, Trash2, Plus, Package, Search, Upload, Loader } from 'lucide-react'
import { userRole } from '@/lib/roles'

const EMPTY_FORM = {
  name: '', sku: '', category_id: '', brand: 'Frescura', description: '',
  list_price: '', unit: '25 kg', stock_qty: '', active: true,
  badge: '', sort_order: '', image_url: '',
}

const BRANDS = ['Frescura', 'Virtus', 'ProLuxShine']
const UNITS  = ['25 kg', '10 kg', '5 kg', '1 kg', '1 L', '500 mL', '200 mL', '50 mL', 'st']
const BADGES = [{ value: '', label: 'Ingen' }, { value: 'top', label: 'Bestseller' }, { value: 'new', label: 'Nyhet' }, { value: 'sale', label: 'Rea' }]

function label(s: string) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 6 }}>{s}</label>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'var(--bg3)',
  border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)',
  fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

export default function AdminProducts() {
  const [products, setProducts]     = useState<any[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editId, setEditId]         = useState<string | null>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [canEdit, setCanEdit]       = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load(); checkUser() }, [])

  async function checkUser() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    setCanEdit(userRole(user) === 'admin')
  }

  async function load() {
    const sb = createClient()
    const [{ data: p }, { data: c }] = await Promise.all([
      sb.from('products').select('*').order('sort_order').order('name'),
      sb.from('categories').select('id,name').order('name'),
    ])
    setProducts(p || [])
    // dedupe categories by id
    const seen = new Set<string>()
    setCategories((c || []).filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return true }))
  }

  function openCreate() {
    setEditId(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  function openEdit(p: any) {
    setEditId(p.id)
    setForm({
      name: p.name || '', sku: p.sku || '', category_id: p.category_id || '',
      brand: p.brand || 'Frescura', description: p.description || '',
      list_price: String(p.list_price || ''), unit: p.unit || '25 kg',
      stock_qty: String(p.stock_qty ?? ''), active: p.active !== false,
      badge: p.badge || '', sort_order: String(p.sort_order ?? ''),
      image_url: p.image_url || '',
    })
    setShowModal(true)
  }

  async function uploadImage(file: File) {
    setImgUploading(true)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop()
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await sb.storage.from('product-images').upload(filename, file, { upsert: false })
      if (error) { showToast('Uppladdning misslyckades: ' + error.message); return }
      const { data } = sb.storage.from('product-images').getPublicUrl(filename)
      setForm(f => ({ ...f, image_url: data.publicUrl }))
      showToast('Bild uppladdad!')
    } finally {
      setImgUploading(false)
    }
  }

  async function save() {
    if (!form.name.trim() || !form.sku.trim()) { showToast('Namn och SKU krävs'); return }
    if (!form.brand.trim()) { showToast('Välj ett varumärke'); return }
    if (!form.unit.trim()) { showToast('Välj en enhet'); return }
    setSaving(true)
    const sb = createClient()
    const payload = {
      name: form.name.trim(), sku: form.sku.trim().toUpperCase(),
      category_id: form.category_id || null,
      brand: form.brand, description: form.description || null,
      list_price: parseFloat(form.list_price) || 0,
      unit: form.unit, stock_qty: parseInt(form.stock_qty) || 0,
      active: form.active,
      badge: form.badge || null,
      sort_order: parseInt(form.sort_order) || 0,
      image_url: form.image_url || null,
    }
    if (editId) {
      const { error } = await sb.from('products').update(payload).eq('id', editId)
      if (error) { showToast('Fel: ' + error.message); setSaving(false); return }
      showToast('Produkt uppdaterad')
    } else {
      const { error } = await sb.from('products').insert(payload)
      if (error) { showToast('Fel: ' + error.message); setSaving(false); return }
      showToast('Produkt skapad: ' + form.name)
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function deleteProduct(id: string) {
    const sb = createClient()
    await sb.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
    showToast('Produkt borttagen')
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const catName = (id: string) => categories.find(c => c.id === id)?.name || id || '—'

  const filtered = products.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || p.category_id === catFilter
    return matchSearch && matchCat
  })

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: 12, display: 'block' }}>Admin / Produkter</span>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 40, fontWeight: 500, color: 'var(--text)', lineHeight: 1.1 }}>Produktkatalog</div>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 6 }}>{products.filter(p => p.active).length} aktiva · {products.length} totalt</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={16} /> Ny produkt
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ padding: '16px 40px', display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid var(--line2)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök namn, SKU, varumärke…"
            style={{ ...inputStyle, paddingLeft: 32, background: 'var(--bg2)' }} />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ padding: '9px 14px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', fontSize: 13, outline: 'none' }}>
          <option value="">Alla kategorier</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>{filtered.length} produkter</span>
      </div>

      {/* Table */}
      <div style={{ padding: '0 40px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
          <thead>
            <tr>
              {['SKU', 'Produkt', 'Varumärke', 'Kategori', 'Listpris', 'Lager', 'Status', ''].map(h => (
                <th key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '14px 0 14px', textAlign: 'left', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', paddingRight: 16 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                <Package size={32} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
                Inga produkter hittades
              </td></tr>
            )}
            {filtered.map(p => {
              const stockColor = p.stock_qty === 0 ? 'var(--red)' : p.stock_qty < 10 ? 'var(--gold)' : 'var(--green)'
              return (
                <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
                  <td style={{ padding: '13px 0', paddingRight: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)', borderBottom: '1px solid var(--line2)', whiteSpace: 'nowrap' }}>{p.sku}</td>
                  <td style={{ padding: '13px 0', paddingRight: 16, borderBottom: '1px solid var(--line2)', minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 7, background: 'var(--bg3)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {p.image_url
                          ? <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                          : <Package size={15} color="var(--text3)" />
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p.name}
                          {p.badge && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: p.badge === 'top' ? 'rgba(232,184,75,.15)' : p.badge === 'new' ? 'rgba(76,175,125,.15)' : 'rgba(74,143,212,.15)', color: p.badge === 'top' ? 'var(--gold)' : p.badge === 'new' ? 'var(--green)' : 'var(--blue)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{p.badge === 'top' ? 'Bestseller' : p.badge === 'new' ? 'Nyhet' : p.badge}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.unit}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 0', paddingRight: 16, fontSize: 12, color: 'var(--text2)', borderBottom: '1px solid var(--line2)' }}>{p.brand}</td>
                  <td style={{ padding: '13px 0', paddingRight: 16, fontSize: 12, color: 'var(--text2)', borderBottom: '1px solid var(--line2)' }}>{catName(p.category_id)}</td>
                  <td style={{ padding: '13px 0', paddingRight: 16, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gold)', borderBottom: '1px solid var(--line2)', whiteSpace: 'nowrap' }}>{fmt(p.list_price)} kr</td>
                  <td style={{ padding: '13px 0', paddingRight: 16, borderBottom: '1px solid var(--line2)', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: stockColor }}>{p.stock_qty} st</span>
                  </td>
                  <td style={{ padding: '13px 0', paddingRight: 16, borderBottom: '1px solid var(--line2)' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 4, background: p.active ? 'rgba(76,175,125,.12)' : 'rgba(255,255,255,.05)', color: p.active ? 'var(--green)' : 'var(--text3)' }}>
                      {p.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td style={{ padding: '13px 0', borderBottom: '1px solid var(--line2)' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {canEdit && (<>
                        <button onClick={() => openEdit(p)} style={{ width: 30, height: 30, border: '1px solid var(--line)', borderRadius: 6, background: 'transparent', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setConfirmDelete(p.id)} style={{ width: 30, height: 30, border: '1px solid rgba(224,82,82,.2)', borderRadius: 6, background: 'transparent', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Trash2 size={13} />
                        </button>
                      </>)}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: 20 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, width: '100%', maxWidth: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>{editId ? 'Redigera produkt' : 'Ny produkt'}</div>
              <button onClick={() => setShowModal(false)} style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg3)', border: 'none', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              {/* Namn — full width */}
              <div style={{ gridColumn: '1/-1' }}>
                {label('Produktnamn *')}
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Rapidet 25 kg" style={inputStyle} />
              </div>

              {/* SKU */}
              <div>
                {label('SKU *')}
                <input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
                  placeholder="FRE-RAP-25" style={inputStyle} />
              </div>

              {/* Varumärke */}
              <div>
                {label('Varumärke *')}
                <select value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} style={inputStyle}>
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {/* Kategori */}
              <div>
                {label('Kategori')}
                <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))} style={inputStyle}>
                  <option value="">Välj kategori…</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Enhet */}
              <div>
                {label('Enhet *')}
                <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={inputStyle}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              {/* Listpris */}
              <div>
                {label('Listpris (kr) *')}
                <input type="number" value={form.list_price} onChange={e => setForm(p => ({ ...p, list_price: e.target.value }))}
                  placeholder="998" style={inputStyle} />
              </div>

              {/* Lagersaldo */}
              <div>
                {label('Lagersaldo')}
                <input type="number" value={form.stock_qty} onChange={e => setForm(p => ({ ...p, stock_qty: e.target.value }))}
                  placeholder="0" style={inputStyle} />
              </div>

              {/* Badge */}
              <div>
                {label('Badge / etikett')}
                <select value={form.badge} onChange={e => setForm(p => ({ ...p, badge: e.target.value }))} style={inputStyle}>
                  {BADGES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>

              {/* Sortering */}
              <div>
                {label('Sorteringsordning')}
                <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                  placeholder="0" style={inputStyle} />
              </div>

              {/* Bild-upload */}
              <div style={{ gridColumn: '1/-1' }}>
                {label('Produktbild')}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f) }}
                />
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Förhandsvisning */}
                  <div
                    onClick={() => !imgUploading && fileInputRef.current?.click()}
                    style={{
                      width: 96, height: 96, borderRadius: 10, overflow: 'hidden',
                      border: '2px dashed var(--line)', background: 'var(--bg3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: imgUploading ? 'wait' : 'pointer', flexShrink: 0,
                      position: 'relative',
                    }}
                  >
                    {imgUploading ? (
                      <Loader size={22} color="var(--text3)" style={{ animation: 'spin 1s linear infinite' }} />
                    ) : form.image_url ? (
                      <img src={form.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <Upload size={22} color="var(--text3)" />
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Klicka</div>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={imgUploading}
                      style={{ padding: '9px 16px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 7, color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}
                    >
                      <Upload size={14} /> {imgUploading ? 'Laddar upp…' : 'Välj bild'}
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                      JPG, PNG eller WebP · Max 5 MB<br />
                      Eller klistra in URL nedan
                    </div>
                    <input
                      value={form.image_url}
                      onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))}
                      placeholder="https://…"
                      style={{ ...inputStyle, marginTop: 8, fontSize: 12 }}
                    />
                  </div>
                </div>
              </div>

              {/* Beskrivning */}
              <div style={{ gridColumn: '1/-1' }}>
                {label('Beskrivning')}
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Kort produktbeskrivning för webshopen…" rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} />
              </div>

              {/* Aktiv toggle */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <div onClick={() => setForm(p => ({ ...p, active: !p.active }))}
                    style={{ width: 42, height: 24, borderRadius: 12, background: form.active ? 'var(--gold)' : 'var(--bg4)', border: `1px solid ${form.active ? 'var(--gold)' : 'var(--line)'}`, position: 'relative', transition: 'all .2s', cursor: 'pointer', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: '#fff', top: 3, left: form.active ? 22 : 3, transition: 'left .2s' }} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                    {form.active ? 'Aktiv — visas i webshop och CRM' : 'Inaktiv — dold för kunder'}
                  </span>
                </label>
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Avbryt</button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 22px', background: 'var(--gold)', border: 'none', borderRadius: 6, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Sparar…' : editId ? 'Spara ändringar' : 'Skapa produkt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '28px 32px', maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>Ta bort produkt?</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>Denna åtgärd kan inte ångras. Produkten tas bort permanent.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Avbryt</button>
              <button onClick={() => deleteProduct(confirmDelete)} style={{ padding: '9px 18px', background: 'var(--red)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Ta bort</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', padding: '12px 20px', fontSize: 13, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
          {toast}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
