import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { DISCOUNT, PriceList } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(amount: number): string {
  return Math.round(amount).toLocaleString('sv-SE')
}

export function custPrice(listPrice: number, priceList: PriceList): number {
  return Math.round(listPrice * (1 - DISCOUNT[priceList]))
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

// "2026-09-24 14:32" in Swedish time, for order lists where the time of day matters.
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm',
  })
}
