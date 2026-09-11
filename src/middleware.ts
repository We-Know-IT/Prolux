import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Same codebase, same deployment — split by hostname instead of by repo.
const CRM_HOSTS = ['crm.proluxshine.com']
const WWW_HOSTS = ['proluxshine.com', 'www.proluxshine.com']

// Paths allowed to load on crm.proluxshine.com without a redirect.
// Admin/CMS lives here too — Bashar's team manages products, orders etc.
// from crm.proluxshine.com, and since it's the same Supabase database,
// changes show up on www.proluxshine.com immediately.
const CRM_ALLOWED_PREFIXES = ['/crm', '/admin', '/login', '/auth']

export function middleware(req: NextRequest) {
  const host = req.headers.get('host')?.toLowerCase().split(':')[0] ?? ''
  const { pathname, search } = req.nextUrl

  // Local dev / preview deployments (e.g. *.vercel.app) are untouched.
  const isCrmHost = CRM_HOSTS.includes(host)
  const isWwwHost = WWW_HOSTS.includes(host)
  if (!isCrmHost && !isWwwHost) return NextResponse.next()

  if (isCrmHost) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/crm/dashboard', req.url))
    }
    const allowed = CRM_ALLOWED_PREFIXES.some(p => pathname.startsWith(p))
    if (!allowed) {
      return NextResponse.redirect(new URL(`https://www.proluxshine.com${pathname}${search}`))
    }
  }

  if (isWwwHost) {
    if (pathname.startsWith('/crm') || pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL(`https://crm.proluxshine.com${pathname}${search}`))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
