'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Pencil, Sparkles, FileText, ShoppingCart, BellRing, Trash2 } from 'lucide-react'
import { deleteOpenOrder } from '@/lib/crm-cart'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { useMe } from '@/hooks/useMe'

// Shared by the CRM and admin overviews.

const panel: React.CSSProperties = {
  background: 'rgba(13,16,23,.72)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12,
  boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 4px 24px rgba(0,0,0,.3)', overflow: 'hidden',
}
// In the admin, "Alla ordrar" means the admin order list; in the CRM the CRM one.
function useInAdmin() {
  const path = usePathname() || ''
  return path.startsWith('/admin') && !path.startsWith('/admin/crm')
}
// "Alla ordrar": admins always go to Admin → Ordrar, sellers to the CRM list.
function useOrdersHref() {
  const me = useMe()
  return useInAdmin() || me.role === 'admin' ? '/admin/orders' : '/crm/orders?view=history'
}
// One order/quote: the admin order panel in the admin, the order form in the CRM.
function useOrderHref() {
  const admin = useInAdmin()
  return (id: string) => admin ? `/admin/orders?order=${id}` : `/crm/orders?edit=${id}`
}

const heading: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.09em',
  marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7,
}

// Open leads (deals not yet won or lost) with notes that can be edited in place.
export function LeadsPanel({ base, limit = 8 }: { base?: string; limit?: number }) {
  const path = usePathname() || ''
  base = base ?? (path.startsWith('/admin') ? '/admin/crm' : '/crm')
  const orderHref = useOrderHref()
  const [leads, setLeads] = useState<any[] | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [quoteByDeal, setQuoteByDeal] = useState<Record<string, { id: string; order_nr: number; status: string }>>({})

  async function load() {
    const sb = createClient()
    const { data } = await sb.from('deals')
      .select('id,title,value,stage,notes,assigned_to,source,created_at,updated_at,customers(id,company)')
      .in('stage', ['Prospekt', 'Kontaktad', 'Offert', 'Förhandling'])
      .order('updated_at', { ascending: false }).limit(limit)
    setLeads(data ?? [])
    const ids = (data ?? []).map(d => d.id)
    if (!ids.length) return
    // The quote behind each lead, so one click opens it (needs orders.deal_id, migration 0006).
    const { data: qs } = await sb.from('orders').select('id,order_nr,status,deal_id').in('deal_id', ids).in('status', ['quote', 'draft']).order('created_at', { ascending: false })
    const map: Record<string, { id: string; order_nr: number; status: string }> = {}
    for (const o of (qs ?? []) as any[]) if (!map[o.deal_id]) map[o.deal_id] = o
    setQuoteByDeal(map)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(['deals', 'orders'], load)

  async function save(id: string) {
    const notes = text.trim() || null
    const { error } = await createClient().from('deals').update({ notes, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return
    setLeads(ls => (ls ?? []).map(l => l.id === id ? { ...l, notes } : l))
    setEditId(null)
  }

  return (
    <div>
      <div style={heading}>
        <Sparkles size={12} /> Leads
        <Link href={`${base}/pipeline`} style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text2)', textDecoration: 'none', textTransform: 'none', letterSpacing: 0 }}>Pipeline →</Link>
      </div>
      <div style={panel}>
        {leads && leads.length === 0 && <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--text2)' }}>Inga öppna leads. Förfrågningar från webben och offerter (Spara som lead) hamnar här.</div>}
        {leads === null && <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--text2)' }}>Laddar…</div>}
        {(leads ?? []).map((l, i, arr) => (
          <div key={l.id} style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Link href={quoteByDeal[l.id] ? orderHref(quoteByDeal[l.id].id) : l.customers?.id ? `/crm/customers/${l.customers.id}` : `${base}/pipeline`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
                {l.customers?.company || l.title}
              </Link>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(74,143,212,.14)', color: '#8DBDF0' }}>{l.stage}</span>
              {l.source === 'web' && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(76,175,125,.14)', color: '#6FCB9C' }}>Från webben</span>}
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--gold)' }}>{l.value ? `${fmt(l.value)} kr` : ''}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)', margin: '3px 0 6px' }}>{l.title}{l.assigned_to ? ` · ${l.assigned_to}` : ''} · {formatDate(l.updated_at || l.created_at)}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {quoteByDeal[l.id] && (
                <Link href={orderHref(quoteByDeal[l.id].id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, background: 'var(--gold)', color: '#111', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                  <FileText size={12} /> Öppna {quoteByDeal[l.id].status === 'quote' ? 'offert' : 'varukorg'} #{quoteByDeal[l.id].order_nr}
                </Link>
              )}
              {l.customers?.id && (
                <Link href={`/crm/customers/${l.customers.id}`} style={{ padding: '5px 11px', borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, textDecoration: 'none' }}>Kundkort</Link>
              )}
              {l.customers?.id && !quoteByDeal[l.id] && (
                <Link href={`/crm/orders?customer=${l.customers.id}`} style={{ padding: '5px 11px', borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, textDecoration: 'none' }}>Skapa offert</Link>
              )}
            </div>
            {editId === l.id ? (
              <div>
                <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={3}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={() => save(l.id)} style={{ padding: '5px 14px', background: 'var(--gold)', border: 'none', borderRadius: 6, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Spara</button>
                  <button onClick={() => setEditId(null)} style={{ padding: '5px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>Avbryt</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setEditId(l.id); setText(l.notes || '') }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 6, width: '100%', textAlign: 'left', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 7, padding: '7px 10px', cursor: 'pointer', color: l.notes ? 'var(--text)' : 'var(--text2)', fontSize: 13, lineHeight: 1.5 }}>
                <Pencil size={12} style={{ marginTop: 3, flexShrink: 0 }} />
                <span style={{ whiteSpace: 'pre-line' }}>{l.notes || 'Lägg till anteckning…'}</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Open quotes; each opens in the order form (mail it or turn it into an order).
export function QuotesPanel({ limit = 6 }: { limit?: number }) {
  const orderHref = useOrderHref()
  const ordersHref = useOrdersHref()
  const [quotes, setQuotes] = useState<any[] | null>(null)
  function load() {
    createClient().from('orders').select('id,order_nr,subtotal,created_at,notes,customers(company)')
      .eq('status', 'quote').order('created_at', { ascending: false }).limit(limit)
      .then(({ data }) => setQuotes(data ?? []))
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(['orders'], load)

  return (
    <div>
      <div style={heading}>
        <FileText size={12} /> Offerter
        <Link href={ordersHref} style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text2)', textDecoration: 'none', textTransform: 'none', letterSpacing: 0 }}>Alla ordrar →</Link>
      </div>
      <div style={panel}>
        {quotes && quotes.length === 0 && <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--text2)' }}>Inga öppna offerter just nu.</div>}
        {quotes === null && <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--text2)' }}>Laddar…</div>}
        {(quotes ?? []).map((q, i, arr) => (
          <Link key={q.id} href={orderHref(q.id)} title="Öppna offerten – mejla den eller gör om den till order"
            style={{ display: 'block', padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{q.customers?.company || 'Kund saknas'}</span>
              <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>#{q.order_nr}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--gold)' }}>{fmt(q.subtotal)} kr</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>{formatDate(q.created_at)}{q.notes ? ` · ${String(q.notes).split('\n')[0].slice(0, 80)}` : ''}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// Saved carts (draft orders), with or without a customer; one click continues them.
export function DraftsPanel({ limit = 10 }: { limit?: number }) {
  async function remove(d: any) {
    if (!confirm(`Ta bort varukorg #${d.order_nr}${d.customers?.company ? ` (${d.customers.company})` : ''}?`)) return
    if (await deleteOpenOrder(createClient(), d.id)) setDrafts(ds => (ds ?? []).filter(x => x.id !== d.id))
  }
  const orderHref = useOrderHref()
  // Saved carts live in the CRM order list's "Varukorgar" tab.
  const cartsHref = useInAdmin() ? '/admin/crm/orders?view=history&filter=carts' : '/crm/orders?view=history&filter=carts'
  const [drafts, setDrafts] = useState<any[] | null>(null)
  function load() {
    createClient().from('orders').select('id,order_nr,subtotal,created_at,created_by,customers(company),order_items(qty)')
      .eq('status', 'draft').order('created_at', { ascending: false }).limit(limit)
      .then(({ data }) => setDrafts(data ?? []))
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(['orders'], load)

  return (
    <div>
      <div style={heading}>
        <ShoppingCart size={12} /> Sparade varukorgar
        <Link href={cartsHref} style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text2)', textDecoration: 'none', textTransform: 'none', letterSpacing: 0 }}>Alla varukorgar →</Link>
      </div>
      <div style={panel}>
        {drafts && drafts.length === 0 && <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--text2)' }}>Inga sparade varukorgar. En varukorg i Ny order sparas här automatiskt.</div>}
        {drafts === null && <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--text2)' }}>Laddar…</div>}
        {(drafts ?? []).map((d, i, arr) => {
          const units = (d.order_items ?? []).reduce((n: number, it: any) => n + (it.qty || 0), 0)
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
            <Link href={orderHref(d.id)} title="Fortsätt med varukorgen"
              style={{ display: 'block', flex: 1, minWidth: 0, padding: '12px 8px 12px 16px', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: d.customers?.company ? 'var(--text)' : 'var(--text2)' }}>{d.customers?.company || 'Utan kund'}</span>
                <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>#{d.order_nr}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--gold)' }}>{fmt(d.subtotal)} kr</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>{units} st · {formatDate(d.created_at)}{d.created_by ? ` · ${d.created_by}` : ''}</div>
            </Link>
            <button onClick={() => remove(d)} aria-label={`Ta bort varukorg #${d.order_nr}`} title="Ta bort varukorgen"
              style={{ margin: '0 12px 0 4px', width: 32, height: 32, flexShrink: 0, borderRadius: 8, background: 'transparent', border: '1px solid rgba(224,82,82,.3)', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={14} />
            </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Quotes and saved carts left untouched for a few days: a nudge to follow up.
// Shown only when there is something to follow up.
// bare: just the rows, for use inside another box (the overview's "Att göra");
// onCount tells that box how many there are.
export function FollowUpPanel({ days = 3, bare = false, onCount }: { days?: number; bare?: boolean; onCount?: (n: number) => void }) {
  const orderHref = useOrderHref()
  const [rows, setRows] = useState<any[]>([])
  function load() {
    const before = new Date(Date.now() - days * 86_400_000).toISOString()
    createClient().from('orders').select('id,order_nr,status,subtotal,created_at,customers(company,email)')
      .in('status', ['quote', 'draft']).lt('created_at', before).order('created_at', { ascending: true }).limit(8)
      .then(({ data }) => { setRows(data ?? []); onCount?.((data ?? []).length) })
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(['orders'], load)
  if (rows.length === 0) return null
  const age = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
  const list = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(o => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: o.status === 'quote' ? 'rgba(155,110,232,.15)' : 'rgba(155,163,176,.12)', color: o.status === 'quote' ? '#B593F0' : 'var(--text2)' }}>
              {o.status === 'quote' ? 'Offert' : 'Varukorg'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.customers?.company || 'Utan kund'} <span style={{ color: 'var(--text2)', fontWeight: 400 }}>#{o.order_nr}</span></span>
            <span style={{ fontSize: 12, color: '#E0A85A' }}>{Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86_400_000)} dagar</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--gold)' }}>{fmt(o.subtotal)} kr</span>
            <Link href={orderHref(o.id)} style={{ padding: '5px 12px', borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Öppna</Link>
          </div>
        ))}
      </div>
  )
  if (bare) return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '10px 0 8px' }}>Följ upp – legat orörda i {days}+ dagar</div>
      {list}
    </div>
  )
  return (
    <div style={{ ...panel, border: '1px solid rgba(232,184,75,.3)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <BellRing size={15} color="var(--gold)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Att göra – följ upp</span>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Offerter och varukorgar som legat orörda i {days} dagar eller mer</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(o => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: o.status === 'quote' ? 'rgba(155,110,232,.15)' : 'rgba(155,163,176,.12)', color: o.status === 'quote' ? '#B593F0' : 'var(--text2)' }}>
              {o.status === 'quote' ? 'Offert' : 'Varukorg'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.customers?.company || 'Utan kund'} <span style={{ color: 'var(--text2)', fontWeight: 400 }}>#{o.order_nr}</span></span>
            <span style={{ fontSize: 12, color: '#E0A85A' }}>{age(o.created_at)} dagar</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--gold)' }}>{fmt(o.subtotal)} kr</span>
            <Link href={orderHref(o.id)} style={{ padding: '5px 12px', borderRadius: 7, background: 'var(--gold)', color: '#111', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Öppna</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
