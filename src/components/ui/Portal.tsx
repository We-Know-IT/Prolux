'use client'
import { ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Renders overlays (drawers, dialogs) at the end of <body>, so no sticky menu
// or animated parent can end up on top of them.
export default function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? createPortal(children, document.body) : null
}
