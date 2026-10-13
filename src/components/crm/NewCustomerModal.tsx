'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Customer, PriceList } from '@/types'

// Price lists with their discount, shown wherever a list is picked.
export const PRICE_LIST_OPTIONS: { id: PriceList; label: string }[] = [
  { id: 'A', label: 'A · 40 %' },
  { id: 'B', label: 'B · 30 %' },
  { id: 'C', label: 'C · 20 %' },
  { id: 'Standard', label: 'Standard · 0 %' },
]

const EMPTY = { company: '', contact_name: '', email: '', phone: '', org_nr: '', address: '', postal_code: '', city: '', price_list_id: 'Standard' as PriceList, customer_type: 'business' as 'business' | 'private' }

// Quick "Ny kund" from the order form: saves the card and hands it back.
export default function NewCustomerModal({ accountManager, initialCompany = '', onCreated, onClose }: {
  accountManager?: string
  initialCompany?: string
  onCreated: (c: Customer) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({ ...EMPTY, company: initialCompany })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof EMPTY, v: string) => setForm(f => ({ ...f, [k]: v }))
  const priv = form.customer_type === 'private'

  async function save() {
    const company = priv ? (form.company.trim() || form.contact_name.trim()) : form.company.trim()
    if (!company) { setError(priv ? 'Ange namn.' : 'Ange företagsnamn.'); return }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) { setError('Ogiltig e-postadress.'); return }
    setSaving(true); setError('')
    const { data, error: err } = await createClient().from('customers').insert({
      company,
      contact_name: form.contact_name.trim() || (priv ? company : ''),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      org_nr: priv ? null : form.org_nr.trim() || null,
      address: form.address.trim() || null,
      postal_code: form.postal_code.trim() || null,
      city: form.city.trim() || null,
      price_list_id: form.price_list_id,
      customer_type: form.customer_type,
      account_manager: accountManager || null,
      status: 'active',
    }).select().single()
    setSaving(false)
    if (err || !data) { setError(err?.message || 'Kunde inte spara kunden.'); return }
    onCreated(data as Customer)
  }

  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }
  const field = (k: keyof typeof EMPTY, text: string, type = 'text', auto?: string) => (
    <div>
      <label style={label} htmlFor={`nc-${k}`}>{text}</label>
      <input id={`nc-${k}`} type={type} autoComplete={auto} value={form[k]} onChange={e => set(k, e.target.value)} style={input} />
    </div>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Ny kund" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>Ny kund</h2>
          <button onClick={onClose} aria-label="Stäng" style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', padding: 6, display: 'flex' }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {([['business', 'Företag'], ['private', 'Privatperson']] as const).map(([t, l]) => (
            <button key={t} type="button" onClick={() => set('customer_type', t)} aria-pressed={form.customer_type === t}
              style={{ flex: 1, padding: '9px 4px', background: form.customer_type === t ? 'rgba(74,143,212,.12)' : 'var(--bg3)', border: `1px solid ${form.customer_type === t ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 8, color: form.customer_type === t ? 'var(--text)' : 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {!priv && field('company', 'Företag *', 'text', 'organization')}
          {field('contact_name', priv ? 'Namn *' : 'Kontaktperson', 'text', 'name')}
          {field('email', 'E-post', 'email', 'email')}
          {field('phone', 'Telefon', 'tel', 'tel')}
          {!priv && field('org_nr', 'Org.nr')}
          {field('address', 'Adress', 'text', 'street-address')}
          {field('postal_code', 'Postnummer', 'text', 'postal-code')}
          {field('city', 'Ort', 'text', 'address-level2')}
        </div>

        <div style={{ marginTop: 16 }}>
          <span style={label}>Prislista</span>
          <PriceListPicker value={form.price_list_id} onChange={v => set('price_list_id', v)} />
        </div>

        {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--red)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}>Avbryt</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: 12, background: 'var(--gold)', border: 'none', borderRadius: 9, color: '#111', fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? .7 : 1 }}>
            {saving ? 'Sparar…' : 'Spara och välj kunden'}
          </button>
        </div>
      </div>
    </div>
  )
}

// A / B / C / Standard with the discount written out.
export function PriceListPicker({ value, onChange }: { value: string; onChange: (v: PriceList) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
      {PRICE_LIST_OPTIONS.map(({ id, label }) => {
        const on = value === id
        return (
          <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={on}
            style={{ padding: '9px 4px', background: on ? 'rgba(232,184,75,.1)' : 'var(--bg3)', border: `1px solid ${on ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 8, color: on ? 'var(--gold)' : 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', lineHeight: 1.3 }}>
            {label.split(' · ')[0]}
            <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: on ? 'var(--gold)' : 'var(--text2)' }}>{label.split(' · ')[1]} rabatt</span>
          </button>
        )
      })}
    </div>
  )
}
