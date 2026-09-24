'use client'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import { ReactNode, useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, ShoppingBag, Users, Tag, Megaphone, Zap, LogOut, UserCog, Menu, X, GitBranch, CalendarDays, StickyNote, Bell, FileText } from 'lucide-react'

const ADMIN_NAV = [
  { href: '/admin/dashboard',  label: 'Översikt',  icon: LayoutDashboard },
  { href: '/admin/orders',     label: 'Ordrar',    icon: ShoppingBag },
  { href: '/admin/customers',  label: 'Kunder',    icon: Users },
  { href: '/admin/products',   label: 'Produkter', icon: Tag },
  { href: '/admin/content',    label: 'Innehåll',  icon: FileText },
  { href: '/admin/campaigns',  label: 'Kampanjer', icon: Megaphone },
  { href: '/admin/staff',      label: 'Team',      icon: UserCog },
]

const ADMIN_NAV_ALL = [
  ...ADMIN_NAV,
  { href: '/admin/automations', label: 'Automationer', icon: Zap },
]

const CRM_NAV = [
  { href: '/admin/crm/pipeline',  label: 'Pipeline',     icon: GitBranch },
  { href: '/admin/crm/customers', label: 'CRM Kunder',   icon: Users },
  { href: '/admin/crm/orders',    label: 'CRM Ordrar',   icon: ShoppingBag },
  { href: '/admin/crm/calendar',  label: 'Kalender',     icon: CalendarDays },
  { href: '/admin/crm/notes',     label: 'Anteckningar', icon: StickyNote },
]

export function AdminShell({ children, email }: { children: ReactNode; email: string }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [newOrderCount, setNewOrderCount] = useState(0)
  const [realtimeToast, setRealtimeToast] = useState<{nr: number; company: string} | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const order = payload.new as any
        setNewOrderCount(n => n + 1)
        setRealtimeToast({ nr: order.order_nr, company: order.delivery_name || 'Ny kund' })
        setTimeout(() => setRealtimeToast(null), 5000)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

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
        <Link href="/admin/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, marginRight: 4 }}>
          <Image src="/logo.svg" alt="Prolux Shine" width={131} height={38} priority style={{ display: 'block' }} />
        </Link>

        {/* Desktop nav pills */}
        <nav className="admin-desktop-nav" style={{ display: 'none', gap: 1, alignItems: 'center', flex: 1, overflow: 'hidden' }}>
          {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 9px', borderRadius: 7,
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
          {/* Separator */}
          <div style={{ width: 1, height: 16, background: 'var(--line)', margin: '0 4px' }} />
          {/* Single CRM pill */}
          {(() => {
            const crmActive = pathname.startsWith('/crm') || pathname.startsWith('/admin/crm')
            return (
              <Link href="/crm/dashboard" style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 9px', borderRadius: 7,
                background: crmActive ? 'rgba(74,143,212,.1)' : 'transparent',
                color: crmActive ? '#6AAFF0' : 'var(--text3)',
                fontSize: 13, fontWeight: crmActive ? 600 : 400,
                textDecoration: 'none',
                border: `1px solid ${crmActive ? 'rgba(74,143,212,.25)' : 'transparent'}`,
                transition: 'all .15s',
              }}>
                <GitBranch size={14} style={{ opacity: crmActive ? 1 : 0.5 }} />
                CRM
              </Link>
            )
          })()}
        </nav>

        {/* Realtime toast */}
        {realtimeToast && (
          <div style={{ position: 'fixed', top: 72, right: 20, zIndex: 999, background: 'var(--bg2)', border: '1px solid var(--gold)', borderRadius: 12, padding: '14px 18px', boxShadow: '0 8px 32px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: 12, minWidth: 280, animation: 'slideInRight .3s ease' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,184,75,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShoppingBag size={18} color="var(--gold)" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Ny order #{realtimeToast.nr}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{realtimeToast.company}</div>
            </div>
            <button onClick={() => setRealtimeToast(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Right side */}
        <div className="admin-desktop-right" style={{ display: 'none', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 }}>
          <Link href="/admin/orders" onClick={() => setNewOrderCount(0)} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, background: newOrderCount > 0 ? 'rgba(232,184,75,.12)' : 'rgba(255,255,255,.04)', border: `1px solid ${newOrderCount > 0 ? 'rgba(232,184,75,.3)' : 'var(--line)'}`, textDecoration: 'none', transition: 'all .2s' }}>
            <Bell size={15} color={newOrderCount > 0 ? 'var(--gold)' : 'var(--text3)'} />
            {newOrderCount > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--gold)', color: '#111', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingInline: 3 }}>
                {newOrderCount}
              </span>
            )}
          </Link>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px 5px 6px',
            background: 'rgba(255,255,255,.04)',
            border: '1px solid var(--line)',
            borderRadius: 20,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--bg4), var(--bg5))',
              border: '1px solid var(--line-gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'var(--gold)',
            }}>
              {email.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
          </div>
          <button onClick={logout} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 8,
            color: 'var(--text3)',
            fontSize: 12, cursor: 'pointer',
            transition: 'all .15s',
          }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line-hi)' }}
             onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)' }}>
            <LogOut size={13} /> Logga ut
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="admin-mobile-btn"
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
          {ADMIN_NAV_ALL.map(({ href, label, icon: Icon }) => {
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
          {/* CRM section */}
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '10px 18px 4px' }}>Säljverktyg</div>
          {CRM_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 18px', borderRadius: 10,
                background: active ? 'rgba(74,143,212,.08)' : 'rgba(255,255,255,.03)',
                color: active ? '#6AAFF0' : 'var(--text)',
                fontSize: 15, fontWeight: active ? 600 : 400,
                textDecoration: 'none',
                border: `1px solid ${active ? 'rgba(74,143,212,.25)' : 'var(--line)'}`,
              }}>
                <Icon size={18} style={{ color: active ? '#6AAFF0' : 'var(--text3)', opacity: active ? 1 : 0.7 }} />
                {label}
              </Link>
            )
          })}
          <div style={{ flex: 1 }} />
          <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>{email}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Administratör</div>
          </div>
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
        .admin-desktop-nav   { display: none !important; }
        .admin-desktop-right { display: none !important; }
        .admin-mobile-btn    { display: flex !important; }
        @media (min-width: 900px) {
          .admin-desktop-nav   { display: flex !important; }
          .admin-desktop-right { display: flex !important; }
          .admin-mobile-btn    { display: none !important; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
