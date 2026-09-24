'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Zap, Mail, Clock, Plus, X, Cake, UserX, RefreshCw } from 'lucide-react'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { formatDateTime } from '@/lib/utils'

const supabase = createClient()

type AutoType = 'birthday' | 'inactivity' | 'reorder'

interface Automation {
  id: string
  name: string
  type: AutoType | null
  trigger: string | null
  action: string | null
  trigger_days: number | null
  email_subject: string | null
  email_body: string | null
  active: boolean
  last_run_at: string | null
  run_count: number | null
  created_at: string
}

interface Run {
  id: string
  automation_id: string
  emails_sent: number
  emails_failed: number
  notes: string | null
  created_at: string
}

// What each type does; run-automations (supabase/functions) implements them.
const TYPES: Record<AutoType, {
  label: string; icon: typeof Cake; days: number | null; daysLabel?: string
  describe: (days: number) => string
  defaults: { name: string; subject: string; body: string }
}> = {
  birthday: {
    label: 'Födelsedag', icon: Cake, days: null,
    describe: () => 'På kontaktpersonens födelsedag',
    defaults: {
      name: 'Födelsedagshälsning',
      subject: 'Grattis på födelsedagen, {name}!',
      body: 'Hej {name},\n\nVi på ProLuxShine vill önska dig en riktigt fin födelsedag!\n\nTack för att {company} handlar hos oss.',
    },
  },
  inactivity: {
    label: 'Inaktiv kund', icon: UserX, days: 60, daysLabel: 'Dagar utan order',
    describe: d => `När kunden inte beställt på ${d} dagar`,
    defaults: {
      name: 'Vi saknar dig',
      subject: 'Det var ett tag sedan, {name}',
      body: 'Hej {name},\n\nDet har gått {days} dagar sedan {company} beställde senast. Behöver ni fylla på lagret?\n\nHör av dig om du vill ha hjälp att välja produkter.',
    },
  },
  reorder: {
    label: 'Återköp', icon: RefreshCw, days: 30, daysLabel: 'Dagar efter levererad order',
    describe: d => `${d} dagar efter en levererad order`,
    defaults: {
      name: 'Dags att fylla på',
      subject: 'Dags att fylla på, {name}?',
      body: 'Hej {name},\n\nDet har gått {days} dagar sedan er senaste leverans. Här kan ni enkelt beställa samma produkter igen.',
    },
  },
}

const SAMPLE = { name: 'Anna', company: 'Bilvård AB', days: '60' }
const fill = (t: string, days: number | null) =>
  (t || '').replaceAll('{name}', SAMPLE.name).replaceAll('{company}', SAMPLE.company).replaceAll('{days}', String(days ?? SAMPLE.days))

const EMPTY = { name: '', type: 'birthday' as AutoType, trigger_days: '', email_subject: '', email_body: '', active: false }

const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

