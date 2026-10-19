'use client'
// "Skapa lead" on the customer card: something to follow up from a visit or a
// call, e.g. the customer wants to change washing system. Saved as a deal in
// the Prospekt stage for the customer's salesperson, so it shows on their
// overview, in the pipeline and in the admin's Leads list.
import { useEffect, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTeam, teamOptions } from '@/hooks/useTeam'

export interface EditableLead {
  id: string; title: string; notes?: string | null; product_id?: string | null
  assigned_to?: string | null; stage: string; value?: number | null
}
interface Props {
  customer: { id: string; company: string; account_manager?: string | null }
  me: string
  lead?: EditableLead          // edit this lead instead of creating one
  onCreated?: () => void
  onClose: () => void
}
const STAGES = ['Prospekt', 'Kontaktad', 'Offert', 'Förhandling', 'Vunnen', 'Förlorad']

export default function CreateLeadModal({ customer, me, lead, onCreated, onClose }: Props) {
  const team = useTeam()
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [productId, setProductId] = useState(lead?.product_id || '')
  const [title, setTitle] = useState(lead?.title || '')
  const [notes, setNotes] = useState(lead?.notes || '')
  const [value, setValue] = useState(lead?.value ? String(lead.value) : '')
  const [followUp, setFollowUp] = useState('')
  const [seller, setSeller] = useState(lead ? lead.assigned_to || '' : customer.account_manager || me)
  const [stage, setStage] = useState(lead?.stage || 'Prospekt')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    createClient().from('products').select('id,name').eq('active', true).order('name').then(({ data }) => setProducts(data ?? []))
  }, [])

  async function save() {
    if (!title.trim()) { setError('Skriv vad samtalet gällde.'); return }
    setBusy(true); setError('')
    const sb = createClient()
    const product = products.find(p => p.id === productId)
    const amount = Math.max(0, Math.round(Number(value.replace(/\s/g, '').replace(',', '.')) || 0))
    if (lead) {
      const edit = { title: title.trim(), stage, value: amount, assigned_to: seller || null, notes: notes.trim() || null, updated_at: new Date().toISOString() }
      let { error: e1 } = await sb.from('deals').update({ ...edit, product_id: productId || null }).eq('id', lead.id)
      if (e1 && e1.message.includes('product_id')) ({ error: e1 } = await sb.from('deals').update(edit).eq('id', lead.id))
      setBusy(false)
      if (e1) { setError(`Kunde inte spara: ${e1.message}`); return }
      onCreated?.(); onClose(); return
    }
    const fields = {
      title: title.trim(),
      customer_id: customer.id,
      stage: 'Prospekt',
      value: amount,
      assigned_to: seller || null,
      notes: [product ? `Produkt: ${product.name}` : '', notes.trim(), `Skapad av ${me || 'säljare'}`].filter(Boolean).join('\n'),
      source: 'visit',
    }
    let { data, error: err } = await sb.from('deals').insert({ ...fields, ...(productId ? { product_id: productId } : {}) }).select('id').single()
    // Before migration 0024 there is no product column: save without it.
    if (err && productId && err.message.includes('product_id')) ({ data, error: err } = await sb.from('deals').insert(fields).select('id').single())
    if (err || !data) { setBusy(false); setError(`Kunde inte spara: ${err?.message || 'okänt fel'}`); return }
    if (followUp) {
      await sb.from('reminders').insert({ title: `Följ upp: ${fields.title}`, due_date: followUp, customer_id: customer.id, priority: 'normal', status: 'upcoming', created_by: seller || me || null })
        .then(() => null, () => null)
    }
    setBusy(false)
    onCreated?.()
    onClose()
  }

  const input: React.CSSProperties = { width: '100%', padding: '11px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }
  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Skapa lead" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid rgba(106,175,240,.45)', borderTop: '3px solid #6AAFF0', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto', padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Sparkles size={18} color="#6AAFF0" />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{lead ? 'Lead' : 'Skapa lead'}</h2>
          <button onClick={onClose} aria-label="Stäng" style={{ marginLeft: 'auto', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', padding: 6, display: 'flex' }}><X size={16} /></button>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--text2)' }}>{lead ? `${customer.company}` : `För ${customer.company} – något att följa upp efter besöket eller samtalet.`}</p>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={label} htmlFor="lead-title">Vad gällde samtalet? *</label>
            <input id="lead-title" autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="T.ex. Vill byta tvättsystem" style={input} />
          </div>
          <div>
            <label style={label} htmlFor="lead-product">Produkt</label>
            <select id="lead-product" value={productId} onChange={e => setProductId(e.target.value)} style={input}>
              <option value="">— Ingen särskild produkt —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={label} htmlFor="lead-notes">Anteckning – varför och vad som ska följas upp</label>
            <textarea id="lead-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="T.ex. Har problem med nuvarande schampo, vill ha prov. Ring om två veckor." style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <div>
              <label style={label} htmlFor="lead-seller">Ansvarig säljare</label>
              <select id="lead-seller" value={seller} onChange={e => setSeller(e.target.value)} style={input}>
                {!seller && <option value="">— Ingen —</option>}
                {teamOptions(team, seller).map(sp => <option key={sp} value={sp}>{sp}</option>)}
              </select>
            </div>
            {lead ? (
              <div>
                <label style={label} htmlFor="lead-stage">Steg</label>
                <select id="lead-stage" value={stage} onChange={e => setStage(e.target.value)} style={input}>
                  {STAGES.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label style={label} htmlFor="lead-follow">Följ upp (valfritt)</label>
                <input id="lead-follow" type="date" value={followUp} onChange={e => setFollowUp(e.target.value)} style={input} />
              </div>
            )}
            <div>
              <label style={label} htmlFor="lead-value">Uppskattat värde (kr)</label>
              <input id="lead-value" inputMode="numeric" value={value} onChange={e => setValue(e.target.value.replace(/[^\d\s]/g, ''))} placeholder="0" style={input} />
            </div>
          </div>
        </div>

        {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: 14, color: 'var(--red)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 15, cursor: 'pointer' }}>Avbryt</button>
          <button onClick={save} disabled={busy} style={{ flex: 2, padding: 13, background: '#6AAFF0', border: 'none', borderRadius: 10, color: '#0F1115', fontSize: 15, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? .7 : 1 }}>
            {busy ? 'Sparar…' : lead ? 'Spara' : 'Skapa lead'}
          </button>
        </div>
      </div>
    </div>
  )
}
