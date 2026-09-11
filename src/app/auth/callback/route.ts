import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.exchangeCodeForSession(code)
    const role = user?.user_metadata?.role
    const path = role === 'admin' ? '/admin/dashboard' : role === 'crm' ? '/crm/dashboard' : '/portal/dashboard'
    const targetHost = role === 'admin' || role === 'crm' ? 'crm.proluxshine.com' : 'www.proluxshine.com'
    const currentHost = new URL(origin).hostname
    const PROD_HOSTS = ['proluxshine.com', 'www.proluxshine.com', 'crm.proluxshine.com']
    const destination = PROD_HOSTS.includes(currentHost) && currentHost !== targetHost
      ? `https://${targetHost}${path}`
      : `${origin}${path}`
    return NextResponse.redirect(destination)
  }

  return NextResponse.redirect(`${origin}/login`)
}
