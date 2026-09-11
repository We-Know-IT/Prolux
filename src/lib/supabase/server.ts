import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { cookieDomainForHost } from './cookie-domain'

export async function createClient() {
  const cookieStore = await cookies()
  const host = (await headers()).get('host')?.split(':')[0] ?? ''
  const domain = cookieDomainForHost(host)
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, domain ? { ...options, domain } : options)
            )
          } catch {}
        },
      },
    }
  )
}
