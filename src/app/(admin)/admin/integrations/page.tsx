'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plug, Check, AlertTriangle, RefreshCw, LogOut, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { callVisma } from '@/lib/visma'
import { formatDateTime } from '@/lib/utils'

const supabase = createClient()

interface Status {
  connected: boolean
  company_name?: string | null
  connected_by?: string | null
  connected_at?: string | null
  last_payment_sync?: string | null
  settings?: { terms_of_payment_id?: string; unit_id?: string; coding_id?: string; invoice_mode?: 'draft' | 'invoice'; auto_on_confirm?: boolean }
}
interface Lookups {
  terms: { id: string; name: string; days: number }[]
  units: { id: string; name: string; abbreviation: string }[]
  codings: { id: string; name: string; type: string; vat: number }[]
}

const card: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 20 }
const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }
const select: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  background: primary ? 'var(--gold)' : 'var(--bg3)', color: primary ? '#111' : 'var(--text)', border: primary ? 'none' : '1px solid var(--border)',
})

export default function IntegrationsPage() {
  const params = useSearchParams()
  const [status, setStatus] = useState<Status | null>(null)
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [settings, setSettings] = useState<NonNullable<Status['settings']>>({})
  const [logs, setLogs] = useState<any[]>([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    params.get('visma') === 'connected' ? { ok: true, text: 'Visma är anslutet. Välj inställningarna nedan.' }
    : params.get('visma') === 'error' ? { ok: false, text: params.get('message') || 'Anslutningen misslyckades.' } : null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('visma_status')
    if (error) { setStatus({ connected: false }); setMsg({ ok: false, text: 'Kör migration 0018_visma.sql i Supabase först.' }); return }
    const s = (data || { connected: false }) as Status
    setStatus(s); setSettings(s.settings || {})
    const { data: l } = await supabase.from('integration_log').select('*').eq('type', 'visma').order('created_at', { ascending: false }).limit(15)
    setLogs(l || [])
    if (s.connected) callVisma<Lookups>('lookups').then(setLookups).catch(e => setMsg({ ok: false, text: e.message }))
  }, [])

  useEffect(() => { load() }, [load])

  async function run(name: string, fn: () => Promise<void>) {
    setBusy(name); setMsg(null)
    try { await fn() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
    setBusy('')
  }

  const connect = () => run('connect', async () => {
    const { url } = await callVisma<{ url: string }>('connect')
    window.location.href = url
  })
  const disconnect = () => {
    if (!confirm('Koppla från Visma? Fakturor skapas inte längre förrän ni ansluter igen.')) return
    run('disconnect', async () => { await callVisma('disconnect'); setLookups(null); await load(); setMsg({ ok: true, text: 'Visma är frånkopplat.' }) })
  }
  const save = () => run('save', async () => {
    await callVisma('save-settings', { settings })
    setMsg({ ok: true, text: 'Inställningarna är sparade.' }); await load()
  })
  const syncPayments = () => run('payments', async () => {
    const r = await callVisma<{ checked: number; invoiced: number; paid: number }>('sync-payments')
    setMsg({ ok: true, text: `Kontrollerade ${r.checked} ordrar: ${r.invoiced} nya fakturanummer, ${r.paid} betalda.` }); await load()
  })

  const ready = !!(settings.terms_of_payment_id && settings.unit_id && settings.coding_id)

  return (
    <div style={{ padding: 32, maxWidth: 880 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>Integrationer</h1>
      <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 24px' }}>Koppla webbshoppen och CRM:et till ProLuxShines bokföring.</p>

      {msg && (
        <div role={msg.ok ? 'status' : 'alert'} style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 20, fontSize: 13,
          background: msg.ok ? 'rgba(76,175,125,.1)' : 'rgba(224,82,82,.1)', border: `1px solid ${msg.ok ? 'rgba(76,175,125,.3)' : 'rgba(224,82,82,.3)'}`, color: msg.ok ? 'var(--green)' : 'var(--red)' }}>
          {msg.text}
        </div>
      )}

      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plug size={20} color="var(--gold)" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Visma Spiris</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              {status === null ? 'Laddar…'
                : status.connected ? <>Ansluten till <strong style={{ color: 'var(--text)' }}>{status.company_name || 'Visma-företaget'}</strong>{status.connected_by ? ` av ${status.connected_by}` : ''}{status.connected_at ? ` · ${formatDateTime(status.connected_at)}` : ''}</>
                : 'Inte ansluten'}
            </div>
          </div>
          {status?.connected
            ? <button onClick={disconnect} disabled={!!busy} style={btn()}><LogOut size={14} /> Koppla från</button>
            : <button onClick={connect} disabled={!!busy} style={btn(true)}>{busy === 'connect' ? 'Öppnar Visma…' : <><ExternalLink size={14} /> Anslut Visma</>}</button>}
        </div>
        {!status?.connected && (
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
            Logga in med ett Visma-konto som har behörighet till <strong style={{ color: 'var(--text)' }}>ProLuxShines</strong> företag i Visma Spiris och godkänn kopplingen.
            Därefter skapas fakturor i ProLuxShines Visma när ordrar läggs.
          </p>
        )}

        {status?.connected && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 8 }}>
              <div>
                <label style={label} htmlFor="v-terms">Betalningsvillkor (nya kunder)</label>
                <select id="v-terms" style={select} value={settings.terms_of_payment_id || ''} onChange={e => setSettings(s => ({ ...s, terms_of_payment_id: e.target.value }))}>
                  <option value="">Välj…</option>
                  {lookups?.terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label style={label} htmlFor="v-unit">Enhet (nya artiklar)</label>
                <select id="v-unit" style={select} value={settings.unit_id || ''} onChange={e => setSettings(s => ({ ...s, unit_id: e.target.value }))}>
                  <option value="">Välj…</option>
                  {lookups?.units.map(u => <option key={u.id} value={u.id}>{u.name}{u.abbreviation ? ` (${u.abbreviation})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={label} htmlFor="v-coding">Bokföringskonto (nya artiklar)</label>
                <select id="v-coding" style={select} value={settings.coding_id || ''} onChange={e => setSettings(s => ({ ...s, coding_id: e.target.value }))}>
                  <option value="">Välj…</option>
                  {lookups?.codings.map(c => <option key={c.id} value={c.id}>{c.name}{c.vat != null ? ` · ${c.vat} % moms` : ''}</option>)}
                </select>
              </div>
            </div>
            {!lookups && <p style={{ fontSize: 12, color: 'var(--text2)', margin: '8px 0 0' }}>Hämtar listor från Visma…</p>}

            <div style={{ marginTop: 18 }}>
              <span style={label}>När en order läggs eller bekräftas</span>
              {([['draft', 'Skapa fakturautkast i Visma', 'Ni granskar och skickar fakturan från Visma.'],
                 ['invoice', 'Skapa och bokför fakturan direkt', 'Fakturan får nummer direkt; skicka den från Visma.']] as const).map(([v, t, d]) => (
                <label key={v} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', cursor: 'pointer' }}>
                  <input type="radio" name="v-mode" checked={(settings.invoice_mode || 'draft') === v} onChange={() => setSettings(s => ({ ...s, invoice_mode: v }))} style={{ marginTop: 3 }} />
                  <span><span style={{ fontSize: 14, color: 'var(--text)' }}>{t}</span><br /><span style={{ fontSize: 12, color: 'var(--text2)' }}>{d}</span></span>
                </label>
              ))}
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.auto_on_confirm !== false} onChange={e => setSettings(s => ({ ...s, auto_on_confirm: e.target.checked }))} />
                <span style={{ fontSize: 14, color: 'var(--text)' }}>Automatiskt när ordern bekräftas (annars med knappen på ordern)</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16, alignItems: 'center' }}>
              <button onClick={save} disabled={!!busy} style={btn(true)}>{busy === 'save' ? 'Sparar…' : 'Spara inställningar'}</button>
              <button onClick={syncPayments} disabled={!!busy} style={btn()}><RefreshCw size={14} /> {busy === 'payments' ? 'Kontrollerar…' : 'Kontrollera betalningar nu'}</button>
              {status.last_payment_sync && <span style={{ fontSize: 12, color: 'var(--text2)' }}>Senast: {formatDateTime(status.last_payment_sync)}</span>}
            </div>
            {!ready && <p style={{ fontSize: 12, color: 'var(--gold)', margin: '10px 0 0' }}>Välj betalningsvillkor, enhet och konto innan första fakturan.</p>}
          </>
        )}
      </section>

      <section style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Senaste händelser</div>
        {logs.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>Inget ännu.</p> : logs.map(l => (
          <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderTop: '1px solid var(--border2)', fontSize: 13 }}>
            {l.status === 'success' ? <Check size={15} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} /> : <AlertTriangle size={15} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />}
            <div style={{ flex: 1, color: 'var(--text)' }}>
              Order #{l.payload?.order_nr ?? '—'} · {l.status === 'success'
                ? (l.response?.invoice_number ? `faktura ${l.response.invoice_number}` : 'fakturautkast skapat')
                : l.response?.error}
              {l.response?.warning && <div style={{ fontSize: 12, color: 'var(--gold)' }}>{l.response.warning}</div>}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{formatDateTime(l.created_at)}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
