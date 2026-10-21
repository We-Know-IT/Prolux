'use client'
import { useEffect, useState } from 'react'
import { FileText, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { useTeam, teamOptions } from '@/hooks/useTeam'
import OrderDrawer from '@/components/orders/OrderDrawer'

type QState = 'open' | 'won' | 'lost'
const STATE: Record<QState, { label: string; color: string; bg: string }> = {
  open: { label: 'Öppen',      color: '#B593F0',      bg: 'rgba(181,147,240,.14)' },
  won:  { label: 'Blev order', color: 'var(--green)', bg: 'rgba(76,175,125,.14)' },
  lost: { label: 'Avböjd',     color: 'var(--red)',   bg: 'rgba(224,82,82,.12)' },
}
const stateOf = (status: string): QState => status === 'quote' ? 'open' : status === 'cancelled' ? 'lost' : 'won'

// Offerter: every quote – open, accepted (became an order) and declined –
// with filters to go back through the history.
export default function QuotesPage() {
  const sb = createClient()
  const team = useTeam()
  const [quotes, setQuotes] = useState<any[] | null>(null)
  const [state, setState] = useState<'' | QState>('')
  const [seller, setSeller] = useState('')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [hasHistory, setHasHistory] = useState(true)

  async function load() {
    const cols = 'id,order_nr,status,subtotal,total,created_at,quoted_at,assigned_to,created_by,customers(id,company,city)'
    // Since migration 0026 a quote remembers it was one after becoming an order.
    const all = await sb.from('orders').select(cols).or('status.eq.quote,quoted_at.not.is.null').order('created_at', { ascending: false }).limit(1000)
    if (!all.error) { setHasHistory(true); setQuotes(all.data ?? []); return }
    const open = await sb.from('orders').select(cols.replace('quoted_at,', '')).eq('status', 'quote').order('created_at', { ascending: false }).limit(1000)
    setHasHistory(false); setQuotes(open.data ?? [])
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(['orders'], load)

  async function decline(id: string) {
    if (!confirm('Markera offerten som avböjd?')) return
    await sb.from('orders').update({ status: 'cancelled' }).eq('id', id)
    load()
  }

  const term = q.trim().toLowerCase()
  const dateOf = (x: any) => (x.quoted_at || x.created_at || '').slice(0, 10)
  const shown = (quotes ?? []).filter(x =>
    (!state || stateOf(x.status) === state) &&
    (!seller || x.assigned_to === seller || x.created_by === seller) &&
    (!from || dateOf(x) >= from) && (!to || dateOf(x) <= to) &&
    (!term || [x.customers?.company, x.customers?.city, String(x.order_nr)].some(v => (v || '').toLowerCase().includes(term))))
  const count = (st: QState) => (quotes ?? []).filter(x => stateOf(x.status) === st).length
  const openValue = (quotes ?? []).filter(x => x.status === 'quote').reduce((n, x) => n + (x.subtotal || 0), 0)

  const field: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text)', fontSize: 14, outline: 'none', colorScheme: 'dark' }
  const th: React.CSSProperties = { padding: '12px 14px', textAlign: 'left', color: 'var(--text2)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '13px 14px', fontSize: 14, color: 'var(--text)' }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <FileText size={22} color="#B593F0" />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Offerter</h1>
        <span style={{ fontSize: 14, color: 'var(--text2)' }}>{count('open')} öppna · {fmt(openValue)} kr exkl. moms</span>
      </div>
      <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--text2)' }}>
        Alla offerter: öppna, de som blev order och de som avböjdes. Klicka på en offert för att se den, redigera den eller göra om den till order.
        {!hasHistory && ' (Kör migration 0026 för att också se offerter som blivit ordrar.)'}
      </p>

      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {([['', 'Alla', (quotes ?? []).length], ['open', 'Öppna', count('open')], ['won', 'Blev order', count('won')], ['lost', 'Avböjda', count('lost')]] as const).map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={state === k} onClick={() => setState(k as '' | QState)}
            style={{ padding: '8px 14px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              background: state === k ? 'rgba(181,147,240,.14)' : 'transparent', border: `1px solid ${state === k ? 'rgba(181,147,240,.5)' : 'var(--line)'}`, color: state === k ? 'var(--text)' : 'var(--text2)' }}>
            {l} <strong>{n}</strong>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök kund, ort eller offertnummer" aria-label="Sök" style={{ ...field, width: '100%', paddingLeft: 32, boxSizing: 'border-box' }} />
        </div>
        <select value={seller} onChange={e => setSeller(e.target.value)} aria-label="Säljare" style={field}>
          <option value="">Alla säljare</option>
          {teamOptions(team, seller).map(sp => <option key={sp} value={sp}>{sp}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)' }}>Från <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={field} /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)' }}>Till <input type="date" value={to} onChange={e => setTo(e.target.value)} style={field} /></label>
        {(state || seller || q || from || to) && <button onClick={() => { setState(''); setSeller(''); setQ(''); setFrom(''); setTo('') }} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Rensa</button>}
      </div>

      <div style={{ background: 'var(--bg3)', border: '1px solid rgba(181,147,240,.3)', borderTop: '3px solid #B593F0', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Offert', 'Datum', 'Kund', 'Säljare', 'Belopp', 'Status', ''].map(h => <th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {quotes === null && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text2)' }}>Laddar…</td></tr>}
            {quotes && shown.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text2)', padding: 30 }}>Inga offerter med de här filtren.</td></tr>}
            {shown.map(x => {
              const st = STATE[stateOf(x.status)]
              return (
                <tr key={x.id} onClick={() => setOpenId(x.id)} title="Öppna offerten" style={{ borderBottom: '1px solid var(--border2)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>#{x.order_nr}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text2)' }}>{formatDate(x.quoted_at || x.created_at)}</td>
                  <td style={td}><strong>{x.customers?.company || 'Utan kund'}</strong>{x.customers?.city && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{x.customers.city}</div>}</td>
                  <td style={td}>{x.assigned_to || x.created_by || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--gold)', fontWeight: 700 }}>{fmt(x.subtotal || 0)} kr</td>
                  <td style={td}><span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 5, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {x.status === 'quote' && (
                      <button onClick={e => { e.stopPropagation(); decline(x.id) }} style={{ padding: '6px 10px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Avböjd</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {openId && <OrderDrawer orderId={openId} onClose={() => setOpenId(null)} onChanged={() => load()} />}
    </div>
  )
}
