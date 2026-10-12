import { createClient } from '@/lib/supabase/client'

// Calls the "visma" Edge Function (supabase/functions/visma) as the logged-in user.
export async function callVisma<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/visma`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || (res.status === 404 ? 'Visma-funktionen är inte driftsatt ännu.' : `Fel ${res.status}`))
  return json as T
}

// After an order is placed or confirmed: create its Visma invoice when
// automatic invoicing is on. Never blocks the caller; problems show on the order.
export function invoiceInVismaInBackground(orderId: string) {
  callVisma('sync-order', { order_id: orderId, auto: true }).catch(() => { /* shown as visma_error on the order */ })
}

export const VISMA_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Fakturautkast i Visma', color: '#6AAFF0', bg: 'rgba(74,143,212,.12)' },
  invoiced: { label: 'Fakturerad',            color: 'var(--gold)', bg: 'rgba(232,184,75,.12)' },
  paid:     { label: 'Betald',                color: 'var(--green)', bg: 'rgba(76,175,125,.12)' },
  error:    { label: 'Visma-fel',             color: 'var(--red)', bg: 'rgba(224,82,82,.12)' },
}
