'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate, formatDateTime } from '@/lib/utils'
import { Plus, Users, ShoppingBag, Package, ChevronRight, GitBranch, Target, Cake, Bell } from 'lucide-react'
import Link from 'next/link'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { currentStaff, monthRange, budgetAchieved, canConfirmOrder, NOT_LIVE_FILTER } from '@/lib/team'
import { useTeam } from '@/hooks/useTeam'
import { useBudgetHistory } from '@/hooks/useBudgetHistory'
import BudgetHistoryChart from '@/components/BudgetHistoryChart'
import ReminderModal, { type Reminder } from '@/components/crm/ReminderModal'
import { LeadsPanel, DraftsPanel, FollowUpPanel, QuotesPanel, ToShipPanel } from '@/components/crm/LeadsAndQuotes'
import { nextBirthday, formatBirthday } from '@/lib/birthdays'
import VisitList from '@/components/crm/VisitList'
import BudgetCard from '@/components/crm/BudgetCard'
import { companySold, workdaysInMonth, workdaysPassed } from '@/lib/budget'

const supabase = createClient()

const glass: React.CSSProperties = {
  background: 'rgba(13,16,23,.72)',
  backdropFilter: 'saturate(180%) blur(20px)',
  WebkitBackdropFilter: 'saturate(180%) blur(20px)',
  border: '1px solid rgba(255,255,255,.06)',
  borderRadius: 12,
  boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 4px 24px rgba(0,0,0,.3)',
}

