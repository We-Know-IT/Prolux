'use client'
import { useEffect, useState } from 'react'

// Register CRM service worker for PWA install
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/crm-sw.js').catch(() => {})
}

import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'
import { Plus, Users, ShoppingBag, Package, ChevronRight, FileText, GitBranch, Target, Calendar, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

const supabase = createClient()

const glass: React.CSSProperties = {
  background: 'rgba(13,16,23,.72)',
  backdropFilter: 'saturate(180%) blur(20px)',
  WebkitBackdropFilter: 'saturate(180%) blur(20px)',
  border: '1px solid rgba(255,255,255,.06)',
  borderRadius: 12,
  boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 4px 24px rgba(0,0,0,.3)',
}

const SALESPEOPLE = ['Bashar', 'Stefan', 'Anna', 'Erik']

function workingDaysInMonth(year: number, month: number): number {
  let count = 0
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function workingDaysPassed(year: number, month: number): number {
  const today = new Date()
  let count = 0
  const d = new Date(year, month, 1)
  const end = today.getMonth() === month && today.getFullYear() === year ? today : new Date(year, month + 1, 0)
  while (d <= end) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export default function CrmDashboardPage() {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()

  const [firstName, setFirstName]         = useState('Bashar')
  const [deals, setDeals]                 = useState<any[]>([])
  const [recentCustomers, setRecentCustomers] = useState<any[]>([])
  const [calMonth, setCalMonth]           = useState(month)
  const [calYear, setCalYear]             = useState(year)
  const [reminders, setReminders]         = useState<any[]>([])
  const [budgets, setBudgets]             = useState<Record<string, number>>({})
  const [achieved, setAchieved]           = useState<Record<string, number>>({})
  const [editBudget, setEditBudget]       = useState(false)
  const [budgetInput, setBudgetInput]     = useState<Record<string, string>>({})
  const [savingBudget, setSavingBudget]   = useState(false)
  const [isAdmin, setIsAdmin]             = useState(false)

  const monthStart = `${year}-${String(month + 1).padStart(2,'0')}-01`
  const monthEnd   = `${year}-${String(month + 1).padStart(2,'0')}-${new Date(year, month + 1, 0).getDate()}`

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const name = (user?.user_metadata?.full_name || user?.user_metadata?.name || 'Bashar').split(' ')[0]
      setFirstName(name)
      setIsAdmin(user?.user_metadata?.role === 'admin')
    })
    Promise.all([
      supabase.from('deals').select('id,title,value,created_at,customers(company)').eq('stage', 'Offert').order('created_at', { ascending: false }).limit(4),
      supabase.from('customers').select('id,company,price_list_id').eq('status', 'active').order('created_at', { ascending: false }).limit(5),
      supabase.from('reminders').select('id,customer_id,title,due_date,priority,status,customers(company)').eq('status', 'upcoming').order('due_date'),
      supabase.from('sales_budgets').select('salesperson,budget').eq('year', year).eq('month', month),
      supabase.from('deals').select('assigned_to,value').eq('stage', 'Vunnen').gte('updated_at', monthStart).lte('updated_at', monthEnd + 'T23:59:59'),
    ]).then(([{ data: d }, { data: c }, { data: r }, { data: b }, { data: won }]) => {
      if (d) setDeals(d)
      if (c) setRecentCustomers(c)
      if (r) setReminders(r)
      if (b) {
        const loaded: Record<string, number> = {}
        for (const row of b as any[]) loaded[row.salesperson] = row.budget
        setBudgets(loaded)
        setBudgetInput(Object.fromEntries(SALESPEOPLE.map(sp => [sp, loaded[sp] ? String(loaded[sp]) : ''])))
      }
      if (won) {
        const acc: Record<string, number> = {}
        for (const deal of won as any[]) {
          if (deal.assigned_to) acc[deal.assigned_to] = (acc[deal.assigned_to] || 0) + (deal.value || 0)
        }
        setAchieved(acc)
      }
    })
  }, [])

  async function saveBudgets() {
    setSavingBudget(true)
    const rows = SALESPEOPLE
      .map(sp => ({ salesperson: sp, year, month, budget: parseInt(budgetInput[sp] || '0') || 0 }))
      .filter(r => r.budget > 0)
    await supabase.from('sales_budgets').upsert(rows, { onConflict: 'salesperson,year,month' })
    // Remove zeroed out entries
    const removed = SALESPEOPLE.filter(sp => !(parseInt(budgetInput[sp] || '0') > 0))
    for (const sp of removed) {
      await supabase.from('sales_budgets').delete().eq('salesperson', sp).eq('year', year).eq('month', month)
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

  const totalBudget = Object.values(budgets).reduce((a, b) => a + b, 0)
  const workDays    = workingDaysInMonth(year, month)
  const daysPassed  = workingDaysPassed(year, month)
  const dailyTarget = workDays > 0 ? Math.round(totalBudget / workDays) : 0

  // Calendar
  const daysInCalMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay()
  const firstMon = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
  const calCells: (number | null)[] = [...Array(firstMon).fill(null), ...Array.from({ length: daysInCalMonth }, (_, i) => i + 1)]
  while (calCells.length % 7 !== 0) calCells.push(null)

  const remindersByDate: Record<string, any[]> = {}
  for (const r of reminders) {
    const d = r.due_date?.slice(0, 10)
    if (d) { if (!remindersByDate[d]) remindersByDate[d] = []; remindersByDate[d].push(r) }
  }

  const todayStr = now.toISOString().slice(0, 10)
  const PRIORITY_DOT: Record<string, string> = { high: 'var(--red)', normal: 'var(--blue)', low: 'var(--text3)' }
  const PL_COLOR: Record<string, string> = { A: 'var(--gold)', B: '#6AAFF0', C: '#5EC49A', Standard: 'var(--text3)' }
  const monthNames = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December']

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 80px' }}>

      {/* Hero */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 400, color: 'var(--text)', margin: 0, lineHeight: 1.15 }}>
          Välkommen,{' '}
          <span style={{ background: 'linear-gradient(135deg,#F5CC6A,#E8B84B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {firstName}
          </span>
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 8 }}>
          {now.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Primary CTA */}
      <Link href="/crm/orders" style={{ width: '100%', padding: '20px 24px', background: 'linear-gradient(135deg, #E8B84B 0%, #F5CC6A 50%, #D4A33C 100%)', borderRadius: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none', boxShadow: '0 2px 20px rgba(232,184,75,.28), 0 1px 0 rgba(255,255,255,.2) inset' }}>
        <div style={{ width: 44, height: 44, background: 'rgba(0,0,0,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Plus size={22} color="#111" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0D0A00', marginBottom: 2 }}>Ny order</div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,.5)' }}>Välj kund → Lägg till produkter → skicka order</div>
        </div>
        <ChevronRight size={20} color="rgba(0,0,0,.35)" style={{ marginLeft: 'auto' }} />
      </Link>

      {/* Quick grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Pipeline',  sub: 'Deals & offerter',    href: '/crm/pipeline',  icon: GitBranch },
          { label: 'Kunder',    sub: 'Kundkort & historik', href: '/crm/customers', icon: Users },
          { label: 'Ordrar',    sub: 'Orderhistorik',       href: '/crm/orders',    icon: ShoppingBag },
          { label: 'Produkter', sub: 'Katalog & priser',    href: '/crm/orders',    icon: Package },
        ].map(({ label, sub, href, icon: Icon }) => (
          <Link key={label} href={href} style={{ ...glass, padding: '16px 18px', textDecoration: 'none', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 30, height: 30, background: 'rgba(232,184,75,.1)', border: '1px solid rgba(232,184,75,.18)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} color="var(--gold)" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', paddingLeft: 40 }}>{sub}</div>
          </Link>
        ))}
      </div>

      {/* Budget Widget */}
      <div style={{ ...glass, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={15} color="var(--gold)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Månadsbudget — {monthNames[month]} {year}</span>
          </div>
          {isAdmin && (
            <button onClick={() => setEditBudget(e => !e)}
              style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(232,184,75,.1)', border: '1px solid rgba(232,184,75,.2)', borderRadius: 6, color: 'var(--gold)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              {editBudget ? 'Avbryt' : 'Sätt budget'}
            </button>
          )}
        </div>

        {editBudget ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
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
              style={{ padding: '9px 20px', background: 'var(--gold)', border: 'none', borderRadius: 7, color: '#111', fontSize: 13, fontWeight: 700, cursor: savingBudget ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: savingBudget ? 0.7 : 1 }}>
              {savingBudget ? 'Sparar...' : 'Spara budget'}
            </button>
          </div>
        ) : totalBudget > 0 ? (
          <div>
            {/* My own budget highlighted */}
            {budgets[firstName] && (
              <div style={{ background: 'rgba(232,184,75,.07)', border: '1px solid rgba(232,184,75,.18)', borderRadius: 10, padding: '14px 18px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>Din budget — {monthNames[month]}</span>
                  <span style={{ fontSize: 12, color: achieved[firstName] >= budgets[firstName] ? 'var(--green)' : 'var(--text3)' }}>
                    {achieved[firstName] >= budgets[firstName] ? '✓ Budget uppnådd!' : `${Math.round(((achieved[firstName] || 0) / budgets[firstName]) * 100)}% av målet`}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
                  {[
                    { label: 'Månadsbudget', value: `${fmt(budgets[firstName])} kr`, color: 'var(--text)' },
                    { label: 'Stängda affärer', value: `${fmt(achieved[firstName] || 0)} kr`, color: (achieved[firstName] || 0) > 0 ? 'var(--green)' : 'var(--text3)' },
                    { label: 'Kvar', value: `${fmt(Math.max(0, budgets[firstName] - (achieved[firstName] || 0)))} kr`, color: 'var(--text)' },
                    { label: 'Dagsmål', value: `${fmt(Math.round(budgets[firstName] / workDays))} kr`, color: 'var(--gold)' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(((achieved[firstName] || 0) / budgets[firstName]) * 100, 100)}%`, background: 'linear-gradient(90deg, #4CAF7D, #5EC49A)', borderRadius: 3, transition: 'width .4s ease' }} />
                </div>
              </div>
            )}
            {isAdmin && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px', marginBottom: 14 }}>
                  {SALESPEOPLE.filter(sp => budgets[sp]).map(sp => {
                    const spBudget   = budgets[sp]
                    const spAchieved = achieved[sp] || 0
                    const spPct      = Math.min((spAchieved / spBudget) * 100, 100)
                    const isMe       = sp === firstName
                    const isGreen    = spAchieved >= spBudget
                    return (
                      <div key={sp} style={{ background: isMe ? 'rgba(232,184,75,.05)' : 'rgba(255,255,255,.03)', border: `1px solid ${isMe ? 'rgba(232,184,75,.15)' : 'rgba(255,255,255,.06)'}`, borderRadius: 8, padding: '10px 13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: isMe ? 'var(--gold)' : 'var(--text2)' }}>{sp}{isMe ? ' (du)' : ''}</span>
                          <span style={{ fontSize: 11, color: isGreen ? 'var(--green)' : 'var(--text3)' }}>{fmt(spAchieved)} / {fmt(spBudget)} kr</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
                          {Math.round(spPct)}% av budget · dagsmål <span style={{ color: isMe ? 'var(--gold)' : 'var(--text2)', fontWeight: 600 }}>{fmt(Math.round(spBudget / workDays))} kr</span>
                        </div>
                        <div style={{ height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${spPct}%`, background: isGreen ? 'var(--green)' : isMe ? 'var(--gold)' : 'rgba(74,143,212,.7)', borderRadius: 2 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 24, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                  {[
                    { label: 'Total månadsbudget', value: `${fmt(totalBudget)} kr` },
                    { label: 'Teamets stängda affärer', value: `${fmt(Object.values(achieved).reduce((a,b) => a+b, 0))} kr` },
                    { label: 'Arbetsdagar kvar', value: `${workDays - daysPassed} av ${workDays}` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
            {isAdmin ? 'Ingen budget satt — klicka "Sätt budget" för att lägga in månadsbudget per säljare' : 'Ingen budget satt för denna månad ännu'}
          </div>
        )}
      </div>

      {/* Calendar + Offerter */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>

        {/* Calendar */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Calendar size={12} /> Kalender & påminnelser
          </div>
          <div style={{ ...glass, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <button onClick={() => { const d = new Date(calYear, calMonth - 1); setCalMonth(d.getMonth()); setCalYear(d.getFullYear()) }}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}><ChevronLeft size={14} /></button>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{monthNames[calMonth]} {calYear}</span>
              <button onClick={() => { const d = new Date(calYear, calMonth + 1); setCalMonth(d.getMonth()); setCalYear(d.getFullYear()) }}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}><ChevronRight size={14} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '6px 8px 0' }}>
              {['M','T','O','T','F','L','S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text3)', padding: '2px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '2px 8px 10px', gap: 2 }}>
              {calCells.map((day, idx) => {
                if (!day) return <div key={idx} />
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const dayRems = remindersByDate[dateStr] || []
                const isToday = dateStr === todayStr
                const isPast  = dateStr < todayStr
                return (
                  <div key={idx} title={dayRems.map(r => r.title).join(', ')} style={{ borderRadius: 5, padding: '3px 2px', textAlign: 'center', background: isToday ? 'rgba(232,184,75,.12)' : 'transparent', border: isToday ? '1px solid rgba(232,184,75,.25)' : '1px solid transparent' }}>
                    <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--gold)' : isPast ? 'var(--text3)' : 'var(--text)' }}>{day}</div>
                    {dayRems.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 1 }}>
                        {dayRems.slice(0, 2).map((r, i) => (
                          <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: PRIORITY_DOT[r.priority] || 'var(--blue)' }} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {reminders.filter(r => r.due_date >= todayStr).slice(0, 4).map((r) => (
              <div key={r.id} style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_DOT[r.priority], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{r.customers?.company} · {formatDate(r.due_date)}</div>
                </div>
              </div>
            ))}
            {reminders.filter(r => r.due_date >= todayStr).length === 0 && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,.04)', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>Inga kommande påminnelser</div>
            )}
          </div>
        </div>

        {/* Skickade offerter */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
            <FileText size={12} /> Skickade offerter
          </div>
          <div style={{ ...glass, overflow: 'hidden' }}>
            {(deals.length > 0 ? deals : [
              { id: '1', title: 'Bilservice AB', value: 12400, created_at: '2026-06-10', customers: { company: 'Bilservice AB' } },
              { id: '2', title: 'Detailing Sthlm', value: 8750, created_at: '2026-06-08', customers: { company: 'Detailing Sthlm' } },
              { id: '3', title: 'AutoGlans Nordic', value: 22000, created_at: '2026-06-05', customers: { company: 'AutoGlans Nordic' } },
            ]).map((d: any, i: number, arr: any[]) => (
              <Link key={d.id} href="/crm/pipeline" style={{ display: 'flex', flexDirection: 'column', padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', textDecoration: 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 3 }}>{d.customers?.company || d.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{formatDate(d.created_at)}</span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--gold)' }}>{fmt(d.value)} kr</span>
                </div>
              </Link>
            ))}
            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,.04)' }}>
              <Link href="/crm/pipeline" style={{ flex: 1, textAlign: 'center', padding: '10px', fontSize: 11, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none', background: 'rgba(232,184,75,.06)', borderRight: '1px solid rgba(255,255,255,.04)' }}>Följ upp</Link>
              <Link href="/crm/pipeline" style={{ flex: 1, textAlign: 'center', padding: '10px', fontSize: 11, color: 'var(--text3)', textDecoration: 'none' }}>Se alla</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Senaste kunder */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Users size={12} /> Senaste kunder
        </div>
        <div style={{ ...glass, overflow: 'hidden' }}>
          {(recentCustomers.length > 0 ? recentCustomers : [
            { id: '1', company: 'Bilservice AB', price_list_id: 'A' },
            { id: '2', company: 'Clean Cars GBG', price_list_id: 'B' },
            { id: '3', company: 'Pro Detailing Malmö', price_list_id: 'C' },
            { id: '4', company: 'Nordic Auto Care', price_list_id: 'A' },
          ]).map((c: any, i: number, arr: any[]) => (
            <Link key={c.id} href="/crm/customers" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', textDecoration: 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(232,184,75,.1)', border: '1px solid rgba(232,184,75,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gold)', flexShrink: 0 }}>
                {c.company[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', color: PL_COLOR[c.price_list_id] || 'var(--text3)' }}>
                {c.price_list_id}
              </span>
            </Link>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
            <Link href="/crm/customers" style={{ display: 'block', textAlign: 'center', padding: '10px', fontSize: 11, color: 'var(--text3)', textDecoration: 'none' }}>Se alla kunder</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
