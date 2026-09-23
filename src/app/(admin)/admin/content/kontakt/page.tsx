'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Save } from 'lucide-react'
import { getSiteContent, saveSiteContent, DEFAULT_CONTACT, ContactContent } from '@/lib/site-content'

function label(s: string) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 6 }}>{s}</label>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'var(--bg3)',
  border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)',
  fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

export default function AdminContentKontakt() {
  const [form, setForm] = useState<ContactContent>(DEFAULT_CONTACT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    getSiteContent('contact', DEFAULT_CONTACT).then(c => { setForm(c); setLoading(false) })
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function save() {
    setSaving(true)
    const { error } = await saveSiteContent('contact', form)
    setSaving(false)
    showToast(error ? 'Kunde inte spara: ' + error.message : 'Sparat — publicerat på webbshopen')
  }

  return (
    <div style={{ padding: 'clamp(16px,4vw,32px)', maxWidth: 640 }}>
      <Link href="/admin/content" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', textDecoration: 'none', marginBottom: 16 }}>
        <ChevronLeft size={14} /> Innehåll
      </Link>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Kontaktuppgifter</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, margin: '4px 0 0' }}>Visas i footern på alla sidor och på Om oss-sidan.</p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', padding: 40 }}>Laddar...</div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            {label('Telefon')}
            <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+46 (0)8 123 456 78" />
          </div>
          <div>
            {label('E-post')}
            <input style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="info@proluxshine.com" />
          </div>
          <div>
            {label('Adress')}
            <input style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Stockholm, Sverige" />
          </div>
          <div>
            {label('Öppettider')}
            <input style={inputStyle} value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder="Mån–fre 08–17" />
          </div>
          <button onClick={save} disabled={saving} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8,
            padding: '12px 20px', background: 'var(--gold)', border: 'none', borderRadius: 7, color: '#111',
            fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1,
          }}>
            <Save size={15} /> {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '12px 20px', fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
