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
