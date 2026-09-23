'use client'
import Link from 'next/link'
import { Image as ImageIcon, BookOpen, Building2, Phone } from 'lucide-react'

const SECTIONS = [
  { href: '/admin/content/hem',     label: 'Startsidan',  desc: 'Hero-bilder, rubriker och kategorikort på www.proluxshine.com', icon: ImageIcon },
  { href: '/admin/content/guider',  label: 'Guider',      desc: 'Skapa, redigera och ta bort guideartiklar',                     icon: BookOpen },
  { href: '/admin/content/om-oss',  label: 'Om oss',      desc: 'Historia, statistik och varumärkestexter',                      icon: Building2 },
  { href: '/admin/content/kontakt', label: 'Kontakt',     desc: 'Telefon, e-post, adress och öppettider — visas i footer m.m.',  icon: Phone },
]

export default function AdminContentHub() {
  return (
    <div style={{ padding: 'clamp(16px,4vw,32px)', maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Innehåll</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, margin: '4px 0 0' }}>Redigera texten och bilderna på webbshopen (www.proluxshine.com) — publiceras direkt.</p>
      </div>

      <div className="grid-2" style={{ gap: 14 }}>
        {SECTIONS.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href} style={{
            display: 'flex', gap: 16, alignItems: 'flex-start', textDecoration: 'none',
            background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '22px 24px',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 9, background: 'rgba(232,184,75,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color="var(--gold)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
