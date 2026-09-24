import type { User } from '@supabase/supabase-js'

// Salespeople are identified by first name everywhere they are stored:
// sales_budgets.salesperson, deals.assigned_to, customers.account_manager
// and orders.assigned_to.
export const SALESPEOPLE = ['Bashar', 'Stefan', 'Anna', 'Erik']

export function salespersonName(user: User | null | undefined): string {
  return (user?.user_metadata?.full_name || user?.user_metadata?.name || 'Bashar').split(' ')[0]
}

export function monthRange(date = new Date()) {
  const y = date.getFullYear(), m = date.getMonth()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end:   `${y}-${pad(m + 1)}-${new Date(y, m + 1, 0).getDate()}T23:59:59`,
  }
}

// Budget credit: each salesperson's order value this month, excluding VAT and cancelled orders.
export function salesBySalesperson(orders: { assigned_to?: string | null; subtotal?: number | null; status?: string | null }[]) {
  const acc: Record<string, number> = {}
  for (const o of orders) {
    if (!o.assigned_to || o.status === 'cancelled') continue
    acc[o.assigned_to] = (acc[o.assigned_to] || 0) + (o.subtotal || 0)
  }
  return acc
}
