'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Plus, X, Search, StickyNote, Bell, Phone, Mail, Users } from 'lucide-react'
import { useMe } from '@/hooks/useMe'

const supabase = createClient()

type ActivityType = 'note' | 'call' | 'email' | 'meeting'
type Priority = 'low' | 'normal' | 'high'

interface Activity {
  id: string
  customer_id: string
  type: ActivityType
  title: string
  body: string
  created_by: string
  created_at: string
  customers?: { company: string }
}

interface Reminder {
  id: string
  customer_id: string
  title: string
  due_date: string
  priority: Priority
  status: 'upcoming' | 'done'
  customers?: { company: string }
}

const ACTIVITY_ICON: Record<ActivityType, React.ElementType> = { note: StickyNote, call: Phone, email: Mail, meeting: Users }
const ACTIVITY_COLOR: Record<ActivityType, string> = { note: 'var(--text3)', call: 'var(--green)', email: 'var(--blue)', meeting: 'var(--gold)' }
const ACTIVITY_LABEL: Record<ActivityType, string> = { note: 'Anteckning', call: 'Samtal', email: 'E-post', meeting: 'Möte' }
const PRIORITY_DOT: Record<Priority, string> = { high: 'var(--red)', normal: 'var(--blue)', low: 'var(--text3)' }
const PRIORITY_LABEL: Record<Priority, string> = { high: 'Hög', normal: 'Normal', low: 'Låg' }

const glass: React.CSSProperties = {
  background: 'rgba(13,16,23,.72)',
  backdropFilter: 'saturate(180%) blur(20px)',
  WebkitBackdropFilter: 'saturate(180%) blur(20px)',
  border: '1px solid rgba(255,255,255,.06)',
  borderRadius: 12,
  boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 4px 24px rgba(0,0,0,.3)',
}

