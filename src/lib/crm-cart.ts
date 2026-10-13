// The CRM cart the salesperson is working on, remembered in this browser so
// the cart icon in the top bar can show it and Ny order can pick it up again.
export const CART_EVENT = 'prolux-crm-cart'
export const OPEN_CART_EVENT = 'prolux-crm-open-cart'
const KEY = 'prolux-crm-cart-v1'

export interface SavedCart { draftId: string | null; count: number }

export function readCart(): SavedCart | null {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null } catch { return null }
}

export function writeCart(cart: SavedCart | null) {
  try {
    if (cart && cart.count > 0) localStorage.setItem(KEY, JSON.stringify(cart))
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
