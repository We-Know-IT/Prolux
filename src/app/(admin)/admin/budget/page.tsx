'use client'
// Budget: the company's budget for a period (e.g. August–July) split into
// months and working days, each salesperson's monthly budget, and how the
// company and every salesperson stand against it.
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Target, Wand2, Save, Check, ChevronDown, ChevronRight, Users, PenLine } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'
import { useTeam } from '@/hooks/useTeam'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { budgetAchieved, NOT_LIVE_FILTER } from '@/lib/team'
import {
  MONTHS, type YM, ymKey, ymLabel, dayKey, monthsBetween, workdaysOf, workdaysInMonth,
  splitBudget, splitByShare, companySold, budgetStatus, defaultBudgetYear, withManual, sumOf,
} from '@/lib/budget'

const num = (v?: string) => parseInt((v || '').replace(/[^\d]/g, ''), 10) || 0
const pct = (sold: number, budget: number) => budget > 0 ? Math.round(sold / budget * 100) : null
const startOf = (ym: YM) => `${ym.year}-${String(ym.month + 1).padStart(2, '0')}-01`
const endOf = (ym: YM) => `${ym.year}-${String(ym.month + 1).padStart(2, '0')}-${new Date(ym.year, ym.month + 1, 0).getDate()}T23:59:59`
const inMonth = (iso: string, ym: YM) => { const d = new Date(iso); return d.getFullYear() === ym.year && d.getMonth() === ym.month }

type Sale = { id: string; assigned_to: string | null; subtotal: number | null; status: string; created_at: string; deal_id: string | null }
type Won = { id: string; assigned_to: string | null; value: number | null; updated_at: string }

function MonthPicker({ value, onChange, label }: { value: YM; onChange: (v: YM) => void; label: string }) {
  const now = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => now - 2 + i)
  const sel: React.CSSProperties = { padding: '10px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 15, outline: 'none' }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
      {label}
      <span style={{ display: 'flex', gap: 6 }}>
        <select aria-label={`${label} månad`} value={value.month} onChange={e => onChange({ ...value, month: +e.target.value })} style={sel}>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select aria-label={`${label} år`} value={value.year} onChange={e => onChange({ ...value, year: +e.target.value })} style={sel}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </span>
    </label>
  )
}

