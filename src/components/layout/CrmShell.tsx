'use client'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import { ReactNode, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import WebshopLink from '@/components/layout/WebshopLink'
import CartButton from '@/components/layout/CartButton'
import TextSizeButton from '@/components/layout/TextSizeButton'
import LeadToast from '@/components/crm/LeadToast'
import GuideTour, { GuideButton } from '@/components/onboarding/GuideTour'
import { CRM_GUIDE } from '@/components/onboarding/guides'
import { createClient } from '@/lib/supabase/client'
import { currentStaff } from '@/lib/team'
import SideNav, { type SideNavGroup } from '@/components/layout/SideNav'
import { LayoutDashboard, GitBranch, Users, ShoppingCart, LogOut, Menu, X, StickyNote, ClipboardList, Truck, FileCheck, PackageCheck, Sparkles } from 'lucide-react'

export const CRM_SECTIONS = [
  { href: '/crm/dashboard', label: 'Översikt',      icon: LayoutDashboard },
  { href: '/crm/quotes',    label: 'Offerter',       icon: FileCheck },
  { href: '/crm/leads',     label: 'Leads',          icon: Sparkles },
  { href: '/crm/pipeline',  label: 'Pipeline',       icon: GitBranch },
  { href: '/crm/customers', label: 'Kunder',         icon: Users },
  { href: '/crm/orders',    label: 'Ny order',       icon: ShoppingCart },
  { href: '/crm/orders?view=history', label: 'Ordrar', icon: ClipboardList },
  { href: '/crm/shipping',  label: 'Leveranser',     icon: PackageCheck },
  { href: '/crm/car',       label: 'Bilen',          icon: Truck },
  { href: '/crm/notes',     label: 'Anteckningar',   icon: StickyNote },
]

export default function CrmShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [orderToast, setOrderToast] = useState<{ id: string; nr: number; name: string } | null>(null)
  // Which orders tab is open ("Ny order" or the list) follows the address.
  const [search, setSearch] = useState('')
  useEffect(() => { setSearch(window.location.search) }, [pathname])
  const isActive = (href: string) => {
    const [path, query] = href.split('?')
    if (path === '/crm/orders') return pathname.startsWith(path) && (query ? search.includes(query) : !search.includes('view=history'))
    return pathname.startsWith(path)
  }
  const groups: SideNavGroup[] = [{ title: 'CRM', color: '#6AAFF0', items: CRM_SECTIONS.map(n => ({
    ...n, active: isActive(n.href), onClick: () => setSearch(n.href.includes('?') ? '?' + n.href.split('?')[1] : ''),
  })) }]
  useEffect(() => { setMenuOpen(false) }, [pathname])
  const supabase = createClient()

  // Tell the salesperson when a new order is assigned to them, wherever they are in the app.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    currentStaff(supabase).then(({ name: me }) => {
      if (!me) return
      channel = supabase
        .channel(`orders-for-${me}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `assigned_to=eq.${me}` }, payload => {
          const o = payload.new as any
          if (o.status === 'draft' || o.status === 'quote') return   // not an order yet
          setOrderToast({ id: o.id, nr: o.order_nr, name: o.delivery_name || 'Ny kund' })
          clearTimeout(timer)
          timer = setTimeout(() => setOrderToast(null), 8000)
        })
        .subscribe()
    })
    return () => { clearTimeout(timer); if (channel) supabase.removeChannel(channel) }
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
          className="crm-mobile-btn"
          aria-label="Meny"
          style={{ marginLeft: -6, marginRight: 2, padding: 8, background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        {/* Logo */}
        <Link href="/crm/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, marginRight: 4 }}>
          <Image src="/logo.svg" alt="Prolux Shine" width={166} height={30} priority style={{ display: 'block', height: 30, width: 'auto' }} />
        </Link>

        {/* Right side */}
        <div className="crm-desktop-right" style={{ display: 'none', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <CartButton />
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
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line-hi)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)' }}>
            <LogOut size={13} /> <span className="crm-logout-label">Logga ut</span>
          </button>
        </div>

        <div className="crm-mobile-btn" style={{ marginLeft: 'auto', alignItems: 'center' }}><CartButton /></div>
      </header>

      {/* ── Narrow screens: the menu slides in from the left ── */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, top: 'var(--nav-h)', zIndex: 199, background: 'rgba(0,0,0,.5)' }}>
          <aside onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 'min(300px, 86vw)', background: 'var(--bg2)', borderRight: '1px solid var(--line)', overflowY: 'auto', animation: 'slideInLeft .18s ease' }}>
            <SideNav groups={groups} onNavigate={() => setMenuOpen(false)} footer={<>
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
      <LeadToast href="/crm/pipeline" />
      <GuideTour steps={CRM_GUIDE} storageKey="prolux-guide-crm-v2" />
      {orderToast && (
        <Link href="/crm/dashboard" onClick={() => setOrderToast(null)} style={{ position: 'fixed', top: 72, right: 16, left: 'auto', zIndex: 999, maxWidth: 'calc(100vw - 32px)', background: 'var(--bg2)', border: '1px solid var(--gold)', borderRadius: 12, padding: '14px 18px', boxShadow: '0 8px 32px rgba(0,0,0,.4)', textDecoration: 'none', display: 'block' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Ny order till dig: #{orderToast.nr}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{orderToast.name} · tryck för att hantera</div>
        </Link>
      )}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <aside className="side-nav" style={{ width: 236, flexShrink: 0, position: 'sticky', top: 'var(--nav-h)', alignSelf: 'flex-start', height: 'calc(100vh - var(--nav-h))', overflowY: 'auto', borderRight: '1px solid var(--line)', background: 'rgba(10,13,18,.6)' }}>
          <SideNav groups={groups} />
        </aside>
        <main style={{ flex: 1, minWidth: 0, zoom: 'var(--ui-zoom, 1.15)', ['--vz' as string]: 'var(--ui-zoom, 1.15)' }}>
          {children}
        </main>
      </div>

      <style>{`
        .side-nav          { display: none; }
        .crm-desktop-right { display: none !important; }
        .crm-mobile-btn    { display: flex !important; }
        @media (max-width: 1299px) {
          .crm-logout-label, .crm-desktop-right .wsl-label { display: none; }
        }
        /* iPad in landscape and wider: the menu stays on the left. */
        @media (min-width: 1000px) {
          .side-nav          { display: block; }
          .crm-desktop-right { display: flex !important; }
          .crm-mobile-btn    { display: none !important; }
        }
        @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: none; } }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
