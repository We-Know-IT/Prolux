'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'

export interface Reminder {
  id: string
  customer_id: string | null
  title: string
  due_date: string
  priority: 'low' | 'normal' | 'high'
  status?: string
  customers?: { company: string } | null
}

const PRIORITY: Record<Reminder['priority'], { label: string; color: string }> = {
  low: { label: 'Låg', color: 'var(--text2)' }, normal: { label: 'Normal', color: 'var(--blue)' }, high: { label: 'Hög', color: 'var(--red)' },
}
const SELECT = 'id,customer_id,title,due_date,priority,status,customers(company)'

// Create a calendar activity, or edit one (title, date, customer, priority),
// mark it done or delete it. Used by the admin and CRM overview calendars.
export default function ReminderModal({ reminder, defaultDate, customers, createdBy, onSaved, onRemoved, onClose }: {
  reminder?: Reminder | null
  defaultDate: string
  customers: { id: string; company: string }[]
  createdBy?: string
  onSaved: (r: Reminder) => void
  onRemoved: (id: string) => void
  onClose: () => void
}) {
  const [title, setTitle]       = useState(reminder?.title ?? '')
  const [date, setDate]         = useState(reminder?.due_date?.slice(0, 10) ?? defaultDate)
  const [customer, setCustomer] = useState(reminder?.customer_id ?? '')
  const [priority, setPriority] = useState<Reminder['priority']>(reminder?.priority ?? 'normal')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sb = createClient()

  async function save() {
    if (!title.trim() || !date) return
    setBusy(true); setError('')
    const fields = { title: title.trim(), due_date: date, customer_id: customer || null, priority }
    const { data, error: err } = reminder
      ? await sb.from('reminders').update(fields).eq('id', reminder.id).select(SELECT).single()
      : await sb.from('reminders').insert({ ...fields, status: 'upcoming', ...(createdBy ? { created_by: createdBy } : {}) }).select(SELECT).single()
    setBusy(false)
    if (err || !data) { setError('Kunde inte spara. Försök igen.'); return }
    onSaved(data as unknown as Reminder)
    onClose()
  }

  async function markDone() {
    if (!reminder) return
    setBusy(true)
    const { error: err } = await sb.from('reminders').update({ status: 'done' }).eq('id', reminder.id)
    setBusy(false)
    if (err) { setError('Kunde inte klarmarkera.'); return }
    onRemoved(reminder.id); onClose()
  }

  async function remove() {
    if (!reminder) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    setBusy(true)
    const { error: err } = await sb.from('reminders').delete().eq('id', reminder.id)
    setBusy(false)
    if (err) { setError('Kunde inte radera.'); return }
    onRemoved(reminder.id); onClose()
  }

  const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }
  const input: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 7, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, width: '100%', maxWidth: 420, padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{reminder ? 'Redigera aktivitet' : 'Ny aktivitet'}</h3>
          <button onClick={onClose} aria-label="Stäng" style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={label} htmlFor="rem-title">Titel</label>
            <input id="rem-title" autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Vad ska göras?" style={input}
              onKeyDown={e => { if (e.key === 'Enter') save() }} />
          </div>
          <div>
            <label style={label} htmlFor="rem-date">Datum</label>
            <input id="rem-date" type="date" value={date} onChange={e => setDate(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label} htmlFor="rem-customer">Kund (valfritt)</label>
            <select id="rem-customer" value={customer} onChange={e => setCustomer(e.target.value)} style={input}>
              <option value="">— Ingen kund —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </div>
          <div>
            <span style={label}>Prioritet</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(Object.keys(PRIORITY) as Reminder['priority'][]).map(p => {
                const on = priority === p
                return (
                  <button key={p} type="button" aria-pressed={on} onClick={() => setPriority(p)}
                    style={{ flex: 1, padding: '8px 0', fontSize: 13, borderRadius: 6, cursor: 'pointer', fontWeight: on ? 700 : 500,
                      background: on ? 'rgba(255,255,255,.08)' : 'transparent', border: `1px solid ${on ? PRIORITY[p].color : 'rgba(255,255,255,.1)'}`, color: on ? 'var(--text)' : 'var(--text2)' }}>
                    {PRIORITY[p].label}
                  </button>
                )
              })}
            </div>
          </div>
          {error && <div role="alert" style={{ fontSize: 13, color: 'var(--red)' }}>{error}</div>}
          <button onClick={save} disabled={busy || !title.trim() || !date}
            style={{ width: '100%', padding: '11px 0', marginTop: 4, background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: !title.trim() || !date ? 0.5 : 1 }}>
            {busy ? 'Sparar…' : reminder ? 'Spara ändringar' : 'Spara aktivitet'}
          </button>
          {reminder && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={markDone} disabled={busy}
                style={{ flex: 1, padding: '9px 0', background: 'rgba(76,175,125,.1)', border: '1px solid rgba(76,175,125,.3)', borderRadius: 8, color: 'var(--green)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Klarmarkera
              </button>
              <button onClick={remove} disabled={busy}
                style={{ flex: 1, padding: '9px 0', background: confirmDelete ? 'rgba(224,82,82,.15)' : 'transparent', border: '1px solid rgba(224,82,82,.35)', borderRadius: 8, color: 'var(--red)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {confirmDelete ? 'Tryck igen för att radera' : 'Radera'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
