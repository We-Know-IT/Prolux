'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { budgetAchieved } from '@/lib/team'

export interface BudgetMonth {
  year: number
  month: number        // 0-based, as stored in sales_budgets.month
  label: string        // "sep"
  sold: Record<string, number>
  budget: Record<string, number>
}

const SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

// Sold vs budget per salesperson for the last `count` months (current month
// last). Uses the same rules as the monthly budget widget: orders excl. VAT
// and cancelled, plus won deals that have no linked order.
export function useBudgetHistory(count = 6) {
  const [months, setMonths]   = useState<BudgetMonth[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    const sb = createClient()
    const now = new Date()
    const slots = Array.from({ length: count }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
    const first = slots[0]
    const from  = `${first.year}-${String(first.month + 1).padStart(2, '0')}-01`
    const years = [...new Set(slots.map(s => s.year))]

    Promise.all([
      sb.from('orders').select('assigned_to,subtotal,status,created_at').gte('created_at', from),
      sb.from('deals').select('id,assigned_to,value,updated_at').eq('stage', 'Vunnen').gte('updated_at', from),
      sb.from('orders').select('deal_id').not('deal_id', 'is', null).neq('status', 'cancelled'),
      sb.from('sales_budgets').select('salesperson,budget,year,month').in('year', years),
    ]).then(([{ data: orders }, { data: won }, { data: linked }, { data: budgets }]) => {
      const inMonth = (iso: string, s: { year: number; month: number }) => {
        const d = new Date(iso)
        return d.getFullYear() === s.year && d.getMonth() === s.month
      }
      setMonths(slots.map(s => {
        const budget: Record<string, number> = {}
        for (const b of budgets || []) if (b.year === s.year && b.month === s.month) budget[b.salesperson] = b.budget
        return {
          ...s,
          label: SHORT[s.month],
          sold: budgetAchieved(
            (orders || []).filter(o => inMonth(o.created_at, s)),
            (won || []).filter(d => inMonth(d.updated_at, s)),
            linked || [],
          ),
          budget,
        }
      }))
      setLoading(false)
    })
  }, [count])

  useEffect(() => { load() }, [load])
  useLiveRefresh(['orders', 'deals', 'sales_budgets'], load)

  return { months, loading }
}
