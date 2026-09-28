'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { currentStaff, type Me } from '@/lib/team'

// The logged-in staff member (name, role). `loaded` is false until known,
// so views never act on a placeholder identity.
export function useMe(): Me & { loaded: boolean } {
  const [me, setMe] = useState<Me & { loaded: boolean }>({ user: null, name: '', role: 'portal', isAdmin: false, loaded: false })
  useEffect(() => {
    let alive = true
    currentStaff(createClient()).then(m => { if (alive) setMe({ ...m, loaded: true }) })
    return () => { alive = false }
  }, [])
  return me
}
