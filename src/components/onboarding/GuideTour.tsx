'use client'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

export interface GuideStep {
  target?: string   // CSS selector; the first visible match gets the pulsing ring
  title: string
  body: string
}

const START_EVENT = 'prolux-guide-start'

// "?" button that restarts the guide.
export function GuideButton({ variant = 'bar' }: { variant?: 'bar' | 'menu' }) {
  const start = () => window.dispatchEvent(new Event(START_EVENT))
  if (variant === 'menu') return (
    <button onClick={start} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text2)', fontSize: 15, cursor: 'pointer', marginBottom: 6, width: '100%' }}>
      <HelpCircle size={18} /> Visa guiden
    </button>
  )
  return (
    <button onClick={start} data-tour="help" title="Visa guiden" aria-label="Visa guiden"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0 }}>
      <HelpCircle size={16} />
    </button>
  )
}

function findVisible(selector?: string): HTMLElement | null {
  if (!selector) return null
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    const r = el.getBoundingClientRect()
    const onScreen = r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight
    if (r.width > 0 && r.height > 0 && el.offsetParent !== null && onScreen) return el
  }
  return null
}

// First-login walkthrough: a pulsing ring around one menu item at a time with
// an info box. Shown once per browser (storageKey); GuideButton restarts it.
export default function GuideTour({ steps, storageKey }: { steps: GuideStep[]; storageKey: string }) {
  const [step, setStep] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    let seen = false
    try { seen = localStorage.getItem(storageKey) === 'done' } catch { /* storage blocked: show it */ }
    const t = seen ? undefined : setTimeout(() => setStep(0), 900)   // let the page settle first
    const start = () => setStep(0)
    window.addEventListener(START_EVENT, start)
    return () => { clearTimeout(t); window.removeEventListener(START_EVENT, start) }
  }, [storageKey])

  const measure = useCallback(() => {
    if (step === null) return
    const el = findVisible(steps[step]?.target)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [step, steps])

  useLayoutEffect(() => {
    // Measuring the highlighted item has to happen after it is in the DOM.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [measure])

  const finish = useCallback(() => {
    try { localStorage.setItem(storageKey, 'done') } catch { /* ignore */ }
    setStep(null)
  }, [storageKey])

  useEffect(() => {
    if (step === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight') setStep(s => s === null ? s : Math.min(steps.length - 1, s + 1))
      if (e.key === 'ArrowLeft') setStep(s => s === null ? s : Math.max(0, s - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, steps.length, finish])

  if (step === null) return null
  const s = steps[step]
  const last = step === steps.length - 1
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const boxW = Math.min(340, vw - 32)

  // The info box goes under the highlighted item, or above it near the bottom.
  let boxStyle: React.CSSProperties = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  if (rect) {
    const left = Math.max(16, Math.min(vw - boxW - 16, rect.left + rect.width / 2 - boxW / 2))
    boxStyle = rect.bottom + 220 < vh ? { left, top: rect.bottom + 18 } : { left, bottom: vh - rect.top + 18 }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="guide-title" style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
      <style>{`
        @keyframes guide-pulse { 0% { box-shadow: 0 0 0 0 rgba(232,184,75,.7); } 70% { box-shadow: 0 0 0 14px rgba(232,184,75,0); } 100% { box-shadow: 0 0 0 0 rgba(232,184,75,0); } }
        @keyframes guide-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>
      {/* Dimmed page with a hole around the highlighted item */}
      {rect ? (
        <>
          <div onClick={finish} style={{ position: 'fixed', left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12, borderRadius: 10, boxShadow: '0 0 0 9999px rgba(5,6,9,.62)', pointerEvents: 'none' }} />
          <div style={{ position: 'fixed', left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12, borderRadius: 10, border: '2px solid var(--gold)', animation: 'guide-pulse 1.6s ease-out infinite', pointerEvents: 'none' }} />
        </>
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,6,9,.62)' }} />
      )}

      <div key={step} style={{ position: 'fixed', width: boxW, boxSizing: 'border-box', background: 'var(--bg2)', border: '1px solid var(--line-gold, rgba(232,184,75,.3))', borderRadius: 14, padding: '18px 18px 14px', boxShadow: '0 16px 48px rgba(0,0,0,.5)', animation: 'guide-in .2s ease', ...boxStyle }}>
        <button onClick={finish} aria-label="Stäng guiden" style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4 }}>
          <X size={15} />
        </button>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>
          Guide · {step + 1} av {steps.length}
        </div>
        <div id="guide-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6, paddingRight: 20 }}>{s.title}</div>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 14px' }}>{s.body}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {steps.map((_, i) => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i === step ? 'var(--gold)' : 'rgba(255,255,255,.18)' }} />
            ))}
          </div>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={{ padding: '7px 12px', borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Tillbaka</button>
          )}
          <button onClick={() => last ? finish() : setStep(step + 1)} style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--gold)', border: 'none', color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {last ? 'Klar' : step === 0 ? 'Visa mig' : 'Nästa'}
          </button>
        </div>
        {step === 0 && (
          <button onClick={finish} style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Hoppa över guiden</button>
        )}
      </div>
    </div>
  )
}
