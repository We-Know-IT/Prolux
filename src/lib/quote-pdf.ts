// Quote as a PDF (A4), built in the browser with jsPDF: logo, a short
// greeting, product cards with pictures and descriptions, totals, the
// salesperson as contact and the brands. Images that cannot load are skipped.

export interface QuotePdfInput {
  orderNr: number
  date: string                       // ISO
  customer: { company: string; contact_name?: string | null; email?: string | null; phone?: string | null; address?: string | null; postal_code?: string | null; city?: string | null; org_nr?: string | null }
  items: { name: string; sku?: string | null; brand?: string | null; description?: string | null; qty: number; unitPrice: number; listPrice?: number | null; delivery?: string | null; imageUrl?: string | null }[]
  subtotal: number
  vat: number
  total: number
  seller?: string
  sellerEmail?: string
  contact: { phone: string; email: string; address: string }
}

type RGB = [number, number, number]
const INK: RGB = [17, 17, 17], GREY: RGB = [110, 110, 110], LIGHT: RGB = [246, 244, 239], GOLD: RGB = [200, 151, 26], DARK: RGB = [15, 17, 21]

// Swedish numbers with plain spaces (the PDF fonts lack the thin space).
const kr = (n: number) => `${Math.round(n || 0).toLocaleString('sv-SE').replace(/[  ]/g, ' ')} kr`
// Characters outside the PDF fonts' set become close equivalents.
const clean = (s: string) => s.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[^\x20-\x7e -ÿ]/g, '')
const firstSentences = (s: string, max = 150) => {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max), dot = cut.lastIndexOf('. ')
  return dot > 60 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '...'
}

// Any image (png/jpg/webp/svg) → data URL with its size, via a canvas.
async function loadImage(src: string, maxPx = 500, png = false): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error('img')); setTimeout(() => fail(new Error('timeout')), 6000) })
    const nw = img.naturalWidth || maxPx, nh = img.naturalHeight || maxPx
    const scale = Math.min(4, maxPx / Math.max(nw, nh))
    const w = Math.max(1, Math.round(nw * scale)), h = Math.max(1, Math.round(nh * scale))
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const ctx = c.getContext('2d')!
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h) }
    ctx.drawImage(img, 0, 0, w, h)
    return { data: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88), w, h }
  } catch { return null }
}

