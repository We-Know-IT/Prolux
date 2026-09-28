// Webshop prices. List prices are stored excluding VAT; the price list (A/B/C)
// gives business customers their discount. Same maths as place_order in the DB.
export const VAT_RATE = 0.25
export const DISCOUNT: Record<string, number> = { A: 0.40, B: 0.30, C: 0.20, Standard: 0 }

export type CustomerType = 'business' | 'private'

export const netPrice = (listPrice: number, priceList = 'Standard') =>
  Math.round(listPrice * (1 - (DISCOUNT[priceList] ?? 0)))
export const withVat = (net: number) => net + Math.round(net * VAT_RATE)

export const customerTypeOf = (customer: { customer_type?: string } | null | undefined): CustomerType =>
  customer?.customer_type === 'private' ? 'private' : 'business'

// Chosen in the first-visit popup; preselects the account type when signing up.
export const VISITOR_TYPE_KEY = 'prolux-visitor-type'
