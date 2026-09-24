'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// Keeps a view in sync across devices: re-runs `refetch` when any of `tables`
// changes (Supabase Realtime) and when the tab/app regains focus — the latter
// covers devices that slept or lost their realtime connection.
export function useLiveRefresh(tables: string[], refetch: () => void) {
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch
  const key = tables.join(',')

  useEffect(() => {
    const sb = createClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    // Debounced: a bulk write, or focus + visibilitychange firing together, triggers one refetch.
    const trigger = () => {
      clearTimeout(timer)
      timer = setTimeout(() => refetchRef.current(), 300)
    }

    const channel = sb.channel(`live:${key}:${Math.random().toString(36).slice(2)}`)
    for (const table of key.split(',')) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, trigger)
    }
    channel.subscribe()

    const onVisible = () => { if (document.visibilityState === 'visible') trigger() }
    window.addEventListener('focus', trigger)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', trigger)
      document.removeEventListener('visibilitychange', onVisible)
      sb.removeChannel(channel)
    }
  }, [key])
}
