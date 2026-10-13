// Quote as a PDF (A4): logo, customer, product pictures, prices and totals.
// Built in the browser with jsPDF; images that cannot be loaded are skipped.

export interface QuotePdfInput {
  orderNr: number
  date: string                       // ISO
  customer: { company: string; contact_name?: string | null; email?: string | null; phone?: string | null; address?: string | null; postal_code?: string | null; city?: string | null; org_nr?: string | null }
  items: { name: string; sku?: string | null; qty: number; unitPrice: number; delivery?: string | null; imageUrl?: string | null }[]
  subtotal: number
  vat: number
  total: number
  seller?: string
  contact: { phone: string; email: string; address: string }
}

// Swedish number format with plain spaces (the PDF fonts lack the thin space).
const kr = (n: number) => `${Math.round(n || 0).toLocaleString('sv-SE').replace(/[  ]/g, ' ')} kr`

// Any image (png/jpg/webp/svg) → JPEG/PNG data URL with its size, via a canvas.
async function loadImage(src: string, maxPx = 400, png = false): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error('img')); setTimeout(() => fail(new Error('timeout')), 6000) })
    const scale = Math.min(1, maxPx / Math.max(img.naturalWidth || maxPx, img.naturalHeight || maxPx))
    const w = Math.max(1, Math.round((img.naturalWidth || maxPx) * scale)), h = Math.max(1, Math.round((img.naturalHeight || maxPx) * scale))
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const ctx = c.getContext('2d')!
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h) }
    ctx.drawImage(img, 0, 0, w, h)
    return { data: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85), w, h }
  } catch { return null }
}

export async function buildQuotePdf(q: QuotePdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 16
  const gold: [number, number, number] = [200, 151, 26]
  const [logo, ...pics] = await Promise.all([
    loadImage('/logo.svg', 900, true),
    ...q.items.map(i => i.imageUrl ? loadImage(i.imageUrl) : Promise.resolve(null)),
  ])

  // Header band
  doc.setFillColor(15, 17, 21); doc.rect(0, 0, W, 34, 'F')
  if (logo) { const h = 12, w = Math.min(70, h * logo.w / logo.h); doc.addImage(logo.data, 'PNG', M, 11, w, h) }
  else { doc.setTextColor(232, 184, 75); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('PROLUX SHINE', M, 21) }
  doc.setTextColor(232, 184, 75); doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.text(`OFFERT #${q.orderNr}`, W - M, 17, { align: 'right' })
  doc.setTextColor(220, 220, 220); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const d = new Date(q.date)
  const valid = new Date(d.getTime() + 30 * 86_400_000)
  doc.text(`Datum ${d.toLocaleDateString('sv-SE')} · Giltig till ${valid.toLocaleDateString('sv-SE')}`, W - M, 24, { align: 'right' })

  // Customer and sender
  let y = 46
  const c = q.customer
  doc.setTextColor(120, 120, 120); doc.setFontSize(8); doc.text('TILL', M, y); doc.text('FRÅN', 120, y)
  doc.setTextColor(17, 17, 17); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text(c.company || '', M, y + 6); doc.text('ProLuxShine', 120, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const left = [c.contact_name, c.org_nr ? `Org.nr ${c.org_nr}` : '', c.address, [c.postal_code, c.city].filter(Boolean).join(' '), c.email, c.phone].filter(Boolean) as string[]
  const right = [q.seller ? `Säljare: ${q.seller}` : '', q.contact.phone, q.contact.email, q.contact.address].filter(Boolean)
  left.forEach((t, i) => doc.text(t, M, y + 12 + i * 4.6))
  right.forEach((t, i) => doc.text(t, 120, y + 12 + i * 4.6))
  y += 14 + Math.max(left.length, right.length) * 4.6 + 6

  // Lines
  const col = { pic: M, name: M + 20, qty: 128, price: 156, sum: W - M }
  const head = () => {
    doc.setFillColor(245, 243, 238); doc.rect(M, y, W - 2 * M, 8, 'F')
    doc.setTextColor(90, 90, 90); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.text('PRODUKT', col.name, y + 5.4); doc.text('ANTAL', col.qty, y + 5.4, { align: 'right' })
    doc.text('À-PRIS', col.price, y + 5.4, { align: 'right' }); doc.text('SUMMA', col.sum, y + 5.4, { align: 'right' })
    y += 10
  }
  head()
  q.items.forEach((it, i) => {
    if (y > 250) { doc.addPage(); y = 20; head() }
    const pic = pics[i]
    if (pic) { const s = 15, r = pic.w / pic.h; const w = r >= 1 ? s : s * r, h = r >= 1 ? s / r : s; doc.addImage(pic.data, 'JPEG', col.pic + (s - w) / 2, y + (s - h) / 2, w, h) }
    doc.setTextColor(17, 17, 17); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text(doc.splitTextToSize(it.name, col.qty - col.name - 18).slice(0, 2), col.name, y + 5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110, 110, 110)
    doc.text([it.sku, it.delivery === 'car' ? 'Levereras direkt' : ''].filter(Boolean).join(' · '), col.name, y + 13)
    doc.setFontSize(10); doc.setTextColor(17, 17, 17)
    doc.text(`${it.qty} st`, col.qty, y + 8, { align: 'right' })
    doc.text(kr(it.unitPrice), col.price, y + 8, { align: 'right' })
    doc.setFont('helvetica', 'bold'); doc.text(kr(it.qty * it.unitPrice), col.sum, y + 8, { align: 'right' })
    doc.setDrawColor(230, 230, 230); doc.line(M, y + 17, W - M, y + 17)
    y += 19
  })

  // Totals
  if (y > 240) { doc.addPage(); y = 20 }
  y += 4
  const line = (label: string, value: string, bold = false, size = 10, color: [number, number, number] = [17, 17, 17]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color)
    doc.text(label, 140, y, { align: 'right' }); doc.text(value, W - M, y, { align: 'right' }); y += size * 0.55
  }
  const lineSum = q.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  if (lineSum - q.subtotal >= 1) { line('Varor exkl. moms', kr(lineSum)); line('Rabatt', `-${kr(lineSum - q.subtotal)}`) }
  line('Summa exkl. moms', kr(q.subtotal))
  line('Moms 25 %', kr(q.vat))
  doc.setDrawColor(...gold); doc.line(110, y - 2, W - M, y - 2)
  y += 5
  line('Totalt inkl. moms', kr(q.total), true, 13, gold)

  // Footer
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120)
  doc.text('Offerten gäller i 30 dagar. Betalning mot faktura. Svara på mejlet eller ring oss så lägger vi ordern.', M, 284)
  doc.text(`ProLuxShine · ${q.contact.phone} · ${q.contact.email} · Officiell distributör av Frescura och Virtus`, M, 289)
  return doc.output('blob')
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
