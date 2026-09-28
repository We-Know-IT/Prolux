// Product label chosen in admin (products.badge), shown on webshop cards.
export const PRODUCT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  top:  { label: 'Storsäljare', bg: '#C9971A', color: '#111' },
  new:  { label: 'Nyhet',       bg: '#111',    color: '#fff' },
  sale: { label: 'Rea',         bg: '#C0392B', color: '#fff' },
}

export const PRODUCT_BRANDS = ['Frescura', 'Virtus', 'ProLuxShine']
export const PRODUCT_UNITS  = ['25 kg', '10 kg', '5 kg', '1 kg', '1 L', '500 mL', '200 mL', '50 mL', 'st']
