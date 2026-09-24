// Customer-facing stock label from products.stock_qty.
export function stockStatus(qty: number | null | undefined) {
  const n = qty ?? 0
  if (n <= 0) return { label: 'Beställningsvara', color: '#8A5A00', bg: '#FFF4DB' }
  if (n <= 5) return { label: `Få kvar (${n} st)`, color: '#8A5A00', bg: '#FFF4DB' }
  return { label: 'I lager', color: '#1F7A4D', bg: '#E8F5EE' }
}
