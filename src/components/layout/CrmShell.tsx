'use client'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import { ReactNode, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, GitBranch, Users, ShoppingCart, LogOut, Menu, X, CalendarDays, StickyNote } from 'lucide-react'

const NAV = [
  { href: '/crm/dashboard', label: 'Översikt',      icon: LayoutDashboard },
  { href: '/crm/pipeline',  label: 'Pipeline',       icon: GitBranch },
  { href: '/crm/customers', label: 'Kunder',         icon: Users },
  { href: '/crm/orders',    label: 'Ordrar',         icon: ShoppingCart },
  { href: '/crm/calendar',  label: 'Kalender',       icon: CalendarDays },
  { href: '/crm/notes',     label: 'Anteckningar',   icon: StickyNote },
]

export default function CrmShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Topbar ───────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        height: 'var(--nav-h)',
        background: 'rgba(8,10,14,.88)',
        backdropFilter: 'saturate(180%) blur(24px)',
        WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        borderBottom: '1px solid var(--line)',
        boxShadow: '0 1px 0 rgba(255,255,255,.03) inset',
        display: 'flex', alignItems: 'center',
        paddingInline: 20, gap: 12,
      }}>
        {/* Logo */}
        <Link href="/crm/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, marginRight: 4 }}>
          <Image src="/logo.svg" alt="Prolux Shine" width={131} height={38} priority style={{ display: 'block' }} />
        </Link>

        {/* Desktop nav pills */}
        <nav className="crm-desktop-nav" style={{ display: 'none', gap: 2, flex: 1, alignItems: 'center' }}>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 13px', borderRadius: 7,
                background: active ? 'rgba(232,184,75,.09)' : 'transparent',
                color: active ? 'var(--gold)' : 'var(--text3)',
                fontSize: 13, fontWeight: active ? 600 : 400,
                textDecoration: 'none',
                border: `1px solid ${active ? 'var(--line-gold)' : 'transparent'}`,
                transition: 'all .15s',
              }}>
                <Icon size={14} style={{ opacity: active ? 1 : 0.6 }} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="crm-desktop-right" style={{ display: 'none', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <button onClick={logout} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 8,
            color: 'var(--text3)',
            fontSize: 12, cursor: 'pointer',
            transition: 'all .15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line-hi)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)' }}>
            <LogOut size={13} /> Logga ut
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="crm-mobile-btn"
          aria-label="Meny"
          style={{ marginLeft: 'auto', padding: 8, background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* ── Mobile fullscreen menu ───────────────────────── */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: 'var(--nav-h)', left: 0, right: 0, bottom: 0,
          background: 'rgba(8,10,14,.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          zIndex: 199,
          padding: '20px 16px 32px',
          display: 'flex', flexDirection: 'column', gap: 6,
          animation: 'fadeIn .15s ease',
        }}>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 18px', borderRadius: 10,
                background: active ? 'rgba(232,184,75,.08)' : 'rgba(255,255,255,.03)',
                color: active ? 'var(--gold)' : 'var(--text)',
                fontSize: 15, fontWeight: active ? 600 : 400,
                textDecoration: 'none',
                border: `1px solid ${active ? 'var(--line-gold)' : 'var(--line)'}`,
                boxShadow: active ? '0 0 20px rgba(232,184,75,.08)' : 'none',
              }}>
                <Icon size={18} style={{ color: active ? 'var(--gold)' : 'var(--text3)', opacity: active ? 1 : 0.7 }} />
                {label}
              </Link>
            )
          })}
          <div style={{ flex: 1 }} />
          <button onClick={logout} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px', background: 'rgba(255,255,255,.03)',
            border: '1px solid var(--line)', borderRadius: 10,
            color: 'var(--text2)', fontSize: 15, cursor: 'pointer',
          }}>
            <LogOut size={18} /> Logga ut
          </button>
        </div>
      )}

      <ServiceWorkerRegister />
      <main style={{ flex: 1 }}>
        {children}
      </main>

      <style>{`
        .crm-desktop-nav   { display: none !important; }
        .crm-desktop-right { display: none !important; }
        .crm-mobile-btn    { display: flex !important; }
        @media (min-width: 900px) {
          .crm-desktop-nav   { display: flex !important; }
          .crm-desktop-right { display: flex !important; }
          .crm-mobile-btn    { display: none !important; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