export default function CrmNotesPage() {
  const me = useMe()
  const [activities, setActivities] = useState<Activity[]>([])
  const [reminders,  setReminders]  = useState<Reminder[]>([])
  const [customers,  setCustomers]  = useState<{ id: string; company: string }[]>([])
  const [search,     setSearch]     = useState('')
  const [activeTab,  setActiveTab]  = useState<'notes' | 'reminders'>('notes')
  const [showAdd,    setShowAdd]    = useState(false)

  // Note form
  const [noteCustomer, setNoteCustomer] = useState('')
  const [noteType,     setNoteType]     = useState<ActivityType>('note')
  const [noteTitle,    setNoteTitle]    = useState('')
  const [noteBody,     setNoteBody]     = useState('')

  // Reminder form
  const [remCustomer,  setRemCustomer]  = useState('')
  const [remTitle,     setRemTitle]     = useState('')
  const [remDate,      setRemDate]      = useState('')
  const [remPriority,  setRemPriority]  = useState<Priority>('normal')
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    Promise.all([
      supabase.from('activities').select('id,customer_id,type,title,body,created_by,created_at,customers(company)').order('created_at', { ascending: false }).limit(100),
      supabase.from('reminders').select('id,customer_id,title,due_date,priority,status,customers(company)').order('due_date'),
      supabase.from('customers').select('id,company').eq('status','active').order('company'),
    ]).then(([{ data: a }, { data: r }, { data: c }]) => {
      if (a) setActivities(a as any)
      if (r) setReminders(r as any)
      if (c) setCustomers(c as any)
    })
  }, [])

  const filteredActivities = activities.filter(a =>
    !search || a.title?.toLowerCase().includes(search.toLowerCase()) || a.body?.toLowerCase().includes(search.toLowerCase()) || a.customers?.company.toLowerCase().includes(search.toLowerCase())
  )
  const filteredReminders = reminders.filter(r =>
    !search || r.title?.toLowerCase().includes(search.toLowerCase()) || r.customers?.company.toLowerCase().includes(search.toLowerCase())
  )

  async function saveNote() {
    if (!noteTitle.trim()) return
    setSaving(true)
    const titles: Record<ActivityType, string> = { note: 'Anteckning', call: 'Samtal', email: 'E-post', meeting: 'Möte' }
    const { data, error } = await supabase.from('activities').insert({
      customer_id: noteCustomer || null,
      type: noteType,
      title: noteTitle.trim() || titles[noteType],
      body: noteBody.trim(),
      created_by: me.name || 'CRM',
    }).select('id,customer_id,type,title,body,created_by,created_at,customers(company)').single()
    setSaving(false)
    if (!error && data) {
      setActivities(as => [data as any, ...as])
      setNoteTitle(''); setNoteBody(''); setNoteCustomer(''); setNoteType('note'); setShowAdd(false)
      showToast('Anteckning sparad')
    }
  }

  async function saveReminder() {
    if (!remTitle.trim() || !remDate) return
    setSaving(true)
    const { data, error } = await supabase.from('reminders').insert({
      customer_id: remCustomer || null,
      title: remTitle.trim(),
      due_date: remDate,
      priority: remPriority,
      status: 'upcoming',
    }).select('id,customer_id,title,due_date,priority,status,customers(company)').single()
    setSaving(false)
    if (!error && data) {
      setReminders(rs => [...rs, data as any].sort((a, b) => a.due_date.localeCompare(b.due_date)))
      setRemTitle(''); setRemDate(''); setRemCustomer(''); setRemPriority('normal'); setShowAdd(false)
      showToast('Påminnelse sparad')
    }
  }

  async function deleteActivity(id: string) {
    await supabase.from('activities').delete().eq('id', id)
    setActivities(as => as.filter(a => a.id !== id))
  }

  async function markDone(id: string) {
    await supabase.from('reminders').update({ status: 'done' }).eq('id', id)
    setReminders(rs => rs.map(r => r.id === id ? { ...r, status: 'done' } : r))
  }

  async function deleteReminder(id: string) {
    await supabase.from('reminders').delete().eq('id', id)
    setReminders(rs => rs.filter(r => r.id !== id))
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', margin: 0 }}>Anteckningar & påminnelser</h1>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 6 }}>Alla noteringar och uppföljningar</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> Ny
        </button>
      </div>

      {/* Search + tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök anteckningar..."
            style={{ width: '100%', padding: '9px 12px 9px 32px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: 3 }}>
          <button onClick={() => setActiveTab('notes')}
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: activeTab === 'notes' ? 'rgba(255,255,255,.07)' : 'transparent', border: 'none', borderRadius: 6, color: activeTab === 'notes' ? 'var(--text)' : 'var(--text3)', cursor: 'pointer' }}>
            Anteckningar ({filteredActivities.length})
          </button>
          <button onClick={() => setActiveTab('reminders')}
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: activeTab === 'reminders' ? 'rgba(255,255,255,.07)' : 'transparent', border: 'none', borderRadius: 6, color: activeTab === 'reminders' ? 'var(--text)' : 'var(--text3)', cursor: 'pointer' }}>
            Påminnelser ({filteredReminders.length})
          </button>
        </div>
      </div>

      {/* Activities list */}
      {activeTab === 'notes' && (
        <div style={{ ...glass, overflow: 'hidden' }}>
          {filteredActivities.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Inga anteckningar</div>
          ) : filteredActivities.map((a, i) => {
            const Icon = ACTIVITY_ICON[a.type] || StickyNote
            return (
              <div key={a.id} style={{ display: 'flex', gap: 12, padding: '14px 20px', borderBottom: i < filteredActivities.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ACTIVITY_COLOR[a.type]}18`, border: `1px solid ${ACTIVITY_COLOR[a.type]}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Icon size={14} color={ACTIVITY_COLOR[a.type]} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.title}</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', background: `${ACTIVITY_COLOR[a.type]}15`, border: `1px solid ${ACTIVITY_COLOR[a.type]}30`, borderRadius: 4, color: ACTIVITY_COLOR[a.type] }}>{ACTIVITY_LABEL[a.type]}</span>
                  </div>
                  {a.body && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4, lineHeight: 1.5 }}>{a.body}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {a.customers?.company && <>{a.customers.company} · </>}
                    {formatDate(a.created_at)} {a.created_by && `· ${a.created_by}`}
                  </div>
                </div>
                <button onClick={() => deleteActivity(a.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, flexShrink: 0, opacity: 0.5 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Reminders list */}
      {activeTab === 'reminders' && (
        <div style={{ ...glass, overflow: 'hidden' }}>
          {filteredReminders.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Inga påminnelser</div>
          ) : filteredReminders.map((r, i) => {
            const isOverdue = r.due_date < todayStr && r.status === 'upcoming'
            return (
              <div key={r.id} style={{ display: 'flex', gap: 12, padding: '12px 20px', borderBottom: i < filteredReminders.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', alignItems: 'center', background: isOverdue ? 'rgba(224,82,82,.04)' : 'transparent' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.status === 'done' ? 'var(--text3)' : PRIORITY_DOT[r.priority], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: r.status === 'done' ? 'var(--text3)' : 'var(--text)', textDecoration: r.status === 'done' ? 'line-through' : 'none' }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: isOverdue ? 'var(--red)' : 'var(--text3)', marginTop: 2 }}>
                    {r.customers?.company && <>{r.customers.company} · </>}
                    {formatDate(r.due_date)}{isOverdue ? ' · Försenad' : ''} · {PRIORITY_LABEL[r.priority]}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {r.status !== 'done' && (
                    <button onClick={() => markDone(r.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(76,175,125,.1)', border: '1px solid rgba(76,175,125,.2)', borderRadius: 5, color: 'var(--green)', cursor: 'pointer' }}>Klar</button>
                  )}
                  <button onClick={() => deleteReminder(r.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, opacity: 0.5 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...glass, width: '100%', maxWidth: 460, padding: '28px 28px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['notes','reminders'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    style={{ padding: '6px 14px', fontSize: 13, fontWeight: 600, background: activeTab === t ? 'rgba(232,184,75,.1)' : 'transparent', border: `1px solid ${activeTab === t ? 'rgba(232,184,75,.25)' : 'transparent'}`, borderRadius: 7, color: activeTab === t ? 'var(--gold)' : 'var(--text3)', cursor: 'pointer' }}>
                    {t === 'notes' ? 'Anteckning' : 'Påminnelse'}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {activeTab === 'notes' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Typ</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['note','call','email','meeting'] as ActivityType[]).map(t => (
                      <button key={t} onClick={() => setNoteType(t)}
                        style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: noteType === t ? 700 : 400, background: noteType === t ? `${ACTIVITY_COLOR[t]}18` : 'rgba(255,255,255,.03)', border: `1px solid ${noteType === t ? ACTIVITY_COLOR[t] + '40' : 'rgba(255,255,255,.08)'}`, borderRadius: 6, color: noteType === t ? ACTIVITY_COLOR[t] : 'var(--text3)', cursor: 'pointer' }}>
                        {ACTIVITY_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Titel</label>
                  <input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Rubrik..."
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Notering</label>
                  <textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} rows={3} placeholder="Skriv din anteckning..."
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Kund (valfritt)</label>
                  <select value={noteCustomer} onChange={e => setNoteCustomer(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                    <option value="">— Ingen kund —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                  </select>
                </div>
                <button onClick={saveNote} disabled={saving || !noteTitle.trim()}
                  style={{ width: '100%', padding: '10px 0', marginTop: 4, background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: !noteTitle.trim() ? 0.5 : 1 }}>
                  {saving ? 'Sparar...' : 'Spara anteckning'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Titel</label>
                  <input value={remTitle} onChange={e => setRemTitle(e.target.value)} placeholder="Vad ska göras?"
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Datum</label>
                  <input type="date" value={remDate} onChange={e => setRemDate(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Kund (valfritt)</label>
                  <select value={remCustomer} onChange={e => setRemCustomer(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                    <option value="">— Ingen kund —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Prioritet</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['low','normal','high'] as Priority[]).map(p => (
                      <button key={p} onClick={() => setRemPriority(p)}
                        style={{ flex: 1, padding: '7px 0', fontSize: 12, background: remPriority === p ? `${PRIORITY_DOT[p]}22` : 'rgba(255,255,255,.03)', border: `1px solid ${remPriority === p ? PRIORITY_DOT[p] + '66' : 'rgba(255,255,255,.08)'}`, borderRadius: 6, color: remPriority === p ? PRIORITY_DOT[p] : 'var(--text3)', cursor: 'pointer', fontWeight: remPriority === p ? 700 : 400 }}>
                        {PRIORITY_LABEL[p]}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={saveReminder} disabled={saving || !remTitle.trim() || !remDate}
                  style={{ width: '100%', padding: '10px 0', marginTop: 4, background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: (!remTitle.trim() || !remDate) ? 0.5 : 1 }}>
                  {saving ? 'Sparar...' : 'Spara påminnelse'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(76,175,125,.9)', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#fff', zIndex: 600 }}>{toast}</div>
      )}
    </div>
  )
}