export default function CrmDashboardPage() {
  const SALESPEOPLE = useTeam()
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()

  const [firstName, setFirstName]         = useState('')
  const [deals, setDeals]                 = useState<any[]>([])
  const [recentCustomers, setRecentCustomers] = useState<any[]>([])
  const [reminders, setReminders]         = useState<any[]>([])
  const [budgets, setBudgets]             = useState<Record<string, number>>({})
  const [achieved, setAchieved]           = useState<Record<string, number>>({})
  const [birthdays, setBirthdays]         = useState<any[]>([])
  const { months: budgetHistory }         = useBudgetHistory(6)
  const [editBudget, setEditBudget]       = useState(false)
  const [budgetInput, setBudgetInput]     = useState<Record<string, string>>({})
  const [savingBudget, setSavingBudget]   = useState(false)
  const [isAdmin, setIsAdmin]             = useState(false)
  const [activeCustomers, setActiveCustomers] = useState<{ id: string; company: string }[]>([])
  const [remModal, setRemModal]           = useState<{ reminder: Reminder | null } | null>(null)
  const [meLoaded, setMeLoaded]           = useState(false)
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [confirmingId, setConfirmingId]   = useState<string | null>(null)
  const [followCount, setFollowCount]     = useState(0)
  const [companyBudget, setCompanyBudget] = useState(0)
  const [companySales, setCompanySales]   = useState(0)

  useEffect(() => {
    currentStaff(supabase).then(me => {
      setFirstName(me.name)
      setIsAdmin(me.isAdmin)
      setMeLoaded(true)
    })
    loadData()
  }, [])

  useLiveRefresh(['deals', 'customers', 'reminders', 'sales_budgets', 'orders'], loadData)

  function loadData() {
    // Separate query: fails quietly until migration 0009 adds birthday.
    supabase.from('customers').select('id,company,contact_name,birthday,account_manager').not('birthday', 'is', null)
      .then(({ data }) => {
        if (!data) return
        setBirthdays(data
          .filter((c: any) => c.birthday)
          .map((c: any) => ({ ...c, ...nextBirthday(c.birthday) }))
          .filter(c => c.daysUntil <= 30)
          .sort((a, b) => a.daysUntil - b.daysUntil))
      })
    // Separate query: fails quietly until migration 0027 adds company_budgets.
    supabase.from('company_budgets').select('budget').eq('year', year).eq('month', month).maybeSingle()
      .then(({ data }) => setCompanyBudget(Number(data?.budget) || 0))
    const { start, end } = monthRange()
    Promise.all([
      // Open quotes (orders with status quote): each one opens in the order form.
      supabase.from('orders').select('id,order_nr,subtotal,created_at,customers(company)').eq('status', 'quote').order('created_at', { ascending: false }).limit(5),
      supabase.from('customers').select('id,company,price_list_id').eq('status', 'active').order('created_at', { ascending: false }).limit(5),
      supabase.from('reminders').select('id,customer_id,title,due_date,priority,status,customers(company)').eq('status', 'upcoming').order('due_date'),
      supabase.from('sales_budgets').select('salesperson,budget').eq('year', year).eq('month', month),
      supabase.from('orders').select('assigned_to,subtotal,status').gte('created_at', start).lte('created_at', end),
      supabase.from('customers').select('id,company').eq('status', 'active').order('company'),
      supabase.from('orders').select('id,order_nr,total,created_at,assigned_to,created_by,customers(id,company)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('deals').select('id,assigned_to,value').eq('stage', 'Vunnen').gte('updated_at', start).lte('updated_at', end),
      supabase.from('orders').select('deal_id').not('deal_id', 'is', null).not('status', 'in', NOT_LIVE_FILTER),
    ]).then(([{ data: d }, { data: c }, { data: r }, { data: b }, { data: sold }, { data: ac }, { data: po }, { data: won }, { data: linked }]) => {
      if (d) setDeals(d)
      if (c) setRecentCustomers(c)
      if (r) setReminders(r)
      if (ac) setActiveCustomers(ac)
      if (b) {
        const loaded: Record<string, number> = {}
        for (const row of b as any[]) loaded[row.salesperson] = row.budget
        setBudgets(loaded)
      }
      if (sold || won) {
        setAchieved(budgetAchieved(sold || [], won || [], linked || []))
        setCompanySales(companySold(sold || [], won || [], linked || []))
      }
      if (po) setPendingOrders(po)
    })
  }

  async function confirmOrder(id: string) {
    setConfirmingId(id)
    const { data: ok, error } = await supabase.rpc('confirm_order', { p_order_id: id })
    setConfirmingId(null)
    if (!error && ok) setPendingOrders(os => os.filter(o => o.id !== id))
    else alert('Kunde inte bekräfta ordern. Har migration 0004 körts i Supabase?')
  }

  // Seed the form from the latest saved budgets when opening it, so a background
  // refresh never overwrites what the user is typing.
  function openBudgetEditor() {
    setBudgetInput(Object.fromEntries(SALESPEOPLE.map(sp => [sp, budgets[sp] ? String(budgets[sp]) : ''])))
    setEditBudget(true)
  }

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

  async function markReminderDone(id: string) {
    await supabase.from('reminders').update({ status: 'done' }).eq('id', id)
    setReminders(rs => rs.filter(r => r.id !== id))
  }


  const totalBudget = Object.values(budgets).reduce((a, b) => a + b, 0)
  const workDays    = workdaysInMonth({ year, month })
  const daysPassed  = workdaysPassed({ year, month })

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

      {/* My budget this month: what each salesperson sees first */}
      {meLoaded && (!isAdmin || budgets[firstName] > 0) && (
        <BudgetCard title="Din budget" budget={budgets[firstName] || 0} sold={achieved[firstName] || 0} ym={{ year, month }}
          company={{ budget: companyBudget || totalBudget, sold: companySales }} />
      )}

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
          { label: 'Pipeline',  sub: 'Affärer & offerter',    href: '/crm/pipeline',  icon: GitBranch },
          { label: 'Kunder',    sub: 'Kundkort & historik', href: '/crm/customers', icon: Users },
          { label: 'Ordrar',    sub: 'Orderhistorik',       href: '/crm/orders?view=history', icon: ShoppingBag },
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

      {/* Att göra: orders to confirm, reminders due and saved carts to follow up */}
      {(() => {
        const mine = meLoaded ? pendingOrders.filter(o => canConfirmOrder(o, firstName, isAdmin)) : []
        // Every open to do, oldest date first (a new one shows here at once).
        const due = [...reminders].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
        const count = mine.length + due.length + followCount
        const sub: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '12px 0 4px' }
        return (
          <section style={{ marginBottom: 20, background: 'var(--bg3)', border: `1px solid ${count ? 'rgba(232,184,75,.45)' : 'rgba(255,255,255,.08)'}`, borderRadius: 14, padding: '16px 20px', boxShadow: count ? '0 0 0 1px rgba(232,184,75,.08), 0 6px 28px rgba(0,0,0,.3)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(232,184,75,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bell size={17} color="var(--gold)" /></span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>To do</span>
              {count > 0
                ? <span style={{ fontSize: 13, fontWeight: 800, padding: '2px 10px', borderRadius: 12, background: 'var(--gold)', color: '#111' }}>{count}</span>
                : <span style={{ fontSize: 14, color: 'var(--green)', fontWeight: 600 }}>✓ Inget som väntar just nu</span>}
              <button onClick={() => setRemModal({ reminder: null })} style={{ marginLeft: 'auto', fontSize: 13, padding: '7px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer' }}>+ Ny to do</button>
            </div>
            {mine.length > 0 && <div style={sub}>Ordrar att bekräfta</div>}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {mine.map((o, i) => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,.06)' : 'none', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      <Link href={`/crm/orders?view=history&open=${o.id}`} style={{ color: 'var(--text)' }}>#{o.order_nr}</Link> · {o.customers?.id
                        ? <Link href={`/crm/customers/${o.customers.id}`} style={{ color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: 3 }}>{o.customers.company}</Link>
                        : 'Gästorder'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                      {formatDateTime(o.created_at)} · {fmt(o.total)} kr{!o.assigned_to ? ' · saknar säljare' : ''}
                    </div>
                  </div>
                  <button onClick={() => confirmOrder(o.id)} disabled={confirmingId === o.id}
                    style={{ padding: '8px 14px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: confirmingId === o.id ? .6 : 1 }}>
                    {confirmingId === o.id ? 'Bekräftar…' : 'Bekräfta order'}
                  </button>
                </div>
              ))}
            </div>
            {due.length > 0 && (mine.length > 0) && <div style={sub}>Att göra</div>}
            {due.map((r, i) => {
              const late = (r.due_date || '').slice(0, 10) < todayStr
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[r.priority] || 'var(--blue)', flexShrink: 0 }} />
                  <button type="button" onClick={() => setRemModal({ reminder: r })} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.title}</div>
                    <div style={{ fontSize: 13, color: late ? '#E0A85A' : 'var(--text2)' }}>{r.customers?.company ? `${r.customers.company} · ` : ''}{late ? `försenad sedan ${formatDate(r.due_date)}` : (r.due_date || '').slice(0, 10) === todayStr ? 'idag' : formatDate(r.due_date)}</div>
                  </button>
                  <button onClick={() => markReminderDone(r.id)} style={{ padding: '6px 12px', background: 'rgba(76,175,125,.12)', border: '1px solid rgba(76,175,125,.35)', borderRadius: 7, color: 'var(--green)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Klar</button>
                </div>
              )
            })}
            <FollowUpPanel bare onlyCarts onCount={setFollowCount} />
          </section>
        )
      })()}

      <VisitList />

      <ToShipPanel />

      {/* Quotes, leads and saved carts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24, alignItems: 'start' }}>
        <QuotesPanel limit={5} />
        <LeadsPanel />
        <DraftsPanel limit={6} />
      </div>

      {/* Upcoming birthdays — for greetings and offers */}
      {birthdays.length > 0 && (
        <div style={{ ...glass, padding: '18px 22px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Cake size={15} color="var(--text2)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Födelsedagar kommande 30 dagar</span>
          </div>
          {birthdays.map((c, i) => (
            <Link key={c.id} href={`/crm/customers/${c.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,.05)' : 'none', textDecoration: 'none' }}>
              <div style={{ width: 44, textAlign: 'center', fontSize: 12, fontWeight: 700, color: c.daysUntil === 0 ? 'var(--green)' : 'var(--text)' }}>
                {c.daysUntil === 0 ? 'Idag' : formatBirthday(c.birthday)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.contact_name || c.company}{c.turns ? ` fyller ${c.turns}` : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{c.company}{c.account_manager ? ` · ${c.account_manager}` : ''}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                {c.daysUntil === 0 ? '🎉' : c.daysUntil === 1 ? 'imorgon' : `om ${c.daysUntil} d`}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Recent customers */}
      <div style={{ marginBottom: 24 }}>

        {/* Senaste kunder */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Users size={15} color="var(--gold)" /> Senaste kunder
          </div>
          <div style={{ ...glass, overflow: 'hidden' }}>
            {recentCustomers.length === 0 && <div style={{ padding: '18px 14px', fontSize: 12, color: 'var(--text3)' }}>Inga kunder ännu.</div>}
            {recentCustomers.map((c: any, i: number, arr: any[]) => (
              <Link key={c.id} href={`/crm/customers/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', textDecoration: 'none' }}>
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

      {/* Team budget (admins); each salesperson sees their own card at the top */}
      {isAdmin && <div style={{ ...glass, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={15} color="var(--gold)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Månadsbudget — {monthNames[month]} {year}</span>
          </div>
          {isAdmin && (<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/admin/budget" style={{ fontSize: 12, color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Hela budgeten →</Link>
            <button onClick={() => editBudget ? setEditBudget(false) : openBudgetEditor()}
              style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(232,184,75,.1)', border: '1px solid rgba(232,184,75,.2)', borderRadius: 6, color: 'var(--gold)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              {editBudget ? 'Avbryt' : 'Sätt budget'}
            </button>
          </div>)}
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
                    { label: 'Teamets försäljning', value: `${fmt(Object.values(achieved).reduce((a,b) => a+b, 0))} kr` },
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
            Ingen budget satt — klicka Sätt budget eller öppna Hela budgeten för att lägga in årsbudget och månadsbudget per säljare
          </div>
        )}
      </div>}

      {/* Budget history: own for salespeople, whole team for admins */}
      {meLoaded && (() => {
        const people = isAdmin ? SALESPEOPLE.filter(sp => budgetHistory.some(m => m.sold[sp] || m.budget[sp])) : [firstName]
        if (people.length === 0 || budgetHistory.length === 0) return null
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12, marginBottom: 24 }}>
            {people.map(sp => <BudgetHistoryChart key={sp} salesperson={sp} months={budgetHistory} />)}
          </div>
        )
      })()}

      {/* Create / edit calendar activity */}
      {remModal && (
        <ReminderModal reminder={remModal.reminder} defaultDate={todayStr}
          customers={activeCustomers} createdBy={firstName || undefined}
          onSaved={saved => setReminders(rs => [...rs.filter(r => r.id !== saved.id), saved].sort((a, b) => a.due_date.localeCompare(b.due_date)))}
          onRemoved={id => setReminders(rs => rs.filter(r => r.id !== id))}
          onClose={() => setRemModal(null)} />
      )}
    </div>
  )
}
