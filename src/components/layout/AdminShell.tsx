'use client'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import { ReactNode, useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import WebshopLink from '@/components/layout/WebshopLink'
import CartButton from '@/components/layout/CartButton'
import TextSizeButton from '@/components/layout/TextSizeButton'
import LeadToast from '@/components/crm/LeadToast'
import GuideTour, { GuideButton } from '@/components/onboarding/GuideTour'
import { ADMIN_GUIDE } from '@/components/onboarding/guides'
import { createClient } from '@/lib/supabase/client'
import { CRM_SECTIONS } from '@/components/layout/CrmShell'
import SideNav, { type SideNavGroup } from '@/components/layout/SideNav'
import { LayoutDashboard, ShoppingBag, Users, Tag, Megaphone, Zap, LogOut, UserCog, Menu, X, Bell, FileText, Plug, FileCheck, Sparkles, PackageCheck } from 'lucide-react'

// Admin: overview of the business, the salespeople and what to follow up.
const ADMIN_NAV = [
  { href: '/admin/dashboard',    label: 'Översikt',      icon: LayoutDashboard },
  { href: '/admin/orders',       label: 'Ordrar',        icon: ShoppingBag },
  { href: '/admin/crm/shipping', label: 'Leveranser',    icon: PackageCheck },
  { href: '/admin/crm/quotes',   label: 'Offerter',      icon: FileCheck },
  { href: '/admin/crm/leads',    label: 'Leads',         icon: Sparkles },
  { href: '/admin/customers',    label: 'Kunder',        icon: Users },
  { href: '/admin/products',     label: 'Produkter',     icon: Tag },
]
// Settings and content, used less often: last in the menu.
const ADMIN_SETTINGS = [
  { href: '/admin/campaigns',    label: 'Kampanjer',     icon: Megaphone },
  { href: '/admin/content',      label: 'Innehåll',      icon: FileText },
  { href: '/admin/staff',        label: 'Team',          icon: UserCog },
  { href: '/admin/integrations', label: 'Integrationer', icon: Plug },
  { href: '/admin/automations',  label: 'Automationer',  icon: Zap },
]

// The admin's own sales work in the CRM (to do, visits, customers, orders).
const MY_CRM = ['/crm/dashboard', '/crm/orders', '/crm/orders?view=history', '/crm/customers', '/crm/pipeline', '/crm/car', '/crm/notes']
const MY_CRM_LABEL: Record<string, string> = { '/crm/dashboard': 'Min översikt', '/crm/orders?view=history': 'Mina ordrar' }

export function AdminShell({ children, email }: { children: ReactNode; email: string }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [crmSearch, setCrmSearch] = useState('')
  useEffect(() => { setCrmSearch(window.location.search) }, [pathname])
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => { setMenuOpen(false) }, [pathname])
  // Which menu row is the current page. CRM pages also open under /admin/crm.
  const crmActive = (href: string) => {
    const [path, query] = href.split('?')
    const here = pathname.replace(/^\/admin\/crm/, '/crm')
    if (path === '/crm/orders') return here.startsWith(path) && (query ? crmSearch.includes(query) : !crmSearch.includes('view=history'))
    return here === path || here.startsWith(path + '/')
  }
  const groups: SideNavGroup[] = [
    { title: 'Admin', color: 'var(--gold)', items: ADMIN_NAV.map(n => ({ ...n, active: pathname === n.href || pathname.startsWith(n.href + '/') })) },
    { title: 'Mitt säljarbete', color: '#6AAFF0', items: CRM_SECTIONS.filter(n => MY_CRM.includes(n.href)).map(n => ({
      ...n, label: MY_CRM_LABEL[n.href] || n.label,
      active: !ADMIN_NAV.some(a => pathname.startsWith(a.href)) && crmActive(n.href),
      onClick: () => setCrmSearch(n.href.includes('?') ? '?' + n.href.split('?')[1] : ''),
    })) },
    { title: 'Inställningar', items: ADMIN_SETTINGS.map(n => ({ ...n, active: pathname === n.href || pathname.startsWith(n.href + '/') })) },
  ]
  const [newOrderCount, setNewOrderCount] = useState(0)
  const [realtimeToast, setRealtimeToast] = useState<{nr: number; company: string} | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const order = payload.new as any
        if (order.status === 'draft' || order.status === 'quote') return   // not an order yet
        setNewOrderCount(n => n + 1)
        setRealtimeToast({ nr: order.order_nr, company: `${order.delivery_name || 'Ny kund'} · ${order.assigned_to ? `till ${order.assigned_to}` : 'saknar säljare'}` })
        setTimeout(() => setRealtimeToast(null), 5000)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Keep the current page's menu item in view when the menu is scrolled sideways.
  useEffect(() => {
    document.querySelector('.swipe-nav [aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

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
        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="admin-mobile-btn"
          aria-label="Meny"
          style={{ marginLeft: -6, marginRight: 2, padding: 8, background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        {/* Logo */}
        <Link href="/admin/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, marginRight: 4 }}>
          <Image src="/logo.svg" alt="Prolux Shine" width={166} height={30} priority style={{ display: 'block', height: 30, width: 'auto' }} />
        </Link>

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
          <CartButton />
          <Link href="/admin/orders" data-tour="bell" onClick={() => setNewOrderCount(0)} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, background: newOrderCount > 0 ? 'rgba(232,184,75,.12)' : 'rgba(255,255,255,.04)', border: `1px solid ${newOrderCount > 0 ? 'rgba(232,184,75,.3)' : 'var(--line)'}`, textDecoration: 'none', transition: 'all .2s' }}>
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
            <span className="admin-email" style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
          </div>
          <TextSizeButton />
          <GuideButton />
          <WebshopLink variant="bar" />
          <button onClick={logout} title="Logga ut" aria-label="Logga ut" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', height: 34, boxSizing: 'border-box',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 8,
            color: 'var(--text3)',
            fontSize: 12, cursor: 'pointer',
            transition: 'all .15s',
          }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line-hi)' }}
             onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)' }}>
            <LogOut size={13} /> <span className="admin-logout-label">Logga ut</span>
          </button>
        </div>

        <div className="admin-mobile-btn" style={{ marginLeft: 'auto', alignItems: 'center' }}><CartButton /></div>
      </header>

      {/* ── Narrow screens: the menu slides in from the left ── */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, top: 'var(--nav-h)', zIndex: 199, background: 'rgba(0,0,0,.5)' }}>
          <aside onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 'min(300px, 86vw)', background: 'var(--bg2)', borderRight: '1px solid var(--line)', overflowY: 'auto', animation: 'slideInLeft .18s ease' }}>
            <SideNav groups={groups} onNavigate={() => setMenuOpen(false)} footer={<>
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email} · Administratör</div>
            <TextSizeButton variant="menu" />
            <GuideButton variant="menu" />
            <WebshopLink variant="menu" />
            <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text2)', fontSize: 15, cursor: 'pointer' }}>
              <LogOut size={18} /> Logga ut
            </button>
          </>} />
          </aside>
        </div>
      )}

      <ServiceWorkerRegister />
      <LeadToast href="/admin/crm/pipeline" />
      <GuideTour steps={ADMIN_GUIDE} storageKey="prolux-guide-admin-v2" />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <aside className="side-nav" style={{ width: 236, flexShrink: 0, position: 'sticky', top: 'var(--nav-h)', alignSelf: 'flex-start', height: 'calc(100vh - var(--nav-h))', overflowY: 'auto', borderRight: '1px solid var(--line)', background: 'rgba(10,13,18,.6)' }}>
          <SideNav groups={groups} />
        </aside>
        <main style={{ flex: 1, minWidth: 0, zoom: 'var(--ui-zoom, 1.15)', ['--vz' as string]: 'var(--ui-zoom, 1.15)' }}>
          {children}
        </main>
      </div>

      <style>{`
        .side-nav            { display: none; }
        .admin-desktop-right { display: none !important; }
        .admin-mobile-btn    { display: flex !important; }
        /* Compact top bar (icons only on the right) until there is room for the labels. */
        @media (max-width: 1599px) {
          .admin-email, .admin-logout-label, .admin-desktop-right .wsl-label { display: none; }
        }
        /* iPad in landscape and wider: the menu stays on the left. */
        @media (min-width: 1000px) {
          .side-nav            { display: block; }
          .admin-desktop-right { display: flex !important; }
          .admin-mobile-btn    { display: none !important; }
        }
        @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: none; } }
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
