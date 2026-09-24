'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, X, Calendar } from 'lucide-react'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'

const supabase = createClient()

type Priority = 'low' | 'normal' | 'high'
interface Reminder {
  id: string
  customer_id: string
  title: string
  due_date: string
  priority: Priority
  status: 'upcoming' | 'done'
  customers?: { company: string }
}

const PRIORITY_DOT: Record<Priority, string> = { high: 'var(--red)', normal: 'var(--blue)', low: 'var(--text3)' }
const PRIORITY_LABEL: Record<Priority, string> = { high: 'Hög', normal: 'Normal', low: 'Låg' }
const monthNames = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December']

const glass: React.CSSProperties = {
  background: 'rgba(13,16,23,.72)',
  backdropFilter: 'saturate(180%) blur(20px)',
  WebkitBackdropFilter: 'saturate(180%) blur(20px)',
  border: '1px solid rgba(255,255,255,.06)',
  borderRadius: 12,
  boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 4px 24px rgba(0,0,0,.3)',
}

export default function CrmCalendarPage() {
  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [reminders, setReminders]   = useState<Reminder[]>([])
  const [customers, setCustomers]   = useState<{ id: string; company: string }[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [addDate, setAddDate]       = useState('')
  const [addTitle, setAddTitle]     = useState('')
  const [addCustomer, setAddCustomer] = useState('')
  const [addPriority, setAddPriority] = useState<Priority>('normal')
  const [saving, setSaving]         = useState(false)
  const [filter, setFilter]         = useState<'all' | 'upcoming' | 'done'>('upcoming')

  function loadData() {
    Promise.all([
      supabase.from('reminders').select('id,customer_id,title,due_date,priority,status,customers(company)').order('due_date'),
      supabase.from('customers').select('id,company').eq('status','active').order('company'),
    ]).then(([{ data: r }, { data: c }]) => {
      if (r) setReminders(r as any)
      if (c) setCustomers(c as any)
    })
  }

  useEffect(() => { loadData() }, [])
  useLiveRefresh(['reminders', 'customers'], loadData)

  const todayStr = now.toISOString().slice(0, 10)
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDow    = new Date(calYear, calMonth, 1).getDay()
  const firstMon    = firstDow === 0 ? 6 : firstDow - 1
  const cells: (number | null)[] = [...Array(firstMon).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const byDate: Record<string, Reminder[]> = {}
  for (const r of reminders) {
    const d = r.due_date?.slice(0, 10)
    if (d) { if (!byDate[d]) byDate[d] = []; byDate[d].push(r) }
  }

  function prevMonth() { const d = new Date(calYear, calMonth - 1); setCalMonth(d.getMonth()); setCalYear(d.getFullYear()) }
  function nextMonth() { const d = new Date(calYear, calMonth + 1); setCalMonth(d.getMonth()); setCalYear(d.getFullYear()) }

  async function saveReminder() {
    if (!addTitle.trim() || !addDate) return
    setSaving(true)
    const { data, error } = await supabase.from('reminders').insert({
      customer_id: addCustomer || null,
      title: addTitle.trim(),
      due_date: addDate,
      priority: addPriority,
      status: 'upcoming',
    }).select('id,customer_id,title,due_date,priority,status,customers(company)').single()
    setSaving(false)
    if (!error && data) {
      setReminders(rs => [...rs, data as any].sort((a, b) => a.due_date.localeCompare(b.due_date)))
      setAddTitle(''); setAddDate(''); setAddCustomer(''); setAddPriority('normal'); setShowAdd(false)
    }
  }

  async function markDone(id: string) {
    await supabase.from('reminders').update({ status: 'done' }).eq('id', id)
    setReminders(rs => rs.map(r => r.id === id ? { ...r, status: 'done' } : r))
  }

  async function deleteReminder(id: string) {
    await supabase.from('reminders').delete().eq('id', id)
    setReminders(rs => rs.filter(r => r.id !== id))
  }

  const selectedReminders = selectedDay ? (byDate[selectedDay] || []) : []
  const listReminders = reminders.filter(r =>
    filter === 'all' ? true :
    filter === 'upcoming' ? r.status === 'upcoming' :
    r.status === 'done'
  ).filter(r => {
    const d = r.due_date?.slice(0, 10) ?? ''
    const m = parseInt(d.slice(5, 7)) - 1
    const y = parseInt(d.slice(0, 4))
    return y === calYear && m === calMonth
  })

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', margin: 0 }}>Kalender</h1>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 6 }}>Påminnelser & uppföljningar</p>
        </div>
        <button onClick={() => { setShowAdd(true); setAddDate(todayStr) }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> Ny påminnelse
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

        {/* Calendar grid */}
        <div style={{ ...glass, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 6, borderRadius: 6 }}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{monthNames[calMonth]} {calYear}</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 6, borderRadius: 6 }}><ChevronRight size={16} /></button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '8px 12px 0', gap: 2 }}>
            {['Mån','Tis','Ons','Tor','Fre','Lör','Sön'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text3)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '2px 12px 16px', gap: 2 }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const dayRems = byDate[dateStr] || []
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDay
              const isPast = dateStr < todayStr
              return (
                <button key={idx} onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  style={{
                    borderRadius: 7, padding: '6px 4px', textAlign: 'center', cursor: 'pointer',
                    background: isSelected ? 'rgba(232,184,75,.15)' : isToday ? 'rgba(232,184,75,.08)' : dayRems.length > 0 ? 'rgba(74,143,212,.06)' : 'transparent',
                    border: isSelected ? '1px solid rgba(232,184,75,.4)' : isToday ? '1px solid rgba(232,184,75,.2)' : '1px solid transparent',
                    minHeight: 54,
                  }}>
                  <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--gold)' : isPast ? 'var(--text3)' : 'var(--text)', marginBottom: 4 }}>{day}</div>
                  {dayRems.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                      {dayRems.slice(0, 3).map((r, i) => (
                        <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: r.status === 'done' ? 'var(--text3)' : PRIORITY_DOT[r.priority] }} />
                      ))}
                      {dayRems.length > 3 && <span style={{ fontSize: 9, color: 'var(--text3)' }}>+{dayRems.length - 3}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '14px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              {selectedReminders.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Inga påminnelser denna dag</div>
              ) : selectedReminders.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.status === 'done' ? 'var(--text3)' : PRIORITY_DOT[r.priority], flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: r.status === 'done' ? 'var(--text3)' : 'var(--text)', fontWeight: 500, textDecoration: r.status === 'done' ? 'line-through' : 'none' }}>{r.title}</div>
                    {r.customers?.company && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.customers.company}</div>}
                  </div>
                  {r.status !== 'done' && (
                    <button onClick={() => markDone(r.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(76,175,125,.1)', border: '1px solid rgba(76,175,125,.2)', borderRadius: 5, color: 'var(--green)', cursor: 'pointer' }}>Klar</button>
                  )}
                  <button onClick={() => deleteReminder(r.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2 }}><X size={13} /></button>
                </div>
              ))}
              <button onClick={() => { setShowAdd(true); setAddDate(selectedDay) }}
                style={{ marginTop: 10, fontSize: 12, padding: '5px 12px', background: 'rgba(232,184,75,.1)', border: '1px solid rgba(232,184,75,.2)', borderRadius: 6, color: 'var(--gold)', cursor: 'pointer' }}>
                + Lägg till påminnelse denna dag
              </button>
            </div>
          )}
        </div>

        {/* Right panel — list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Filter */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: 3 }}>
            {(['upcoming','done','all'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, background: filter === f ? 'rgba(255,255,255,.07)' : 'transparent', border: 'none', borderRadius: 6, color: filter === f ? 'var(--text)' : 'var(--text3)', cursor: 'pointer' }}>
                {f === 'upcoming' ? 'Kommande' : f === 'done' ? 'Klara' : 'Alla'}
              </button>
            ))}
          </div>

          {/* List */}
          <div style={{ ...glass, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
              {monthNames[calMonth]} {calYear} · {listReminders.length} st
            </div>
            {listReminders.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>Inga påminnelser</div>
            ) : listReminders.map((r, i) => (
              <div key={r.id} style={{ padding: '10px 16px', borderBottom: i < listReminders.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.status === 'done' ? 'var(--text3)' : PRIORITY_DOT[r.priority], flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: r.status === 'done' ? 'var(--text3)' : 'var(--text)', fontWeight: 500, textDecoration: r.status === 'done' ? 'line-through' : 'none' }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {r.customers?.company && <>{r.customers.company} · </>}
                    {formatDate(r.due_date)} · {PRIORITY_LABEL[r.priority]}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {r.status !== 'done' && (
                    <button onClick={() => markDone(r.id)} style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(76,175,125,.1)', border: '1px solid rgba(76,175,125,.2)', borderRadius: 4, color: 'var(--green)', cursor: 'pointer' }}>Klar</button>
                  )}
                  <button onClick={() => deleteReminder(r.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2 }}><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add reminder modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...glass, width: '100%', maxWidth: 420, padding: '28px 28px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Ny påminnelse</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Titel</label>
                <input value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Vad ska göras?"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Datum</label>
                <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Kund (valfritt)</label>
                <select value={addCustomer} onChange={e => setAddCustomer(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">— Ingen kund —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Prioritet</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['low','normal','high'] as Priority[]).map(p => (
                    <button key={p} onClick={() => setAddPriority(p)}
                      style={{ flex: 1, padding: '7px 0', fontSize: 12, background: addPriority === p ? `${PRIORITY_DOT[p]}22` : 'rgba(255,255,255,.03)', border: `1px solid ${addPriority === p ? PRIORITY_DOT[p] + '66' : 'rgba(255,255,255,.08)'}`, borderRadius: 6, color: addPriority === p ? PRIORITY_DOT[p] : 'var(--text3)', cursor: 'pointer', fontWeight: addPriority === p ? 700 : 400 }}>
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={saveReminder} disabled={saving || !addTitle.trim() || !addDate}
                style={{ width: '100%', padding: '10px 0', marginTop: 4, background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: (!addTitle.trim() || !addDate) ? 0.5 : 1 }}>
                {saving ? 'Sparar...' : 'Spara påminnelse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
