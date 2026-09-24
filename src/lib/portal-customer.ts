import type { SupabaseClient } from '@supabase/supabase-js'

// Orders belong to customers.id. Older portal orders were saved under the
// login id, so reads match both until migration 0006 has moved them.
export async function portalCustomer(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('customers').select('id').eq('auth_user_id', userId).maybeSingle()
  const customerId: string | null = data?.id ?? null
  return {
    customerId,
    orderOwnerIds: customerId ? [customerId, userId] : [userId],
  }
}
