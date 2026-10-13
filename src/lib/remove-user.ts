import { createClient } from '@/lib/supabase/client'

// Admin: removes a login (and the team member or customer card) through the
// "create-staff-user" Edge Function, which holds the service key.
export async function removeUser(payload: { email?: string; customer_id?: string }):
  Promise<{ login_deleted: boolean; customer: 'deleted' | 'inactive' | null }> {
  const { data: { session } } = await createClient().auth.getSession()
  if (!session) throw new Error('Inte inloggad.')
  let res: Response
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-staff-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' },
      body: JSON.stringify({ action: 'delete', ...payload }),
    })
  } catch {
    throw new Error('Kunde inte nå Supabase-funktionen create-staff-user.')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(res.status === 404 ? 'Funktionen create-staff-user är inte driftsatt.' : json.error || `Fel ${res.status}`)
  // An older deploy ignores "action" and answers like an invite: needs the new version.
  if (!('login_deleted' in json)) throw new Error('Uppdatera funktionen create-staff-user i Supabase för att kunna ta bort användare.')
  return json
}
