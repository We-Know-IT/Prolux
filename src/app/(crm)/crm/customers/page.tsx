'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/types'
import { formatDate } from '@/lib/utils'
import { Plus, Search, Bell, Mail, ChevronRight, Phone } from 'lucide-react'
import Link from 'next/link'
import { useLiveRefresh } from '@/hooks/useLiveRefresh'
import { SALESPEOPLE, salespersonName } from '@/lib/team'

const supabase = createClient()

export default function CrmCustomersPage() {
  const router = useRouter()
  const [customers, setCustomers]     = useState<Customer[]>([])
  const [allReminders, setAllReminders] = useState<{ customer_id: string; due_date: string }[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [myName, setMyName] = useState('')
  const [newCustomerForm, setNewCustomerForm] = useState({ company: '', contact_name: '', email: '', phone: '', city: '', org_nr: '', price_list_id: 'Standard', account_manager: '' })
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [toast, setToast]             = useState('')

  const today = new Date().toISOString().slice(0, 10)

  function loadData() {
    Promise.all([
      supabase.from('customers').select('id,company,contact_name,email,phone,city,org_nr,price_list_id,status,last_order_at,account_manager,created_at').order('company'),
      supabase.from('reminders').select('customer_id,due_date').eq('status', 'upcoming'),
    ]).then(([{ data: c }, { data: r }]) => {
      if (c) setCustomers(c as Customer[])
      if (r) setAllReminders(r as any[])
      setLoading(false)
    })
  }

  useEffect(() => {
    loadData()
    // New customers default to the salesperson creating them.
    supabase.auth.getUser().then(({ data: { user } }) => {
      const me = salespersonName(user)
      setMyName(me)
      setNewCustomerForm(f => ({ ...f, account_manager: f.account_manager || me }))
    })
  }, [])
  useLiveRefresh(['customers', 'reminders'], loadData)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function saveNewCustomer() {
    if (!newCustomerForm.company.trim() || !newCustomerForm.email.trim()) return
    setSavingCustomer(true)
    const { data, error } = await supabase.from('customers').insert({
      ...newCustomerForm,
      account_manager: newCustomerForm.account_manager || null,
      status: 'active',
    }).select().single()
    if (!error && data) {
      setCustomers(cs => [...cs, data].sort((a, b) => a.company.localeCompare(b.company)))
      setShowNewCustomer(false)
      setNewCustomerForm({ company: '', contact_name: '', email: '', phone: '', city: '', org_nr: '', price_list_id: 'Standard', account_manager: myName })
      showToast('Kund skapad!')
    } else {
      showToast('Fel: ' + (error?.message || 'Kunde inte spara'))
    }
    setSavingCustomer(false)
  }

  const filtered = customers.filter(c =>
    !search ||
    c.company.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name.toLowerCase().includes(search.toLowerCase())
  )

  const PL_BADGE_COLOR: Record<string, string> = {
    A: 'rgba(76,175,125,.15)', B: 'rgba(74,143,212,.12)', C: 'rgba(155,110,232,.12)', Standard: 'rgba(255,255,255,.06)'
  }
  const PL_TEXT_COLOR: Record<string, string> = {
    A: 'var(--green)', B: 'var(--blue)', C: '#9B6EE8', Standard: 'var(--text3)'
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Kunder</h1>
          {!loading && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>{customers.length} kunder totalt</p>}
        </div>
        <button onClick={() => setShowNewCustomer(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          <Plus size={14} /> Ny kund
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input
          placeholder="Sök företag eller kontaktperson..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '11px 14px 11px 36px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Customer list */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '8px 0' }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg4)', flexShrink: 0, animation: 'pulse 1.5s ease infinite' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 14, width: `${40 + i * 8}%`, background: 'var(--bg4)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s ease infinite' }} />
                  <div style={{ height: 11, width: '60%', background: 'var(--bg4)', borderRadius: 4, opacity: 0.5, animation: 'pulse 1.5s ease infinite' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
            {search ? 'Inga kunder matchar sökningen' : 'Inga kunder'}
          </div>
        ) : filtered.map((c, i) => {
          const overdueCount = allReminders.filter(r => r.customer_id === c.id && r.due_date < today).length
          return (
            <div key={c.id} onClick={() => router.push(`/crm/customers/${c.id}`)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
              borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none',
              background: 'transparent', transition: 'background .1s', cursor: 'pointer',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,.03)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
            >
              {/* Avatar */}
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: PL_BADGE_COLOR[c.price_list_id], border: `1px solid ${PL_TEXT_COLOR[c.price_list_id]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: PL_TEXT_COLOR[c.price_list_id], flexShrink: 0 }}>
                {c.company[0]}
              </div>

              {/* Main info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</span>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: PL_BADGE_COLOR[c.price_list_id], color: PL_TEXT_COLOR[c.price_list_id], fontWeight: 700, flexShrink: 0 }}>{c.price_list_id}</span>
                  {overdueCount > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(224,82,82,.15)', border: '1px solid rgba(224,82,82,.25)', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>
                      <Bell size={9} /> {overdueCount}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>{c.contact_name}</span>
                  {c.city && <span>📍 {c.city}</span>}
                  <span style={{ color: c.account_manager ? undefined : 'var(--red)' }}>👤 {c.account_manager || 'Ingen kundansvarig'}</span>
                  {c.last_order_at && <span>Senast: {formatDate(c.last_order_at)}</span>}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {c.phone && (
                  <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 7, background: 'rgba(76,175,125,.1)', border: '1px solid rgba(76,175,125,.2)', color: 'var(--green)', textDecoration: 'none' }}>
                    <Phone size={13} />
                  </a>
                )}
                <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 7, background: 'rgba(74,143,212,.1)', border: '1px solid rgba(74,143,212,.2)', color: 'var(--blue)', textDecoration: 'none' }}>
                  <Mail size={13} />
                </a>
                <Link href={`/crm/customers/${c.id}`} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 7, background: 'rgba(232,184,75,.1)', border: '1px solid rgba(232,184,75,.2)', color: 'var(--gold)', textDecoration: 'none' }}>
                  <ChevronRight size={15} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', padding: '12px 20px', fontSize: 13, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)' }} />
          {toast}
        </div>
      )}

      {/* New customer modal */}
      {showNewCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 520 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, color: 'var(--text)', marginBottom: 24 }}>Ny kund</div>

            {[
              { label: 'Företagsnamn *', key: 'company', placeholder: 'AB Bilservice', type: 'text' },
              { label: 'Kontaktperson *', key: 'contact_name', placeholder: 'Erik Lindgren', type: 'text' },
              { label: 'E-post *', key: 'email', placeholder: 'erik@foretag.se', type: 'email' },
              { label: 'Telefon', key: 'phone', placeholder: '08-123 45 67', type: 'tel' },
              { label: 'Stad', key: 'city', placeholder: 'Stockholm', type: 'text' },
              { label: 'Org.nr', key: 'org_nr', placeholder: '556123-4567', type: 'text' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>
                <input
                  type={type}
                  value={(newCustomerForm as any)[key]}
                  onChange={e => setNewCustomerForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '9px 13px', background: 'var(--bg4)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Prislista</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['A', 'B', 'C', 'Standard'].map(pl => (
                  <button key={pl} onClick={() => setNewCustomerForm(f => ({ ...f, price_list_id: pl }))}
                    style={{ flex: 1, padding: '8px 4px', background: newCustomerForm.price_list_id === pl ? 'rgba(232,184,75,.1)' : 'var(--bg3)', border: `1px solid ${newCustomerForm.price_list_id === pl ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 8, color: newCustomerForm.price_list_id === pl ? 'var(--gold)' : 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {pl}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                {newCustomerForm.price_list_id === 'A' ? 'Platinum — 40% rabatt' : newCustomerForm.price_list_id === 'B' ? 'Gold — 30% rabatt' : newCustomerForm.price_list_id === 'C' ? 'Silver — 20% rabatt' : 'Utan rabatt (listavis)'}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Kundansvarig</label>
              <select value={newCustomerForm.account_manager} onChange={e => setNewCustomerForm(f => ({ ...f, account_manager: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' }}>
                <option value="">— Ingen —</option>
                {SALESPEOPLE.map(sp => <option key={sp} value={sp}>{sp}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowNewCustomer(false)} style={{ flex: 1, padding: 11, background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
                Avbryt
              </button>
              <button onClick={saveNewCustomer} disabled={savingCustomer || !newCustomerForm.company || !newCustomerForm.email}
                style={{ flex: 2, padding: 11, background: 'var(--gold)', color: '#111', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (savingCustomer || !newCustomerForm.company || !newCustomerForm.email) ? 0.6 : 1 }}>
                {savingCustomer ? 'Sparar…' : 'Skapa kund'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .4 } }
      `}</style>
    </div>
  )
}
