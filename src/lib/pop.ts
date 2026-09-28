// Small "pop" on an element, e.g. the add-to-cart button that was clicked.
// Skipped for visitors who prefer reduced motion.
export function popElement(el: Element | null | undefined) {
  if (!el || typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  ;(el as HTMLElement).animate?.(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(0.94)' }, { transform: 'scale(1)' }],
    { duration: 380, easing: 'cubic-bezier(.3,1.4,.5,1)' },
  )
}
