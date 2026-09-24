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
