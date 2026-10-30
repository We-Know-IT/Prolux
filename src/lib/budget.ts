// Budget arithmetic shared by the admin budget page and the dashboards:
// Swedish working days, splitting an annual budget into months, and how a
// salesperson (or the company) stands against the month's budget.
// Months are 0–11 everywhere, the same as sales_budgets.month.
import { isLiveOrder } from '@/lib/team'

export const MONTHS = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December']
export const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

export interface YM { year: number; month: number }

const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const ymKey = (ym: YM) => `${ym.year}-${pad(ym.month + 1)}`
export const ymLabel = (ym: YM) => `${MONTHS[ym.month]} ${ym.year}`

// Easter Sunday (Gregorian), for the moving Swedish holidays.
function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  return new Date(year, month, ((h + l - 7 * m + 114) % 31) + 1)
}

const holidayCache = new Map<number, Set<string>>()
// Weekdays the office is closed: public holidays plus midsummer, Christmas
// and New Year's Eve.
export function swedishHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year)
  if (cached) return cached
  const e = easter(year)
  const plus = (n: number) => new Date(e.getFullYear(), e.getMonth(), e.getDate() + n)
  // Midsummer's Eve: the Friday between 19 and 25 June.
  const midsummer = new Date(year, 5, 19)
  while (midsummer.getDay() !== 5) midsummer.setDate(midsummer.getDate() + 1)
  const days = [
    new Date(year, 0, 1), new Date(year, 0, 6), plus(-2), plus(1), new Date(year, 4, 1),
    plus(39), new Date(year, 5, 6), midsummer,
    new Date(year, 11, 24), new Date(year, 11, 25), new Date(year, 11, 26), new Date(year, 11, 31),
  ]
  const set = new Set(days.map(dayKey))
  holidayCache.set(year, set)
  return set
}

export function isWorkday(d: Date) {
  const wd = d.getDay()
  return wd !== 0 && wd !== 6 && !swedishHolidays(d.getFullYear()).has(dayKey(d))
}

export function workdaysOf(ym: YM): Date[] {
  const out: Date[] = []
  for (let d = new Date(ym.year, ym.month, 1); d.getMonth() === ym.month; d.setDate(d.getDate() + 1)) {
    if (isWorkday(d)) out.push(new Date(d))
  }
  return out
}
export const workdaysInMonth = (ym: YM) => workdaysOf(ym).length

// Working days of the month up to and including `today` (all of them for a
// past month, none for a future one).
export function workdaysPassed(ym: YM, today = new Date()) {
  const t = dayKey(today)
  return workdaysOf(ym).filter(d => dayKey(d) <= t).length
}

export function monthsBetween(from: YM, to: YM): YM[] {
  const out: YM[] = []
  for (let y = from.year, m = from.month; y < to.year || (y === to.year && m <= to.month); m === 11 ? (y++, m = 0) : m++) {
    out.push({ year: y, month: m })
    if (out.length > 36) break
  }
  return out
}

// Split `total` across the months, by working days or evenly. Whole kronor;
// what rounding leaves over goes to the last month, so the sum is exact.
export function splitBudget(total: number, months: YM[], method: 'workdays' | 'even'): number[] {
  if (!months.length || !(total > 0)) return months.map(() => 0)
  const weights = months.map(ym => method === 'even' ? 1 : workdaysInMonth(ym))
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  const parts = weights.map(w => Math.round(total * w / sum))
  parts[parts.length - 1] += Math.round(total) - parts.reduce((a, b) => a + b, 0)
  return parts
}

// Split a month's company budget across salespeople by share (percent).
export function splitByShare(total: number, shares: Record<string, number>): Record<string, number> {
  const people = Object.keys(shares).filter(p => shares[p] > 0)
  const sum = people.reduce((a, p) => a + shares[p], 0)
  const out: Record<string, number> = {}
  if (!sum || !(total > 0)) return out
  for (const p of people) out[p] = Math.round(total * shares[p] / sum)
  const diff = Math.round(total) - Object.values(out).reduce((a, b) => a + b, 0)
  if (people.length) out[people[people.length - 1]] += diff
  return out
}

// Company sales: every order that counts (assigned or not) plus won deals
// that have no order linked to them.
export function companySold(
  orders: { subtotal?: number | null; status?: string | null }[],
  wonDeals: { id?: string; value?: number | null }[],
  dealsWithOrders: { deal_id?: string | null }[] = [],
) {
  const linked = new Set(dealsWithOrders.map(o => o.deal_id).filter(Boolean))
  return orders.filter(o => isLiveOrder(o.status)).reduce((n, o) => n + (o.subtotal || 0), 0)
    + wonDeals.filter(d => !(d.id && linked.has(d.id))).reduce((n, d) => n + (d.value || 0), 0)
}

export interface BudgetStatus {
  budget: number
  sold: number
  remaining: number        // left to reach the budget (0 once reached)
  pct: number              // sold / budget, in percent
  daily: number            // budget per working day
  workdays: number
  passed: number           // working days passed, today included
  left: number             // working days left, today included
  expected: number         // where you should be by the end of today
  vsExpected: number       // sold − expected: ahead (+) or behind (−)
  neededPerDay: number     // to reach the budget over the working days left
}

export function budgetStatus(budget: number, sold: number, ym: YM, today = new Date()): BudgetStatus {
  const days = workdaysOf(ym)
  const t = dayKey(today)
  const passed = days.filter(d => dayKey(d) <= t).length
  const left = days.filter(d => dayKey(d) >= t).length
  const workdays = days.length
  const daily = workdays ? Math.round(budget / workdays) : 0
  const expected = workdays ? Math.round(budget * passed / workdays) : 0
  const remaining = Math.max(0, Math.round(budget - sold))
  return {
    budget, sold, remaining, workdays, passed, left, daily, expected,
    pct: budget > 0 ? Math.round(sold / budget * 100) : 0,
    vsExpected: Math.round(sold - expected),
    neededPerDay: left ? Math.round(remaining / left) : remaining,
  }
}

// The budget year that holds `d`, August to July (as ProLuxShine plans it).
export function defaultBudgetYear(d = new Date()): { from: YM; to: YM } {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
  return { from: { year: y, month: 7 }, to: { year: y + 1, month: 6 } }
}

// Sales entered by hand per salesperson and month (migration 0028), added to
// what the orders in the system give.
export interface ManualSale { salesperson: string; year: number; month: number; amount: number | string }

export function manualFor(manual: ManualSale[], ym: YM): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of manual) {
    if (m.year !== ym.year || m.month !== ym.month || !(Number(m.amount) > 0)) continue
    out[m.salesperson] = (out[m.salesperson] || 0) + Number(m.amount)
  }
  return out
}

export function withManual(sold: Record<string, number>, manual: Record<string, number>): Record<string, number> {
  const out = { ...sold }
  for (const [p, v] of Object.entries(manual)) out[p] = (out[p] || 0) + v
  return out
}

export const sumOf = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)
