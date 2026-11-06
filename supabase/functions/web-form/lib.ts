// Turns a form submission from the WordPress site (Fluent Forms or Elementor
// Pro webhooks, JSON or form-encoded) into a lead: who it is from and what
// they wrote. Field names differ per form, so they are matched loosely.

export interface Lead {
  name: string | null
  company: string | null
  email: string | null
  phone: string | null
  org_nr: string | null
  city: string | null
  message: string | null
  form: string | null
  other: [string, string][]     // every other field, kept in the note
}

// Flattens nested data ({ fields: { name: { value } } }, names[first_name] …)
// into label → value pairs.
export function flatten(input: unknown, prefix = '', out: [string, string][] = []): [string, string][] {
  if (input == null) return out
  if (Array.isArray(input)) {
    const simple = input.every(v => v == null || typeof v !== 'object')
    if (simple) { const v = input.filter(x => x != null && String(x).trim()).join(', '); if (v) out.push([prefix, v]) }
    else input.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out))
    return out
  }
  if (typeof input === 'object') {
    const o = input as Record<string, unknown>
    // Elementor: { title/id, value } per field.
    if ('value' in o && (('title' in o) || ('id' in o) || ('type' in o))) {
      const label = String(o.title || o.id || prefix)
      flatten(o.value, label, out)
      return out
    }
    for (const [k, v] of Object.entries(o)) flatten(v, prefix ? `${prefix}.${k}` : k, out)
    return out
  }
  const v = String(input).trim()
  if (v) out.push([prefix, v])
  return out
}

// form-encoded "names[first_name]=Anna" → { names: { first_name: 'Anna' } }
export function parseForm(body: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [rawKey, value] of new URLSearchParams(body)) {
    const parts = rawKey.replace(/\]/g, '').split('[')
    let node = out as Record<string, unknown>
    parts.forEach((p, i) => {
      if (i === parts.length - 1) {
        const prev = node[p]
        node[p] = prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value]
      } else node = (node[p] ??= {}) as Record<string, unknown>
    })
  }
  return out
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// Keys that are noise from the form plugins, not something the visitor wrote.
const SKIP = /^(_|form id|form_id|form name|form_name|entry id|entry_id|serial|status|source url|user agent|ip|browser|device|created|updated|date|time|page url|remote ip|referer|referrer|nonce|token|g recaptcha|recaptcha|hcaptcha|cf turnstile|website$)/

function pick(pairs: [string, string][], tests: RegExp[], used: Set<number>): string | null {
  for (const re of tests) {
    const i = pairs.findIndex(([k], idx) => !used.has(idx) && re.test(norm(k)))
    if (i >= 0) { used.add(i); return pairs[i][1] }
  }
  return null
}

export function toLead(data: Record<string, unknown>): Lead {
  const pairs = flatten(data).filter(([k]) => k)
  const used = new Set<number>()
  const form = pick(pairs, [/^form (name|title)$/, /^form$/], used)
  pairs.forEach(([k], i) => { const last = k.replace(/^.*\./, ''); if (last.startsWith('_') || SKIP.test(norm(last)) || SKIP.test(norm(k))) used.add(i) })

  const email = pick(pairs, [/(^|\b)(e ?post|e ?mail|email|mail)(\b|$)/], used)
  let name = pick(pairs, [/(^|\b)(fullstandigt namn|full name|kontaktperson|contact name|your name|ditt namn)(\b|$)/, /^(names|name|namn)$/], used)
  if (!name) {
    const first = pick(pairs, [/(first name|fornamn|names first)/], used)
    const last = pick(pairs, [/(last name|efternamn|names last)/], used)
    name = [first, last].filter(Boolean).join(' ') || null
  }
  if (!name) name = pick(pairs, [/(^|\b)(namn|name)(\b|$)/], used)
  const company = pick(pairs, [/(foretag|company|bolag|firma|organisation|business|verkstad|salong)/], used)
  const org_nr = pick(pairs, [/(org ?nr|organisationsnummer|orgnr|org number|organization number)/], used)
  const phone = pick(pairs, [/(telefon|phone|mobil|tel)(\b|$)/], used)
  const city = pick(pairs, [/(^|\b)(ort|stad|city|town)(\b|$)/], used)
  const message = pick(pairs, [/(meddelande|message|fraga|question|kommentar|comment|beskrivning|description|ovrigt)/], used)
  const other = pairs.filter((_, i) => !used.has(i)).map(([k, v]) => [k.replace(/^.*\./, ''), v] as [string, string])

  const clean = (s: string | null, n: number) => (s ?? '').trim().slice(0, n) || null
  return {
    name: clean(name, 120), company: clean(company, 160), email: clean(email, 200)?.toLowerCase() ?? null,
    phone: clean(phone, 40), org_nr: clean(org_nr, 20), city: clean(city, 80),
    message: clean(message, 4000), form: clean(form, 120), other: other.slice(0, 30),
  }
}

export function noteFor(l: Lead): string {
  return [
    `Skickad via ${l.form ? `formuläret "${l.form}"` : 'ett formulär'} på www.proluxshine.se.`,
    '',
    l.company && `Företag: ${l.company}`,
    l.name && `Kontakt: ${l.name}`,
    l.email && `E-post: ${l.email}`,
    l.phone && `Telefon: ${l.phone}`,
    l.org_nr && `Org.nr: ${l.org_nr}`,
    l.city && `Ort: ${l.city}`,
    ...l.other.map(([k, v]) => `${k}: ${v}`),
    l.message && `\nMeddelande:\n${l.message}`,
  ].filter((x): x is string => typeof x === 'string').join('\n')
}