export async function buildQuotePdf(q: QuotePdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297, M = 16
  const [logo, frescura, virtus, ...pics] = await Promise.all([
    loadImage('/logo.svg', 520, true),
    loadImage('/brands/frescura.svg', 520, true),
    loadImage('/brands/virtus.svg', 140, true),
    ...q.items.map(i => i.imageUrl ? loadImage(i.imageUrl) : Promise.resolve(null)),
  ])
  const text = (s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: RGB; align?: 'left' | 'right' | 'center' } = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(o.size ?? 10); doc.setTextColor(...(o.color ?? INK))
    doc.text(clean(s), x, y, { align: o.align ?? 'left' })
  }
  const d = new Date(q.date)
  const valid = new Date(d.getTime() + 30 * 86_400_000)

  // ── Header ──
  const header = (first: boolean) => {
    doc.setFillColor(...DARK); doc.rect(0, 0, W, first ? 40 : 18, 'F')
    doc.setFillColor(...GOLD); doc.rect(0, first ? 40 : 18, W, 0.8, 'F')
    if (logo) { const h = first ? 13 : 8, w = Math.min(80, h * logo.w / logo.h); doc.addImage(logo.data, 'PNG', M, first ? 13 : 5, w, h) }
    else text('PROLUX SHINE', M, first ? 23 : 12, { size: first ? 18 : 12, bold: true, color: [232, 184, 75] })
    if (first) {
      text('OFFERT', W - M, 17, { size: 9, bold: true, color: [232, 184, 75], align: 'right' })
      text(`#${q.orderNr}`, W - M, 26, { size: 20, bold: true, color: [255, 255, 255], align: 'right' })
      text(`${d.toLocaleDateString('sv-SE')}  ·  giltig till ${valid.toLocaleDateString('sv-SE')}`, W - M, 33, { size: 8, color: [200, 200, 200], align: 'right' })
    } else {
      text(`Offert #${q.orderNr} (forts.)`, W - M, 11, { size: 9, color: [220, 220, 220], align: 'right' })
    }
  }
  header(true)

  // ── Customer, contact person, greeting ──
  let y = 54
  const c = q.customer
  text('OFFERT TILL', M, y, { size: 7.5, bold: true, color: GREY })
  text(c.company || '', M, y + 6, { size: 13, bold: true })
  const cust = [c.contact_name, [c.address, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', '), c.org_nr ? `Org.nr ${c.org_nr}` : '', [c.email, c.phone].filter(Boolean).join('  ·  ')].filter(Boolean) as string[]
  cust.forEach((t, i) => text(t, M, y + 12 + i * 4.6, { size: 9, color: [60, 60, 60] }))

  const cx = 128, cw = W - M - cx
  doc.setFillColor(...LIGHT); doc.roundedRect(cx, y - 5, cw, 30, 2.5, 2.5, 'F')
  text('DIN KONTAKTPERSON', cx + 5, y + 1, { size: 7.5, bold: true, color: GREY })
  text(q.seller || 'ProLuxShine', cx + 5, y + 7.5, { size: 11, bold: true })
  ;[q.sellerEmail || q.contact.email, q.contact.phone].filter(Boolean).forEach((t, i) => text(t!, cx + 5, y + 13 + i * 4.6, { size: 8.5, color: [60, 60, 60] }))
  y = Math.max(y + 14 + cust.length * 4.6, y + 28) + 6

  text(c.contact_name ? `Hej ${c.contact_name.split(' ')[0]}!` : 'Hej!', M, y, { size: 11, bold: true })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(60, 60, 60)
  const intro = doc.splitTextToSize(clean('Tack för ett trevligt möte. Här är offerten på produkterna vi pratade om - med era priser. Hör av dig om du vill ändra något, annars lägger vi ordern direkt när du svarar.'), W - 2 * M)
  doc.text(intro, M, y + 6)
  y += 8 + intro.length * 4.6

  // ── Products ──
  const colQty = 140, colPrice = 166, colSum = W - M
  const head = () => {
    text('PRODUKT', M + 30, y, { size: 7.5, bold: true, color: GREY })
    text('ANTAL', colQty, y, { size: 7.5, bold: true, color: GREY, align: 'right' })
    text('À-PRIS', colPrice, y, { size: 7.5, bold: true, color: GREY, align: 'right' })
    text('SUMMA', colSum, y, { size: 7.5, bold: true, color: GREY, align: 'right' })
    y += 3
  }
  y += 2; head()
  const rowH = 30
  q.items.forEach((it, i) => {
    if (y + rowH > H - 40) { doc.addPage(); header(false); y = 30; head() }
    if (i % 2 === 0) { doc.setFillColor(251, 250, 247); doc.rect(M - 2, y, W - 2 * M + 4, rowH, 'F') }
    doc.setFillColor(255, 255, 255); doc.setDrawColor(232, 230, 224); doc.roundedRect(M, y + 3, 24, 24, 2, 2, 'FD')
    const pic = pics[i]
    if (pic) { const s = 21, r = pic.w / pic.h; const w = r >= 1 ? s : s * r, h = r >= 1 ? s / r : s; doc.addImage(pic.data, 'JPEG', M + 12 - w / 2, y + 15 - h / 2, w, h) }
    const tx = M + 30, tw = colQty - tx - 16
    let ty = y + 8
    if (it.brand) { text(it.brand.toUpperCase(), tx, ty, { size: 7, bold: true, color: GOLD }); ty += 4.5 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...INK)
    const name = doc.splitTextToSize(clean(it.name), tw).slice(0, 2); doc.text(name, tx, ty); ty += name.length * 4.6
    const sub = [it.sku ? `Art.nr ${it.sku}` : '', it.delivery === 'car' ? 'Levereras direkt' : ''].filter(Boolean).join('  ·  ')
    if (it.description) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GREY)
      const desc = doc.splitTextToSize(clean(firstSentences(it.description)), tw).slice(0, sub ? 2 : 3); doc.text(desc, tx, ty); ty += desc.length * 3.6
    }
    if (sub) text(sub, tx, Math.min(ty + 0.5, y + rowH - 2.5), { size: 7.5, color: GREY })
    text(`${it.qty} st`, colQty, y + 15, { size: 10, align: 'right' })
    if (it.listPrice && it.listPrice > it.unitPrice) text(kr(it.listPrice), colPrice, y + 10.5, { size: 7.5, color: [160, 160, 160], align: 'right' })
    text(kr(it.unitPrice), colPrice, y + 15, { size: 10, align: 'right' })
    text(kr(it.qty * it.unitPrice), colSum, y + 15, { size: 10.5, bold: true, align: 'right' })
    y += rowH
  })

  // ── Totals and terms ──
  const lineSum = q.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const rows: [string, string][] = []
  if (lineSum - q.subtotal >= 1) rows.push(['Varor exkl. moms', kr(lineSum)], ['Rabatt', `-${kr(lineSum - q.subtotal)}`])
  rows.push(['Summa exkl. moms', kr(q.subtotal)], ['Moms 25 %', kr(q.vat)])
  const boxH = 10 + rows.length * 5.5 + 12
  if (y + boxH + 8 > H - 34) { doc.addPage(); header(false); y = 30 }
  y += 6
  const bx = 112, bw = W - M - bx
  doc.setFillColor(...LIGHT); doc.roundedRect(bx, y, bw, boxH, 2.5, 2.5, 'F')
  let by = y + 8
  rows.forEach(([l, v]) => { text(l, bx + 5, by, { size: 9.5, color: [60, 60, 60] }); text(v, bx + bw - 5, by, { size: 9.5, align: 'right' }); by += 5.5 })
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(bx + 5, by - 2, bx + bw - 5, by - 2); doc.setLineWidth(0.2)
  text('Totalt inkl. moms', bx + 5, by + 6, { size: 11, bold: true })
  text(kr(q.total), bx + bw - 5, by + 6, { size: 14, bold: true, color: GOLD, align: 'right' })

  const terms = ['Offerten gäller i 30 dagar.', 'Betalning mot faktura, 30 dagar netto.', 'Leverans 1-2 arbetsdagar, fri frakt från 2 000 kr.', 'Svara på mejlet eller ring din kontaktperson', 'så lägger vi ordern.']
  text('VILLKOR', M, y + 8, { size: 7.5, bold: true, color: GREY })
  terms.forEach((t, i) => text(t, M, y + 14 + i * 4.6, { size: 8.5, color: [60, 60, 60] }))

  // ── Footer on every page: brands and company ──
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(230, 228, 222); doc.line(M, H - 26, W - M, H - 26)
    text('OFFICIELL DISTRIBUTÖR AV', M, H - 19.5, { size: 6.5, bold: true, color: GREY })
    let lx = M
    if (frescura) { const h = 4.2, w = h * frescura.w / frescura.h; doc.addImage(frescura.data, 'PNG', lx, H - 16.5, w, h); lx += w + 6 }
    if (virtus) { const h = 8, w = h * virtus.w / virtus.h; doc.addImage(virtus.data, 'PNG', lx, H - 18.5, w, h) }
    text('ProLuxShine', W - M, H - 18.5, { size: 8.5, bold: true, align: 'right' })
    text(`${q.contact.phone}  ·  ${q.contact.email}`, W - M, H - 14, { size: 7.5, color: GREY, align: 'right' })
    text(`Sida ${p} av ${pages}`, W - M, H - 9.5, { size: 7, color: [160, 160, 160], align: 'right' })
  }
  return doc.output('blob')
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
