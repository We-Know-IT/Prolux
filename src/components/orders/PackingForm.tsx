'use client'
// Packing in the warehouse, saved on the order: who packed it, when, and
// when the carrier is to pick it up. Shown wherever the order is opened.
import { useEffect, useState } from 'react'
import { PackageCheck, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import { useTeam } from '@/hooks/useTeam'
import { useMe } from '@/hooks/useMe'

export interface PackableOrder {
  id: string
  status: string
  packed_by?: string | null
  packed_at?: string | null
  pickup_at?: string | null
}

// ISO → value for <input type="datetime-local"> (local time), and back.
const toLocal = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null)

export default function PackingForm({ order, onSaved, readOnly = false }: { order: PackableOrder; onSaved?: (patch: Partial<PackableOrder>) => void; readOnly?: boolean }) {
  const team = useTeam()
  const me = useMe()
  const [packedBy, setPackedBy] = useState(order.packed_by || '')
  const [packedAt, setPackedAt] = useState(toLocal(order.packed_at))
  const [pickupAt, setPickupAt] = useState(toLocal(order.pickup_at))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => { setPackedBy(order.packed_by || ''); setPackedAt(toLocal(order.packed_at)); setPickupAt(toLocal(order.pickup_at)) }, [order.id, order.packed_by, order.packed_at, order.pickup_at])

  const sent = order.status === 'shipped' || order.status === 'delivered'
  if (readOnly || sent) {
    if (!order.packed_at && !order.pickup_at) return null
    return (
      <div style={{ fontSize: 14, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {order.packed_at && <span>Packad {formatDateTime(order.packed_at)}{order.packed_by ? ` av ${order.packed_by}` : ''}</span>}
        {order.pickup_at && <span>Upphämtning {formatDateTime(order.pickup_at)}</span>}
      </div>
    )
  }

  async function save() {
    setBusy(true); setMsg(null)
    const packed = !!packedBy.trim()
    const patch: Partial<PackableOrder> = {
      packed_by: packedBy.trim() || null,
      packed_at: packed ? (fromLocal(packedAt) ?? new Date().toISOString()) : null,
      pickup_at: fromLocal(pickupAt),
    }
    // A confirmed order becomes "Packad"; an unconfirmed one keeps its status.
    if (packed && order.status === 'confirmed') patch.status = 'packed'
    if (!packed && order.status === 'packed') patch.status = 'confirmed'
    const { error } = await createClient().from('orders').update(patch).eq('id', order.id)
    setBusy(false)
    if (error) { setMsg({ ok: false, text: /packed|pickup/.test(error.message) ? 'Kör migration 0023 och 0024 i Supabase.' : `Kunde inte spara: ${error.message}` }); return }
    if (patch.packed_at) setPackedAt(toLocal(patch.packed_at))
    setMsg({ ok: true, text: 'Sparat' })
    onSaved?.(patch)
  }

  const field: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }
  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 5 }
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        <div>
          <label style={label} htmlFor={`pb-${order.id}`}>Packad av</label>
          <input id={`pb-${order.id}`} list={`team-${order.id}`} value={packedBy} onChange={e => setPackedBy(e.target.value)} placeholder="Namn" style={field} />
          <datalist id={`team-${order.id}`}>{[...new Set([me.name, ...team].filter(Boolean))].map(n => <option key={n} value={n} />)}</datalist>
          {!packedBy && me.name && (
            <button type="button" onClick={() => { setPackedBy(me.name); if (!packedAt) setPackedAt(toLocal(new Date().toISOString())) }}
              style={{ marginTop: 4, background: 'none', border: 'none', padding: 0, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Jag packade den</button>
          )}
        </div>
        <div>
          <label style={label} htmlFor={`pa-${order.id}`}>Packad när</label>
          <input id={`pa-${order.id}`} type="datetime-local" value={packedAt} onChange={e => setPackedAt(e.target.value)} style={field} />
        </div>
        <div>
          <label style={label} htmlFor={`pu-${order.id}`}>Hämtas av transportör</label>
          <input id={`pu-${order.id}`} type="datetime-local" value={pickupAt} onChange={e => setPickupAt(e.target.value)} style={field} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <button type="button" onClick={save} disabled={busy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 8, background: '#4FC1D9', border: 'none', color: '#0F1115', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: busy ? .6 : 1 }}>
          <PackageCheck size={16} /> {busy ? 'Sparar…' : 'Spara packning'}
        </button>
        {msg && <span role={msg.ok ? 'status' : 'alert'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.ok && <Check size={14} />}{msg.text}</span>}
      </div>
      {order.status === 'pending' && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text2)' }}>Ordern är inte bekräftad av säljaren ännu – packningen sparas ändå på ordern.</p>}
    </div>
  )
}
