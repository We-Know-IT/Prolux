// Recommendations from real purchases: products that other customers bought in
// the same orders as these, topped up with the bestsellers.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SoldLine { order_id: string; product_id: string | null; qty: number }

export function rankRecommendations(lines: SoldLine[], boughtIds: string[], limit = 4, allowed?: Set<string>): string[] {
  const bought = new Set(boughtIds)
  const byOrder = new Map<string, Set<string>>()
  const sold = new Map<string, number>()
  for (const l of lines) {
    if (!l.product_id) continue
    if (!byOrder.has(l.order_id)) byOrder.set(l.order_id, new Set())
    byOrder.get(l.order_id)!.add(l.product_id)
    sold.set(l.product_id, (sold.get(l.product_id) ?? 0) + (l.qty || 0))
  }
  const together = new Map<string, number>()
  for (const items of byOrder.values()) {
    if (![...items].some(id => bought.has(id))) continue
    for (const id of items) if (!bought.has(id)) together.set(id, (together.get(id) ?? 0) + 1)
  }
  const ok = (id: string) => !bought.has(id) && (!allowed || allowed.has(id))
  const ranked = [...together.entries()].filter(([id]) => ok(id))
    .sort((a, b) => b[1] - a[1] || (sold.get(b[0]) ?? 0) - (sold.get(a[0]) ?? 0)).map(([id]) => id)
  const best = [...sold.entries()].filter(([id]) => ok(id) && !ranked.includes(id)).sort((a, b) => b[1] - a[1]).map(([id]) => id)
  return [...ranked, ...best].slice(0, limit)
}

export async function recommendFor(sb: SupabaseClient, boughtIds: string[], limit = 4, allowed?: Set<string>): Promise<string[]> {
  const { data } = await sb.from('order_items').select('order_id,product_id,qty,orders!inner(status)')
    .not('orders.status', 'in', '(draft,quote,cancelled)').limit(5000)
  return rankRecommendations((data ?? []) as unknown as SoldLine[], boughtIds, limit, allowed)
}
