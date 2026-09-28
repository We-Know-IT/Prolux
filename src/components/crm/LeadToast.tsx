'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Live notice when a B2B enquiry arrives from the Om oss form (deals.source = 'web').
export default function LeadToast({ href }: { href: string }) {
  const [lead, setLead] = useState<{ title: string; assigned: string | null } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    const channel = supabase
      .channel('web-leads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deals', filter: 'source=eq.web' }, payload => {
        const d = payload.new as { title: string; assigned_to: string | null }
        setLead({ title: d.title, assigned: d.assigned_to })
        clearTimeout(timer)
        timer = setTimeout(() => setLead(null), 10000)
      })
      .subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(channel) }
  }, [])

  if (!lead) return null
  return (
    <div style={{ position: 'fixed', top: 72, right: 16, zIndex: 999, maxWidth: 'calc(100vw - 32px)', background: 'var(--bg2)', border: '1px solid var(--blue)', borderRadius: 12, padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(74,143,212,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <UserPlus size={18} color="var(--blue)" />
      </div>
      <Link href={href} onClick={() => setLead(null)} style={{ textDecoration: 'none' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Ny B2B-förfrågan från webben</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{lead.title.replace(/^B2B-förfrågan – /, '')} · {lead.assigned ? `till ${lead.assigned}` : 'saknar säljare'} · öppna pipeline</div>
      </Link>
      <button onClick={() => setLead(null)} aria-label="Stäng" style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}>
        <X size={14} />
      </button>
    </div>
  )
}
