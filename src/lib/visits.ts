// Besökslista (migration 0023): planned customer visits per salesperson and day.

export interface VisitCustomer {
  id: string
  company: string
  contact_name?: string | null
  phone?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
}

export interface Visit {
  id: string
  customer_id: string
  visit_date: string
  position: number
  visited_at: string | null
  note: string | null
  customers: VisitCustomer | null
}

// "2026-10-19" for today (+ days), in local time.
export function isoDay(addDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + addDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addressOf(c?: Pick<VisitCustomer, 'address' | 'postal_code' | 'city'> | null): string {
  if (!c) return ''
  return [c.address, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

export const mapsSearchUrl = (address: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`

// Google Maps directions through the addresses in order (from where you are).
export function mapsRouteUrl(addresses: string[]): string | null {
  if (addresses.length === 0) return null
  const dest = addresses[addresses.length - 1]
  const stops = addresses.slice(0, -1).slice(0, 9)   // Google allows 9 stops in a link
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${stops.length ? `&waypoints=${encodeURIComponent(stops.join('|'))}` : ''}&travelmode=driving`
}
