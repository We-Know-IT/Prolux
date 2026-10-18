'use client'
// Search plus filters on city and salesperson, shared by the customer lists
// in the CRM and in admin.
import { useState } from 'react'

interface Filterable {
  company: string
  contact_name?: string | null
  city?: string | null
  org_nr?: string | null
  email?: string | null
  account_manager?: string | null
}

const cityKey = (v?: string | null) => (v || '').trim().toLowerCase()

export function useCustomerFilters<T extends Filterable>(customers: T[]) {
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [manager, setManager] = useState('')

  const q = search.trim().toLowerCase()
  const filtered = customers.filter(c =>
    (!city || cityKey(c.city) === city) &&
    (!manager || (manager === '-' ? !c.account_manager : c.account_manager === manager)) &&
    (!q || [c.company, c.contact_name, c.city, c.org_nr, c.email].some(v => (v || '').toLowerCase().includes(q))))

  // Cities and salespeople that occur among the customers.
  const cities = [...customers.reduce((m, c) => {
    const k = cityKey(c.city)
    if (k) m.set(k, { label: m.get(k)?.label || (c.city || '').trim(), count: (m.get(k)?.count ?? 0) + 1 })
    return m
  }, new Map<string, { label: string; count: number }>())].sort((a, b) => a[1].label.localeCompare(b[1].label, 'sv'))
  const managers = [...new Set(customers.map(c => c.account_manager).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'sv'))

  const active = !!(search || city || manager)
  const clear = () => { setSearch(''); setCity(''); setManager('') }

  const select = (on: boolean): React.CSSProperties => ({
    padding: '9px 12px', background: on ? 'rgba(232,184,75,.1)' : 'var(--bg3)', border: `1px solid ${on ? 'rgba(232,184,75,.4)' : 'var(--line)'}`,
    borderRadius: 9, color: 'var(--text)', fontSize: 13, cursor: 'pointer', outline: 'none', maxWidth: '100%',
  })
  const filters = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <select aria-label="Filtrera på stad" value={city} onChange={e => setCity(e.target.value)} style={select(!!city)}>
        <option value="">Alla städer</option>
        {cities.map(([k, { label, count }]) => <option key={k} value={k}>{label} ({count})</option>)}
      </select>
      <select aria-label="Filtrera på säljare" value={manager} onChange={e => setManager(e.target.value)} style={select(!!manager)}>
        <option value="">Alla säljare</option>
        {managers.map(m => <option key={m} value={m}>{m}</option>)}
        <option value="-">Utan säljare</option>
      </select>
      {active && (
        <button type="button" onClick={clear} style={{ padding: '8px 10px', background: 'transparent', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Rensa</button>
      )}
    </div>
  )

  return { search, setSearch, filtered, filters, active }
}
