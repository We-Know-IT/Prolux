'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'
import { X } from 'lucide-react'
import { isLiveOrder } from '@/lib/team'

const PL_COLORS: Record<string, { bg: string; color: string }> = {
  A:        { bg: 'rgba(232,184,75,.15)',  color: '#E8B84B' },
  B:        { bg: 'rgba(232,236,240,.08)', color: '#F0EDE8' },
  C:        { bg: 'rgba(232,236,240,.06)', color: '#9BA0AB' },
  Standard: { bg: 'rgba(232,236,240,.04)', color: '#5C6270' },
}
const STATUS_LABELS: Record<string, string> = {
  active:   'Aktiv',
  inactive: 'Inaktiv',
  prospect: 'Prospekt',
}
const STATUS_CSS: Record<string, { bg: string; color: string }> = {
  active:   { bg: 'rgba(76,175,125,.12)', color: '#4CAF7D' },
  inactive: { bg: 'rgba(155,163,176,.08)', color: '#9BA0AB' },
  prospect: { bg: 'rgba(74,143,212,.12)', color: '#4A8FD4' },
}
const ACT_ICONS: Record<string, string> = {
  note: '📝', call: '📞', email: '✉️', meeting: '🤝', order: '📦',
}

const EMPTY_FORM = {
  company: '', contact_name: '', contact_role: '', email: '', phone: '',
  city: '', org_nr: '', price_list_id: 'B', status: 'active', birthday: '',
}

