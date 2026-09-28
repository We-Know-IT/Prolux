'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SALESPEOPLE_FALLBACK, firstNameOf } from '@/lib/team'

// Salespeople (first names) from Personal in admin: everyone with the admin
// or CRM role. Fetched once and shared by every view that needs the list.
let cache: Promise<string[]> | null = null

function loadTeam(): Promise<string[]> {
  if (!cache) {
    cache = Promise.resolve(createClient().from('staff_members').select('full_name,email,role').order('full_name'))
      .then(({ data }) => {
        const names = (data || [])
          .filter(s => s.role === 'admin' || s.role === 'crm')
          .map(s => firstNameOf(s.full_name, s.email))
          .filter(Boolean)
        const unique = [...new Set(names)]
        // Until migration 0014 lets salespeople read Personal, keep the old list.
        return unique.length ? unique : [...SALESPEOPLE_FALLBACK]
      })
      .catch(() => { cache = null; return [...SALESPEOPLE_FALLBACK] })
  }
  return cache
}

export function useTeam(): string[] {
  const [team, setTeam] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    loadTeam().then(t => { if (alive) setTeam(t) })
    return () => { alive = false }
  }, [])
  return team
}

// Options for a salesperson picker: the team, plus the current value if that
// person is no longer in Personal (so the existing choice still shows).
export function teamOptions(team: string[], current?: string | null) {
  return current && !team.includes(current) ? [...team, current] : team
}
