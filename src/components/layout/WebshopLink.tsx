'use client'
import { useEffect, useState } from 'react'
import { Store } from 'lucide-react'

// Link from admin/CRM to the webshop. Until the new webshop is on www
// (NEXT_PUBLIC_WEBSHOP_ON_WWW), it opens on crm.proluxshine.com/webbshop;
// afterwards it points at www. The login is shared either way, so admins can
// use "Redigera sida".
const WEBSHOP_ON_WWW = process.env.NEXT_PUBLIC_WEBSHOP_ON_WWW === 'true'

export default function WebshopLink({ variant }: { variant: 'bar' | 'menu' }) {
  const [href, setHref] = useState(WEBSHOP_ON_WWW ? 'https://www.proluxshine.com/' : '/webbshop')
  useEffect(() => {
    if (!window.location.hostname.startsWith('crm.')) setHref('/')
  }, [])

  const style: React.CSSProperties = variant === 'bar'
    ? { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--line)', borderRadius: 8,
        color: 'var(--text2)', fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' }
    : { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(255,255,255,.03)',
        border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text2)', fontSize: 15, textDecoration: 'none', marginBottom: 6 }

  return (
    <a href={href} style={style} title="Öppna webbshoppen" data-tour={variant === 'bar' ? 'webshop' : undefined}>
      <Store size={variant === 'bar' ? 14 : 18} /> <span className="wsl-label">Webbshoppen</span>
    </a>
  )
}
