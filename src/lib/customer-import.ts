// Customer import from Excel/CSV: parsing, column matching and validation.
// Pure functions (no React/Supabase), used by components/customers/ImportCustomers.

export type ImportField =
  | 'company' | 'org_nr' | 'contact_name' | 'email' | 'phone' | 'address' | 'postal_code' | 'city'
  | 'price_list_id' | 'account_manager' | 'customer_type' | 'birthday' | 'notes'

export const IMPORT_FIELDS: { key: ImportField; label: string; required?: boolean }[] = [
  { key: 'company', label: 'Företag / namn', required: true },
  { key: 'org_nr', label: 'Org.nr' },
  { key: 'contact_name', label: 'Kontaktperson' },
  { key: 'email', label: 'E-post' },
  { key: 'phone', label: 'Telefon' },
  { key: 'address', label: 'Adress' },
  { key: 'postal_code', label: 'Postnummer' },
  { key: 'city', label: 'Ort' },
  { key: 'price_list_id', label: 'Prislista (A/B/C)' },
  { key: 'account_manager', label: 'Kundansvarig säljare' },
  { key: 'customer_type', label: 'Kundtyp (företag/privat)' },
  { key: 'birthday', label: 'Födelsedag' },
  { key: 'notes', label: 'Anteckning' },
]

// Column titles we recognise (lower case, without spaces/dots/dashes).
const SYNONYMS: Record<ImportField, string[]> = {
  company: ['företag', 'foretag', 'företagsnamn', 'kund', 'kundnamn', 'namn', 'name', 'company', 'firma', 'bolag'],
  org_nr: ['orgnr', 'organisationsnummer', 'orgnummer', 'organisationsnr', 'personnummer', 'corporateidentitynumber', 'vatnumber', 'momsregnr'],
  contact_name: ['kontaktperson', 'kontakt', 'kontaktnamn', 'contact', 'contactperson', 'referens'],
  email: ['epost', 'email', 'mail', 'emailadress', 'epostadress', 'mejl'],
  phone: ['telefon', 'tel', 'telefonnummer', 'mobil', 'mobilnummer', 'phone', 'mobile'],
  address: ['adress', 'gatuadress', 'address', 'fakturaadress', 'utdelningsadress', 'besöksadress'],
  postal_code: ['postnummer', 'postnr', 'postalcode', 'zip', 'zipcode'],
  city: ['ort', 'stad', 'postort', 'city', 'kommun'],
  price_list_id: ['prislista', 'pricelist', 'rabattnivå', 'nivå'],
  account_manager: ['kundansvarig', 'säljare', 'saljare', 'ansvarig', 'accountmanager'],
  customer_type: ['kundtyp', 'typ', 'type'],
  birthday: ['födelsedag', 'fodelsedag', 'födelsedatum', 'birthday'],
  notes: ['anteckning', 'anteckningar', 'kommentar', 'notes', 'note', 'övrigt'],
}

const norm = (s: string) => s.toLowerCase().replace(/[\s._\-/:()]/g, '')

// Which field a column title belongs to (or null).
export function guessField(title: string): ImportField | null {
  const t = norm(title)
  if (!t) return null
  for (const f of Object.keys(SYNONYMS) as ImportField[]) if (SYNONYMS[f].includes(t)) return f
  for (const f of Object.keys(SYNONYMS) as ImportField[]) if (SYNONYMS[f].some(s => s.length > 3 && t.includes(s))) return f
  return null
}

// CSV with ; or , (whichever the header uses), quotes and a UTF-8 BOM.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : (firstLine.includes('\t') ? '\t' : ',')
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === sep) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

export type Cell = string | number | boolean | Date | null | undefined

function cellText(v: Cell): string {
  if (v == null) return ''
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10)
  return String(v).trim()
}

export interface ImportRow {
  line: number                       // row number in the file (1 = header)
  values: Partial<Record<ImportField, string>>
  error?: string
  duplicateOf?: string               // id of an existing customer with the same org.nr or e-mail
}

const PRICE_LISTS = ['A', 'B', 'C', 'Standard']

function clean(field: ImportField, raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  switch (field) {
    case 'email': return v.toLowerCase()
    case 'postal_code': { const d = v.replace(/\D/g, ''); return d.length === 5 ? `${d.slice(0, 3)} ${d.slice(3)}` : v }
    case 'org_nr': { const d = v.replace(/\D/g, ''); return d.length === 10 ? `${d.slice(0, 6)}-${d.slice(6)}` : v }
    case 'price_list_id': { const u = v.toUpperCase(); return PRICE_LISTS.find(p => p.toUpperCase() === u) ?? (/^(PRISLISTA\s*)?([ABC])$/.test(u) ? u.slice(-1) : 'Standard') }
    case 'customer_type': return /^(privat|private|privatperson|p)$/i.test(v) ? 'private' : 'business'
    case 'birthday': {
      const m = v.match(/^(\d{4})-?(\d{2})-?(\d{2})/) ?? v.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/)
      if (!m) return ''
      return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`
    }
    default: return v
  }
}

// Turns the sheet (first row = column titles) into checked rows.
export function buildRows(
  sheet: Cell[][],
  mapping: (ImportField | '')[],
  existing: { id: string; org_nr?: string | null; email?: string | null }[],
): ImportRow[] {
  const byOrg = new Map(existing.filter(c => c.org_nr).map(c => [c.org_nr!.replace(/\D/g, ''), c.id]))
  const byEmail = new Map(existing.filter(c => c.email).map(c => [c.email!.trim().toLowerCase(), c.id]))
  const seenOrg = new Set<string>(), seenEmail = new Set<string>()
  const rows: ImportRow[] = []
  sheet.slice(1).forEach((cells, i) => {
    const values: ImportRow['values'] = {}
    mapping.forEach((field, col) => {
      if (!field) return
      const v = clean(field, cellText(cells[col]))
      if (v) values[field] = values[field] ? `${values[field]} ${v}` : v
    })
    if (Object.keys(values).length === 0) return
    const row: ImportRow = { line: i + 2, values }
    const org = values.org_nr?.replace(/\D/g, '')
    const email = values.email
    if (!values.company) row.error = 'Saknar företag/namn'
    else if (email && !/^\S+@\S+\.\S+$/.test(email)) row.error = 'Ogiltig e-postadress'
    else if ((org && seenOrg.has(org)) || (email && seenEmail.has(email))) row.error = 'Finns två gånger i filen'
    else {
      row.duplicateOf = (org && byOrg.get(org)) || (email && byEmail.get(email)) || undefined
      if (org) seenOrg.add(org)
      if (email) seenEmail.add(email)
    }
    rows.push(row)
  })
  return rows
}

export const TEMPLATE_CSV =
  'Företag;Org.nr;Kontaktperson;E-post;Telefon;Adress;Postnummer;Ort;Prislista;Kundansvarig;Kundtyp\n' +
  'Bilvård Malmö AB;556677-8899;Anna Lindberg;anna@bilvardmalmo.se;040-123 45 67;Storgatan 1;211 22;Malmö;B;Bashar;Företag\n'
