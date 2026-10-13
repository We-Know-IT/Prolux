'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Customer, Order, OrderItem, Activity, PRICE_LIST_LABEL, ORDER_STATUS_LABEL, OrderStatus } from '@/types'
import { fmt, formatDate, custPrice } from '@/lib/utils'
import {
  Plus, Mail, FileText, Bell, Calendar,
  TrendingUp, ShoppingBag, Package, Star,
  BarChart2, X, Trash2, ChevronLeft, ChevronRight, RefreshCw, Pencil, ShoppingCart, Info
} from 'lucide-react'
import { PriceListPicker } from '@/components/crm/NewCustomerModal'
import IncVat from '@/components/orders/IncVat'
import Portal from '@/components/ui/Portal'
import { recommendFor } from '@/lib/recommend'
import Link from 'next/link'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { useTeam, teamOptions } from '@/hooks/useTeam'
import { nextBirthday, formatBirthday } from '@/lib/birthdays'
import { useMe } from '@/hooks/useMe'

const supabase = createClient()

const PL_DISCOUNT_TEXT: Record<string, string> = { A: '40 % rabatt', B: '30 % rabatt', C: '20 % rabatt', Standard: 'ingen rabatt' }
const NOT_SOLD = ['draft', 'quote', 'cancelled']