export default function AdminCustomers() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [orders, setOrders]       = useState<any[]>([])
  const [search, setSearch]       = useState('')
  const [selectedCust, setSelectedCust] = useState<any>(null)
  const [custOrders, setCustOrders]     = useState<any[]>([])
  const [custActs, setCustActs]         = useState<any[]>([])
  const [actType, setActType]           = useState('note')
  const [actTitle, setActTitle]         = useState('')
  const [actBody, setActBody]           = useState('')
  const [showModal, setShowModal]       = useState(false)
  const [editMode, setEditMode]         = useState(false)
  const [toast, setToast]               = useState('')
  const [form, setForm]                 = useState({ ...EMPTY_FORM })

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('customers').select('*').order('company'),
      sb.from('orders').select('id,order_nr,customer_id,subtotal,status,created_at').order('created_at', { ascending: false }),
    ]).then(([{ data: c }, { data: o }]) => {
      setCustomers(c || [])
      setOrders(o || [])
    })
  }, [])

  function openCust(c: any) {
    setSelectedCust(c)
    const co = orders.filter(o => o.customer_id === c.id)
    setCustOrders(co.slice(0, 5))
    const sb = createClient()
    sb.from('activities')
      .select('*')
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setCustActs(data || []))
  }

  async function saveActivity() {
    if (!actTitle.trim() || !selectedCust) return
    const sb = createClient()
    const { data } = await sb.from('activities')
      .insert({ customer_id: selectedCust.id, type: actType, title: actTitle, body: actBody, created_by: 'Admin' })
      .select()
      .single()
    if (data) setCustActs(prev => [data, ...prev])
    setActTitle('')
    setActBody('')
    showToast('Aktivitet sparad')
  }

  async function saveCustomer() {
    if (!form.company || !form.contact_name || !form.email) {
      showToast('Fyll i obligatoriska fält')
      return
    }
    const sb = createClient()
    if (editMode && selectedCust) {
      const { data, error } = await sb.from('customers')
        .update({ ...form, birthday: form.birthday || null })
        .eq('id', selectedCust.id)
        .select()
        .single()
      if (error) { showToast('Fel: ' + error.message); return }
      setCustomers(prev => prev.map(c => c.id === selectedCust.id ? data : c).sort((a, b) => a.company.localeCompare(b.company)))
      setSelectedCust(data)
      setEditMode(false)
      showToast('Kund uppdaterad')
    } else {
      const { data, error } = await sb.from('customers')
        .insert({ ...form, birthday: form.birthday || null })
        .select()
        .single()
      if (error) { showToast('Fel: ' + error.message); return }
      setCustomers(prev => [...prev, data].sort((a, b) => a.company.localeCompare(b.company)))
      showToast('Kund skapad: ' + form.company)
    }
    setShowModal(false)
    setForm({ ...EMPTY_FORM })
  }

  function openEditModal(c: any) {
    setForm({
      company: c.company || '', contact_name: c.contact_name || '',
      contact_role: c.contact_role || '', email: c.email || '',
      phone: c.phone || '', city: c.city || '', org_nr: c.org_nr || '',
      price_list_id: c.price_list_id || 'B', status: c.status || 'active',
      birthday: c.birthday || '',
    })
    setEditMode(true)
    setShowModal(true)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const filtered = customers.filter(c =>
    !search ||
    c.company.toLowerCase().includes(search.toLowerCase()) ||
    (c.contact_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalRevenue = (c: any) =>
    orders.filter(o => o.customer_id === c.id && isLiveOrder(o.status)).reduce((s: number, o: any) => s + (o.subtotal || 0), 0)

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: 12, display: 'block' }}>003 / Hantera</span>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '40px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.1 }}>Kunder</div>
        </div>
        <button
          onClick={() => { setEditMode(false); setForm({ ...EMPTY_FORM }); setShowModal(true) }}
          style={{ padding: '9px 18px', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'var(--gold)', border: 'none', borderRadius: 6, color: '#111' }}
        >
          + Ny kund
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Sök kund, företag…"
          style={{ width: '100%', maxWidth: 320, padding: '9px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: '13px', outline: 'none' }}
        />
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text3)' }}>{filtered.length} kunder</span>
      </div>

      {/* Table */}
      <div style={{ padding: '0 40px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Företag', 'Kontakt', 'E-post', 'Prislista', 'Status', 'Ordrar', 'Omsättning'].map(h => (
                <th key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '14px 0', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const orderCount = orders.filter(o => o.customer_id === c.id).length
              const sc  = STATUS_CSS[c.status] || STATUS_CSS.inactive
              const plc = PL_COLORS[c.price_list_id] || PL_COLORS.Standard
              return (
                <tr key={c.id} onClick={() => router.push(`/crm/customers/${c.id}`)} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,.03)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                >
                  <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <strong style={{ fontSize: 13, color: 'var(--text)', display: 'block' }}>{c.company}</strong>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{c.org_nr || ''}</span>
                  </td>
                  <td style={{ padding: '16px 0', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    {c.contact_name}
                    {c.contact_role && <><br /><span style={{ fontSize: 10, color: 'var(--text3)' }}>{c.contact_role}</span></>}
                  </td>
                  <td style={{ padding: '16px 0', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{c.email}</td>
                  <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: plc.bg, color: plc.color }}>{c.price_list_id}</span>
                  </td>
                  <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: sc.bg, color: sc.color }}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px 0', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{orderCount}</td>
                  <td style={{ padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{fmt(totalRevenue(c))} kr</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Customer Side Panel */}
      <div style={{ position: 'fixed', top: '58px', right: 0, bottom: 0, width: 440, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', zIndex: 80, transform: selectedCust ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .28s cubic-bezier(.22,.68,0,1.1)', display: 'flex', flexDirection: 'column' }}>
        {selectedCust && (
          <>
            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: 'var(--text)' }}>{selectedCust.company}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{selectedCust.org_nr || ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openEditModal(selectedCust)} style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Redigera</button>
                <button onClick={() => setSelectedCust(null)} style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              {/* Customer info */}
              <div style={{ marginBottom: 28 }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.04)', display: 'block' }}>Kundinfo</span>
                {[
                  ['Kontakt',   selectedCust.contact_name],
                  ['Roll',      selectedCust.contact_role || '—'],
                  ['E-post',    selectedCust.email],
                  ['Telefon',   selectedCust.phone || '—'],
                  ['Stad',      selectedCust.city || '—'],
                  ['Org.nr',    selectedCust.org_nr || '—'],
                  ['Prislista', selectedCust.price_list_id],
                  ['Status',    STATUS_LABELS[selectedCust.status] || selectedCust.status],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text2)', flexShrink: 0 }}>{k}</span>
                    <strong style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right', marginLeft: 12 }}>{v}</strong>
                  </div>
                ))}
              </div>

              {/* Recent orders */}
              <div style={{ marginBottom: 28 }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.04)', display: 'block' }}>Senaste ordrar</span>
                {custOrders.length === 0
                  ? <p style={{ fontSize: '12px', color: 'var(--text3)' }}>Inga ordrar</p>
                  : custOrders.map(o => (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)' }}>#{o.order_nr}</span>
                      <span style={{ color: 'var(--text2)' }}>{fmt(o.subtotal)} kr</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{o.created_at?.slice(0, 10)}</span>
                    </div>
                  ))
                }
              </div>

              {/* Activity log */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, display: 'block' }}>Aktiviteter</span>

                {/* Type selector */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {(['note', 'call', 'email', 'meeting'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setActType(t)}
                      style={{ padding: '6px 14px', fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500, color: actType === t ? 'var(--text)' : 'var(--text3)', border: '1px solid var(--border)', background: actType === t ? 'rgba(255,255,255,.08)' : 'transparent', cursor: 'pointer', borderRadius: 4 }}
                    >
                      {ACT_ICONS[t]} {t === 'note' ? 'Anteckning' : t === 'call' ? 'Samtal' : t === 'email' ? 'E-post' : 'Möte'}
                    </button>
                  ))}
                </div>

                {/* New activity form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  <input
                    value={actTitle}
                    onChange={e => setActTitle(e.target.value)}
                    placeholder="Rubrik…"
                    style={{ padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 13, outline: 'none' }}
                  />
                  <textarea
                    value={actBody}
                    onChange={e => setActBody(e.target.value)}
                    placeholder="Detaljer (valfritt)…"
                    style={{ padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 56 }}
                  />
                  <button
                    onClick={saveActivity}
                    style={{ padding: '9px 20px', background: 'var(--gold)', color: '#111', border: 'none', borderRadius: 6, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12, cursor: 'pointer', alignSelf: 'flex-end' }}
                  >
                    Spara
                  </button>
                </div>

                {/* Activity list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {custActs.map(a => {
                    const iconBg = a.type === 'note' ? 'rgba(232,184,75,.1)' : a.type === 'call' ? 'rgba(76,175,125,.1)' : a.type === 'email' ? 'rgba(74,143,212,.1)' : 'rgba(180,100,200,.1)'
                    return (
                      <div key={a.id} style={{ display: 'flex', gap: 12, padding: '12px', border: '1px solid rgba(255,255,255,.04)', borderRadius: 6 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, background: iconBg }}>
                          {ACT_ICONS[a.type] || '📝'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>{a.title}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', letterSpacing: '.06em', marginBottom: 4 }}>{a.created_at?.slice(0, 10)}{a.created_by ? ` · ${a.created_by}` : ''}</div>
                          {a.body && <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{a.body}</div>}
                        </div>
                      </div>
                    )
                  })}
                  {custActs.length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)' }}>Inga aktiviteter ännu</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New / Edit Customer Modal */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditMode(false) } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: 20 }}
        >
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500, color: 'var(--text)' }}>{editMode ? 'Redigera kund' : 'Ny kund'}</div>
              <button onClick={() => { setShowModal(false); setEditMode(false) }} style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg3)', border: 'none', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {[
                { label: 'Företag *',       key: 'company',      placeholder: 'AB Bolaget' },
                { label: 'Kontaktperson *', key: 'contact_name', placeholder: 'Anna Lindqvist' },
                { label: 'Roll',            key: 'contact_role', placeholder: 'Inköpschef' },
                { label: 'E-post *',        key: 'email',        placeholder: 'anna@bolaget.se', type: 'email' },
                { label: 'Telefon',         key: 'phone',        placeholder: '+46 70 …' },
                { label: 'Stad',            key: 'city',         placeholder: 'Stockholm' },
                { label: 'Org.nr',          key: 'org_nr',       placeholder: '556123-4567' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Prislista</label>
                  <select value={form.price_list_id} onChange={e => setForm(p => ({ ...p, price_list_id: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none' }}>
                    <option value="Standard">Standard</option>
                    <option value="C">C – Volym</option>
                    <option value="B">B – Återförsäljare</option>
                    <option value="A">A – Partner</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none' }}>
                    <option value="prospect">Prospekt</option>
                    <option value="active">Aktiv</option>
                    <option value="inactive">Inaktiv</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => { setShowModal(false); setEditMode(false) }} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Avbryt</button>
              <button onClick={saveCustomer} style={{ padding: '9px 18px', background: 'var(--gold)', border: 'none', borderRadius: 6, color: '#111', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {editMode ? 'Uppdatera kund' : 'Spara kund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '12px 20px', fontSize: 13, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </div>
  )
}
