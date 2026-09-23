'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ShoppingBag, Users, Tag, Megaphone, Zap, LogOut, UserCog, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Ordrar', icon: ShoppingBag },
  { href: '/admin/customers', label: 'Kunder', icon: Users },
  { href: '/admin/products', label: 'Produkter', icon: Tag },
  { href: '/admin/content', label: 'Innehåll', icon: FileText },
  { href: '/admin/campaigns', label: 'Kampanjer', icon: Megaphone },
  { href: '/admin/automations', label: 'Automationer', icon: Zap },
  { href: '/admin/staff', label: 'Medarbetare', icon: UserCog },
]

export function AdminSidebar({ email }: { email?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav style={{position:'fixed',top:'58px',left:0,bottom:0,width:'248px',background:'var(--bg2)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',zIndex:90}}>
      <div style={{padding:'28px 20px 20px',borderBottom:'1px solid rgba(255,255,255,.04)'}}>
        <div style={{fontFamily:'var(--font-serif)',fontSize:'17px',fontWeight:500,color:'var(--text)',marginBottom:'4px'}}>
          Prolux <span style={{color:'var(--gold)',fontStyle:'italic'}}>Shine</span>
        </div>
        <div style={{fontSize:'11px',color:'var(--text3)'}}>Admin-panel</div>
      </div>
      <div style={{padding:'12px 0',flex:1,overflowY:'auto'}}>
        <span style={{fontSize:'10px',fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.1em',padding:'16px 20px 6px',display:'block'}}>Navigera</span>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 20px',fontSize:'13px',fontWeight:active?500:400,color:active?'var(--text)':'var(--text3)',textDecoration:'none',borderLeft:`2px solid ${active?'var(--gold)':'transparent'}`,background:active?'var(--gold-bg)':'transparent',transition:'all .15s'}}>
              <Icon size={15} style={{opacity:active?1:.5,color:active?'var(--gold)':'currentColor'}} />
              {label}
            </Link>
          )
        })}
      </div>
      <div style={{padding:'16px 20px',borderTop:'1px solid rgba(255,255,255,.04)'}}>
        <div style={{fontSize:'13px',color:'var(--text2)',fontWeight:500,marginBottom:'2px'}}>{email || '—'}</div>
        <div style={{fontSize:'11px',color:'var(--text3)',marginBottom:'14px'}}>Administratör</div>
        <button onClick={logout} style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:'var(--text3)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-sans)'}}>
          <LogOut size={14} /> Logga ut
        </button>
      </div>
    </nav>
  )
}
