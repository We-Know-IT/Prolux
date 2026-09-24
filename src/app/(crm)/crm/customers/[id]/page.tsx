'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Customer, Order, OrderItem, Activity, PRICE_LIST_LABEL, ORDER_STATUS_LABEL, OrderStatus } from '@/types'
import { fmt, formatDate, custPrice } from '@/lib/utils'
import {
  Plus, Mail, FileText, Bell, Calendar,
  TrendingUp, ShoppingBag, Package, Star,
  BarChart2, X, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { SALESPEOPLE } from '@/lib/team'
import { nextBirthday, formatBirthday } from '@/lib/birthdays'

const supabase = createClient()

const AFFINITY: Record<string, string[]> = {
  'rapidet':  ['magic', 'gommalux', 'green power'],
  'magic':    ['rapidet', 'carnauba', 'keramisk'],
  'gommalux': ['rapidet', 'magic'],
  'carnauba': ['keramisk', 'magic', 'polish'],
  'keramisk': ['carnauba', 'polish', 'magic'],
  'green':    ['magic', 'rapidet'],
  'polish':   ['carnauba', 'keramisk'],
}

function getRecommendations(topProducts: string[], allProductNames: string[]): string[] {
  const recs = new Set<string>()
  for (const bought of topProducts) {
    const key = Object.keys(AFFINITY).find(k => bought.toLowerCase().includes(k))
    if (key) {
      for (const rec of AFFINITY[key]) {
        const match = allProductNames.find(n => n.toLowerCase().includes(rec) && !topProducts.includes(n))
        if (match) recs.add(match)
      }
    }
  }
  return Array.from(recs).slice(0, 4)
}

type Tab = 'overview' | 'orders' | 'stats' | 'notes'
type ReminderPriority = 'low' | 'normal' | 'high'

interface Reminder {
  id: string; customer_id: string; title: string; due_date: string
  priority: ReminderPriority; status: 'upcoming' | 'done'; created_at: string
}

const PRIORITY_COLOR: Record<ReminderPriority, string> = { low: 'var(--text3)', normal: 'var(--blue)', high: 'var(--red)' }
const PRIORITY_LABEL: Record<ReminderPriority, string> = { low: 'Låg', normal: 'Normal', high: 'Hög' }
const activityColor: Record<string, string> = {
  note: 'var(--text3)', call: 'var(--green)', email: 'var(--blue)', meeting: 'var(--gold)', order: 'var(--gold)'
}
const PL_BADGE_COLOR: Record<string, string> = { A: 'rgba(76,175,125,.15)', B: 'rgba(74,143,212,.12)', C: 'rgba(155,110,232,.12)', Standard: 'rgba(255,255,255,.06)' }
const PL_TEXT_COLOR:  Record<string, string> = { A: 'var(--green)', B: 'var(--blue)', C: '#9B6EE8', Standard: 'var(--text3)' }

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [customer, setCustomer]           = useState<Customer | null>(null)
  const [orders, setOrders]               = useState<Order[]>([])
  const [orderItems, setOrderItems]       = useState<OrderItem[]>([])
  const [activities, setActivities]       = useState<Activity[]>([])
  const [reminders, setReminders]         = useState<Reminder[]>([])
  const [allProductNames, setAllProductNames] = useState<string[]>([])
  const [loading, setLoading]             = useState(true)
  const [tab, setTab]                     = useState<Tab>('overview')
  const [noteText, setNoteText]           = useState('')
  const [noteType, setNoteType]           = useState<'note'|'call'|'email'|'meeting'>('note')
  const [reminderText, setReminderText]   = useState('')
  const [reminderDate, setReminderDate]   = useState('')
  const [reminderPriority, setReminderPriority] = useState<ReminderPriority>('normal')
  const [toast, setToast]                 = useState('')
  const [editMode, setEditMode]           = useState(false)
  const [editForm, setEditForm]           = useState<Partial<Customer>>({})
  const [editSaving, setEditSaving]       = useState(false)

  useEffect(() => { loadData() }, [id])
  useLiveRefresh(['customers', 'orders', 'order_items', 'activities', 'reminders'], loadData)

  function loadData() {
    if (!id) return
    Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('orders').select('id,order_nr,status,total,subtotal,vat_amount,created_at,delivery_city,order_items(id,product_name,product_sku,qty,unit_price,list_price,total_price)').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('activities').select('id,type,title,body,created_by,created_at').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('reminders').select('*').eq('customer_id', id).order('due_date'),
      supabase.from('products').select('id,name,brand,list_price,unit').eq('active', true).order('sort_order'),
    ]).then(([{ data: c }, { data: o }, { data: a }, { data: r }, { data: p }]) => {
      if (c) setCustomer(c as Customer)
      if (o) { setOrders(o as any); setOrderItems(o.flatMap((x: any) => x.order_items || [])) }
      if (a) setActivities(a as any)
      if (r) setReminders(r)
      if (p) setAllProductNames(p.map((x: any) => x.name))
      setLoading(false)
    })
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function addActivity() {
    if (!customer || !noteText.trim()) return
    const titles = { note: 'Anteckning', call: 'Samtal', email: 'E-post', meeting: 'Möte' }
    const { data, error } = await supabase.from('activities').insert({
      customer_id: customer.id, type: noteType,
      title: titles[noteType], body: noteText, created_by: 'Bashar'
    }).select().single()
    if (!error && data) { setActivities(as => [data, ...as]); setNoteText(''); showToast('Sparad') }
  }

  async function deleteActivity(id: string) {
    await supabase.from('activities').delete().eq('id', id)
    setActivities(as => as.filter(a => a.id !== id))
  }

  async function addReminder() {
    if (!customer || !reminderText.trim() || !reminderDate) return
    const { data, error } = await supabase.from('reminders').insert({
      customer_id: customer.id, title: reminderText, due_date: reminderDate,
      priority: reminderPriority, status: 'upcoming', created_by: 'Bashar',
    }).select().single()
    if (!error && data) {
      setReminders(rs => [...rs, data].sort((a, b) => a.due_date.localeCompare(b.due_date)))
      setReminderText(''); setReminderDate(''); showToast('Påminnelse skapad')
    }
  }

  async function toggleReminder(id: string) {
    const r = reminders.find(x => x.id === id)
    if (!r) return
    const newStatus = r.status === 'done' ? 'upcoming' : 'done'
    await supabase.from('reminders').update({ status: newStatus }).eq('id', id)
    setReminders(rs => rs.map(x => x.id === id ? { ...x, status: newStatus } : x))
  }

  async function deleteReminder(id: string) {
    await supabase.from('reminders').delete().eq('id', id)
    setReminders(rs => rs.filter(r => r.id !== id))
  }

  function sendOffer() {
    if (!customer) return
    const sub  = `Offert från ProLuxShine — ${customer.company}`
    const body = `Hej ${customer.contact_name},\n\nTack för visat intresse! Jag bifogar en offert anpassad efter er prislista ${customer.price_list_id}.\n\nVänliga hälsningar,\nBashar\nProLuxShine`
    window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(customer.email)}&su=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`, '_blank')
  }


  function startEdit() {
    if (!customer) return
    setEditForm({ company: customer.company, contact_name: customer.contact_name, email: customer.email, phone: customer.phone || '', city: customer.city || '', org_nr: customer.org_nr || '', price_list_id: customer.price_list_id, status: customer.status, account_manager: customer.account_manager || '', contact_birthday: customer.contact_birthday || '' })
    setEditMode(true)
  }

  async function saveEdit() {
    if (!customer) return
    setEditSaving(true)
    const { data, error } = await supabase.from('customers').update({ ...editForm, account_manager: editForm.account_manager || null, contact_birthday: editForm.contact_birthday || null }).eq('id', customer.id).select().single()
    if (!error && data) { setCustomer(data as Customer); showToast('Kunduppgifter sparade'); setEditMode(false) }
    else showToast('Fel: ' + (error?.message || 'Kunde inte spara'))
    setEditSaving(false)
  }

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
      {[1,2,3].map(i => <div key={i} style={{ height: 60, background: 'var(--bg3)', borderRadius: 10, marginBottom: 12, opacity: 0.5 }} />)}
    </div>
  )

  if (!customer) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px', textAlign: 'center', color: 'var(--text3)' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>404</div>
      <p>Kund hittades inte.</p>
      <Link href="/crm/customers" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>← Tillbaka till kunder</Link>
    </div>
  )

  // Derived stats
  const totalSpend     = orders.reduce((s, o) => s + (o.total || 0), 0)
  const ordersThisYear = orders.filter(o => new Date(o.created_at).getFullYear() === new Date().getFullYear()).length
  const avgOrderValue  = orders.length ? Math.round(totalSpend / orders.length) : 0
  const productFreq: Record<string, { name: string; qty: number; total: number }> = {}
  for (const item of orderItems) {
    if (!productFreq[item.product_name]) productFreq[item.product_name] = { name: item.product_name, qty: 0, total: 0 }
    productFreq[item.product_name].qty += item.qty
    productFreq[item.product_name].total += item.total_price
  }
  const topProducts    = Object.values(productFreq).sort((a, b) => b.qty - a.qty).slice(0, 6)
  const maxQty         = topProducts[0]?.qty || 1
  const lastOrdered    = topProducts.slice(0, 3).map(p => p.name)
  const recommendations = getRecommendations(lastOrdered, allProductNames)
  const today          = new Date().toISOString().slice(0, 10)
  const overdueReminders  = reminders.filter(r => r.status !== 'done' && r.due_date < today)
  const upcomingReminders = reminders.filter(r => r.status !== 'done' && r.due_date >= today)

  const card: React.CSSProperties = {
    background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 12,
  }

  const noteForm = (
    <div style={{ ...card, padding: 16, marginBottom: 14 }}>
      <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
        placeholder="Skriv anteckning, samtalsnotis, mötesinformation..." rows={3}
        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
        <select value={noteType} onChange={e => setNoteType(e.target.value as any)}
          style={{ padding: '7px 10px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none' }}>
          <option value="note">📝 Anteckning</option>
          <option value="call">📞 Samtal</option>
          <option value="email">📧 E-post</option>
          <option value="meeting">🤝 Möte</option>
        </select>
        <button onClick={addActivity} style={{ padding: '7px 18px', background: 'var(--gold)', border: 'none', borderRadius: 6, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Spara</button>
      </div>
    </div>
  )

  const reminderForm = (
    <div style={{ ...card, padding: 16, marginBottom: 14 }}>
      <input value={reminderText} onChange={e => setReminderText(e.target.value)} placeholder="Vad ska du komma ihåg?"
        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={13} color="var(--text3)" />
          <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)}
            style={{ flex: 1, padding: '7px 10px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none', colorScheme: 'dark' }} />
        </div>
        <select value={reminderPriority} onChange={e => setReminderPriority(e.target.value as ReminderPriority)}
          style={{ padding: '7px 10px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 6, color: PRIORITY_COLOR[reminderPriority], fontSize: 12, outline: 'none', fontWeight: 600 }}>
          <option value="low">Låg</option><option value="normal">Normal</option><option value="high">Hög</option>
        </select>
      </div>
      <button onClick={addReminder} style={{ width: '100%', padding: '8px 0', background: 'var(--gold)', border: 'none', borderRadius: 7, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        + Lägg till påminnelse
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px 80px' }}>

      {/* Breadcrumb */}
      <Link href="/crm/customers" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text3)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
        <ChevronLeft size={15} /> Alla kunder
      </Link>

      {/* Header card */}
      <div style={{ ...card, padding: '24px 28px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: PL_BADGE_COLOR[customer.price_list_id], border: `1px solid ${PL_TEXT_COLOR[customer.price_list_id]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: PL_TEXT_COLOR[customer.price_list_id], flexShrink: 0 }}>
                {customer.company[0]}
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{customer.company}</h1>
                <p style={{ margin: '2px 0 0', color: 'var(--text2)', fontSize: 13 }}>
                  {customer.contact_name}
                  {customer.city ? ` · ${customer.city}` : ''}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: customer.account_manager ? 'var(--text3)' : 'var(--red)' }}>
                  {customer.account_manager ? `Kundansvarig: ${customer.account_manager}` : 'Ingen kundansvarig — ordrar får ingen säljare'}
                </p>
              </div>
              <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: PL_BADGE_COLOR[customer.price_list_id], color: PL_TEXT_COLOR[customer.price_list_id], fontWeight: 700, marginLeft: 4 }}>
                {PRICE_LIST_LABEL[customer.price_list_id]}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 7, color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ✏️ Redigera
            </button>
            <a href={`mailto:${customer.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(74,143,212,.1)', border: '1px solid rgba(74,143,212,.2)', borderRadius: 7, color: 'var(--blue)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              <Mail size={13} /> Mail
            </a>
            <button onClick={sendOffer} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(232,184,75,.1)', border: '1px solid rgba(232,184,75,.2)', borderRadius: 7, color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <FileText size={13} /> Skicka offert
            </button>
            <button onClick={() => router.push(`/crm/orders?customer=${customer.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--gold)', border: 'none', borderRadius: 7, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={13} /> Ny order
            </button>
          </div>
        </div>

        {/* Quick KPIs */}
        <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
          {[
            { label: 'Totalt köpt',  value: `${fmt(totalSpend)} kr`,    icon: ShoppingBag, color: 'var(--gold)' },
            { label: 'Ordrar i år',  value: ordersThisYear,             icon: FileText,    color: 'var(--blue)' },
            { label: 'Snittvärde',   value: `${fmt(avgOrderValue)} kr`, icon: TrendingUp,  color: 'var(--green)' },
            { label: 'Påminnelser',  value: upcomingReminders.length + (overdueReminders.length > 0 ? ` (${overdueReminders.length} försen.)` : ''), icon: Bell, color: overdueReminders.length > 0 ? 'var(--red)' : 'var(--text3)' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon size={14} color={color} />
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{label}:</span>
              <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginTop: 16, borderBottom: '2px solid var(--line)' }}>
          {([
            { key: 'overview', label: 'Översikt' },
            { key: 'orders',   label: `Ordrar (${orders.length})` },
            { key: 'stats',    label: 'Statistik' },
            { key: 'notes',    label: `Anteckningar${reminders.filter(r=>r.status!=='done').length > 0 ? ` · ${reminders.filter(r=>r.status!=='done').length} påm.` : ''}` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key as Tab)}
              style={{ padding: '8px 18px', background: 'none', border: 'none', borderBottom: tab === key ? '2px solid var(--gold)' : '2px solid transparent', color: tab === key ? 'var(--gold)' : 'var(--text2)', fontSize: 13, fontWeight: tab === key ? 700 : 400, cursor: 'pointer', marginBottom: -2, whiteSpace: 'nowrap' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: Overview ────────────────────────────────────── */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Contact details */}
          <div style={{ ...card, padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 24px' }}>
            {[
              ['E-post', customer.email], ['Telefon', customer.phone || '—'], ['Stad', customer.city || '—'],
              ['Org.nr', customer.org_nr || '—'], ['Status', ({ active: 'Aktiv', inactive: 'Inaktiv', prospect: 'Prospekt' } as Record<string, string>)[customer.status] || customer.status], ['Prislista', customer.price_list_id],
              ['Kontaktperson', customer.contact_name || '—'],
              ['Födelsedag', customer.contact_birthday ? (() => {
                const nb = nextBirthday(customer.contact_birthday)
                const when = nb.daysUntil === 0 ? 'idag 🎉' : nb.daysUntil === 1 ? 'imorgon' : `om ${nb.daysUntil} dagar`
                return `${formatBirthday(customer.contact_birthday)}${nb.turns ? ` · fyller ${nb.turns}` : ''} (${when})`
              })() : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Overdue reminders */}
          {overdueReminders.length > 0 && (
            <div style={{ background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.2)', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Bell size={15} color="var(--red)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>Försenade påminnelser ({overdueReminders.length})</span>
              </div>
              {overdueReminders.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(224,82,82,.1)' }}>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{r.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--red)' }}>{r.due_date}</span>
                  <button onClick={() => toggleReminder(r.id)} style={{ background: 'var(--red)', border: 'none', borderRadius: 5, color: '#fff', fontSize: 11, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>Klar</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Recent orders */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Senaste ordrar</div>
              {orders.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {orders.slice(0, 4).map(o => (
                    <div key={o.id} style={{ ...card, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Order #{o.order_nr}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{formatDate(o.created_at)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{fmt(o.total)} kr</div>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(76,175,125,.12)', color: 'var(--green)', fontWeight: 700 }}>{ORDER_STATUS_LABEL[o.status as OrderStatus] || o.status}</span>
                      </div>
                    </div>
                  ))}
                  {orders.length > 4 && (
                    <button onClick={() => setTab('orders')} style={{ padding: '9px 0', background: 'transparent', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
                      Visa alla {orders.length} ordrar →
                    </button>
                  )}
                </div>
              ) : <p style={{ color: 'var(--text3)', fontSize: 13 }}>Inga ordrar ännu</p>}
            </div>

            {/* Activity log preview */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Senaste aktiviteter</div>
              {noteForm}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activities.slice(0, 4).map(a => (
                  <div key={a.id} style={{ ...card, border: `1px solid ${activityColor[a.type]}28`, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: activityColor[a.type], textTransform: 'uppercase' }}>
                        {a.type === 'note' ? '📝' : a.type === 'call' ? '📞' : a.type === 'email' ? '📧' : '🤝'} {a.title}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>{formatDate(a.created_at)}</span>
                      <button onClick={() => deleteActivity(a.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}><Trash2 size={12} /></button>
                    </div>
                    {a.body && <p style={{ margin: 0, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{a.body}</p>}
                  </div>
                ))}
                {activities.length === 0 && <p style={{ color: 'var(--text3)', fontSize: 13 }}>Inga aktiviteter</p>}
              </div>
            </div>
          </div>

          {/* Product tags */}
          {topProducts.length > 0 && (
            <div style={{ ...card, padding: '18px 24px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Senaste köp</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: recommendations.length > 0 ? 14 : 0 }}>
                {topProducts.slice(0, 5).map(p => (
                  <Link key={p.name} href={`/crm/orders?customer=${customer.id}&product=${encodeURIComponent(p.name)}`}
                    style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(76,175,125,.1)', border: '1px solid rgba(76,175,125,.2)', borderRadius: 6, color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}>
                    {p.name} ×{p.qty}
                  </Link>
                ))}
              </div>
              {recommendations.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Star size={12} color="var(--gold)" /> Rekommendationer
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {recommendations.map(rec => (
                      <Link key={rec} href={`/crm/orders?customer=${customer.id}&product=${encodeURIComponent(rec)}`}
                        style={{ fontSize: 12, padding: '4px 10px', background: 'rgba(232,184,75,.08)', border: '1px solid rgba(232,184,75,.18)', borderRadius: 6, color: 'var(--gold)', textDecoration: 'none' }}>
                        {rec}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Orders ──────────────────────────────────────── */}
      {tab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(o => (
            <div key={o.id} style={{ ...card, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (o as any).order_items?.length ? 12 : 0 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Order #{o.order_nr}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{formatDate(o.created_at)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>{fmt(o.total)} kr</div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(76,175,125,.12)', color: 'var(--green)', fontWeight: 700 }}>{ORDER_STATUS_LABEL[o.status as OrderStatus] || o.status}</span>
                </div>
              </div>
              {(o as any).order_items?.length > 0 && (
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(o as any).order_items.map((item: OrderItem) => (
                    <span key={item.id} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--text2)' }}>
                      {item.product_name} ×{item.qty}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {orders.length === 0 && <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Inga ordrar ännu</p>}
        </div>
      )}

      {/* ── TAB: Stats ───────────────────────────────────────── */}
      {tab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Totalt köpt', value: `${fmt(totalSpend)} kr`, color: 'var(--gold)' },
              { label: 'Antal ordrar', value: orders.length, color: 'var(--blue)' },
              { label: 'Snittvärde', value: `${fmt(avgOrderValue)} kr`, color: 'var(--green)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ ...card, padding: '18px 22px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={15} color="var(--gold)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Mest köpta produkter</span>
            </div>
            {topProducts.length > 0 ? topProducts.map((p, i) => (
              <div key={p.name} style={{ padding: '13px 20px', borderBottom: i < topProducts.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>{p.qty} st</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{fmt(p.total)} kr</span>
                  </div>
                </div>
                <div style={{ height: 5, background: 'var(--bg4)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${(p.qty / maxQty) * 100}%`, background: i === 0 ? 'var(--gold)' : 'rgba(232,184,75,.35)', borderRadius: 3 }} />
                </div>
              </div>
            )) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Inga ordrar ännu</div>
            )}
          </div>
          {recommendations.length > 0 && (
            <div style={{ ...card, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Star size={15} color="var(--gold)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Rekommendationer baserade på köphistorik</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {recommendations.map(rec => (
                  <div key={rec} style={{ ...card, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(232,184,75,.08)', border: '1px solid rgba(232,184,75,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Package size={17} color="var(--gold)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{rec}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>Passar till deras köp</div>
                    </div>
                    <ChevronRight size={14} color="var(--text3)" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Notes & Reminders ───────────────────────────── */}
      {tab === 'notes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Anteckningar & aktiviteter</h3>
            {noteForm}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activities.map(a => (
                <div key={a.id} style={{ ...card, border: `1px solid ${activityColor[a.type]}28`, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: activityColor[a.type], textTransform: 'uppercase' }}>
                      {a.type === 'note' ? '📝' : a.type === 'call' ? '📞' : a.type === 'email' ? '📧' : '🤝'} {a.title}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>{formatDate(a.created_at)}</span>
                    <button onClick={() => deleteActivity(a.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}><Trash2 size={12} /></button>
                  </div>
                  {a.body && <p style={{ margin: 0, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{a.body}</p>}
                </div>
              ))}
              {activities.length === 0 && <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Inga aktiviteter</p>}
            </div>
          </div>

          <div>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              <Bell size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} color="var(--gold)" />Påminnelser
            </h3>
            {reminderForm}
            {overdueReminders.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Försenade</div>
                {overdueReminders.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(224,82,82,.06)', border: '1px solid rgba(224,82,82,.2)', borderRadius: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 3 }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--red)' }}>Försenad: {r.due_date}</div>
                    </div>
                    <button onClick={() => toggleReminder(r.id)} style={{ padding: '4px 8px', background: 'var(--green)', border: 'none', borderRadius: 5, color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>✓</button>
                    <button onClick={() => deleteReminder(r.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
            {upcomingReminders.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Kommande</div>
                {upcomingReminders.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'var(--bg3)', border: `1px solid ${PRIORITY_COLOR[r.priority]}28`, borderRadius: 8, marginBottom: 6 }}>
                    <div style={{ width: 3, minHeight: 36, background: PRIORITY_COLOR[r.priority], borderRadius: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 3 }}>{r.title}</div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{r.due_date}</span>
                        <span style={{ fontSize: 10, color: PRIORITY_COLOR[r.priority], fontWeight: 700 }}>{PRIORITY_LABEL[r.priority]}</span>
                      </div>
                    </div>
                    <button onClick={() => toggleReminder(r.id)} style={{ padding: '4px 8px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--text3)', fontSize: 10, cursor: 'pointer' }}>✓ Klar</button>
                    <button onClick={() => deleteReminder(r.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
            {reminders.filter(r => r.status === 'done').length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, opacity: 0.6 }}>Avklarade</div>
                {reminders.filter(r => r.status === 'done').map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, marginBottom: 4, opacity: 0.5 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'line-through', flex: 1 }}>{r.title}</span>
                    <button onClick={() => deleteReminder(r.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            {reminders.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>Inga påminnelser</div>}
          </div>
        </div>
      )}

      {/* ── EDIT CUSTOMER MODAL ─────────────────────────────── */}
      {editMode && customer && (
        <div onClick={() => setEditMode(false)} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 24, fontFamily: 'var(--font-serif)' }}>Redigera kunduppgifter</div>

            {[
              { label: 'Företagsnamn', key: 'company', type: 'text' },
              { label: 'Kontaktperson', key: 'contact_name', type: 'text' },
              { label: 'E-post', key: 'email', type: 'email' },
              { label: 'Telefon', key: 'phone', type: 'tel' },
              { label: 'Stad', key: 'city', type: 'text' },
              { label: 'Org.nr', key: 'org_nr', type: 'text' },
              { label: 'Kontaktpersonens födelsedag', key: 'contact_birthday', type: 'date' },
            ].map(({ label, key, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>
                <input type={type} value={(editForm as any)[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '9px 13px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Prislista</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['A', 'B', 'C', 'Standard'] as const).map(pl => (
                  <button key={pl} onClick={() => setEditForm(f => ({ ...f, price_list_id: pl }))}
                    style={{ flex: 1, padding: '8px 4px', background: editForm.price_list_id === pl ? 'rgba(232,184,75,.1)' : 'var(--bg3)', border: `1px solid ${editForm.price_list_id === pl ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 8, color: editForm.price_list_id === pl ? 'var(--gold)' : 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {pl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Kundansvarig</label>
              <select value={editForm.account_manager || ''} onChange={e => setEditForm(f => ({ ...f, account_manager: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' }}>
                <option value="">— Ingen —</option>
                {SALESPEOPLE.map(sp => <option key={sp} value={sp}>{sp}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Nya ordrar från kunden går till och räknas på den här säljaren.</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['active', 'prospect', 'inactive'] as const).map(s => (
                  <button key={s} onClick={() => setEditForm(f => ({ ...f, status: s }))}
                    style={{ flex: 1, padding: '8px 4px', background: editForm.status === s ? 'rgba(232,184,75,.1)' : 'var(--bg3)', border: `1px solid ${editForm.status === s ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 8, color: editForm.status === s ? 'var(--gold)' : 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                    {s === 'active' ? 'Aktiv' : s === 'prospect' ? 'Prospekt' : 'Inaktiv'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditMode(false)} style={{ flex: 1, padding: 11, background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Avbryt</button>
              <button onClick={saveEdit} disabled={editSaving}
                style={{ flex: 2, padding: 11, background: 'var(--gold)', color: '#111', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: editSaving ? 0.6 : 1 }}>
                {editSaving ? 'Sparar…' : 'Spara ändringar'}
              </button>
            </div>
          </div>
        </div>
      )}


      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', padding: '12px 20px', fontSize: 13, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)' }} />
          {toast}
        </div>
      )}
    </div>
  )
}
