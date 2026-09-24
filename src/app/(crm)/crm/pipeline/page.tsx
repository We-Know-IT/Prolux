'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Deal, Customer, DEAL_STAGES, DealStage } from '@/types'
import { fmt, formatDate } from '@/lib/utils'
import { Plus, X, User, ChevronDown } from 'lucide-react'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { SALESPEOPLE } from '@/lib/team'

const supabase = createClient()

const STAGE_COLORS: Record<DealStage, string> = {
  Prospekt: '#5C6270', Kontaktad: '#4A8FD4', Offert: '#E8B84B',
  Förhandling: '#9B6EE8', Vunnen: '#4CAF7D', Förlorad: '#E05252'
}


export default function CrmPipelinePage() {
  const [deals, setDeals] = useState<(Deal & { customers?: Customer })[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', customer_id: '', value: '', stage: 'Prospekt' as DealStage,
    expected_close: '', notes: '', assigned_to: 'Bashar'
  })
  // Inline new customer
  const [showNewCust, setShowNewCust] = useState(false)
  const [newCust, setNewCust] = useState({ company: '', contact_name: '', email: '', price_list_id: 'Standard' })
  const [savingCust, setSavingCust] = useState(false)
  const [toast, setToast] = useState('')
  const [highlightDeal, setHighlightDeal] = useState<string | null>(null)

  function loadData() {
    return Promise.all([
      supabase.from('deals').select('*,customers(id,company)').order('created_at', { ascending: false }),
      supabase.from('customers').select('id,company').eq('status', 'active').order('company')
    ]).then(([d, c]) => {
      if (d.data) setDeals(d.data)
      if (c.data) setCustomers(c.data as Customer[])
    })
  }

  useLiveRefresh(['deals', 'customers'], loadData)

  useEffect(() => {
    loadData().then(() => {
      setLoading(false)
      const wantedId = new URLSearchParams(window.location.search).get('deal')
      if (wantedId) {
        setHighlightDeal(wantedId)
        setTimeout(() => {
          document.getElementById(`deal-${wantedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
        }, 100)
        setTimeout(() => setHighlightDeal(null), 3000)
      }
    })
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function createCustomerInline() {
    if (!newCust.company.trim() || !newCust.email.trim()) return showToast('Företag och e-post krävs')
    setSavingCust(true)
    const { data, error } = await supabase.from('customers').insert({
      ...newCust, status: 'active'
    }).select('id,company').single()
    if (error) { showToast('Fel: ' + error.message); setSavingCust(false); return }
    if (data) {
      setCustomers(cs => [...cs, data as Customer].sort((a, b) => a.company.localeCompare(b.company)))
      setForm(f => ({ ...f, customer_id: data.id }))
      setNewCust({ company: '', contact_name: '', email: '', price_list_id: 'Standard' })
      setShowNewCust(false)
      showToast(`${data.company} skapad!`)
    }
    setSavingCust(false)
  }

  const EMPTY_FORM = { title: '', customer_id: '', value: '', stage: 'Prospekt' as DealStage, expected_close: '', notes: '', assigned_to: 'Bashar' }

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(d: any) {
    setEditingId(d.id)
    setForm({
      title: d.title || '', customer_id: d.customer_id || '', value: d.value != null ? String(d.value) : '',
      stage: d.stage, expected_close: d.expected_close || '', notes: d.notes || '', assigned_to: d.assigned_to || '',
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false); setShowNewCust(false); setEditingId(null)
  }

  async function saveDeal() {
    if (!form.title.trim()) return showToast('Titel krävs')
    const fields = {
      title: form.title.trim(),
      customer_id: form.customer_id || null,
      value: parseFloat(form.value) || 0,
      stage: form.stage,
      expected_close: form.expected_close || null,
      notes: form.notes || null,
      assigned_to: form.assigned_to || null,
    }
    // Only a stage change moves updated_at: it dates a win for the budget, so
    // fixing a typo on a won deal must not move it to this month.
    const stageChanged = editingId && deals.find(d => d.id === editingId)?.stage !== form.stage
    const { data, error } = editingId
      ? await supabase.from('deals').update(stageChanged ? { ...fields, updated_at: new Date().toISOString() } : fields).eq('id', editingId).select('*,customers(id,company)').single()
      : await supabase.from('deals').insert(fields).select('*,customers(id,company)').single()
    if (error) { showToast('Fel: ' + error.message); return }
    if (data) {
      setDeals(ds => editingId ? ds.map(d => d.id === editingId ? data : d) : [data, ...ds])
      showToast(editingId ? 'Deal uppdaterad' : 'Deal skapad!')
      closeModal()
      setForm(EMPTY_FORM)
    }
  }

  async function moveToStage(dealId: string, stage: DealStage) {
    // updated_at marks when a deal was won, which decides its budget month.
    await supabase.from('deals').update({ stage, updated_at: new Date().toISOString() }).eq('id', dealId)
    setDeals(ds => ds.map(d => d.id === dealId ? { ...d, stage } : d))
  }

  async function deleteDeal(id: string, title: string) {
    if (!confirm(`Radera "${title}"? Det går inte att ångra.`)) return
    await supabase.from('deals').delete().eq('id', id)
    setDeals(ds => ds.filter(d => d.id !== id))
    if (editingId === id) closeModal()
    showToast('Deal raderad')
  }

  const stageDeals = (stage: DealStage) => deals.filter(d => d.stage === stage)
  const stageTotal = (stage: DealStage) => stageDeals(stage).reduce((s, d) => s + (d.value || 0), 0)

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text3)' }}>Laddar pipeline...</div>

  return (
    <div style={{ padding: '16px 14px', height: 'calc(100vh - 58px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, color: 'var(--text)', margin: 0 }}>Pipeline</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, margin: '4px 0 0' }}>
            {deals.filter(d => d.stage !== 'Vunnen' && d.stage !== 'Förlorad').length} aktiva deals · {fmt(deals.filter(d => d.stage !== 'Vunnen' && d.stage !== 'Förlorad').reduce((s,d) => s+d.value,0))} kr i pipeline
          </p>
        </div>
        <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={16} /> Ny deal
        </button>
      </div>

      {/* Kanban board */}
      <div style={{ display: 'flex', gap: 14, flex: 1, overflow: 'auto', paddingBottom: 16, scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
        {DEAL_STAGES.map(stage => {
          const color = STAGE_COLORS[stage]
          const columnDeals = stageDeals(stage)
          return (
            <div key={stage}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (dragging) moveToStage(dragging, stage) }}
              style={{ flex: '0 0 min(240px, 85vw)', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}
            >
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', background: `${color}10` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stage}</span>
                  <span style={{ fontSize: 11, background: `${color}20`, color, borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>{columnDeals.length}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{fmt(stageTotal(stage))} kr</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {columnDeals.map(d => (
                  <div key={d.id} id={`deal-${d.id}`}
                    draggable
                    onDragStart={() => setDragging(d.id)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => openEdit(d)}
                    title="Klicka för att redigera"
                    style={{
                      background: highlightDeal === d.id ? 'rgba(232,184,75,.1)' : 'var(--bg4)',
                      border: `1px solid ${highlightDeal === d.id ? 'var(--gold)' : dragging === d.id ? color : 'var(--line)'}`,
                      borderRadius: 10, padding: 14, cursor: 'pointer', transition: 'all .15s',
                      boxShadow: highlightDeal === d.id ? '0 0 0 3px rgba(232,184,75,.2)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{d.title}</span>
                      <button onClick={e => { e.stopPropagation(); deleteDeal(d.id, d.title) }} aria-label="Radera deal" style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2, flexShrink: 0 }}><X size={12} /></button>
                    </div>
                    {(d as any).customers && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>{(d as any).customers.company}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-serif)' }}>{fmt(d.value)} kr</span>
                      {(d as any).expected_close && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{formatDate((d as any).expected_close)}</span>}
                    </div>
                    {/* Säljare */}
                    {(d as any).assigned_to && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line2)' }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--bg5)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--gold)', flexShrink: 0 }}>
                          {(d as any).assigned_to[0]}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{(d as any).assigned_to}</span>
                      </div>
                    )}
                    {(d as any).notes && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, borderTop: '1px solid var(--line2)', paddingTop: 8, lineHeight: 1.4 }}>{(d as any).notes}</div>}
                    {/* Move buttons */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {DEAL_STAGES.filter(s => s !== stage).slice(0, 3).map(s => (
                        <button key={s} onClick={e => { e.stopPropagation(); moveToStage(d.id, s) }} style={{ fontSize: 9, padding: '2px 6px', background: `${STAGE_COLORS[s]}15`, border: `1px solid ${STAGE_COLORS[s]}30`, borderRadius: 4, color: STAGE_COLORS[s], cursor: 'pointer', fontWeight: 600 }}>→ {s}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── NY DEAL MODAL ──────────────────────────────────────── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1 }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 400, color: 'var(--text)' }}>{editingId ? 'Redigera deal' : 'Ny deal'}</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 24, display: 'grid', gap: 14 }}>
              {/* Titel */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Titel *</label>
                <input placeholder="Produktpaket Virtus 2025" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Värde */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Värde (kr)</label>
                <input type="number" placeholder="25000" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Kund + Skapa ny */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kund</label>
                  <button onClick={() => setShowNewCust(v => !v)} style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={11} /> Skapa ny kund
                  </button>
                </div>
                <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' }}>
                  <option value="">Välj kund...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                </select>

                {/* Inline ny kund */}
                {showNewCust && (
                  <div style={{ marginTop: 10, padding: 14, background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 12 }}>Ny kund</div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {[
                        { label: 'Företag *', key: 'company', placeholder: 'AB Bilservice' },
                        { label: 'Kontaktperson', key: 'contact_name', placeholder: 'Erik Lindgren' },
                        { label: 'E-post *', key: 'email', placeholder: 'erik@foretag.se' },
                      ].map(({ label, key, placeholder }) => (
                        <div key={key}>
                          <label style={{ display: 'block', fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                          <input placeholder={placeholder} value={(newCust as any)[key]} onChange={e => setNewCust(f => ({ ...f, [key]: e.target.value }))}
                            style={{ width: '100%', padding: '7px 10px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                      ))}
                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prislista</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['A','B','C','Standard'].map(pl => (
                            <button key={pl} onClick={() => setNewCust(f => ({ ...f, price_list_id: pl }))}
                              style={{ flex: 1, padding: '6px 4px', background: newCust.price_list_id === pl ? 'rgba(232,184,75,.1)' : 'var(--bg4)', border: `1px solid ${newCust.price_list_id === pl ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 6, color: newCust.price_list_id === pl ? 'var(--gold)' : 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              {pl}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={createCustomerInline} disabled={savingCust}
                        style={{ padding: '8px 0', background: 'var(--gold)', border: 'none', borderRadius: 7, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: savingCust ? 0.6 : 1 }}>
                        {savingCust ? 'Sparar...' : 'Spara kund & välj'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Stage */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stage</label>
                <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as DealStage }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' }}>
                  {DEAL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Säljare */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Säljare</label>
                <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' }}>
                  <option value="">— Ingen —</option>
                  {SALESPEOPLE.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Stängningsdatum */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stängningsdatum</label>
                <input type="date" value={form.expected_close} onChange={e => setForm(f => ({ ...f, expected_close: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Anteckning */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Anteckning</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Skriv en anteckning..."
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--bg2)' }}>
              <button onClick={closeModal} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Avbryt</button>
              {editingId && (
                <button onClick={() => deleteDeal(editingId, form.title)} style={{ marginRight: 'auto', padding: '9px 14px', background: 'transparent', border: '1px solid rgba(224,82,82,.3)', borderRadius: 6, color: 'var(--red)', fontSize: 13, cursor: 'pointer' }}>Radera</button>
              )}
              <button onClick={saveDeal} style={{ padding: '9px 22px', background: 'var(--gold)', border: 'none', borderRadius: 6, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{editingId ? 'Spara ändringar' : 'Skapa deal'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', padding: '12px 20px', fontSize: 13, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 24px rgba(0,0,0,.4)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)' }} />
          {toast}
        </div>
      )}
    </div>
  )
}