function ProductPic({ src, size }: { src?: string | null; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 10, background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 4, boxSizing: 'border-box' }}>
      {src ? <img src={src} alt="" loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Package size={Math.round(size * 0.4)} color="#999" />}
    </div>
  )
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
  const SALESPEOPLE = useTeam()
  const me = useMe()
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
  const [productImages, setProductImages] = useState<Record<string, string | null>>({})
  const [imageByName, setImageByName]     = useState<Record<string, string | null>>({})
  const [nameById, setNameById]           = useState<Record<string, string>>({})
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [viewOrder, setViewOrder]         = useState<any | null>(null)
  const [editingActId, setEditingActId]   = useState<string | null>(null)
  const [editingActText, setEditingActText] = useState('')
  const [infoEdit, setInfoEdit]           = useState<string | null>(null)   // fast info being edited

  useEffect(() => { loadData() }, [id])
  useLiveRefresh(['customers', 'orders', 'order_items', 'activities', 'reminders'], loadData)

  function loadData() {
    if (!id) return
    Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('orders').select('id,order_nr,status,total,subtotal,vat_amount,created_at,delivery_city,notes,order_items(id,product_id,product_name,product_sku,qty,unit_price,list_price,total_price)').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('activities').select('id,type,title,body,created_by,created_at').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('reminders').select('*').eq('customer_id', id).order('due_date'),
      supabase.from('products').select('id,name,brand,list_price,unit,image_url').eq('active', true).order('sort_order'),
    ]).then(([{ data: c }, { data: o }, { data: a }, { data: r }, { data: p }]) => {
      if (c) setCustomer(c as Customer)
      if (o) { setOrders(o as any); setOrderItems(o.filter((x: any) => !NOT_SOLD.includes(x.status)).flatMap((x: any) => x.order_items || [])) }
      if (a) setActivities(a as any)
      if (r) setReminders(r)
      if (p) { setAllProductNames(p.map((x: any) => x.name)); setProductImages(Object.fromEntries(p.map((x: any) => [x.id, x.image_url]))); setImageByName(Object.fromEntries(p.map((x: any) => [x.name, x.image_url]))); setNameById(Object.fromEntries(p.map((x: any) => [x.id, x.name]))) }
      setLoading(false)
    })
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Recommendations: what other customers bought together with this customer's products.
  useEffect(() => {
    if (Object.keys(nameById).length === 0) return
    const qty = new Map<string, number>()
    for (const it of orderItems) if (it.product_id) qty.set(it.product_id, (qty.get(it.product_id) ?? 0) + it.qty)
    const top = [...qty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id)
    let alive = true
    recommendFor(supabase, top, 4, new Set(Object.keys(nameById)))
      .then(ids => { if (alive) setRecommendations(ids.map(id => nameById[id]).filter(Boolean)) })
    return () => { alive = false }
  }, [orderItems, nameById])

  async function addActivity() {
    if (!customer || !noteText.trim()) return
    const titles = { note: 'Anteckning', call: 'Samtal', email: 'E-post', meeting: 'Möte' }
    const { data, error } = await supabase.from('activities').insert({
      customer_id: customer.id, type: noteType,
      title: titles[noteType], body: noteText, created_by: me.name || 'CRM'
    }).select().single()
    if (!error && data) { setActivities(as => [data, ...as]); setNoteText(''); showToast('Sparad') }
  }

  async function saveActivityEdit(id: string) {
    const body = editingActText.trim()
    const { error } = await supabase.from('activities').update({ body }).eq('id', id)
    if (error) { showToast('Kunde inte spara: ' + error.message); return }
    setActivities(as => as.map(a => a.id === id ? { ...a, body } : a))
    setEditingActId(null); showToast('Anteckningen uppdaterad')
  }

  async function saveFixedInfo() {
    if (!customer || infoEdit === null) return
    const fixed_info = infoEdit.trim() || null
    const { error } = await supabase.from('customers').update({ fixed_info }).eq('id', customer.id)
    if (error) { showToast(error.message.includes('fixed_info') ? 'Kör migration 0019 först' : 'Kunde inte spara: ' + error.message); return }
    setCustomer({ ...customer, fixed_info }); setInfoEdit(null); showToast('Fast info sparad')
  }

  async function deleteActivity(id: string) {
    await supabase.from('activities').delete().eq('id', id)
    setActivities(as => as.filter(a => a.id !== id))
  }

  async function addReminder() {
    if (!customer || !reminderText.trim() || !reminderDate) return
    const { data, error } = await supabase.from('reminders').insert({
      customer_id: customer.id, title: reminderText, due_date: reminderDate,
      priority: reminderPriority, status: 'upcoming', created_by: me.name || 'CRM',
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
    setEditForm({ company: customer.company, contact_name: customer.contact_name, email: customer.email, phone: customer.phone || '', address: customer.address || '', postal_code: customer.postal_code || '', city: customer.city || '', org_nr: customer.org_nr || '', price_list_id: customer.price_list_id, status: customer.status, account_manager: customer.account_manager || '', birthday: customer.birthday || '', customer_type: customer.customer_type === 'private' ? 'private' : 'business', fixed_info: customer.fixed_info || '' })
    setEditMode(true)
  }

  async function saveEdit() {
    if (!customer) return
    setEditSaving(true)
    const { data, error } = await supabase.from('customers').update({ ...editForm, account_manager: editForm.account_manager || null, birthday: editForm.birthday || null, fixed_info: (editForm.fixed_info || '').trim() || null }).eq('id', customer.id).select().single()
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
  const sold           = orders.filter(o => !NOT_SOLD.includes(o.status))
  const openCarts      = orders.filter(o => o.status === 'draft' || o.status === 'quote')
  const totalSpend     = sold.reduce((s, o) => s + (o.total || 0), 0)
  const ordersThisYear = sold.filter(o => new Date(o.created_at).getFullYear() === new Date().getFullYear()).length
  const avgOrderValue  = sold.length ? Math.round(totalSpend / sold.length) : 0
  // Latest purchases with pictures: newest first, one tile per product.
  const recentBuys: { id: string; name: string; qty: number; last: string }[] = []
  for (const o of sold) for (const it of ((o as any).order_items || []) as OrderItem[]) {
    const hit = recentBuys.find(r => r.id === it.product_id)
    if (hit) hit.qty += it.qty
    else recentBuys.push({ id: it.product_id, name: it.product_name, qty: it.qty, last: o.created_at })
  }
  const productFreq: Record<string, { name: string; qty: number; total: number }> = {}
  const lastSold = sold[0]
  for (const item of orderItems) {
    if (!productFreq[item.product_name]) productFreq[item.product_name] = { name: item.product_name, qty: 0, total: 0 }
    productFreq[item.product_name].qty += item.qty
    productFreq[item.product_name].total += item.total_price
  }
  const topProducts    = Object.values(productFreq).sort((a, b) => b.qty - a.qty).slice(0, 6)
  const maxQty         = topProducts[0]?.qty || 1
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

  const activityItem = (a: Activity, pad: string) => (
    <div key={a.id} style={{ ...card, border: `1px solid ${activityColor[a.type]}28`, padding: pad }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: activityColor[a.type], textTransform: 'uppercase' }}>
          {a.type === 'note' ? '📝' : a.type === 'call' ? '📞' : a.type === 'email' ? '📧' : '🤝'} {a.title}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 'auto' }}>{formatDate(a.created_at)}</span>
        {editingActId !== a.id && (
          <button onClick={() => { setEditingActId(a.id); setEditingActText(a.body || '') }} aria-label="Redigera anteckning" title="Redigera"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 2 }}><Pencil size={12} /></button>
        )}
        <button onClick={() => deleteActivity(a.id)} aria-label="Ta bort anteckning" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 2 }}><Trash2 size={12} /></button>
      </div>
      {editingActId === a.id ? (
        <div>
          <textarea autoFocus value={editingActText} onChange={e => setEditingActText(e.target.value)} rows={3}
            style={{ width: '100%', padding: '8px 10px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => saveActivityEdit(a.id)} style={{ padding: '5px 14px', background: 'var(--gold)', border: 'none', borderRadius: 6, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Spara</button>
            <button onClick={() => setEditingActId(null)} style={{ padding: '5px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>Avbryt</button>
          </div>
        </div>
      ) : a.body && <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{a.body}</p>}
    </div>
  )

  const orderRow = (o: Order, big = false) => {
    const items = ((o as any).order_items || []) as OrderItem[]
    return (
      <button key={o.id} type="button" onClick={() => setViewOrder(o)}
        style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', padding: big ? '14px 18px' : '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,184,75,.35)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}>
        <div style={{ display: 'flex', gap: 4 }}>
          {items.slice(0, big ? 5 : 3).map(it => <ProductPic key={it.id} src={productImages[it.product_id]} size={big ? 46 : 36} />)}
        </div>
        <div style={{ flex: 1, minWidth: 110 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.status === 'quote' ? 'Offert' : o.status === 'draft' ? 'Varukorg' : 'Order'} #{o.order_nr}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{formatDate(o.created_at)} · {items.reduce((n, it) => n + it.qty, 0)} st</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{fmt(o.total)} kr</div>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(76,175,125,.12)', color: 'var(--green)', fontWeight: 700 }}>{ORDER_STATUS_LABEL[o.status as OrderStatus] || o.status}</span>
        </div>
        <ChevronRight size={15} color="var(--text2)" />
      </button>
    )
  }

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
              {customer.customer_type === 'private' && (
                <span className="badge badge-blue" style={{ marginLeft: 4 }}>Privatkund</span>
              )}
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
            {lastSold && (
              <button onClick={() => router.push(`/crm/orders?reorder=${lastSold.id}`)} title={`Samma produkter som order #${lastSold.order_nr}, med dagens priser`}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 7, color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <RefreshCw size={13} /> Sälj igen
              </button>
            )}
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
              ['E-post', customer.email], ['Telefon', customer.phone || '—'], ['Adress', [customer.address, [customer.postal_code, customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'],
              ['Org.nr', customer.org_nr || '—'], ['Status', ({ active: 'Aktiv', inactive: 'Inaktiv', prospect: 'Prospekt' } as Record<string, string>)[customer.status] || customer.status], ['Prislista', `${customer.price_list_id} · ${PL_DISCOUNT_TEXT[customer.price_list_id] || ''}`],
              ['Kontaktperson', customer.contact_name || '—'],
              ['Födelsedag', customer.birthday ? (() => {
                const nb = nextBirthday(customer.birthday)
                const when = nb.daysUntil === 0 ? 'idag 🎉' : nb.daysUntil === 1 ? 'imorgon' : `om ${nb.daysUntil} dagar`
                return `${formatBirthday(customer.birthday)}${nb.turns ? ` · fyller ${nb.turns}` : ''} (${when})`
              })() : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
            {/* Fast info: a standing note, e.g. how to find the delivery entrance */}
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Info size={13} color="var(--gold)" />
                <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Fast info</span>
                {infoEdit === null && (
                  <button onClick={() => setInfoEdit(customer.fixed_info || '')} aria-label="Redigera fast info"
                    style={{ marginLeft: 6, background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 2, display: 'flex' }}><Pencil size={12} /></button>
                )}
              </div>
              {infoEdit === null ? (
                customer.fixed_info
                  ? <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{customer.fixed_info}</p>
                  : <button onClick={() => setInfoEdit('')} style={{ background: 'none', border: '1px dashed var(--line)', borderRadius: 8, padding: '8px 12px', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                      + Skriv något som alltid gäller kunden, t.ex. "Leverans en trappa ned till höger"
                    </button>
              ) : (
                <div>
                  <textarea autoFocus value={infoEdit} onChange={e => setInfoEdit(e.target.value)} rows={2} maxLength={500}
                    placeholder="T.ex. Kunden befinner sig en trappa ned till höger"
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={saveFixedInfo} style={{ padding: '7px 16px', background: 'var(--gold)', border: 'none', borderRadius: 7, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Spara</button>
                    <button onClick={() => setInfoEdit(null)} style={{ padding: '7px 14px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 7, color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>Avbryt</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Saved carts (drafts) and quotes */}
          {openCarts.length > 0 && (
            <div style={{ ...card, padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCart size={14} color="var(--gold)" /> Påbörjade varukorgar & offerter
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {openCarts.map(o => {
                  const items = ((o as any).order_items || []) as OrderItem[]
                  return (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {items.slice(0, 4).map(it => <ProductPic key={it.id} src={productImages[it.product_id]} size={40} />)}
                      </div>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.status === 'quote' ? 'Offert' : 'Varukorg'} #{o.order_nr}</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{formatDate(o.created_at)} · {items.reduce((n, it) => n + it.qty, 0)} st · {fmt(o.subtotal)} kr exkl. moms</div>
                      </div>
                      <button onClick={() => router.push(`/crm/orders?edit=${o.id}`)}
                        style={{ padding: '7px 14px', background: 'var(--gold)', border: 'none', borderRadius: 7, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Fortsätt
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
                  {orders.slice(0, 4).map(o => orderRow(o))}
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
                {activities.slice(0, 4).map(a => activityItem(a, '10px 14px'))}
                {activities.length === 0 && <p style={{ color: 'var(--text3)', fontSize: 13 }}>Inga aktiviteter</p>}
              </div>
            </div>
          </div>

          {/* Product tags */}
          {recentBuys.length > 0 && (
            <div style={{ ...card, padding: '18px 24px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Senaste köp</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: recommendations.length > 0 ? 16 : 0 }}>
                {recentBuys.slice(0, 8).map(p => (
                  <Link key={p.id} href={`/crm/orders?customer=${customer.id}&product=${encodeURIComponent(p.name)}`} title={`Sälj ${p.name} igen`}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 10, background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none' }}>
                    <ProductPic src={productImages[p.id]} size={96} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', textAlign: 'center', lineHeight: 1.3 }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text2)' }}>{p.qty} st · {formatDate(p.last)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)' }}>+ Sälj igen</span>
                  </Link>
                ))}
              </div>
              {recommendations.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Star size={12} color="var(--gold)" /> Rekommendationer
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                    {recommendations.map(rec => (
                      <Link key={rec} href={`/crm/orders?customer=${customer.id}&product=${encodeURIComponent(rec)}`} title={`Sälj ${rec}`}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 10, background: 'rgba(232,184,75,.05)', border: '1px solid rgba(232,184,75,.18)', borderRadius: 12, textDecoration: 'none' }}>
                        <ProductPic src={imageByName[rec]} size={96} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', textAlign: 'center', lineHeight: 1.3 }}>{rec}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)' }}>+ Sälj</span>
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
          {orders.map(o => orderRow(o, true))}
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
                    <ProductPic src={imageByName[rec]} size={56} />
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
              {activities.map(a => activityItem(a, '12px 14px'))}
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
      {editMode && customer && (<Portal>
        <div onClick={() => setEditMode(false)} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 24, fontFamily: 'var(--font-serif)' }}>Redigera kunduppgifter</div>

            {[
              { label: 'Företagsnamn', key: 'company', type: 'text' },
              { label: 'Kontaktperson', key: 'contact_name', type: 'text' },
              { label: 'E-post', key: 'email', type: 'email' },
              { label: 'Telefon', key: 'phone', type: 'tel' },
              { label: 'Adress', key: 'address', type: 'text' },
              { label: 'Postnummer', key: 'postal_code', type: 'text' },
              { label: 'Stad', key: 'city', type: 'text' },
              { label: 'Org.nr', key: 'org_nr', type: 'text' },
              { label: 'Kontaktpersonens födelsedag', key: 'birthday', type: 'date' },
            ].map(({ label, key, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>
                <input type={type} value={(editForm as any)[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '9px 13px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Kundtyp</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([['business', 'Företag · exkl. moms'], ['private', 'Privat · inkl. moms']] as const).map(([t, l]) => (
                  <button key={t} onClick={() => setEditForm(f => ({ ...f, customer_type: t }))}
                    style={{ flex: 1, padding: '8px 4px', background: editForm.customer_type === t ? 'rgba(74,143,212,.12)' : 'var(--bg3)', border: `1px solid ${editForm.customer_type === t ? 'var(--blue)' : 'var(--line)'}`, borderRadius: 8, color: editForm.customer_type === t ? 'var(--text)' : 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Prislista</label>
              <PriceListPicker value={editForm.price_list_id || 'Standard'} onChange={pl => setEditForm(f => ({ ...f, price_list_id: pl }))} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Fast info</label>
              <textarea value={editForm.fixed_info || ''} onChange={e => setEditForm(f => ({ ...f, fixed_info: e.target.value }))} rows={2} maxLength={500}
                placeholder="T.ex. Kunden befinner sig en trappa ned till höger"
                style={{ width: '100%', padding: '9px 13px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Kundansvarig</label>
              <select value={editForm.account_manager || ''} onChange={e => setEditForm(f => ({ ...f, account_manager: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' }}>
                <option value="">— Ingen —</option>
                {teamOptions(SALESPEOPLE, editForm.account_manager).map(sp => <option key={sp} value={sp}>{sp}</option>)}
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
      </Portal>)}


      {viewOrder && (<Portal>
        <div onClick={() => setViewOrder(null)} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-label={`Order #${viewOrder.order_nr}`} onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 16, width: '100%', maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>{viewOrder.status === 'quote' ? 'Offert' : viewOrder.status === 'draft' ? 'Varukorg' : 'Order'} #{viewOrder.order_nr}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{formatDate(viewOrder.created_at)} · {ORDER_STATUS_LABEL[viewOrder.status as OrderStatus] || viewOrder.status}</div>
              </div>
              <button onClick={() => setViewOrder(null)} aria-label="Stäng" style={{ marginLeft: 'auto', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', padding: 6, display: 'flex' }}><X size={16} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '6px 22px' }}>
              {(((viewOrder.order_items || []) as OrderItem[])).map(it => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                  <ProductPic src={productImages[it.product_id]} size={72} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{it.product_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{it.qty} × {fmt(it.unit_price)} kr{it.product_sku ? ` · ${it.product_sku}` : ''}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>{fmt(it.total_price)} kr<IncVat net={it.total_price} /></div>
                </div>
              ))}
              {viewOrder.notes && <p style={{ fontSize: 12, color: 'var(--text2)', margin: '12px 0 0', whiteSpace: 'pre-line' }}>{viewOrder.notes}</p>}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text)', marginBottom: 4 }}><span>Summa exkl. moms</span><span>{fmt(viewOrder.subtotal)} kr</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}><span>Moms</span><span>{fmt(viewOrder.vat_amount)} kr</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}><span>Totalt inkl. moms</span><span style={{ color: 'var(--gold)' }}>{fmt(viewOrder.total)} kr</span></div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(viewOrder.status === 'draft' || viewOrder.status === 'quote') ? (
                  <button onClick={() => router.push(`/crm/orders?edit=${viewOrder.id}`)} style={{ flex: 1, padding: '12px 0', background: 'var(--gold)', border: 'none', borderRadius: 9, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    {viewOrder.status === 'quote' ? 'Öppna offerten' : 'Fortsätt med varukorgen'}
                  </button>
                ) : (
                  <button onClick={() => router.push(`/crm/orders?reorder=${viewOrder.id}`)} style={{ flex: 1, padding: '12px 0', background: 'var(--gold)', border: 'none', borderRadius: 9, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <RefreshCw size={15} /> Sälj igen
                  </button>
                )}
                <button onClick={() => setViewOrder(null)} style={{ padding: '12px 20px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}>Stäng</button>
              </div>
            </div>
          </div>
        </div>
      </Portal>)}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', padding: '12px 20px', fontSize: 13, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)' }} />
          {toast}
        </div>
      )}
    </div>
  )
}
