'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, Plus, Minus, Search, Package, PackagePlus, Undo2 } from 'lucide-react'
import { useMe } from '@/hooks/useMe'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'

const supabase = createClient()

interface Row { product_id: string; qty: number; salesperson: string }
interface Prod { id: string; name: string; sku: string | null; brand: string | null; image_url: string | null; stock_qty: number | null }

function Pic({ src }: { src: string | null }) {
  return (
    <div style={{ width: 56, height: 56, borderRadius: 10, background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 4, boxSizing: 'border-box' }}>
      {src ? <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Package size={22} color="#999" />}
    </div>
  )
}

// What the salesperson carries in the car. Loading moves goods from the
// warehouse; lines sold "från bilen" are taken from here automatically.
export default function CarStockPage() {
  const me = useMe()
  const [rows, setRows] = useState<Row[]>([])
  const [products, setProducts] = useState<Prod[]>([])
  const [who, setWho] = useState('')
  const [search, setSearch] = useState('')
  const [loadQty, setLoadQty] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [missing, setMissing] = useState(false)

  function load() {
    Promise.all([
      supabase.from('car_stock').select('product_id,qty,salesperson'),
      supabase.from('products').select('id,name,sku,brand,image_url,stock_qty').eq('active', true).order('sort_order'),
    ]).then(([c, p]) => {
      if (c.error) setMissing(true); else { setMissing(false); setRows(c.data as Row[]) }
      if (p.data) setProducts(p.data as Prod[])
    })
  }
  useEffect(load, [])
  useLiveRefresh(['car_stock', 'products'], load)
  useEffect(() => { if (me.loaded && !who) setWho(me.name) }, [me.loaded, me.name, who])

  const sellers = useMemo(() => [...new Set([me.name, ...rows.map(r => r.salesperson)].filter(Boolean))], [rows, me.name])
  const mine = who === me.name
  const inCar = rows.filter(r => r.salesperson === who && r.qty > 0)
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products])
  const total = inCar.reduce((n, r) => n + r.qty, 0)

  async function call(fn: 'car_load' | 'car_set', productId: string, qty: number, fromWarehouse = true, done?: string) {
    setBusy(productId); setMsg(null)
    const { error } = fn === 'car_load'
      ? await supabase.rpc('car_load', { p_product: productId, p_qty: qty, p_from_warehouse: fromWarehouse })
      : await supabase.rpc('car_set', { p_product: productId, p_qty: qty })
    setBusy(null)
    if (error) { setMsg({ ok: false, text: error.message.includes('car_') ? 'Kör migration 0020 först.' : error.message }); return }
    if (done) setMsg({ ok: true, text: done })
    load()
  }

  const term = search.trim().toLowerCase()
  const candidates = term ? products.filter(p => p.name.toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term)).slice(0, 8) : []
  const btn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <Truck size={22} color="var(--gold)" />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Lager i bilen</h1>
        {sellers.length > 1 && (
          <select value={who} onChange={e => setWho(e.target.value)} aria-label="Säljare"
            style={{ marginLeft: 'auto', padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
            {sellers.map(s => <option key={s} value={s}>{s === me.name ? `${s} (du)` : s}</option>)}
          </select>
        )}
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
        Lasta bilen från lagret här. När du säljer &quot;från bilen&quot; i en order dras varorna härifrån automatiskt, och kommer tillbaka om ordern avbryts.
      </p>
      {missing && <div role="alert" style={{ padding: 14, borderRadius: 10, background: 'rgba(224,82,82,.1)', border: '1px solid rgba(224,82,82,.3)', color: 'var(--text)', fontSize: 13, marginBottom: 16 }}>Bil-lagret är inte aktiverat ännu – kör migration 0020 i Supabase.</div>}
      {msg && <div role="status" style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13, background: msg.ok ? 'rgba(76,175,125,.1)' : 'rgba(224,82,82,.1)', border: `1px solid ${msg.ok ? 'rgba(76,175,125,.3)' : 'rgba(224,82,82,.3)'}`, color: 'var(--text)' }}>{msg.text}</div>}

      {mine && (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><PackagePlus size={16} color="var(--gold)" /> Lasta bilen</div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök produkt att lasta…" aria-label="Sök produkt att lasta"
              style={{ width: '100%', padding: '10px 12px 10px 32px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {candidates.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border2)', flexWrap: 'wrap' }}>
              <Pic src={p.image_url} />
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{p.sku} · {p.stock_qty ?? 0} st i lager</div>
              </div>
              <input type="number" min={1} value={loadQty[p.id] ?? '1'} onChange={e => setLoadQty(q => ({ ...q, [p.id]: e.target.value }))} aria-label={`Antal ${p.name}`}
                style={{ width: 70, padding: '8px 10px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
              <button disabled={busy === p.id} onClick={() => { const n = Math.max(1, parseInt(loadQty[p.id] ?? '1') || 1); call('car_load', p.id, n, true, `${n} st ${p.name} lastade i bilen`).then(() => setSearch('')) }}
                style={{ padding: '9px 14px', borderRadius: 8, background: 'var(--gold)', border: 'none', color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Lasta</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{mine ? 'I din bil' : `I ${who}s bil`}</h2>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>{total} st</span>
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {inCar.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>Bilen är tom.</div>}
        {inCar.map(r => {
          const p = byId.get(r.product_id)
          return (
            <div key={r.product_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border2)', flexWrap: 'wrap' }}>
              <Pic src={p?.image_url ?? null} />
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p?.name ?? 'Okänd produkt'}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{p?.sku}</div>
              </div>
              {mine ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title="Justera efter inventering (påverkar inte lagret)">
                    <button style={btn} disabled={busy === r.product_id} onClick={() => call('car_set', r.product_id, r.qty - 1)} aria-label="En mindre"><Minus size={14} /></button>
                    <span style={{ minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{r.qty}</span>
                    <button style={btn} disabled={busy === r.product_id} onClick={() => call('car_set', r.product_id, r.qty + 1)} aria-label="En till"><Plus size={14} /></button>
                  </div>
                  <button disabled={busy === r.product_id} onClick={() => call('car_load', r.product_id, -r.qty, true, `${r.qty} st ${p?.name ?? ''} tillbaka i lagret`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
                    <Undo2 size={13} /> Lasta av till lagret
                  </button>
                </>
              ) : <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{r.qty} st</span>}
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 10 }}>− och + justerar efter inventering utan att ändra lagret. &quot;Lasta av&quot; lägger tillbaka varorna i lagret.</p>
    </div>
  )
}
