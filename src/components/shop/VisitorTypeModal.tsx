'use client'
import { useState } from 'react'
import Image from 'next/image'
import { Building2, User, X, Check } from 'lucide-react'
import type { CustomerType } from '@/lib/pricing'

const PERKS: Record<CustomerType, { title: string; text: string; points: string[]; cta: string }> = {
  business: {
    title: 'Tack! Välkommen som företagskund',
    text: 'Logga in eller skapa ett företagskonto för att se dina priser och beställa.',
    points: ['Grossistpriser exkl. moms', 'Prislista anpassad efter er volym', 'Betalning mot faktura', 'Personlig säljare'],
    cta: 'Skapa företagskonto',
  },
  private: {
    title: 'Tack! Välkommen',
    text: 'Logga in eller skapa ett konto för att se priser och beställa.',
    points: ['Priser inkl. moms', 'Samma proffsprodukter som bilvårdsfirmorna', 'Betalning mot faktura', 'Snabb leverans'],
    cta: 'Skapa konto',
  },
}

// First visit: "Företag eller privat?", then a thank-you with log in / sign up.
export default function VisitorTypeModal({ onChoose, onClose, onLogin, onSignup }: {
  onChoose: (t: CustomerType) => void
  onClose: () => void
  onLogin: () => void
  onSignup: (t: CustomerType) => void
}) {
  const [type, setType] = useState<CustomerType | null>(null)
  const perks = type && PERKS[type]

  function choose(t: CustomerType) { setType(t); onChoose(t) }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="visitor-type-title" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'fadeIn .2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#fff', borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,.25)', padding: '32px 28px 28px', position: 'relative', boxSizing: 'border-box' }}>
        <button onClick={onClose} aria-label="Stäng" style={{ position: 'absolute', top: 14, right: 14, background: 'transparent', border: 'none', color: '#777', cursor: 'pointer', padding: 6 }}>
          <X size={18} />
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Image src="/logo-full-dark.svg" alt="Prolux Shine" width={110} height={81} style={{ display: 'block', height: 72, width: 'auto' }} />
        </div>

        {!perks ? (
          <>
            <h2 id="visitor-type-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: '#111', textAlign: 'center', margin: '0 0 6px' }}>Välkommen!</h2>
            <p style={{ fontSize: 14, color: '#555', textAlign: 'center', margin: '0 0 22px' }}>Handlar du som företag eller privatperson?</p>
            <div className="vt-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {([
                { t: 'business' as const, icon: Building2, label: 'Företag', sub: 'Priser exkl. moms' },
                { t: 'private' as const,  icon: User,      label: 'Privat',  sub: 'Priser inkl. moms' },
              ]).map(({ t, icon: Icon, label, sub }) => (
                <button key={t} onClick={() => choose(t)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '22px 12px', borderRadius: 14, background: '#FAF8F4', border: '1.5px solid rgba(0,0,0,.1)', cursor: 'pointer', transition: 'border-color .15s, transform .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9971A'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.1)'; e.currentTarget.style.transform = 'none' }}>
                  <span style={{ width: 48, height: 48, borderRadius: 12, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={22} color="#E8B84B" />
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{label}</span>
                  <span style={{ fontSize: 12, color: '#666' }}>{sub}</span>
                </button>
              ))}
            </div>
            <style>{`@media (max-width: 380px) { .vt-grid { grid-template-columns: 1fr !important; } }`}</style>
          </>
        ) : (
          <>
            <h2 id="visitor-type-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: '#111', textAlign: 'center', margin: '0 0 8px' }}>{perks.title}</h2>
            <p style={{ fontSize: 14, color: '#555', textAlign: 'center', margin: '0 0 18px', lineHeight: 1.6 }}>{perks.text}</p>
            <ul style={{ listStyle: 'none', margin: '0 0 22px', padding: '14px 16px', background: '#FAF8F4', borderRadius: 12, display: 'grid', gap: 8 }}>
              {perks.points.map(p => (
                <li key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333' }}>
                  <Check size={14} color="#C9971A" strokeWidth={2.5} /> {p}
                </li>
              ))}
            </ul>
            <button onClick={() => onSignup(type!)} style={{ width: '100%', padding: '13px', borderRadius: 10, background: '#E8B84B', color: '#0D0900', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>
              {perks.cta}
            </button>
            <button onClick={onLogin} style={{ width: '100%', padding: '12px', borderRadius: 10, background: '#111', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>
              Logga in
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button onClick={() => setType(null)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', padding: 6 }}>← Ändra val</button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', padding: 6 }}>Titta runt först</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
