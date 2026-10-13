// "Beställ igen": puts an earlier order's products in the webshop cart at
// today's prices (current list price and image, inactive products skipped).
import type { SupabaseClient } from '@supabase/supabase-js'

type CartProduct = { id: string; name: string; brand: string; list_price: number; image_url: string | null; unit: string }
type Cart = { addItem: (p: CartProduct, priceList: string) => void; updateQty: (id: string, qty: number) => void; items: { id: string; qty: number }[]; openCart: () => void }

export async function reorderToCart(sb: SupabaseClient, cart: Cart, order: any, priceList: string): Promise<{ added: number; skipped: number }> {
  const qty = new Map<string, number>()
  for (const i of order.order_items ?? []) if (i.product_id) qty.set(i.product_id, (qty.get(i.product_id) ?? 0) + i.qty)
  if (qty.size === 0) return { added: 0, skipped: (order.order_items ?? []).length }
  const { data } = await sb.from('products').select('id,name,brand,list_price,image_url,unit,active').in('id', [...qty.keys()])
  const live = (data ?? []).filter((p: any) => p.active !== false)
  for (const p of live) {
    const inCart = cart.items.find(i => i.id === p.id)?.qty ?? 0
    cart.addItem({ id: p.id, name: p.name, brand: p.brand || '', list_price: p.list_price, image_url: p.image_url ?? null, unit: p.unit || '' }, priceList)
    cart.updateQty(p.id, inCart + qty.get(p.id)!)
  }
  if (live.length) cart.openCart()
  return { added: live.length, skipped: qty.size - live.length }
}
