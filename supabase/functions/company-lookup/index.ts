import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { normalizeOrgNr, parseOrganisation } from './lib.ts'

// Looks up a company by organisation number (name and postal address), for
// "Hämta uppgifter" when a new business customer is registered.
// Source: Bolagsverket's free API "Värdefulla datamängder".
//
// Deploy: Supabase → Edge Functions → new function "company-lookup" with
// index.ts and lib.ts. Verify JWT may stay on.
//
// Secrets (Edge Functions → Secrets), from Bolagsverket's API portal:
//   BOLAGSVERKET_CLIENT_ID, BOLAGSVERKET_CLIENT_SECRET
//   BOLAGSVERKET_TOKEN_URL  default https://portal.api.bolagsverket.se/oauth2/token
//   BOLAGSVERKET_API_URL    default https://gw.api.bolagsverket.se/vardefulla-datamangder/v1
//   BOLAGSVERKET_SCOPE      default "vardefulla-datamangder:read vardefulla-datamangder:ping"
//
// Call: POST { org_nr } with the logged-in staff member's token.

const env = (k: string) => Deno.env.get(k)
const sb = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!)
const TOKEN_URL = env('BOLAGSVERKET_TOKEN_URL') || 'https://portal.api.bolagsverket.se/oauth2/token'
const API_URL = (env('BOLAGSVERKET_API_URL') || 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1').replace(/\/$/, '')
const SCOPE = env('BOLAGSVERKET_SCOPE') || 'vardefulla-datamangder:read vardefulla-datamangder:ping'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

let cached: { token: string; until: number } | null = null
async function accessToken(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env('BOLAGSVERKET_CLIENT_ID')!, client_secret: env('BOLAGSVERKET_CLIENT_SECRET')!, scope: SCOPE }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) throw new Error(`Bolagsverket godkände inte nyckeln (${res.status})`)
  cached = { token: data.access_token, until: Date.now() + Math.max(60, (data.expires_in ?? 3600) - 60) * 1000 }
  return cached.token
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Använd POST' }, 405)

  // Staff only.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const { data: auth } = token ? await sb.auth.getUser(token) : { data: { user: null } }
  const role = auth.user?.app_metadata?.role
  if (role !== 'admin' && role !== 'crm') return json({ error: 'Logga in som säljare eller admin.' }, 401)

  if (!env('BOLAGSVERKET_CLIENT_ID') || !env('BOLAGSVERKET_CLIENT_SECRET')) {
    return json({ error: 'Uppslag av organisationsnummer är inte inställt ännu (nycklar från Bolagsverket saknas).' }, 501)
  }

  let body: any = {}
  try { body = await req.json() } catch { /* empty */ }
  const orgNr = normalizeOrgNr(String(body.org_nr ?? ''))
  if (!orgNr) return json({ error: 'Ange ett organisationsnummer med 10 siffror.' }, 400)

  try {
    const res = await fetch(`${API_URL}/organisationer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identitetsbeteckning: orgNr }),
    })
    const data = await res.json().catch(() => null)
    if (res.status === 404) return json({ error: 'Hittade inget företag med det organisationsnumret.' }, 404)
    if (!res.ok) return json({ error: `Bolagsverket svarade med fel (${res.status}).` }, 502)
    const info = parseOrganisation(data, orgNr)
    if (!info) return json({ error: 'Hittade inget företag med det organisationsnumret.' }, 404)
    return json(info)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502)
  }
})
