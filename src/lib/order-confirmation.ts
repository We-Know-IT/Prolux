import { createClient } from '@/lib/supabase/client'

// E-mails the customer a confirmation of their order, via the
// "order-confirmation" Edge Function. Throws with a message to show.
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const { data: { session } } = await createClient().auth.getSession()
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/order-confirmation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ order_id: orderId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || (res.status === 404 ? 'funktionen är inte driftsatt ännu' : `fel ${res.status}`))
}
