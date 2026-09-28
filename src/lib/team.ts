import type { SupabaseClient, User } from '@supabase/supabase-js'
import { userRole, type AppRole } from '@/lib/roles'

// Salespeople are identified by first name everywhere they are stored:
// sales_budgets.salesperson, deals.assigned_to, customers.account_manager
// and orders.assigned_to.
export const SALESPEOPLE = ['Bashar', 'Stefan', 'Anna', 'Erik']

// First name from the account itself. Prefer currentStaff(), which also
// reads the name admin entered under Personal.
export function salespersonName(user: User | null | undefined, staffFullName?: string | null): string {
  const full = staffFullName || user?.user_metadata?.full_name || user?.user_metadata?.name
  if (full) return String(full).trim().split(/\s+/)[0]
  const local = (user?.email || '').split('@')[0].split(/[._-]/)[0]
  return local ? local[0].toUpperCase() + local.slice(1) : ''
}

export interface Me { user: User | null; name: string; role: AppRole; isAdmin: boolean }

// Who is logged in: name from staff_members (Personal in admin), role from
// app_metadata. Every CRM view keys "my" data on this name.
export async function currentStaff(sb: SupabaseClient): Promise<Me> {
  const { data: { user } } = await sb.auth.getUser()
  let staffName: string | null = null
  if (user?.email) {
    const { data } = await sb.from('staff_members').select('full_name').ilike('email', user.email).maybeSingle()
    staffName = data?.full_name ?? null
  }
  const role = userRole(user)
  return { user, name: salespersonName(user, staffName), role, isAdmin: role === 'admin' }
}

export function monthRange(date = new Date()) {
  const y = date.getFullYear(), m = date.getMonth()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end:   `${y}-${pad(m + 1)}-${new Date(y, m + 1, 0).getDate()}T23:59:59`,
  }
}

// Budget credit: each salesperson's order value this month (excluding VAT,
// drafts, quotes and cancelled orders) plus the value of deals they won this month. A won deal
// that has an order linked to it (orders.deal_id) is already counted through
// that order, so it is skipped.
export function salesBySalesperson(orders: { assigned_to?: string | null; subtotal?: number | null; status?: string | null }[]) {
  const acc: Record<string, number> = {}
  for (const o of orders) {
    if (!o.assigned_to || !isLiveOrder(o.status)) continue
    acc[o.assigned_to] = (acc[o.assigned_to] || 0) + (o.subtotal || 0)
  }
  return acc
}

export function budgetAchieved(
  orders: Parameters<typeof salesBySalesperson>[0],
  wonDeals: { id?: string; assigned_to?: string | null; value?: number | null }[],
  dealsWithOrders: { deal_id?: string | null }[] = [],
) {
  const acc = salesBySalesperson(orders)
  const linked = new Set(dealsWithOrders.map(o => o.deal_id).filter(Boolean))
  for (const d of wonDeals) {
    if (!d.assigned_to || (d.id && linked.has(d.id))) continue
    acc[d.assigned_to] = (acc[d.assigned_to] || 0) + (d.value || 0)
  }
  return acc
}

// Orders a CRM user can confirm: ones they placed or received. Admins also
// handle orders nobody has been assigned.
export function canConfirmOrder(o: { assigned_to?: string | null; created_by?: string | null }, me: string, isAdmin: boolean) {
  return isAdmin ? (!o.assigned_to || o.assigned_to === me || o.created_by === me) : (o.assigned_to === me || o.created_by === me)
}

// Orders that count as sales and hold stock: not drafts, quotes or cancelled.
export const NOT_LIVE_STATUSES = ['draft', 'quote', 'cancelled'] as const
export function isLiveOrder(status: string | null | undefined) {
  return !(NOT_LIVE_STATUSES as readonly string[]).includes(status || '')
}
// For Supabase filters: .not('status', 'in', NOT_LIVE_FILTER)
export const NOT_LIVE_FILTER = `(${NOT_LIVE_STATUSES.join(',')})`
