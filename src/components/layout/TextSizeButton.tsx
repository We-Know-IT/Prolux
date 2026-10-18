'use client'
import { useEffect, useState } from 'react'

// Text size for the admin and CRM pages, remembered per browser. The page
// content (inside <main>) is scaled with CSS zoom via the --ui-zoom variable.
const KEY = 'prolux-text-size'
export const TEXT_SIZES = [
  { value: 1, label: 'Normal' },
  { value: 1.1, label: 'Större' },
  { value: 1.2, label: 'Störst' },
]
export const DEFAULT_TEXT_SIZE = 1.1

function read(): number {
  try {
    const v = Number(localStorage.getItem(KEY))
    return TEXT_SIZES.some(s => s.value === v) ? v : DEFAULT_TEXT_SIZE
  } catch { return DEFAULT_TEXT_SIZE }
}

export default function TextSizeButton({ variant = 'bar' }: { variant?: 'bar' | 'menu' }) {
  const [size, setSize] = useState(DEFAULT_TEXT_SIZE)
  useEffect(() => {
    const sync = () => setSize(read())
    sync()
    window.addEventListener(KEY, sync)
    return () => window.removeEventListener(KEY, sync)
  }, [])
  useEffect(() => { document.documentElement.style.setProperty('--ui-zoom', String(size)) }, [size])

  function next() {
    const i = TEXT_SIZES.findIndex(s => s.value === size)
    const v = TEXT_SIZES[(i + 1) % TEXT_SIZES.length].value
    setSize(v)
    try { localStorage.setItem(KEY, String(v)) } catch { /* private mode */ }
    window.dispatchEvent(new Event(KEY))
  }
  const label = TEXT_SIZES.find(s => s.value === size)?.label ?? 'Större'

  if (variant === 'menu') return (
    <button type="button" onClick={next} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(255,255,255,.03)',
      border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text2)', fontSize: 15, cursor: 'pointer',
    }}>
      <span aria-hidden style={{ fontWeight: 700, width: 18 }}>Aa</span> Textstorlek: {label}
    </button>
  )
  return (
    <button type="button" onClick={next} title={`Textstorlek: ${label} (klicka för att ändra)`} aria-label={`Textstorlek: ${label}`} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', height: 34, minWidth: 38, padding: '0 9px', boxSizing: 'border-box',
      background: 'transparent', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    }}>
      A<span style={{ fontSize: size > 1.15 ? 17 : size > 1 ? 15 : 12 }}>a</span>
    </button>
  )
}
