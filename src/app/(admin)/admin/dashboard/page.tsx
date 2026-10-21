'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { monthRange, budgetAchieved, isLiveOrder } from '@/lib/team'
import { useTeam } from '@/hooks/useTeam'
import { useBudgetHistory } from '@/hooks/useBudgetHistory'
import BudgetHistoryChart from '@/components/BudgetHistoryChart'
import ReminderModal, { type Reminder } from '@/components/crm/ReminderModal'
import VisitList from '@/components/crm/VisitList'
import { LeadsPanel, QuotesPanel, FollowUpPanel, ToShipPanel } from '@/components/crm/LeadsAndQuotes'
import { TrendingUp, ShoppingBag, Clock, Users, AlertTriangle, GitBranch, Target, ArrowRight, Bell } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Varukorg', quote: 'Offert', pending: 'Väntande', confirmed: 'Bekräftad',
  packed: 'Packad', shipped: 'Skickad', delivered: 'Levererad', cancelled: 'Avbruten',
}
const STATUS_CSS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: 'rgba(212,138,58,.14)',  color: '#D48A3A' },
  confirmed: { bg: 'rgba(232,184,75,.12)',  color: '#E8B84B' },
  packed:    { bg: 'rgba(232,184,75,.12)',  color: '#E8B84B' },
  shipped:   { bg: 'rgba(66,153,225,.12)',  color: '#4299E1' },
  delivered: { bg: 'rgba(76,175,125,.12)',  color: '#4CAF7D' },
  cancelled: { bg: 'rgba(224,82,82,.12)',   color: '#E05252' },
  draft:     { bg: 'rgba(155,160,171,.12)', color: '#9BA0AB' },
  quote:     { bg: 'rgba(155,110,232,.12)', color: '#9B6EE8' },
}