export default function BudgetPage() {
  const sb = createClient()
  const team = useTeam()
  const today = new Date()
  const thisYM: YM = { year: today.getFullYear(), month: today.getMonth() }

  const [range, setRange] = useState<{ from: YM; to: YM } | null>(null)
  const [company, setCompany] = useState<Record<string, string>>({})
  const [seller, setSeller] = useState<Record<string, Record<string, string>>>({})
  const [extraPeople, setExtraPeople] = useState<string[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [won, setWon] = useState<Won[]>([])
  const [linked, setLinked] = useState<{ deal_id: string | null }[]>([])
  const [missingTable, setMissingTable] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const [dayWho, setDayWho] = useState('')
  // Sales entered by hand per salesperson and month (migration 0028).
  const [manual, setManual] = useState<Record<string, Record<string, string>>>({})
  const [manualDirty, setManualDirty] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualMsg, setManualMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [manualMissing, setManualMissing] = useState(false)

  // Annual budget tool
  const [annual, setAnnual] = useState('')
  const [method, setMethod] = useState<'workdays' | 'even'>('workdays')
  const [shares, setShares] = useState<Record<string, string>>({})
  const [alsoSellers, setAlsoSellers] = useState(true)
  const [distributed, setDistributed] = useState<{ total: number; method: string } | null>(null)

  // Changing the period reloads the budget; ask first if there are unsaved changes.
  const changeRange = (next: { from: YM; to: YM }) => {
    if (dirty && !confirm('Du har ändringar som inte är sparade. Byta period ändå?')) return
    setRange(next)
  }

  const months = useMemo(() => range ? monthsBetween(range.from, range.to) : [], [range])
  const people = useMemo(() => [...new Set([...team, ...extraPeople])], [team, extraPeople])

  // Start on the latest saved budget period, otherwise this budget year (Aug–Jul).
  useEffect(() => {
    sb.from('budget_periods').select('start_year,start_month,end_year,end_month,total,method').order('created_at', { ascending: false }).limit(1)
      .then(({ data, error }) => {
        const p = !error && data?.[0]
        setRange(p ? { from: { year: p.start_year, month: p.start_month }, to: { year: p.end_year, month: p.end_month } } : defaultBudgetYear())
        if (p) { setAnnual(String(p.total)); setMethod(p.method === 'even' ? 'even' : 'workdays') }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Equal shares for the team until admin changes them.
  useEffect(() => {
    if (!team.length || Object.keys(shares).length) return
    const each = Math.round(100 / team.length * 10) / 10
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShares(Object.fromEntries(team.map(p => [p, String(each)])))
  }, [team]) // eslint-disable-line react-hooks/exhaustive-deps

  // Links like /admin/budget#manuell: scroll there once the page is drawn.
  useEffect(() => {
    if (!range || !window.location.hash) return
    const t = setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView({ block: 'start' }), 300)
    return () => clearTimeout(t)
  }, [!!range]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadBudgets() {
    if (!months.length) return
    const years = [...new Set(months.map(m => m.year))]
    const keys = new Set(months.map(ymKey))
    const [c, s] = await Promise.all([
      sb.from('company_budgets').select('year,month,budget').in('year', years),
      sb.from('sales_budgets').select('salesperson,year,month,budget').in('year', years),
    ])
    setMissingTable(!!c.error)
    const comp: Record<string, string> = {}
    for (const r of c.data ?? []) { const k = ymKey(r); if (keys.has(k) && Number(r.budget) > 0) comp[k] = String(Math.round(Number(r.budget))) }
    const sel: Record<string, Record<string, string>> = {}
    const extra = new Set<string>()
    for (const r of s.data ?? []) {
      const k = ymKey(r)
      if (!keys.has(k) || !(Number(r.budget) > 0)) continue
      ;(sel[k] ??= {})[r.salesperson] = String(Math.round(Number(r.budget)))
      extra.add(r.salesperson)
    }
    setCompany(comp); setSeller(sel); setExtraPeople([...extra]); setDirty(false)
  }

  async function loadManual() {
    if (!months.length) return
    const years = [...new Set(months.map(m => m.year))]
    const keys = new Set(months.map(ymKey))
    const { data, error } = await sb.from('manual_sales').select('salesperson,year,month,amount').in('year', years)
    setManualMissing(!!error)
    const out: Record<string, Record<string, string>> = {}
    for (const r of data ?? []) {
      const k = ymKey(r)
      if (keys.has(k) && Number(r.amount) > 0) (out[k] ??= {})[r.salesperson] = String(Math.round(Number(r.amount)))
    }
    setManual(out); setManualDirty(false)
    setExtraPeople(p => [...new Set([...p, ...(data ?? []).filter(r => keys.has(ymKey(r))).map(r => r.salesperson)])])
  }

  async function saveManual() {
    setManualSaving(true); setManualMsg(null)
    const rows: { salesperson: string; year: number; month: number; amount: number; updated_at: string }[] = []
    const zero: { salesperson: string; ym: YM }[] = []
    for (const ym of months) for (const p of people) {
      const v = num(manual[ymKey(ym)]?.[p])
      if (v > 0) rows.push({ salesperson: p, year: ym.year, month: ym.month, amount: v, updated_at: new Date().toISOString() })
      else zero.push({ salesperson: p, ym })
    }
    let error = rows.length ? (await sb.from('manual_sales').upsert(rows, { onConflict: 'salesperson,year,month' })).error : null
    if (!error) for (const z of zero) {
      const r = await sb.from('manual_sales').delete().eq('salesperson', z.salesperson).eq('year', z.ym.year).eq('month', z.ym.month)
      if (r.error) { error = r.error; break }
    }
    setManualSaving(false)
    if (error) { setManualMsg({ ok: false, text: /manual_sales/.test(error.message) ? 'Kör migration 0028 i Supabase först.' : `Kunde inte spara: ${error.message}` }); return }
    setManualDirty(false)
    setManualMsg({ ok: true, text: 'Försäljningen är sparad och räknas in i budgeten.' })
  }

  async function loadSales() {
    if (!months.length) return
    const from = startOf(months[0]), to = endOf(months[months.length - 1])
    // Page through: Supabase returns at most 1000 rows per request.
    const all: Sale[] = []
    for (let i = 0; i < 50; i++) {
      const { data } = await sb.from('orders').select('id,assigned_to,subtotal,status,created_at,deal_id')
        .gte('created_at', from).lte('created_at', to).not('status', 'in', NOT_LIVE_FILTER)
        .order('created_at').range(i * 1000, i * 1000 + 999)
      all.push(...((data ?? []) as Sale[]))
      if (!data || data.length < 1000) break
    }
    const [w, l] = await Promise.all([
      sb.from('deals').select('id,assigned_to,value,updated_at').eq('stage', 'Vunnen').gte('updated_at', from).lte('updated_at', to),
      sb.from('orders').select('deal_id').not('deal_id', 'is', null).not('status', 'in', NOT_LIVE_FILTER),
    ])
    setSales(all); setWon((w.data ?? []) as Won[]); setLinked(l.data ?? [])
  }

  useEffect(() => { loadBudgets(); loadManual(); loadSales() }, [months]) // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useLiveRefresh(['orders', 'deals'], loadSales)

  // Sold per month: per salesperson and for the whole company.
  const soldByMonth = useMemo(() => {
    // system: from orders and won deals; people/company also count the
    // sales entered by hand.
    const out: Record<string, { people: Record<string, number>; company: number; system: Record<string, number> }> = {}
    for (const ym of months) {
      const k = ymKey(ym)
      const o = sales.filter(x => inMonth(x.created_at, ym))
      const d = won.filter(x => inMonth(x.updated_at, ym))
      const system = budgetAchieved(o, d, linked)
      const hand = Object.fromEntries(Object.entries(manual[k] ?? {}).map(([p, v]) => [p, num(v)]).filter(([, v]) => (v as number) > 0))
      out[k] = { system, people: withManual(system, hand), company: companySold(o, d, linked) + sumOf(hand) }
    }
    return out
  }, [months, sales, won, linked, manual])

  const sellerSum = (k: string) => people.reduce((n, p) => n + num(seller[k]?.[p]), 0)
  // Company budget for a month: what admin entered, else the salespeople's total.
  const companyOf = (k: string) => num(company[k]) || sellerSum(k)
  const isPast = (ym: YM) => ym.year < thisYM.year || (ym.year === thisYM.year && ym.month < thisYM.month)
  const isNow = (ym: YM) => ym.year === thisYM.year && ym.month === thisYM.month
  const started = (ym: YM) => isPast(ym) || isNow(ym)

  // Where the period stands: budget, sold, and where it should be by today.
  const period = useMemo(() => {
    let budget = 0, sold = 0, expected = 0
    const per: Record<string, { budget: number; sold: number }> = {}
    for (const ym of months) {
      const k = ymKey(ym), b = companyOf(k)
      budget += b
      if (!started(ym)) continue
      sold += soldByMonth[k]?.company || 0
      expected += isNow(ym) ? budgetStatus(b, 0, ym, today).expected : b
    }
    for (const p of people) {
      per[p] = { budget: 0, sold: 0 }
      for (const ym of months) {
        const k = ymKey(ym)
        per[p].budget += num(seller[k]?.[p])
        if (started(ym)) per[p].sold += soldByMonth[k]?.people[p] || 0
      }
    }
    return { budget, sold, expected, per }
  }, [months, company, seller, soldByMonth, people]) // eslint-disable-line react-hooks/exhaustive-deps

  function distribute() {
    const total = num(annual)
    if (!total) { setMsg({ ok: false, text: 'Fyll i årsbudgeten först.' }); return }
    const parts = splitBudget(total, months, method)
    const comp: Record<string, string> = {}
    months.forEach((ym, i) => { comp[ymKey(ym)] = String(parts[i]) })
    setCompany(comp)
    if (alsoSellers) applyShares(comp)
    setDistributed({ total, method })
    setDirty(true)
    setMsg({ ok: true, text: `Fördelat på ${months.length} månader${alsoSellers ? ' och säljarna' : ''}. Kontrollera och tryck Spara budget.` })
  }

  function applyShares(comp = company) {
    const sh = Object.fromEntries(people.map(p => [p, parseFloat((shares[p] || '0').replace(',', '.')) || 0]))
    if (!Object.values(sh).some(v => v > 0)) { setMsg({ ok: false, text: 'Ange hur många procent varje säljare ska ha.' }); return }
    const next: Record<string, Record<string, string>> = {}
    for (const ym of months) {
      const k = ymKey(ym)
      const split = splitByShare(num(comp[k]), sh)
      next[k] = Object.fromEntries(people.map(p => [p, split[p] ? String(split[p]) : '']))
    }
    setSeller(next)
    setDirty(true)
  }

  async function save() {
    setSaving(true); setMsg(null)
    const compRows: { year: number; month: number; budget: number }[] = []
    const compZero: YM[] = []
    const selRows: { salesperson: string; year: number; month: number; budget: number }[] = []
    const selZero: { salesperson: string; ym: YM }[] = []
    for (const ym of months) {
      const k = ymKey(ym)
      const v = num(company[k])
      if (v > 0) compRows.push({ year: ym.year, month: ym.month, budget: v }); else compZero.push(ym)
      for (const p of people) {
        const b = num(seller[k]?.[p])
        if (b > 0) selRows.push({ salesperson: p, year: ym.year, month: ym.month, budget: b }); else selZero.push({ salesperson: p, ym })
      }
    }
    const errors: string[] = []
    if (compRows.length) { const { error } = await sb.from('company_budgets').upsert(compRows, { onConflict: 'year,month' }); if (error) errors.push(error.message) }
    for (const ym of compZero) await sb.from('company_budgets').delete().eq('year', ym.year).eq('month', ym.month)
    if (selRows.length) { const { error } = await sb.from('sales_budgets').upsert(selRows, { onConflict: 'salesperson,year,month' }); if (error) errors.push(error.message) }
    for (const z of selZero) await sb.from('sales_budgets').delete().eq('salesperson', z.salesperson).eq('year', z.ym.year).eq('month', z.ym.month)
    if (distributed && range) {
      await sb.from('budget_periods').upsert({
        start_year: range.from.year, start_month: range.from.month, end_year: range.to.year, end_month: range.to.month,
        total: distributed.total, method: distributed.method, created_at: new Date().toISOString(),
      }, { onConflict: 'start_year,start_month,end_year,end_month' })
    }
    setSaving(false)
    if (errors.length) {
      setMsg({ ok: false, text: errors.some(e => /company_budgets/.test(e)) ? 'Kör migration 0027 i Supabase för att kunna spara bolagets budget.' : `Kunde inte spara: ${errors[0]}` })
      return
    }
    setDirty(false); setDistributed(null)
    setMsg({ ok: true, text: 'Budgeten är sparad. Säljarna ser sin budget direkt i CRM:et.' })
    loadBudgets()
  }

  const field: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }
  const cellIn: React.CSSProperties = { ...field, padding: '8px 9px', fontSize: 14, textAlign: 'right', minWidth: 96 }
  const card: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 20px', marginBottom: 18 }
  const h2: React.CSSProperties = { margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }
  const help: React.CSSProperties = { margin: '0 0 14px', fontSize: 14, color: 'var(--text2)' }
  const th: React.CSSProperties = { padding: '10px 10px', textAlign: 'right', color: 'var(--text2)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 14, color: 'var(--text)', textAlign: 'right', whiteSpace: 'nowrap' }
  const pctColor = (p: number | null) => p === null ? 'var(--text2)' : p >= 100 ? 'var(--green)' : 'var(--text)'

  if (!range) return <div style={{ padding: 40, color: 'var(--text2)' }}>Laddar…</div>

  // This month, for the company and each salesperson.
  const nowKey = ymKey(thisYM)
  const nowSold = soldByMonth[nowKey]
  const nowCompanyBudget = months.some(isNow) ? companyOf(nowKey) : 0
  const periodPct = pct(period.sold, period.budget)
  const vsPlan = Math.round(period.sold - period.expected)

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px clamp(14px,3vw,24px) 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <Target size={24} color="var(--gold)" />
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>Budget</h1>
      </div>
      <p style={help}>Lägg in en årsbudget för bolaget så fördelas den på månader och arbetsdagar, eller skriv in budgeten för varje månad själv – för bolaget och för varje säljare. Säljarna ser sin månadsbudget, dagsbudget, vad de sålt och vad som är kvar på sin översikt i CRM:et.</p>
      {missingTable && <p role="alert" style={{ ...help, color: '#E0A85A', fontWeight: 600 }}>Kör migration 0027 i Supabase (SQL Editor) för att kunna spara bolagets budget och årsbudgetar. Säljarnas budget fungerar redan.</p>}

      {/* Shortcuts to the parts of the page */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[['#arsbudget', 'Fördela årsbudget'], ['#manader', 'Budget per månad och säljare'], ['#manuell', 'Registrera försäljning manuellt']].map(([h, l]) => (
          <a key={h} href={h} style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--bg3)', border: '1px solid rgba(232,184,75,.35)', color: 'var(--text)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>{l} ↓</a>
        ))}
      </div>

      {/* Period */}
      <div style={{ ...card, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <MonthPicker label="Period från" value={range.from} onChange={v => changeRange({ ...range, from: v })} />
        <MonthPicker label="Till och med" value={range.to} onChange={v => changeRange({ ...range, to: v })} />
        <div style={{ fontSize: 14, color: 'var(--text2)', paddingBottom: 10 }}>
          {months.length} månader · {months.reduce((n, m) => n + workdaysInMonth(m), 0)} arbetsdagar
        </div>
        <button onClick={() => changeRange(defaultBudgetYear())} style={{ marginBottom: 4, padding: '9px 14px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}>
          Detta budgetår (aug–jul)
        </button>
      </div>

      {/* Overview of the period */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { l: 'Budget för perioden', v: `${fmt(period.budget)} kr`, s: `${ymLabel(range.from)} – ${ymLabel(range.to)}` },
          { l: 'Sålt hittills', v: `${fmt(period.sold)} kr`, s: 'exkl. moms', c: period.sold > 0 ? 'var(--green)' : undefined },
          { l: 'Av budgeten', v: periodPct === null ? '—' : `${periodPct}%`, s: period.budget ? `kvar ${fmt(Math.max(0, period.budget - period.sold))} kr` : 'ingen budget satt' },
          { l: 'Mot planen idag', v: period.budget ? `${vsPlan >= 0 ? '+' : '−'}${fmt(Math.abs(vsPlan))} kr` : '—', s: period.budget ? `plan hittills ${fmt(Math.round(period.expected))} kr` : '', c: period.budget ? (vsPlan >= 0 ? 'var(--green)' : '#E0A85A') : undefined },
        ].map(x => (
          <div key={x.l} style={{ ...card, marginBottom: 0, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{x.l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: x.c || 'var(--text)', margin: '4px 0 2px' }}>{x.v}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{x.s}</div>
          </div>
        ))}
      </div>

      {/* This month per salesperson */}
      {months.some(isNow) && (
        <div style={card}>
          <h2 style={h2}><Users size={18} color="var(--gold)" /> Så ligger alla till i {MONTHS[thisYM.month].toLowerCase()}</h2>
          <p style={help}>Månadens budget, dagsbudget och försäljning per säljare. ”Mot planen” jämför med vad som borde vara sålt efter dagens arbetsdag.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['', 'Månadsbudget', 'Dagsbudget', 'Sålt', 'Kvar', 'Av budget', 'Mot planen', 'Behöver/dag'].map((h, i) => <th key={i} style={{ ...th, textAlign: i ? 'right' : 'left' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[{ who: 'Hela bolaget', b: nowCompanyBudget, s: nowSold?.company || 0, strong: true },
                  ...people.map(p => ({ who: p, b: num(seller[nowKey]?.[p]), s: nowSold?.people[p] || 0, strong: false }))].map(r => {
                  const st = budgetStatus(r.b, r.s, thisYM, today)
                  const p = pct(r.s, r.b)
                  return (
                    <tr key={r.who} style={{ borderBottom: '1px solid var(--border2)', background: r.strong ? 'rgba(232,184,75,.06)' : undefined }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{r.who}</td>
                      <td style={td}>{r.b ? `${fmt(r.b)} kr` : '—'}</td>
                      <td style={td}>{r.b ? `${fmt(st.daily)} kr` : '—'}</td>
                      <td style={{ ...td, color: r.s ? 'var(--green)' : 'var(--text)' }}>{fmt(r.s)} kr</td>
                      <td style={td}>{r.b ? `${fmt(st.remaining)} kr` : '—'}</td>
                      <td style={td}>
                        {p === null ? '—' : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 70, height: 7, borderRadius: 4, background: 'rgba(255,255,255,.08)', overflow: 'hidden', display: 'inline-block' }}>
                              <span style={{ display: 'block', height: '100%', width: `${Math.min(100, p)}%`, background: p >= 100 ? 'var(--green)' : st.vsExpected >= 0 ? '#5EC49A' : '#E0A85A' }} />
                            </span>
                            <strong style={{ color: pctColor(p) }}>{p}%</strong>
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, color: !r.b ? 'var(--text2)' : st.vsExpected >= 0 ? 'var(--green)' : '#E0A85A', fontWeight: 700 }}>{r.b ? `${st.vsExpected >= 0 ? '+' : '−'}${fmt(Math.abs(st.vsExpected))} kr` : '—'}</td>
                      <td style={td}>{r.b && st.remaining ? `${fmt(st.neededPerDay)} kr` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8 }}>
            {budgetStatus(0, 0, thisYM, today).passed} av {workdaysInMonth(thisYM)} arbetsdagar har gått (helgdagar räknas inte).
          </div>
        </div>
      )}

      {/* Annual budget → months */}
      <div id="arsbudget" style={{ ...card, scrollMarginTop: 80 }}>
        <h2 style={h2}><Wand2 size={18} color="var(--gold)" /> Fördela en årsbudget</h2>
        <p style={help}>Skriv in bolagets budget för hela perioden. Den fördelas på månaderna efter antal arbetsdagar (eller lika mycket per månad) och kan sedan delas på säljarna. Inget sparas förrän du trycker Spara budget – du kan justera varje månad först.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'start' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
            Budget för perioden (kr exkl. moms)
            <input inputMode="numeric" value={annual ? fmt(num(annual)) : ''} onChange={e => setAnnual(e.target.value.replace(/[^\d]/g, ''))} placeholder="t.ex. 6 000 000" style={{ ...field, fontSize: 18, fontWeight: 700 }} />
            {num(annual) > 0 && months.length > 0 && <span style={{ fontWeight: 400, fontSize: 13 }}>≈ {fmt(Math.round(num(annual) / months.length))} kr/månad · {fmt(Math.round(num(annual) / Math.max(1, months.reduce((n, m) => n + workdaysInMonth(m), 0))))} kr/arbetsdag</span>}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
            Fördela
            {([['workdays', 'Efter arbetsdagar i månaden'], ['even', 'Lika mycket varje månad']] as const).map(([k, l]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 500, color: 'var(--text)', minHeight: 32, cursor: 'pointer' }}>
                <input type="radio" name="method" checked={method === k} onChange={() => setMethod(k)} style={{ width: 18, height: 18, accentColor: '#E8B84B' }} /> {l}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, color: 'var(--text)', cursor: 'pointer', minHeight: 32 }}>
              <input type="checkbox" checked={alsoSellers} onChange={e => setAlsoSellers(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#E8B84B' }} />
              Dela även på säljarna
            </label>
            {people.map(p => (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text)' }}>
                <span style={{ flex: 1 }}>{p}</span>
                <input inputMode="decimal" aria-label={`Andel ${p}`} value={shares[p] ?? ''} onChange={e => setShares(s => ({ ...s, [p]: e.target.value }))} style={{ ...field, width: 80, padding: '7px 9px', textAlign: 'right' }} />
                <span style={{ color: 'var(--text2)' }}>%</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button onClick={distribute} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 9, background: 'rgba(232,184,75,.14)', border: '1px solid rgba(232,184,75,.5)', color: 'var(--text)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            <Wand2 size={16} color="var(--gold)" /> Fördela på månaderna
          </button>
          <button onClick={() => { applyShares(); setMsg({ ok: true, text: 'Bolagets månadsbudget är delad på säljarna. Tryck Spara budget.' }) }} style={{ padding: '12px 18px', borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Dela bolagets månader på säljarna
          </button>
        </div>
      </div>

      {/* Month by month */}
      <div id="manader" style={{ ...card, scrollMarginTop: 80 }}>
        <h2 style={h2}><Target size={18} color="var(--gold)" /> Månad för månad</h2>
        <p style={help}>Skriv in eller justera budgeten för bolaget och varje säljare. Lämnar du bolagets ruta tom räknas säljarnas summa som bolagets budget. Tryck på en månad för att se den dag för dag.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 + people.length * 120 }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ ...th, textAlign: 'left' }}>Månad</th>
              <th style={th}>Arb.dagar</th>
              <th style={th}>Bolaget</th>
              <th style={th}>Per dag</th>
              {people.map(p => <th key={p} style={th}>{p}</th>)}
              <th style={th}>Sålt</th>
              <th style={th}>Av budget</th>
            </tr></thead>
            <tbody>
              {months.map(ym => {
                const k = ymKey(ym)
                const b = companyOf(k)
                const wd = workdaysInMonth(ym)
                const sold = soldByMonth[k]?.company || 0
                const p = started(ym) ? pct(sold, b) : null
                const ss = sellerSum(k)
                const mismatch = num(company[k]) > 0 && ss > 0 && ss !== num(company[k])
                const open = openMonth === k
                return (
                  <Fragment key={k}>
                    <tr style={{ borderBottom: '1px solid var(--border2)', background: isNow(ym) ? 'rgba(232,184,75,.06)' : undefined }}>
                      <td style={{ ...td, textAlign: 'left' }}>
                        <button onClick={() => setOpenMonth(open ? null : k)} aria-expanded={open} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: '6px 0', color: 'var(--text)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {MONTHS[ym.month]} {ym.year}
                        </button>
                        {isNow(ym) && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: 'var(--gold)', color: '#111' }}>NU</span>}
                      </td>
                      <td style={{ ...td, color: 'var(--text2)' }}>{wd}</td>
                      <td style={td}>
                        <input inputMode="numeric" aria-label={`Bolaget ${ymLabel(ym)}`} value={company[k] ? fmt(num(company[k])) : ''} placeholder={ss ? fmt(ss) : '0'}
                          onChange={e => { setCompany(c => ({ ...c, [k]: e.target.value.replace(/[^\d]/g, '') })); setDirty(true) }} style={{ ...cellIn, fontWeight: 700 }} />
                        {mismatch && <div style={{ fontSize: 11, color: '#E0A85A', marginTop: 3 }}>Säljarna: {fmt(ss)}</div>}
                      </td>
                      <td style={{ ...td, color: 'var(--text2)' }}>{b && wd ? `${fmt(Math.round(b / wd))}` : '—'}</td>
                      {people.map(sp => (
                        <td key={sp} style={td}>
                          <input inputMode="numeric" aria-label={`${sp} ${ymLabel(ym)}`} value={seller[k]?.[sp] ? fmt(num(seller[k][sp])) : ''} placeholder="0"
                            onChange={e => { const v = e.target.value.replace(/[^\d]/g, ''); setSeller(s => ({ ...s, [k]: { ...s[k], [sp]: v } })); setDirty(true) }} style={cellIn} />
                          {started(ym) && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>sålt {fmt(soldByMonth[k]?.people[sp] || 0)}{num(seller[k]?.[sp]) ? ` · ${pct(soldByMonth[k]?.people[sp] || 0, num(seller[k]?.[sp]))}%` : ''}</div>}
                        </td>
                      ))}
                      <td style={{ ...td, color: started(ym) && sold ? 'var(--green)' : 'var(--text2)' }}>{started(ym) ? `${fmt(sold)} kr` : '—'}</td>
                      <td style={{ ...td, fontWeight: 700, color: pctColor(p) }}>{p === null ? '—' : `${p}%`}</td>
                    </tr>
                    {open && (
                      <tr><td colSpan={6 + people.length} style={{ padding: '6px 10px 16px', background: 'rgba(255,255,255,.02)' }}>
                        <DayByDay ym={ym} who={dayWho} setWho={setDayWho} people={people}
                          budget={dayWho ? num(seller[k]?.[dayWho]) : b}
                          sales={sales.filter(x => inMonth(x.created_at, ym) && (!dayWho || x.assigned_to === dayWho))} />
                      </td></tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot><tr style={{ borderTop: '2px solid var(--border)' }}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 800 }}>Totalt</td>
              <td style={{ ...td, color: 'var(--text2)' }}>{months.reduce((n, m) => n + workdaysInMonth(m), 0)}</td>
              <td style={{ ...td, fontWeight: 800 }}>{fmt(period.budget)} kr</td>
              <td style={td} />
              {people.map(p => (
                <td key={p} style={{ ...td, fontWeight: 700 }}>
                  {fmt(period.per[p]?.budget || 0)} kr
                  <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 400 }}>sålt {fmt(period.per[p]?.sold || 0)}{period.per[p]?.budget ? ` · ${pct(period.per[p].sold, period.per[p].budget)}%` : ''}</div>
                </td>
              ))}
              <td style={{ ...td, fontWeight: 800, color: 'var(--green)' }}>{fmt(period.sold)} kr</td>
              <td style={{ ...td, fontWeight: 800, color: pctColor(periodPct) }}>{periodPct === null ? '—' : `${periodPct}%`}</td>
            </tr></tfoot>
          </table>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '10px 0 0' }}>Sålt räknas som säljarnas budget gör i övrigt: ordrar exkl. moms (inte varukorgar, offerter eller makulerade) plus vunna affärer utan kopplad order och försäljning du registrerat manuellt. Helgdagar, midsommarafton, julafton och nyårsafton räknas inte som arbetsdagar.</p>
      </div>

      {/* Sales entered by hand */}
      <div id="manuell" style={{ ...card, scrollMarginTop: 80 }}>
        <h2 style={h2}><PenLine size={18} color="var(--gold)" /> Registrera försäljning manuellt</h2>
        <p style={help}>För försäljning som inte finns som ordrar i systemet, t.ex. augusti och september innan CRM:et användes. Beloppet (kr exkl. moms) läggs till det som säljaren sålt i systemet och räknas in i budgeten. Skriv bara in det som saknas, annars räknas det två gånger.</p>
        {manualMissing && <p role="alert" style={{ ...help, color: '#E0A85A', fontWeight: 600 }}>Kör migration 0028 i Supabase (SQL Editor) för att kunna registrera försäljning manuellt.</p>}
        {months.filter(started).length === 0 ? <p style={help}>Perioden har inte börjat än.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 260 + people.length * 150 }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ ...th, textAlign: 'left' }}>Månad</th>
                {people.map(p => <th key={p} style={th}>{p}</th>)}
                <th style={th}>Manuellt totalt</th>
              </tr></thead>
              <tbody>
                {months.filter(started).map(ym => {
                  const k = ymKey(ym)
                  return (
                    <tr key={k} style={{ borderBottom: '1px solid var(--border2)' }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 700, fontSize: 15 }}>{MONTHS[ym.month]} {ym.year}</td>
                      {people.map(sp => (
                        <td key={sp} style={td}>
                          <input inputMode="numeric" aria-label={`Manuell försäljning ${sp} ${ymLabel(ym)}`} placeholder="0"
                            value={manual[k]?.[sp] ? fmt(num(manual[k][sp])) : ''}
                            onChange={e => { const v = e.target.value.replace(/[^\d]/g, ''); setManual(m => ({ ...m, [k]: { ...m[k], [sp]: v } })); setManualDirty(true); setManualMsg(null) }}
                            style={cellIn} />
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>i systemet {fmt(soldByMonth[k]?.system[sp] || 0)} kr</div>
                        </td>
                      ))}
                      <td style={{ ...td, fontWeight: 700 }}>{fmt(people.reduce((n, p) => n + num(manual[k]?.[p]), 0))} kr</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <button onClick={saveManual} disabled={manualSaving || !manualDirty} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 9, background: manualDirty ? 'var(--gold)' : 'var(--bg4)', border: 'none', color: manualDirty ? '#111' : 'var(--text2)', fontSize: 15, fontWeight: 800, cursor: manualDirty ? 'pointer' : 'default', opacity: manualSaving ? .6 : 1 }}>
            <Save size={16} /> {manualSaving ? 'Sparar…' : 'Spara försäljning'}
          </button>
          {manualMsg && <span role={manualMsg.ok ? 'status' : 'alert'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: manualMsg.ok ? 'var(--green)' : 'var(--red)' }}>{manualMsg.ok && <Check size={15} />}{manualMsg.text}</span>}
        </div>
      </div>

      {/* Save bar */}
      <div style={{ position: dirty ? 'sticky' : 'static', bottom: 12, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', background: 'rgba(22,25,32,.96)', border: `1px solid ${dirty ? 'rgba(232,184,75,.55)' : 'var(--line)'}`, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,.4)' }}>
        <button onClick={save} disabled={saving || !dirty} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 9, background: dirty ? 'var(--gold)' : 'var(--bg4)', border: 'none', color: dirty ? '#111' : 'var(--text2)', fontSize: 15, fontWeight: 800, cursor: dirty ? 'pointer' : 'default', opacity: saving ? .6 : 1 }}>
          <Save size={16} /> {saving ? 'Sparar…' : 'Spara budget'}
        </button>
        {dirty && <button onClick={() => { loadBudgets(); setDistributed(null); setMsg(null) }} style={{ padding: '10px 14px', borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}>Ångra ändringar</button>}
        {msg ? <span role={msg.ok ? 'status' : 'alert'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.ok && <Check size={15} />}{msg.text}</span>
          : <span style={{ fontSize: 14, color: 'var(--text2)' }}>{dirty ? 'Du har ändringar som inte är sparade.' : 'Allt är sparat.'}</span>}
      </div>
    </div>
  )
}

// One month day by day: each working day's budget, what was sold that day,
// and the running total against the plan.
function DayByDay({ ym, budget, sales, who, setWho, people }: { ym: YM; budget: number; sales: Sale[]; who: string; setWho: (v: string) => void; people: string[] }) {
  const days = workdaysOf(ym)
  const daily = days.length ? budget / days.length : 0
  const byDay: Record<string, number> = {}
  for (const s of sales) { const k = dayKey(new Date(s.created_at)); byDay[k] = (byDay[k] || 0) + (s.subtotal || 0) }
  const todayKey = dayKey(new Date())
  // Sales on a weekend or holiday count towards the next working day (and
  // the month's last weekend towards its last working day).
  const spill = (to: string, after: string) => Object.entries(byDay).filter(([k]) => k <= to && k > after).reduce((n, [, v]) => n + v, 0)
  const monthEnd = dayKey(new Date(ym.year, ym.month + 1, 0))
  const before = dayKey(new Date(ym.year, ym.month, 0))
  const rows: { d: Date; k: string; sold: number; accPlan: number; accSold: number; future: boolean; diff: number }[] = []
  for (let i = 0, accPlan = 0, accSold = 0; i < days.length; i++) {
    const d = days[i], k = dayKey(d)
    const sold = spill(i === days.length - 1 ? monthEnd : k, i ? dayKey(days[i - 1]) : before)
    accPlan += daily; accSold += sold
    rows.push({ d, k, sold, accPlan, accSold, future: k > todayKey, diff: Math.round(accSold - accPlan) })
  }
  const th: React.CSSProperties = { padding: '7px 10px', textAlign: 'right', color: 'var(--text2)', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '6px 10px', fontSize: 13, color: 'var(--text)', textAlign: 'right', whiteSpace: 'nowrap' }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '6px 0 8px' }}>
        <strong style={{ fontSize: 14, color: 'var(--text)' }}>{MONTHS[ym.month]} dag för dag</strong>
        <select value={who} onChange={e => setWho(e.target.value)} aria-label="Visa för" style={{ padding: '7px 10px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13 }}>
          <option value="">Hela bolaget</option>
          {people.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>{budget ? `${fmt(Math.round(daily))} kr per arbetsdag` : 'ingen budget satt'}</span>
      </div>
      <table style={{ borderCollapse: 'collapse', minWidth: 520 }}>
        <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
          <th style={{ ...th, textAlign: 'left' }}>Dag</th><th style={th}>Dagsbudget</th><th style={th}>Sålt</th><th style={th}>Plan hittills</th><th style={th}>Sålt hittills</th><th style={th}>Mot planen</th>
        </tr></thead>
        <tbody>
          {rows.map(({ d, k, sold, accPlan, accSold, future, diff }) => {
            return (
              <tr key={k} style={{ borderBottom: '1px solid var(--border2)', opacity: future ? .7 : 1, background: k === todayKey ? 'rgba(232,184,75,.08)' : undefined }}>
                <td style={{ ...td, textAlign: 'left' }}>{d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                <td style={td}>{fmt(Math.round(daily))}</td>
                <td style={{ ...td, color: sold ? 'var(--green)' : 'var(--text2)' }}>{future ? '' : fmt(sold)}</td>
                <td style={td}>{fmt(Math.round(accPlan))}</td>
                <td style={td}>{future ? '' : fmt(accSold)}</td>
                <td style={{ ...td, fontWeight: 700, color: future || !budget ? 'var(--text2)' : diff >= 0 ? 'var(--green)' : '#E0A85A' }}>{future || !budget ? '' : `${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff))}`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>Ordrar från helger och helgdagar räknas på nästa arbetsdag. Vunna affärer utan order syns i månadens summa men inte per dag.</div>
    </div>
  )
}
