'use client'
// The menu on the left in the admin and the CRM: large, clear rows grouped
// under a heading, easy to hit with a finger on an iPad. On narrow screens
// the same menu slides in from the left behind the ☰ button.
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface SideNavItem { href: string; label: string; icon: LucideIcon; active: boolean; onClick?: () => void }
export interface SideNavGroup { title?: string; color?: string; items: SideNavItem[] }

export default function SideNav({ groups, footer, onNavigate }: { groups: SideNavGroup[]; footer?: ReactNode; onNavigate?: () => void }) {
  return (
    <nav aria-label="Meny" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '18px 12px 24px', minHeight: '100%', boxSizing: 'border-box' }}>
      {groups.map((g, gi) => (
        <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {g.title && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 6px', fontSize: 12, fontWeight: 800, color: g.color || 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.color || 'var(--text2)' }} />
              {g.title}
            </div>
          )}
          {g.items.map(({ href, label, icon: Icon, active, onClick }) => (
            <Link key={href + label} href={href} aria-current={active ? 'page' : undefined}
              onClick={() => { onClick?.(); onNavigate?.() }}
              className="side-nav-item"
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
                minHeight: 46, padding: '0 12px', borderRadius: 10, textDecoration: 'none',
                fontSize: 15, fontWeight: active ? 700 : 600, letterSpacing: '.005em',
                color: active ? 'var(--text)' : 'var(--text)',
                background: active ? 'rgba(232,184,75,.14)' : 'transparent',
                border: `1px solid ${active ? 'rgba(232,184,75,.4)' : 'transparent'}`,
              }}>
              {active && <span aria-hidden style={{ position: 'absolute', left: -1, top: 10, bottom: 10, width: 3, borderRadius: 3, background: 'var(--gold)' }} />}
              <Icon size={19} color={active ? 'var(--gold)' : 'var(--text2)'} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            </Link>
          ))}
        </div>
      ))}
      {footer && <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: '1px solid var(--line)' }}>{footer}</div>}
      <style>{`.side-nav-item:hover { background: rgba(255,255,255,.05) !important; } .side-nav-item[aria-current="page"]:hover { background: rgba(232,184,75,.18) !important; }`}</style>
    </nav>
  )
}
