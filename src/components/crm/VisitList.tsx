'use client'
// Besökslista: the customers the salesperson plans to visit on a day (picked
// in Kunder), ticked off after each visit. Shown on the overview.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, Check, X, Navigation, Phone, Route } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { useMe } from '@/hooks/useMe'
import { isoDay, mapsSearchUrl, mapsRouteUrl, addressOf, type Visit } from '@/lib/visits'

export default function VisitList() {
  const me = useMe()
  const [day, setDay] = useState(() => isoDay(0))
  const [visits, setVisits] = useState<Visit[] | null>(null)
  const [missing, setMissing] = useState(false)

  function load() {
    if (!me.name) return
    createClient().from('visit_plans')
      .select('id,customer_id,visit_date,position,visited_at,note,customers(id,company,contact_name,phone,address,postal_code,city)')
      .eq('salesperson', me.name).eq('visit_date', day).order('position').order('created_at')
      .then(({ data, error }) => {
        if (error) { setMissing(true); setVisits([]); return }
        setMissing(false); setVisits((data ?? []) as any)
      })
  }
  useEffect(load, [me.name, day]) // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(['visit_plans'], load)

  async function toggle(v: Visit) {
    const visited_at = v.visited_at ? null : new Date().toISOString()
    setVisits(vs => (vs ?? []).map(x => x.id === v.id ? { ...x, visited_at } : x))
    await createClient().from('visit_plans').update({ visited_at }).eq('id', v.id)
  }
  async function remove(v: Visit) {
    setVisits(vs => (vs ?? []).filter(x => x.id !== v.id))
    await createClient().from('visit_plans').delete().eq('id', v.id)
  }

  const list = visits ?? []
  const done = list.filter(v => v.visited_at).length
  const left = list.filter(v => !v.visited_at)
  const routeUrl = mapsRouteUrl(left.map(v => addressOf(v.customers)).filter(Boolean) as string[])
  const today = isoDay(0), tomorrow = isoDay(1)

  return (
    <section style={{ marginBottom: 20, background: 'var(--bg3)', border: '1px solid rgba(94,196,154,.35)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border2)', background: 'rgba(94,196,154,.07)', flexWrap: 'wrap' }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(94,196,154,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MapPin size={16} color="#5EC49A" /></span>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Besökslista</span>
        {list.length > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: done === list.length ? 'var(--green)' : 'var(--text2)' }}>{done} av {list.length} besökta</span>}
        <div role="group" aria-label="Dag" style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {[[today, 'Idag'], [tomorrow, 'Imorgon']].map(([d, l]) => (
            <button key={d} type="button" aria-pressed={day === d} onClick={() => setDay(d)}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: day === d ? 700 : 500, border: 'none', cursor: 'pointer', background: day === d ? 'rgba(94,196,154,.18)' : 'var(--bg4)', color: day === d ? 'var(--text)' : 'var(--text2)' }}>{l}</button>
          ))}
        </div>
      </div>

      {missing && <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text2)' }}>Besökslistan aktiveras när migration 0023 har körts.</div>}
      {!missing && visits && list.length === 0 && (
        <div style={{ padding: '16px 18px', fontSize: 14, color: 'var(--text2)' }}>
          Inga besök planerade {day === today ? 'idag' : 'imorgon'}. Gå till <Link href="/crm/customers?plan=1" style={{ color: 'var(--text)', fontWeight: 600 }}>Kunder → Planera besök</Link>, filtrera på stad och markera vilka du ska besöka.
        </div>
      )}
      {list.map((v, i) => {
        const c = v.customers
        const addr = addressOf(c)
        return (
          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: i ? '1px solid var(--border2)' : 'none', opacity: v.visited_at ? .65 : 1 }}>
            <button type="button" onClick={() => toggle(v)} aria-pressed={!!v.visited_at} aria-label={v.visited_at ? `Ångra besök hos ${c?.company}` : `Bocka av ${c?.company}`}
              style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: v.visited_at ? 'var(--green)' : 'transparent', border: `2px solid ${v.visited_at ? 'var(--green)' : 'rgba(255,255,255,.3)'}` }}>
              {v.visited_at && <Check size={18} color="#0F1115" strokeWidth={3} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link href={`/crm/customers/${c?.id}`} style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', textDecoration: v.visited_at ? 'line-through' : 'none' }}>{c?.company}</Link>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                {addr || 'Adress saknas'}{v.visited_at ? ` · besökt ${new Date(v.visited_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </div>
            </div>
            {c?.phone && <a href={`tel:${c.phone}`} aria-label={`Ring ${c.company}`} title={c.phone} style={iconBtn}><Phone size={15} /></a>}
            {addr && <a href={mapsSearchUrl(addr)} target="_blank" rel="noreferrer" aria-label={`Vägbeskrivning till ${c?.company}`} title="Vägbeskrivning" style={iconBtn}><Navigation size={15} /></a>}
            <button type="button" onClick={() => remove(v)} aria-label={`Ta bort ${c?.company} från listan`} title="Ta bort från listan" style={{ ...iconBtn, color: 'var(--text2)' }}><X size={15} /></button>
          </div>
        )
      })}
      {list.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '12px 18px', borderTop: '1px solid var(--border2)' }}>
          {routeUrl && left.length > 1 && (
            <a href={routeUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(94,196,154,.14)', border: '1px solid rgba(94,196,154,.35)', color: 'var(--text)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              <Route size={14} /> Rutt för de {left.length} som är kvar
            </a>
          )}
          <Link href="/crm/customers?plan=1" style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, textDecoration: 'none' }}>+ Lägg till kunder</Link>
        </div>
      )}
    </section>
  )
}

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textDecoration: 'none',
}
