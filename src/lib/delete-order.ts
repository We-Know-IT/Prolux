import { createClient } from '@/lib/supabase/client'

// Admin: removes an order for good. Its lines go first; the database puts the
// goods back in stock (warehouse or the seller's car) as the lines are removed.
export async function deleteOrder(id: string): Promise<void> {
  const sb = createClient()
  const { error: itemsError } = await sb.from('order_items').delete().eq('order_id', id)
  if (itemsError) throw new Error(itemsError.message)
  const { error } = await sb.from('orders').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
