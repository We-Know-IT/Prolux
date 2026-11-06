import { createClient } from '@/lib/supabase/client'
import { removeUser } from '@/lib/remove-user'

export type DeleteOutcome = 'deleted' | 'inactive'

// Removes a customer card. A customer with orders keeps its order history:
// the card is made inactive instead. A customer with a login goes through
// the create-staff-user function so the login is removed too.
export async function deleteCustomer(c: { id: string; auth_user_id?: string | null }): Promise<DeleteOutcome> {
  if (c.auth_user_id) {
    const r = await removeUser({ customer_id: c.id })
    return r.customer === 'deleted' ? 'deleted' : 'inactive'
  }
  const sb = createClient()
  const { data: anyOrder } = await sb.from('orders').select('id').eq('customer_id', c.id).limit(1)
  if (anyOrder?.length) return inactivate(c.id)
  let { error } = await sb.from('customers').delete().eq('id', c.id)
  if (error && /foreign key|violates/i.test(error.message)) {
    // Notes, to dos, visits and the like that point at the card go with it.
    for (const t of ['activities', 'customer_activities', 'reminders', 'visit_plans', 'customer_product_views', 'deals']) {
      await sb.from(t).delete().eq('customer_id', c.id)
    }
    ;({ error } = await sb.from('customers').delete().eq('id', c.id))
    if (error) return inactivate(c.id)
  }
  if (error) throw new Error(error.message)
  return 'deleted'
}

async function inactivate(id: string): Promise<DeleteOutcome> {
  const { error } = await createClient().from('customers').update({ status: 'inactive' }).eq('id', id)
  if (error) throw new Error(error.message)
  return 'inactive'
}

// Several at once (e.g. an import that went wrong). Returns how it went.
export async function deleteCustomers(list: { id: string; auth_user_id?: string | null }[], onProgress?: (done: number) => void) {
  const out = { deleted: [] as string[], inactive: [] as string[], failed: [] as string[] }
  for (let i = 0; i < list.length; i++) {
    try { out[await deleteCustomer(list[i]) === 'deleted' ? 'deleted' : 'inactive'].push(list[i].id) }
    catch { out.failed.push(list[i].id) }
    onProgress?.(i + 1)
  }
  return out
}