export default function AdminAutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [runs, setRuns]       = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast]     = useState('')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [provider, setProvider] = useState<string | null>(null)

  function load() {
    Promise.all([
      supabase.from('automations').select('*').order('created_at', { ascending: false }),
      supabase.from('automation_runs').select('id,automation_id,emails_sent,emails_failed,notes,created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('email_config').select('provider').eq('id', 'default').maybeSingle(),
    ]).then(([a, r, c]) => {
      if (a.data) setAutomations(a.data as Automation[])
      if (r.data) setRuns(r.data as Run[])
      setProvider(c.data?.provider ?? 'pending')
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])
  useLiveRefresh(['automations', 'automation_runs'], load)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function openNew() {
    const d = TYPES.birthday.defaults
    setForm({ ...EMPTY, name: d.name, email_subject: d.subject, email_body: d.body })
    setEditing('new')
  }

  function openEdit(a: Automation) {
    const type = (a.type && TYPES[a.type] ? a.type : 'birthday') as AutoType
    setForm({
      name: a.name || '', type, trigger_days: a.trigger_days != null ? String(a.trigger_days) : '',
      email_subject: a.email_subject || '', email_body: a.email_body || '', active: a.active,
    })
    setEditing(a.id)
  }

  // Switching type on a new automation swaps in that type's example text.
  function chooseType(type: AutoType) {
    setForm(f => {
      if (editing !== 'new') return { ...f, type }
      const d = TYPES[type].defaults
      return { ...f, type, name: d.name, email_subject: d.subject, email_body: d.body, trigger_days: '' }
    })
  }

  const t = TYPES[form.type]
  const days = t.days === null ? null : (parseInt(form.trigger_days) || t.days)

  async function save() {
    if (!form.name.trim() || !form.email_subject.trim() || !form.email_body.trim()) {
      showToast('Fyll i namn, ämne och text'); return
    }
    setSaving(true)
    const row = {
      name: form.name.trim(),
      type: form.type,
      trigger_days: days,
      email_subject: form.email_subject.trim(),
      email_body: form.email_body.trim(),
      active: form.active,
      // Older description columns shown elsewhere.
      trigger: t.describe(days ?? 0),
      action: 'Skicka e-post',
    }
    const { error } = editing === 'new'
      ? await supabase.from('automations').insert(row)
      : await supabase.from('automations').update(row).eq('id', editing!)
    setSaving(false)
    if (error) { showToast('Kunde inte spara: ' + error.message); return }
    showToast(editing === 'new' ? 'Automation skapad' : 'Automation sparad')
    setEditing(null)
    load()
  }

  async function remove() {
    if (editing === 'new' || !editing) return
    if (!confirm(`Radera "${form.name}"? Det går inte att ångra.`)) return
    const { error } = await supabase.from('automations').delete().eq('id', editing)
    if (error) { showToast('Kunde inte radera: ' + error.message); return }
    setAutomations(as => as.filter(a => a.id !== editing))
    setEditing(null)
    showToast('Automation raderad')
  }

  async function toggleAutomation(id: string, active: boolean) {
    await supabase.from('automations').update({ active: !active }).eq('id', id)
    setAutomations(as => as.map(a => a.id === id ? { ...a, active: !active } : a))
    showToast(!active ? 'Automation aktiverad' : 'Automation pausad')
  }

  const nameOf = (id: string) => automations.find(a => a.id === id)?.name || 'Borttagen automation'

  return (
    <div style={{ padding: 'clamp(16px,4vw,32px)', maxWidth: 900 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Automationer</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, margin: '4px 0 0' }}>E-post som skickas automatiskt till kunder</p>
        </div>
        <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={16} /> Ny automation
        </button>
      </div>

      <div style={{ background: 'rgba(232,184,75,.08)', border: '1px solid rgba(232,184,75,.2)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
        <Zap size={18} color="var(--gold)" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          Aktiva automationer körs en gång per dygn. Varje kund får samma automation högst en gång per period.
          {(provider === 'pending' || provider === null) && <> <strong style={{ color: 'var(--text)' }}>E-post är inte kopplad ännu</strong> – körningarna loggas men inget skickas.</>}
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 60 }}>Laddar...</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {automations.map(a => {
            const type = a.type && TYPES[a.type] ? TYPES[a.type] : null
            const Icon = type?.icon || Mail
            return (
              <div key={a.id} onClick={() => openEdit(a)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: a.active ? 'rgba(76,175,125,.12)' : 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color={a.active ? 'var(--green)' : 'var(--text3)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{a.name}</span>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: a.active ? 'rgba(76,175,125,.15)' : 'rgba(92,98,112,.15)', color: a.active ? 'var(--green)' : 'var(--text2)', fontWeight: 700 }}>{a.active ? 'AKTIV' : 'PAUSAD'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text2)' }}>
                    <span>{type ? type.describe(a.trigger_days ?? type.days ?? 0) : (a.trigger || 'Okänd typ')}</span>
                    {a.email_subject && <span>Ämne: <strong style={{ color: 'var(--text)' }}>{a.email_subject}</strong></span>}
                    {a.last_run_at && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {formatDateTime(a.last_run_at)}</span>
                    )}
                  </div>
                </div>
                <label onClick={e => e.stopPropagation()} style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0 }} aria-label={a.active ? 'Pausa' : 'Aktivera'}>
                  <input type="checkbox" checked={a.active} onChange={() => toggleAutomation(a.id, a.active)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: 'absolute', inset: 0, borderRadius: 12, background: a.active ? 'var(--green)' : 'var(--bg4)', border: `1px solid ${a.active ? 'var(--green)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all .2s' }}>
                    <span style={{ position: 'absolute', top: 2, left: a.active ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                  </span>
                </label>
              </div>
            )
          })}
          {automations.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text2)', padding: 50, background: 'var(--bg3)', borderRadius: 12, border: '1px dashed var(--border)' }}>
              Inga automationer ännu. Skapa den första med <strong style={{ color: 'var(--text)' }}>Ny automation</strong>.
            </div>
          )}
        </div>
      )}

      {runs.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>Senaste körningar</h2>
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {runs.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 13, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text2)', minWidth: 130 }}>{formatDateTime(r.created_at)}</span>
                <span style={{ color: 'var(--text)', flex: 1, minWidth: 140 }}>{nameOf(r.automation_id)}</span>
                <span style={{ color: 'var(--text2)' }}>{r.emails_sent} skickade{r.emails_failed ? ` · ${r.emails_failed} misslyckades` : ''}</span>
                {r.notes && <span style={{ color: 'var(--text2)', fontSize: 12, width: '100%' }}>{r.notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create / edit ── */}
      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{editing === 'new' ? 'Ny automation' : 'Redigera automation'}</h2>
              <button onClick={() => setEditing(null)} aria-label="Stäng" style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
            </div>

            <div style={{ padding: 22, display: 'grid', gap: 16 }}>
              <div>
                <span style={label}>När ska e-posten skickas?</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
                  {(Object.keys(TYPES) as AutoType[]).map(k => {
                    const T = TYPES[k]; const on = form.type === k
                    return (
                      <button key={k} type="button" onClick={() => chooseType(k)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                          background: on ? 'rgba(232,184,75,.1)' : 'var(--bg3)', border: `1px solid ${on ? 'var(--gold)' : 'var(--border)'}`, color: 'var(--text)' }}>
                        <T.icon size={16} color={on ? 'var(--gold)' : 'var(--text2)'} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{T.label}</span>
                      </button>
                    )
                  })}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text2)', margin: '8px 0 0' }}>{t.describe(days ?? 0)}.</p>
              </div>

              {t.days !== null && (
                <div>
                  <label style={label} htmlFor="a-days">{t.daysLabel}</label>
                  <input id="a-days" type="number" min={1} max={730} value={form.trigger_days} placeholder={String(t.days)}
                    onChange={e => setForm(f => ({ ...f, trigger_days: e.target.value }))} style={{ ...input, maxWidth: 160 }} />
                </div>
              )}

              <div>
                <label style={label} htmlFor="a-name">Namn (visas bara i admin)</label>
                <input id="a-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={input} />
              </div>
              <div>
                <label style={label} htmlFor="a-subject">Ämnesrad</label>
                <input id="a-subject" value={form.email_subject} onChange={e => setForm(f => ({ ...f, email_subject: e.target.value }))} style={input} />
              </div>
              <div>
                <label style={label} htmlFor="a-body">Text</label>
                <textarea id="a-body" rows={7} value={form.email_body} onChange={e => setForm(f => ({ ...f, email_body: e.target.value }))} style={{ ...input, resize: 'vertical', lineHeight: 1.6 }} />
                <p style={{ fontSize: 12, color: 'var(--text2)', margin: '6px 0 0' }}>
                  Kortkoder: <code>{'{name}'}</code> kontaktperson, <code>{'{company}'}</code> företag{t.days !== null && <>, <code>{'{days}'}</code> antal dagar</>}. Tom rad ger nytt stycke. Hälsning från ProLuxShine läggs till automatiskt.
                </p>
              </div>

              <div>
                <span style={label}>Förhandsvisning</span>
                <div style={{ background: '#fff', color: '#222', borderRadius: 8, padding: '14px 16px', fontSize: 14, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #eee' }}>{fill(form.email_subject, days) || 'Ämne'}</div>
                  {fill(form.email_body, days).split(/\n\s*\n/).map((p, i) => <p key={i} style={{ margin: '0 0 10px', whiteSpace: 'pre-line' }}>{p}</p>)}
                  <p style={{ margin: '12px 0 0', color: '#8A6A10' }}>Med vänliga hälsningar,<br /><strong>ProLuxShine</strong></p>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} style={{ width: 16, height: 16 }} />
                Aktiv – körs vid nästa dagliga körning
              </label>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--bg2)' }}>
              {editing !== 'new' && (
                <button onClick={remove} style={{ marginRight: 'auto', padding: '9px 14px', background: 'transparent', border: '1px solid rgba(224,82,82,.35)', borderRadius: 7, color: 'var(--red)', fontSize: 13, cursor: 'pointer' }}>Radera</button>
              )}
              <button onClick={() => setEditing(null)} style={{ padding: '9px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Avbryt</button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 20px', background: 'var(--gold)', border: 'none', borderRadius: 7, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? .7 : 1 }}>
                {saving ? 'Sparar…' : editing === 'new' ? 'Skapa automation' : 'Spara'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '12px 20px', fontSize: 13, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)' }} />
          {toast}
        </div>
      )}
    </div>
  )
}
