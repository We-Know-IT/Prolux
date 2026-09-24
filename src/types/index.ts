// ── DATABASE TYPES ────────────────────────────────────────────
export interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  category_id: string
  brand: string
  list_price: number
  unit: string
  stock_qty: number
  badge: 'top' | 'new' | null
  image_url: string | null
  active: boolean
  sort_order: number
}

export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface Customer {
  id: string
  email: string
  company: string
  contact_name: string
  contact_role: string | null
  phone: string | null
  city: string | null
  org_nr: string | null
  price_list_id: PriceList
  status: 'active' | 'inactive' | 'prospect'
  notes: string | null
  birthday: string | null
  last_order_at: string | null
  account_manager?: string | null
  contact_birthday?: string | null
  created_at: string
}

export type PriceList = 'A' | 'B' | 'C' | 'Standard'

export interface Order {
  id: string
  order_nr: number
  customer_id: string
  status: OrderStatus
  price_list_id: PriceList
  delivery_name: string | null
  delivery_city: string | null
  subtotal: number
  vat_amount: number
  total: number
  visma_invoice_id: string | null
  transport_order_id: string | null
  carrier?: string | null
  shipped_at?: string | null
  notes: string | null
  assigned_to?: string | null
  created_by?: string | null
  deal_id?: string | null
  created_at: string
  order_items?: OrderItem[]
  customers?: Customer
}

export type OrderStatus = 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled'

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  product_sku: string
  qty: number
  unit_price: number
  list_price: number
  total_price: number
}

export interface Deal {
  id: string
  title: string
  customer_id: string
  value: number
  stage: DealStage
  close_date: string | null
  note: string | null
  created_at: string
  customers?: Customer
}

export type DealStage = 'Prospekt' | 'Kontaktad' | 'Offert' | 'Förhandling' | 'Vunnen' | 'Förlorad'

export interface Activity {
  id: string
  customer_id: string
  type: 'note' | 'call' | 'email' | 'meeting' | 'order'
  title: string
  body: string | null
  created_by: string
  created_at: string
}

export interface Campaign {
  id: string
  code: string
  name: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_order_amount: number
  max_uses: number | null
  used_count: number
  valid_from: string
  valid_to: string | null
  active: boolean
  created_at: string
}

// ── CART ────────────────────────────────────────────────────
export interface CartItem {
  product: Product
  qty: number
  unitPrice: number
}

// ── CONSTANTS ────────────────────────────────────────────────
export const DISCOUNT: Record<PriceList, number> = {
  A: 0.40, B: 0.30, C: 0.20, Standard: 0
}

export const PRICE_LIST_LABEL: Record<PriceList, string> = {
  A: 'Strategisk partner (–40%)',
  B: 'Återförsäljare (–30%)',
  C: 'Volymkund (–20%)',
  Standard: 'Standard (0%)',
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Väntande',
  confirmed: 'Bekräftad',
  packed: 'Packad',
  shipped: 'Skickad',
  delivered: 'Levererad',
  cancelled: 'Avbruten',
}

export const DEAL_STAGES: DealStage[] = [
  'Prospekt', 'Kontaktad', 'Offert', 'Förhandling', 'Vunnen', 'Förlorad'
]
