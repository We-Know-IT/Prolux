// Company lookup by organisation number, from Bolagsverket's free API
// "Värdefulla datamängder". Kept free of Deno APIs so it can be tested.

export interface CompanyInfo {
  org_nr: string
  company: string
  address: string | null
  postal_code: string | null
  city: string | null
}

// "556677-8899", "5566778899" or "16556677 8899" → "5566778899"; null if not 10 digits.
export function normalizeOrgNr(input: string): string | null {
  let d = (input || '').replace(/\D/g, '')
  if (d.length === 12 && (d.startsWith('16') || d.startsWith('19') || d.startsWith('20'))) d = d.slice(2)
  return d.length === 10 ? d : null
}

export const formatOrgNr = (d: string) => `${d.slice(0, 6)}-${d.slice(6)}`

// Depth-first search for the first value matching a test.
function find(node: unknown, test: (key: string, value: unknown) => boolean, depth = 0): unknown {
  if (!node || typeof node !== 'object' || depth > 8) return undefined
  const entries = Array.isArray(node) ? node.map((v, i) => [String(i), v] as const) : Object.entries(node as Record<string, unknown>)
  for (const [k, v] of entries) if (test(k, v)) return v
  for (const [, v] of entries) {
    const hit = find(v, test, depth + 1)
    if (hit !== undefined) return hit
  }
  return undefined
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

// Reads the answer for one organisation. Written to tolerate small changes in
// the response: it looks for the name list and the postal address by key.
export function parseOrganisation(body: unknown, orgNr: string): CompanyInfo | null {
  const list = (body as any)?.organisationer
  const org = Array.isArray(list) ? list[0] : body
  if (!org || typeof org !== 'object') return null

  const names = find(org, k => k === 'organisationsnamnLista') as any[] | undefined
  const company = str(Array.isArray(names) ? names[0]?.namn : null)
    ?? str(find(org, (k, v) => (k === 'namn' || k === 'organisationsnamn' || k === 'firma') && typeof v === 'string'))
  if (!company) return null

  const postal = (find(org, k => k === 'postadressOrganisation') ?? org) as object
  const addr = find(postal, (_k, v) => !!v && typeof v === 'object' && !Array.isArray(v) && ('postort' in (v as object) || 'postnummer' in (v as object))) as Record<string, unknown> | undefined
  const zip = str(addr?.postnummer)?.replace(/\s/g, '') ?? null
  return {
    org_nr: formatOrgNr(orgNr),
    company,
    address: str(addr?.utdelningsadress) ?? str(addr?.gatuadress) ?? null,
    postal_code: zip && zip.length === 5 ? `${zip.slice(0, 3)} ${zip.slice(3)}` : zip,
    city: titleCase(str(addr?.postort)),
  }
}

// Bolagsverket writes towns in capitals: "STOCKHOLM" → "Stockholm".
function titleCase(v: string | null): string | null {
  if (!v) return null
  if (v !== v.toUpperCase()) return v
  return v.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase())
}
