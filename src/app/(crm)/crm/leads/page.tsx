'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { useMe } from '@/hooks/useMe'
import { useTeam, teamOptions } from '@/hooks/useTeam'

const OPEN = ['Prospekt', 'Kontaktad', 'Offert', 'Förhandling']
const SOURCE: Record<string, string> = { web: 'Webben', visit: 'Besök', crm: 'Offert' }

// Every lead, to follow up with each salesperson. Salespeople start on their
// own; admins see the whole team.
export default function LeadsPage() {
  const me = useMe()
  const team = useTeam()
  const path = usePathname() || ''
  const base = path.startsWith('/admin') ? '/admin/crm' : '/crm'
  const [leads, setLeads] = useState<any[] | null>(null)
  const [seller, setSeller] = useState<string | null>(null)
  const [stage, setStage] = useState('open')
  const [q, setQ] = useState('')

  useEffect(() => { if (me.loaded && seller === null) setSeller(me.role === 'admin' ? '' : me.name) }, [me.loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const sb = createClient()
    const base = 'id,title,value,stage,notes,assigned_to,source,created_at,updated_at,customers(id,company,city)'
    const withProduct = await sb.from('deals').select(`${base},products(name)`).order('updated_at', { ascending: false }).limit(1000)
    // Before migration 0024 there is no product on a lead.
    const res = withProduct.error ? await sb.from('deals').select(base).order('updated_at', { ascending: false }).limit(1000) : withProduct
    setLeads((res.data ?? []) as any[])
  }
  useEffect(() => { load() }, [])
  useLiveRefresh(['deals'], load)

  const term = q.trim().toLowerCase()
  const shown = (leads ?? []).filter(l =>
    (!seller || l.assigned_to === seller) &&
    (stage === 'all' || (stage === 'open' ? OPEN.includes(l.stage) : l.stage === stage)) &&
    (!term || [l.customers?.company, l.title, l.notes, l.products?.name, l.customers?.city].some(v => (v || '').toLowerCase().includes(term))))
  const perSeller = shown.reduce((m: Record<string, number>, l) => { const k = l.assigned_to || 'Ingen'; m[k] = (m[k] ?? 0) + 1; return m }, {})

  const field: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text)', fontSize: 14, outline: 'none' }
  const th: React.CSSProperties = { padding: '12px 14px', textAlign: 'left', color: 'var(--text2)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '12px 14px', fontSize: 14, color: 'var(--text)', verticalAlign: 'top' }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Sparkles size={22} color="#6AAFF0" />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Leads</h1>
        <span style={{ fontSize: 14, color: 'var(--text2)' }}>{shown.length} st</span>
      </div>
      <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--text2)' }}>
        Leads från kundbesök, webben och offerter. Skapa en ny från kundkortet med <strong style={{ color: 'var(--text)' }}>Skapa lead</strong>. Klicka på en lead för att öppna den.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök kund, produkt eller anteckning" aria-label="Sök" style={{ ...field, width: '100%', paddingLeft: 32, boxSizing: 'border-box' }} />
        </div>
        <select value={seller ?? ''} onChange={e => setSeller(e.target.value)} aria-label="Säljare" style={field}>
          <option value="">Alla säljare</option>
          {teamOptions(team, seller || '').map(sp => <option key={sp} value={sp}>{sp}</option>)}
        </select>
        <select value={stage} onChange={e => setStage(e.target.value)} aria-label="Steg" style={field}>
          <option value="open">Öppna</option>
          {[...OPEN, 'Vunnen', 'Förlorad'].map(st => <option key={st} value={st}>{st}</option>)}
          <option value="all">Alla</option>
        </select>
      </div>
      {!seller && Object.keys(perSeller).length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.entries(perSeller).sort((a, b) => b[1] - a[1]).map(([sp, n]) => (
            <button key={sp} onClick={() => sp !== 'Ingen' && setSeller(sp)} style={{ padding: '6px 12px', borderRadius: 20, background: 'rgba(106,175,240,.1)', border: '1px solid rgba(106,175,240,.35)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
              {sp} <strong>{n}</strong>
            </button>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--bg3)', border: '1px solid rgba(106,175,240,.3)', borderTop: '3px solid #6AAFF0', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Kund', 'Gäller', 'Produkt', 'Säljare', 'Steg', 'Värde', 'Skapad', 'Anteckning'].map(h => <th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {leads === null && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--text2)' }}>Laddar…</td></tr>}
            {leads && shown.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--text2)', padding: 30 }}>Inga leads med de här filtren.</td></tr>}
            {shown.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                <td style={td}>
                  {l.customers?.id ? <Link href={`/crm/customers/${l.customers.id}`} style={{ color: 'var(--text)', fontWeight: 600 }}>{l.customers.company}</Link> : '—'}
                  {l.customers?.city && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{l.customers.city}</div>}
                </td>
                <td style={td}>
                  <Link href={`${base}/pipeline?deal=${l.id}`} style={{ color: 'var(--text)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'rgba(255,255,255,.3)' }}>{l.title}</Link>
                  {l.source && <div style={{ fontSize: 12, color: 'var(--text2)' }}>Från {(SOURCE[l.source] || l.source).toLowerCase()}</div>}
                </td>
                <td style={td}>{l.products?.name || '—'}</td>
                <td style={{ ...td, color: l.assigned_to ? 'var(--text)' : 'var(--red)' }}>{l.assigned_to || 'Ingen'}</td>
                <td style={td}><span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: 'rgba(106,175,240,.14)', color: '#8DBDF0', whiteSpace: 'nowrap' }}>{l.stage}</span></td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{l.value ? `${fmt(l.value)} kr` : '—'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text2)' }}>{formatDate(l.created_at)}</td>
                <td style={{ ...td, color: 'var(--text2)', maxWidth: 320, whiteSpace: 'pre-line' }}>{(l.notes || '').split('\n').filter((x: string) => !x.startsWith('Produkt: ') && !x.startsWith('Skapad av ')).join('\n').slice(0, 160) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
