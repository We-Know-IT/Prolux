// Product import from Excel/CSV: column matching, cleaning and checks.
// Pure functions, used by components/products/ImportProducts.
import type { Cell } from '@/lib/customer-import'
export { parseCsv } from '@/lib/customer-import'

export type ProductField = 'sku' | 'name' | 'brand' | 'category' | 'list_price' | 'unit' | 'stock_qty' | 'description' | 'image_url' | 'active'

export const PRODUCT_FIELDS: { key: ProductField; label: string }[] = [
  { key: 'sku', label: 'Artikelnr (SKU)' },
  { key: 'name', label: 'Produktnamn *' },
  { key: 'brand', label: 'Varumärke' },
  { key: 'category', label: 'Kategori' },
  { key: 'list_price', label: 'Listpris exkl. moms *' },
  { key: 'unit', label: 'Enhet' },
  { key: 'stock_qty', label: 'Lager' },
  { key: 'description', label: 'Beskrivning' },
  { key: 'image_url', label: 'Bildlänk' },
  { key: 'active', label: 'Aktiv (ja/nej)' },
]

const SYNONYMS: Record<ProductField, string[]> = {
  sku: ['sku', 'artikelnr', 'artikelnummer', 'artnr', 'art', 'produktkod', 'kod', 'itemnumber', 'number'],
  name: ['namn', 'produkt', 'produktnamn', 'benämning', 'benamning', 'name', 'product', 'artikel'],
  brand: ['varumärke', 'varumarke', 'märke', 'brand', 'tillverkare'],
  category: ['kategori', 'category', 'produktgrupp', 'grupp'],
  list_price: ['pris', 'listpris', 'price', 'listprice', 'prisexklmoms', 'priseximoms', 'nettopris', 'utpris', 'försäljningspris'],
  unit: ['enhet', 'unit', 'förpackning'],
  stock_qty: ['lager', 'lagersaldo', 'saldo', 'antal', 'stock', 'qty', 'stockqty'],
  description: ['beskrivning', 'description', 'text', 'info', 'produktbeskrivning'],
  image_url: ['bild', 'bildlänk', 'bildurl', 'image', 'imageurl', 'url'],
  active: ['aktiv', 'active', 'status', 'visas'],
}

const norm = (s: string) => s.toLowerCase().replace(/[\s._\-/:()]/g, '')

export function guessProductField(title: string): ProductField | null {
  const t = norm(title)
  if (!t) return null
  for (const f of Object.keys(SYNONYMS) as ProductField[]) if (SYNONYMS[f].includes(t)) return f
  for (const f of Object.keys(SYNONYMS) as ProductField[]) if (SYNONYMS[f].some(s => s.length > 3 && t.includes(s))) return f
  return null
}

// "1 234,50 kr" → 1234.5
export function parsePrice(v: Cell): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null
  const t = String(v ?? '').replace(/kr|sek|:-/gi, '').replace(/\s| /g, '').trim()
  if (!t) return null
  const n = Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, ''))
  return isFinite(n) ? n : null
}

export interface ProductRow {
  line: number
  values: {
    sku?: string; name?: string; brand?: string; category_id?: string | null; list_price?: number
    unit?: string; stock_qty?: number; description?: string; image_url?: string; active?: boolean
  }
  categoryName?: string        // given but not found among the categories
  error?: string
  duplicateOf?: string         // existing product with the same SKU (else same name)
}

export function buildProductRows(
  sheet: Cell[][],
  mapping: (ProductField | '')[],
  existing: { id: string; sku: string | null; name: string }[],
  categories: { id: string; name: string }[],
): ProductRow[] {
  const bySku = new Map(existing.filter(p => p.sku).map(p => [p.sku!.trim().toUpperCase(), p.id]))
  const byName = new Map(existing.map(p => [p.name.trim().toLowerCase(), p.id]))
  const catByName = new Map(categories.map(c => [c.name.trim().toLowerCase(), c.id]))
  const seen = new Set<string>()
  const rows: ProductRow[] = []
  sheet.slice(1).forEach((cells, i) => {
    const raw: Partial<Record<ProductField, Cell>> = {}
    mapping.forEach((f, col) => { if (f && cells[col] != null && String(cells[col]).trim() !== '') raw[f] = cells[col] })
    if (Object.keys(raw).length === 0) return
    const txt = (f: ProductField) => raw[f] == null ? undefined : String(raw[f]).trim()
    const row: ProductRow = { line: i + 2, values: {} }
    const v = row.values
    if (txt('sku')) v.sku = txt('sku')!.toUpperCase()
    if (txt('name')) v.name = txt('name')
    if (txt('brand')) v.brand = txt('brand')
    if (txt('unit')) v.unit = txt('unit')
    if (txt('description')) v.description = txt('description')
    if (txt('image_url')) v.image_url = txt('image_url')
    if (raw.list_price != null) { const p = parsePrice(raw.list_price); if (p != null) v.list_price = Math.round(p * 100) / 100 }
    if (raw.stock_qty != null) { const q = parsePrice(raw.stock_qty); if (q != null) v.stock_qty = Math.max(0, Math.round(q)) }
    if (raw.active != null) v.active = !/^(nej|no|false|0|inaktiv|dold)$/i.test(String(raw.active).trim())
    if (txt('category')) {
      const id = catByName.get(txt('category')!.toLowerCase())
      if (id) v.category_id = id; else row.categoryName = txt('category')
    }

    const key = v.sku || (v.name ?? '').toLowerCase()
    if (!v.name) row.error = 'Saknar produktnamn'
    else if (raw.list_price != null && v.list_price == null) row.error = 'Ogiltigt pris'
    else if (key && seen.has(key)) row.error = 'Finns två gånger i filen'
    else {
      row.duplicateOf = (v.sku && bySku.get(v.sku)) || byName.get(v.name.toLowerCase()) || undefined
      if (!row.duplicateOf && v.list_price == null) row.error = 'Saknar pris'
      if (key) seen.add(key)
    }
    rows.push(row)
  })
  return rows
}

export const PRODUCT_TEMPLATE_CSV =
  'Artikelnr;Produktnamn;Varumärke;Kategori;Listpris;Enhet;Lager;Beskrivning;Bildlänk;Aktiv\n' +
  'FRE-RAP-5L;RAPIDET 5L;Frescura;Tvätt & Schampo;595;st;120;Koncentrerat bilschampo;;ja\n'
