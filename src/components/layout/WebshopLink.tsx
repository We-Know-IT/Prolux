'use client'
import { useEffect, useState } from 'react'
import { Store } from 'lucide-react'

// Link from admin/CRM to the webshop. On crm.proluxshine.com "/" leads back
// to the CRM, so it points at www; the login is shared, so the user stays
// logged in there (admins get "Redigera sida").
export default function WebshopLink({ variant }: { variant: 'bar' | 'menu' }) {
  const [href, setHref] = useState('https://www.proluxshine.com/')
  useEffect(() => {
    if (!window.location.hostname.startsWith('crm.')) setHref('/')
  }, [])

  const style: React.CSSProperties = variant === 'bar'
    ? { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--line)', borderRadius: 8,
        color: 'var(--text2)', fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' }
    : { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(255,255,255,.03)',
        border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text2)', fontSize: 15, textDecoration: 'none', marginBottom: 6 }

  return (
    <a href={href} style={style} title="Öppna webbshoppen">
      <Store size={variant === 'bar' ? 14 : 18} /> Webbshoppen
    </a>
  )
}
