import { createClient } from '@/lib/supabase/client'

export interface CompanyInfo {
  org_nr: string
  company: string
  address: string | null
  postal_code: string | null
  city: string | null
}

// Name and address for an organisation number, via the "company-lookup"
// Edge Function (Bolagsverket). Throws with a message to show the user.
export async function lookupCompany(orgNr: string): Promise<CompanyInfo> {
  const { data: { session } } = await createClient().auth.getSession()
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/company-lookup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ org_nr: orgNr }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || (res.status === 404 ? 'Uppslaget är inte driftsatt ännu.' : `Fel ${res.status}`))
  return json as CompanyInfo
}
