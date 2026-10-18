export const CARRIERS = ['PostNord', 'DHL', 'DB Schenker', 'Bring', 'Budbee', 'Egen leverans'] as const

// Public tracking page for a parcel, or null when the carrier has none.
export function trackingUrl(carrier: string | null | undefined, tracking: string | null | undefined): string | null {
  if (!tracking) return null
  const id = encodeURIComponent(tracking.trim())
  switch (carrier) {
    case 'PostNord':    return `https://tracking.postnord.com/se/?id=${id}`
    case 'DHL':         return `https://www.dhl.com/se-sv/home/tracking.html?tracking-id=${id}`
    case 'DB Schenker': return `https://www.dbschenker.com/app/tracking-public/?refNumber=${id}`
    case 'Bring':       return `https://tracking.bring.se/tracking/${id}`
    case 'Budbee':      return `https://tracking.budbee.com/${id}`
    default:            return null
  }
}

// Goods still to be sent: lines marked "Frakt" on a live order that has not
// been shipped yet. Lines handed over from the car are already delivered.
export const AWAITING_SHIPMENT = ['pending', 'confirmed', 'packed'] as const

export interface ShipLine { qty: number; delivery?: string | null; product_name?: string | null }

export function awaitingShipment(status: string): boolean {
  return (AWAITING_SHIPMENT as readonly string[]).includes(status)
}

// Number of items left to send on an order (0 when nothing is waiting).
export function qtyToShip(o: { status: string; ship_lines?: ShipLine[] | null }): number {
  if (!awaitingShipment(o.status)) return 0
  return (o.ship_lines ?? []).filter(l => (l.delivery ?? 'ship') === 'ship').reduce((s, l) => s + (l.qty || 0), 0)
}

// Embedded in an orders select: `ship_lines:order_items(qty,delivery,product_name)`.
export const SHIP_LINES_SELECT = 'ship_lines:order_items(qty,delivery,product_name)'
