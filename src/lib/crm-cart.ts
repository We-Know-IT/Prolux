// The CRM cart the salesperson is working on, remembered in this browser so
// the cart icon in the top bar can show it and Ny order can pick it up again.
export const CART_EVENT = 'prolux-crm-cart'
export const OPEN_CART_EVENT = 'prolux-crm-open-cart'
const KEY = 'prolux-crm-cart-v1'

export interface SavedCart { draftId: string | null; count: number }

const today = () => new Date().toLocaleDateString('sv-SE')

// Only today's cart counts (an active cart lasts until midnight).
export function readCart(): SavedCart | null {
  try {
    const v = localStorage.getItem(KEY)
    if (!v) return null
    const c = JSON.parse(v)
    if (c.day !== today()) { localStorage.removeItem(KEY); return null }
    return c
  } catch { return null }
}

export function writeCart(cart: SavedCart | null) {
  try {
    if (cart && cart.count > 0) localStorage.setItem(KEY, JSON.stringify({ ...cart, day: today() }))
    else localStorage.removeItem(KEY)
  } catch { /* storage blocked: the icon just shows no count */ }
  window.dispatchEvent(new Event(CART_EVENT))
}

// Deletes a saved cart (draft) or quote. Live orders are never touched.
export async function deleteOpenOrder(sb: { from: (t: string) => any }, id: string): Promise<boolean> {
  const { data } = await sb.from('orders').select('status').eq('id', id).maybeSingle()
  if (!data || !['draft', 'quote'].includes(data.status)) return false
  await sb.from('order_items').delete().eq('order_id', id)
  const { error } = await sb.from('orders').delete().eq('id', id)
  if (error) return false
  if (readCart()?.draftId === id) writeCart(null)
  return true
}

// The seller's cart from today in the database (an active cart lasts until
// midnight; after that Ny order starts empty), so the cart follows the
// login across browsers and devices (not just this browser's memory).
export async function findMyLatestDraft(sb: { from: (t: string) => any }, myName: string): Promise<{ id: string; count: number } | null> {
  if (!myName) return null
  const { data } = await sb.from('orders').select('id,order_items(qty)')
    .eq('status', 'draft').eq('created_by', myName).gte('created_at', startOfToday())
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!data) return null
  return { id: data.id, count: (data.order_items ?? []).reduce((n: number, i: any) => n + (i.qty || 0), 0) }
}

// Local midnight today, as ISO (an active cart lasts until then).
export function startOfToday(): string {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString()
}

// Carts without a customer from earlier days are left-overs: remove them.
export async function cleanOldCarts(sb: { from: (t: string) => any }, myName: string) {
  if (!myName) return
  const { data } = await sb.from('orders').select('id').eq('status', 'draft').eq('created_by', myName)
    .is('customer_id', null).lt('created_at', startOfToday()).limit(50)
  for (const o of (data ?? []) as { id: string }[]) await deleteOpenOrder(sb, o.id)
}
