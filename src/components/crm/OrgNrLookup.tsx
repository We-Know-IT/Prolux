'use client'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { lookupCompany, type CompanyInfo } from '@/lib/company-lookup'

// "Hämta uppgifter": fills in company name and address from the organisation number.
export default function OrgNrLookup({ orgNr, onFound, compact = false }: { orgNr: string; onFound: (c: CompanyInfo) => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const digits = orgNr.replace(/\D/g, '')
  const ready = digits.length === 10 || digits.length === 12

  async function run() {
    if (!ready) { setMsg({ text: 'Skriv organisationsnumret först (10 siffror).', ok: false }); return }
    setBusy(true); setMsg(null)
    try {
      const c = await lookupCompany(orgNr)
      onFound(c)
      setMsg({ text: `Hämtade ${c.company}`, ok: true })
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Kunde inte hämta uppgifterna.', ok: false })
    }
    setBusy(false)
  }

  return (
    <div>
      <button type="button" onClick={run} disabled={busy}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: compact ? '7px 10px' : '9px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: compact ? 12 : 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap', opacity: busy ? .7 : 1 }}>
        <Search size={13} /> {busy ? 'Hämtar…' : 'Hämta uppgifter'}
      </button>
      {msg && <div role={msg.ok ? 'status' : 'alert'} style={{ marginTop: 6, fontSize: 12, color: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.text}</div>}
    </div>
  )
}
