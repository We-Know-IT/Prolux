'use client'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const INPUT_STYLE: React.CSSProperties = { width: '100%', padding: '10px 13px', background: '#fff', border: '1.5px solid rgba(0,0,0,.1)', borderRadius: 8, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const LABEL_STYLE: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }
const EMPTY_LEAD = { name: '', company: '', email: '', phone: '', message: '', website: '' }

// "Intresserad av B2B-avtal?" — lands in the CRM as a prospect, a Prospekt
// deal and a note on the customer card (submit_b2b_lead, migration 0015).
export default function B2BLeadForm() {
  const [lead, setLead] = useState(EMPTY_LEAD)
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  const set = (k: keyof typeof EMPTY_LEAD) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setLead(l => ({ ...l, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!lead.name.trim() || !lead.company.trim() || !lead.email.trim()) { setError('Fyll i namn, företag och e-post'); return }
    setState('sending'); setError('')
    const { error } = await createClient().rpc('submit_b2b_lead', { p_lead: lead })
    if (error) { setError(error.message || 'Förfrågan kunde inte skickas. Försök igen.'); setState('idle'); return }
    setState('sent'); setLead(EMPTY_LEAD)
  }

  if (state === 'sent') return (
    <div role="status" style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', textAlign: 'center', border: '1.5px solid rgba(76,175,125,.35)' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(76,175,125,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <Check size={22} color="#2E8B57" strokeWidth={2.5} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 6 }}>Tack för din förfrågan!</div>
      <p style={{ fontSize: 14, color: '#666', margin: '0 0 16px', lineHeight: 1.6 }}>En säljare kontaktar dig inom en arbetsdag.</p>
      <button type="button" onClick={() => setState('idle')} style={{ background: 'none', border: 'none', color: '#8A6510', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Skicka en till</button>
    </div>
  )

  return (
    <form onSubmit={submit} noValidate>
      {([
        { key: 'name',    label: 'Ditt namn', placeholder: 'Anna Lindberg',   type: 'text',  auto: 'name' },
        { key: 'company', label: 'Företag',   placeholder: 'Bilverkstad AB',  type: 'text',  auto: 'organization' },
        { key: 'email',   label: 'E-post',    placeholder: 'anna@foretag.se', type: 'email', auto: 'email' },
        { key: 'phone',   label: 'Telefon',   placeholder: '070-123 45 67',   type: 'tel',   auto: 'tel' },
      ] as const).map(f => (
        <div key={f.key} style={{ marginBottom: 14 }}>
          <label htmlFor={`lead-${f.key}`} style={LABEL_STYLE}>{f.label}{f.key !== 'phone' && ' *'}</label>
          <input id={`lead-${f.key}`} type={f.type} autoComplete={f.auto} placeholder={f.placeholder} value={lead[f.key]} onChange={set(f.key)}
            required={f.key !== 'phone'} maxLength={f.key === 'company' ? 160 : 120} style={INPUT_STYLE} />
        </div>
      ))}
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="lead-message" style={LABEL_STYLE}>Meddelande</label>
        <textarea id="lead-message" placeholder="Berätta kort om ditt företag och era behov..." rows={3} maxLength={2000} value={lead.message} onChange={set('message')} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
      </div>
      {/* Honeypot: hidden from people, bots fill it in. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}>
        <label>Webbplats <input tabIndex={-1} autoComplete="off" value={lead.website} onChange={set('website')} /></label>
      </div>
      {error && <p role="alert" style={{ margin: '0 0 14px', fontSize: 13, color: '#C0392B', fontWeight: 600 }}>{error}</p>}
      <button type="submit" disabled={state === 'sending'} style={{ width: '100%', padding: '13px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: state === 'sending' ? 'wait' : 'pointer', opacity: state === 'sending' ? .7 : 1, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {state === 'sending' ? 'Skickar…' : 'Skicka förfrågan'}
      </button>
    </form>
  )
}
