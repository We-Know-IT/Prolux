import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookieDomainForHost } from '@/lib/supabase/cookie-domain'
import { userRole } from '@/lib/roles'

// Same codebase, same deployment — split crm/admin from the webshop by hostname.
const CRM_HOSTS = ['crm.proluxshine.com']
const WWW_HOSTS = ['proluxshine.com', 'www.proluxshine.com']

// Paths allowed to load on crm.proluxshine.com without a redirect.
// Admin/CMS lives here too — Bashar's team manages products, orders etc.
// from crm.proluxshine.com, and since it's the same Supabase database,
// changes show up on www.proluxshine.com immediately.
const CRM_ALLOWED_PREFIXES = ['/crm', '/admin', '/login', '/auth', '/reset-password']

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase().split(':')[0] ?? ''
  const { pathname, search } = request.nextUrl

  // Local dev / preview deployments (e.g. *.vercel.app) skip domain routing.
  const isCrmHost = CRM_HOSTS.includes(host)
  const isWwwHost = WWW_HOSTS.includes(host)

  if (isCrmHost) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/crm/dashboard', request.url))
    }
    const allowed = CRM_ALLOWED_PREFIXES.some(p => pathname.startsWith(p))
    if (!allowed) {
      return NextResponse.redirect(new URL(`https://www.proluxshine.com${pathname}${search}`))
    }
  }

  if (isWwwHost && (pathname.startsWith('/crm') || pathname.startsWith('/admin'))) {
    return NextResponse.redirect(new URL(`https://crm.proluxshine.com${pathname}${search}`))
  }

  let supabaseResponse = NextResponse.next({ request })

  const cookieDomain = cookieDomainForHost(host)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, cookieDomain ? { ...options, domain: cookieDomain } : options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const role: string | undefined = userRole(user)

  // Redirect logged-in users away from login
  if (pathname === '/login' && user) {
    if (role === 'admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    if (role === 'crm')   return NextResponse.redirect(new URL('/crm/dashboard', request.url))
    return NextResponse.redirect(new URL('/portal/dashboard', request.url))
  }

  // Protect all app routes
  const protectedPaths = ['/portal', '/admin', '/crm']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))
  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based access control
  if (user && pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && pathname.startsWith('/crm') && role !== 'admin' && role !== 'crm') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

// Static files from /public (images, the PWA manifest, service worker and
// offline page) skip the proxy: browsers fetch the manifest without cookies,
// so running auth on it would hand them the login page instead.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|json|html)$).*)'],
}