function workingDaysInMonth(year: number, month: number) {
  let count = 0
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export default function AdminDashboard() {
  const SALESPEOPLE = useTeam()
  const router = useRouter()
  const [orders, setOrders]       = useState<any[]>([])
  const [products, setProducts]   = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [deals, setDeals]           = useState<any[]>([])
  const [wonDeals, setWonDeals]     = useState<any[]>([])
  const { months: budgetHistory }   = useBudgetHistory(6)
  const [budgets, setBudgets]       = useState<Record<string, number>>({})
  const [reminders, setReminders]   = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('week')
  const [editBudget, setEditBudget]     = useState(false)
  const [budgetInput, setBudgetInput]   = useState<Record<string, string>>({})
  const [savingBudget, setSavingBudget] = useState(false)
  const [remModal, setRemModal]         = useState<{ reminder: Reminder | null } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()
  const monthStart = `${year}-${String(month + 1).padStart(2,'0')}-01`
  const monthEnd   = `${year}-${String(month + 1).padStart(2,'0')}-${new Date(year, month + 1, 0).getDate()}`
  const monthNames = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December']

  function loadData() {
    const sb = createClient()
    Promise.all([
      sb.from('orders').select('*,customers(company,contact_name)').order('created_at', { ascending: false }),
      sb.from('products').select('*').order('sort_order'),
      sb.from('customers').select('*').order('company'),
      sb.from('deals').select('id,title,value,stage,assigned_to,updated_at').neq('stage', 'Vunnen').neq('stage', 'Förlorad'),
      sb.from('deals').select('id,assigned_to,value,updated_at').eq('stage', 'Vunnen').gte('updated_at', monthStart).lte('updated_at', monthEnd + 'T23:59:59'),
      sb.from('sales_budgets').select('salesperson,budget').eq('year', year).eq('month', month),
      sb.from('reminders').select('id,customer_id,title,due_date,priority,status,customers(company)').eq('status', 'upcoming').order('due_date').limit(50),
      // Notes, calls, e-mails and meetings logged on customer cards (plus new web accounts and B2B enquiries).
      sb.from('activities').select('id,type,title,body,created_by,created_at,customers(id,company)').order('created_at', { ascending: false }).limit(12),
    ]).then(([{ data: o }, { data: p }, { data: c }, { data: d }, { data: w }, { data: b }, { data: r }, { data: a }]) => {
      setOrders(o || [])
      setProducts(p || [])
      setCustomers(c || [])
      setDeals(d || [])
      setWonDeals(w || [])
      if (b) {
        const map: Record<string, number> = {}
        for (const row of b as any[]) map[row.salesperson] = row.budget
        setBudgets(map)
      }
      if (r) setReminders(r)
      if (a) setActivities(a.map((x: any) => ({ ...x, activity_type: x.type, notes: [x.title, x.body].filter(Boolean).join(' – ') })))
    })
  }

  useEffect(() => { loadData() }, [])
  useLiveRefresh(['orders', 'products', 'customers', 'deals', 'sales_budgets', 'reminders', 'activities'], loadData)

  // Seed the form from the latest saved budgets when opening it, so a background
  // refresh never overwrites what the user is typing.
  function openBudgetEditor() {
    setBudgetInput(Object.fromEntries(SALESPEOPLE.map(sp => [sp, budgets[sp] ? String(budgets[sp]) : ''])))
    setEditBudget(true)
  }

  useEffect(() => { drawChart() }, [orders, chartPeriod])

  async function saveBudgets() {
    setSavingBudget(true)
    const sb = createClient()
    const rows = SALESPEOPLE
      .map(sp => ({ salesperson: sp, year, month, budget: parseInt(budgetInput[sp] || '0') || 0 }))
      .filter(r => r.budget > 0)
    await sb.from('sales_budgets').upsert(rows, { onConflict: 'salesperson,year,month' })
    const removed = SALESPEOPLE.filter(sp => !(parseInt(budgetInput[sp] || '0') > 0))
    for (const sp of removed) {
      await sb.from('sales_budgets').delete().eq('salesperson', sp).eq('year', year).eq('month', month)
    }
    const newBudgets: Record<string, number> = {}
    for (const sp of SALESPEOPLE) {
      const v = parseInt(budgetInput[sp] || '0')
      if (v > 0) newBudgets[sp] = v
    }
    setBudgets(newBudgets)
    setSavingBudget(false)
    setEditBudget(false)
  }


  async function markReminderDone(id: string) {
    const sb = createClient()
    await sb.from('reminders').update({ status: 'done' }).eq('id', id)
    setReminders(rs => rs.filter(r => r.id !== id))
  }

  function drawChart() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.parentElement?.clientWidth || 800
    canvas.width = W
    canvas.height = 180

    const days = chartPeriod === 'week' ? 7 : 30
    const buckets: Record<string, number> = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      buckets[d.toISOString().slice(0, 10)] = 0
    }
    orders.filter(o => isLiveOrder(o.status)).forEach(o => {
      const d = o.created_at?.slice(0, 10)
      if (d && d in buckets) buckets[d] += o.subtotal || 0
    })

    const vals = Object.values(buckets)
    const max  = Math.max(...vals, 1)
    const keys = Object.keys(buckets)
    const barW = Math.max(4, Math.floor((W - 72) / days) - 5)
    const padL = 56, padB = 30, padT = 16, chartH = canvas.height - padB - padT

    ctx.clearRect(0, 0, W, canvas.height)
    ctx.strokeStyle = 'rgba(255,255,255,.035)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - 10, y); ctx.stroke()
      ctx.fillStyle = 'rgba(78,85,102,.8)'
      ctx.font = '10px Inter'
      ctx.textAlign = 'right'
      ctx.fillText(fmt(max - (max / 4) * i), padL - 6, y + 4)
    }
    vals.forEach((v, i) => {
      const x  = padL + i * ((W - padL - 10) / days)
      const bh = Math.max(2, (v / max) * chartH)
      const y  = padT + chartH - bh
      const grad = ctx.createLinearGradient(0, y, 0, y + bh)
      grad.addColorStop(0, 'rgba(245,204,106,.85)')
      grad.addColorStop(0.4, 'rgba(232,184,75,.7)')
      grad.addColorStop(1, 'rgba(180,130,40,.15)')
      ctx.fillStyle = grad
      const r = Math.min(3, bh / 2)
      ctx.beginPath()
      ctx.moveTo(x, y + r)
      ctx.arcTo(x, y, x + r, y, r)
      ctx.arcTo(x + barW, y, x + barW, y + r, r)
      ctx.lineTo(x + barW, y + bh)
      ctx.lineTo(x, y + bh)
      ctx.closePath()
      ctx.fill()
      if (days === 7 || i % 5 === 0) {
        const d = new Date(keys[i])
        ctx.fillStyle = 'rgba(78,85,102,.8)'
        ctx.font = '9px Inter'
        ctx.textAlign = 'center'
        ctx.fillText(`${d.getDate()}/${d.getMonth() + 1}`, x + barW / 2, canvas.height - 8)
      }
    })
  }

  const todayStr = now.toISOString().slice(0, 10)
  const PRIORITY_DOT: Record<string, string> = { high: 'var(--red)', normal: 'var(--blue)', low: 'var(--text3)' }

  const revenue         = orders.filter(o => isLiveOrder(o.status)).reduce((s, o) => s + (o.subtotal || 0), 0)
  const pendingCount    = orders.filter(o => o.status === 'pending').length
  const todayOrders     = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length
  const activeCustomers = customers.filter(c => c.status === 'active').length
  const lowStock        = products.filter(p => p.stock_qty < 20).sort((a, b) => a.stock_qty - b.stock_qty)
  const pipelineValue   = deals.reduce((s, d) => s + (d.value || 0), 0)
  const totalBudget     = Object.values(budgets).reduce((a, b) => a + b, 0)
  const workDays        = workingDaysInMonth(year, month)

  // Budget credit: this month's orders per assignee.
  const { start: salesStart, end: salesEnd } = monthRange(now)
  const ordersThisMonth = orders.filter(o => o.created_at >= salesStart && o.created_at <= salesEnd)
  const soldBySP        = budgetAchieved(ordersThisMonth, wonDeals, orders.filter(o => isLiveOrder(o.status)))
  const soldThisMonth   = Object.values(soldBySP).reduce((a, b) => a + b, 0)
  const unassignedCount = orders.filter(o => !o.assigned_to && o.status === 'pending').length

  const card: React.CSSProperties = {
    background: 'rgba(13,16,23,.7)',
    backdropFilter: 'saturate(180%) blur(20px)',
    WebkitBackdropFilter: 'saturate(180%) blur(20px)',
    border: '1px solid var(--line)',
    borderRadius: 14,
    boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 6px 28px rgba(0,0,0,.35)',
  }

  const kpis: { label: string; value: string; sub: string; icon: typeof Clock; href: string; gold?: boolean; alert?: boolean; blue?: boolean; green?: boolean }[] = [
    { label: 'Total omsättning',  value: `${fmt(revenue)} kr`,         sub: 'alla ordrar exkl. moms',     icon: TrendingUp, gold: true, href: '/admin/orders' },
    { label: 'Aktiva ordrar',     value: pendingCount.toString(),       sub: unassignedCount > 0 ? `${unassignedCount} saknar säljare` : 'väntande behandling',         icon: Clock,      alert: pendingCount > 0, href: unassignedCount > 0 ? '/admin/orders?status=unassigned' : '/admin/orders?status=pending' },
    { label: 'Ordrar idag',       value: todayOrders.toString(),        sub: 'nya ordrar',                  icon: ShoppingBag, href: '/admin/orders?status=today' },
    { label: 'Aktiva kunder',     value: activeCustomers.toString(),    sub: `av ${customers.length} totalt`, icon: Users, href: '/admin/customers' },
    { label: 'Pipeline-värde',    value: `${fmt(pipelineValue)} kr`,   sub: `${deals.length} aktiva deals`, icon: GitBranch, blue: true, href: '/admin/crm/pipeline' },
  ]

  return (
    <div style={{ padding: 'clamp(14px,4vw,28px) clamp(14px,4vw,28px) 60px', maxWidth: 1400, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em', margin: 0 }}>
            Admin<span style={{ color: 'var(--gold)', fontStyle: 'italic' }}> översikt</span>
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>
            {now.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })} · Live-vy
          </p>
        </div>
        <Link href="/crm/dashboard" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', background: 'rgba(74,143,212,.08)', border: '1px solid rgba(74,143,212,.2)',
          borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#6AAFF0', textDecoration: 'none',
        }}>
          <GitBranch size={13} /> CRM-verktyg <ArrowRight size={12} />
        </Link>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 12, marginBottom: 24 }}>
        {kpis.map((k, i) => {
          const Icon = k.icon
          const borderColor = k.gold ? 'var(--line-gold)' : k.alert ? 'rgba(212,138,58,.2)' : k.blue ? 'rgba(74,143,212,.18)' : k.green ? 'rgba(76,175,125,.18)' : 'var(--line)'
          const iconBg   = k.gold ? 'rgba(232,184,75,.1)' : k.alert ? 'rgba(212,138,58,.1)' : k.blue ? 'rgba(74,143,212,.1)' : k.green ? 'rgba(76,175,125,.1)' : 'rgba(255,255,255,.04)'
          const iconColor = k.gold ? 'var(--gold)' : k.alert ? '#D48A3A' : k.blue ? '#6AAFF0' : k.green ? 'var(--green)' : 'var(--text3)'
          return (
            <Link key={i} href={k.href} className="kpi-link" style={{ ...card, display: 'block', textDecoration: 'none', padding: '20px 22px', borderColor, boxShadow: k.gold ? `${card.boxShadow}, var(--gold-glow)` : card.boxShadow as string }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{k.label}</span>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: iconBg, border: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={13} color={iconColor} />
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 500, lineHeight: 1, marginBottom: 5,
                background: k.gold ? 'linear-gradient(135deg,#F5CC6A,#E8B84B)' : 'none',
                WebkitBackgroundClip: k.gold ? 'text' : 'unset',
                WebkitTextFillColor: k.gold ? 'transparent' : 'unset',
                color: k.alert ? '#D48A3A' : k.blue ? '#6AAFF0' : k.green ? 'var(--green)' : 'var(--text)',
              }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{k.sub}</div>
            </Link>
          )
        })}
      </div>

      {/* To do */}
      <div style={{ ...card, padding: '20px 24px', marginBottom: 16, border: `1px solid ${reminders.length ? 'rgba(232,184,75,.45)' : 'var(--line)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(232,184,75,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bell size={15} color="var(--gold)" /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>To do {reminders.length > 0 && <span style={{ fontSize: 12, fontWeight: 800, padding: '1px 9px', borderRadius: 10, background: 'var(--gold)', color: '#111', marginLeft: 6 }}>{reminders.length}</span>}</span>
          <button onClick={() => setRemModal({ reminder: null })} style={{ fontSize: 13, padding: '6px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer' }}>+ Ny to do</button>
        </div>
        {reminders.length === 0 && <div style={{ fontSize: 14, color: 'var(--green)', fontWeight: 600 }}>✓ Inget som väntar just nu</div>}
        {[...reminders].sort((x, y) => (x.due_date || '').localeCompare(y.due_date || '')).map((r, i) => {
          const d = (r.due_date || '').slice(0, 10)
          const late = d < todayStr
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--line2)' : 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[r.priority] || 'var(--blue)', flexShrink: 0 }} />
              <button type="button" onClick={() => setRemModal({ reminder: r })} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.title}</div>
                <div style={{ fontSize: 13, color: late ? '#E0A85A' : 'var(--text2)' }}>{r.customers?.company ? `${r.customers.company} · ` : ''}{late ? `försenad sedan ${d}` : d === todayStr ? 'idag' : d}</div>
              </button>
              <button onClick={() => markReminderDone(r.id)} style={{ padding: '6px 12px', background: 'rgba(76,175,125,.12)', border: '1px solid rgba(76,175,125,.35)', borderRadius: 7, color: 'var(--green)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Klar</button>
            </div>
          )
        })}
      </div>

      <VisitList />

      {/* Att göra: quotes and carts to follow up (shown only when there are any) */}
      <div style={{ marginBottom: 16 }}><FollowUpPanel onlyQuotes /></div>
      <ToShipPanel />

      {/* Leads and open quotes (saved carts belong in the CRM) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24, alignItems: 'start' }}>
        <LeadsPanel />
        <QuotesPanel />
      </div>

      {/* Chart + Budget side by side */}
      <div className="dash-chart-row" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginBottom: 20 }}>

        {/* Revenue chart */}
        <div style={{ ...card, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Omsättning</span>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
              {(['week', 'month'] as const).map(p => (
                <button key={p} onClick={() => setChartPeriod(p)} style={{
                  padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: chartPeriod === p ? 'rgba(232,184,75,.1)' : 'transparent',
                  color: chartPeriod === p ? 'var(--gold)' : 'var(--text3)',
                  border: 'none', borderRight: p === 'week' ? '1px solid var(--line)' : 'none',
                  transition: 'all .15s', fontFamily: 'var(--font-sans)',
                }}>
                  {p === 'week' ? '7 dagar' : '30 dagar'}
                </button>
              ))}
            </div>
          </div>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
        </div>

        {/* Team budget widget */}
        <div style={{ ...card, padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Target size={14} color="var(--gold)" />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Budget — {monthNames[month]}</span>
            </div>
            <button onClick={() => editBudget ? setEditBudget(false) : openBudgetEditor()}
              style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(232,184,75,.1)', border: '1px solid rgba(232,184,75,.2)', borderRadius: 6, color: 'var(--gold)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
              {editBudget ? 'Avbryt' : 'Sätt budget'}
            </button>
          </div>

          {editBudget ? (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {SALESPEOPLE.map(sp => (
                  <div key={sp}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }}>{sp}</label>
                    <div style={{ position: 'relative' }}>
                      <input type="number" placeholder="0" value={budgetInput[sp] || ''} onChange={e => setBudgetInput(b => ({ ...b, [sp]: e.target.value }))}
                        style={{ width: '100%', padding: '8px 32px 8px 10px', background: 'var(--bg4)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text3)' }}>kr</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={saveBudgets} disabled={savingBudget}
                style={{ width: '100%', padding: '9px 20px', background: 'var(--gold)', border: 'none', borderRadius: 7, color: '#111', fontSize: 13, fontWeight: 700, cursor: savingBudget ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: savingBudget ? 0.7 : 1 }}>
                {savingBudget ? 'Sparar...' : 'Spara budget'}
              </button>
            </div>
          ) : totalBudget > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {SALESPEOPLE.filter(sp => budgets[sp]).map(sp => {
                  const budget   = budgets[sp]
                  const achieved = soldBySP[sp] || 0
                  const pct      = Math.min((achieved / budget) * 100, 100)
                  const isGreen  = achieved >= budget
                  return (
                    <div key={sp}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{sp}</span>
                        <span style={{ fontSize: 11, color: isGreen ? 'var(--green)' : 'var(--text3)' }}>
                          {fmt(achieved)} / {fmt(budget)} kr
                        </span>
                      </div>
                      <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: isGreen ? 'var(--green)' : 'linear-gradient(90deg,#E8B84B,#F5CC6A)', borderRadius: 3, transition: 'width .4s' }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                        {Math.round(pct)}% · dagsmål {fmt(Math.round(budget / workDays))} kr
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>Total budget</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmt(totalBudget)} kr</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>Sålt</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: soldThisMonth > 0 ? 'var(--green)' : 'var(--text3)' }}>{fmt(soldThisMonth)} kr</div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Target size={28} color="rgba(232,184,75,.25)" />
              <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>Ingen budget satt</div>
              <button onClick={openBudgetEditor}
                style={{ fontSize: 12, color: 'var(--gold)', background: 'rgba(232,184,75,.08)', border: '1px solid rgba(232,184,75,.2)', borderRadius: 7, padding: '6px 14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Sätt budget →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, alignItems: 'start' }}>

        {/* Recent orders */}
        <div style={{ ...card, padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Senaste ordrar</span>
            <Link href="/admin/orders" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Visa alla →</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['#', 'Kund', 'Belopp', 'Status'].map(h => (
                  <th key={h} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 0 10px', textAlign: 'left', borderBottom: '1px solid var(--line2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 7).map(o => (
                <tr key={o.id} onClick={() => router.push(`/admin/orders?order=${o.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid var(--line2)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)', fontWeight: 500 }}>#{o.order_nr}</span>
                  </td>
                  <td style={{ padding: '10px 0', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--line2)' }}>{(o.customers?.company || o.delivery_name || '—').slice(0, 16)}</td>
                  <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', borderBottom: '1px solid var(--line2)' }}>{fmt(o.subtotal)}</td>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid var(--line2)' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: (STATUS_CSS[o.status] || STATUS_CSS.draft).bg, color: (STATUS_CSS[o.status] || STATUS_CSS.draft).color }}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={4} style={{ padding: '24px 0', fontSize: 12, color: 'var(--text3)' }}>Inga ordrar ännu</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Low stock */}
        <div style={{ ...card, padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Lagerstatus</span>
            {lowStock.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#D48A3A', fontWeight: 600 }}>
                <AlertTriangle size={12} /> {lowStock.length} varnar
              </span>
            )}
          </div>
          {lowStock.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>✓ Allt lager OK</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Produkt', 'SKU', 'Lager'].map(h => (
                    <th key={h} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 0 10px', textAlign: 'left', borderBottom: '1px solid var(--line2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lowStock.slice(0, 7).map(p => (
                  <tr key={p.id}>
                    <td style={{ padding: '10px 0', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--line2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                    <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', borderBottom: '1px solid var(--line2)' }}>{p.sku}</td>
                    <td style={{ padding: '10px 0', borderBottom: '1px solid var(--line2)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: p.stock_qty === 0 ? 'var(--red)' : p.stock_qty < 10 ? '#D48A3A' : 'var(--gold)' }}>{p.stock_qty} st</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {/* Budget history — last 6 months per salesperson */}
      {(() => {
        const active = SALESPEOPLE.filter(sp => budgetHistory.some(m => m.sold[sp] || m.budget[sp]))
        if (active.length === 0) return null
        return (
          <div style={{ ...card, padding: '22px 24px', marginTop: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Budget senaste 6 månaderna</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>Sålt exkl. moms per säljare, jämfört med månadens budget</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
              {active.map(sp => <BudgetHistoryChart key={sp} salesperson={sp} months={budgetHistory} />)}
            </div>
          </div>
        )
      })()}

      <style>{`
        @media (max-width: 700px) {
          .dash-chart-row { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Create / edit calendar activity */}
      {remModal && (
        <ReminderModal reminder={remModal.reminder} defaultDate={todayStr}
          customers={customers} createdBy="Admin"
          onSaved={saved => setReminders(rs => [...rs.filter(r => r.id !== saved.id), saved].sort((a, b) => a.due_date.localeCompare(b.due_date)))}
          onRemoved={id => setReminders(rs => rs.filter(r => r.id !== id))}
          onClose={() => setRemModal(null)} />
      )}
    </div>
  )
}
