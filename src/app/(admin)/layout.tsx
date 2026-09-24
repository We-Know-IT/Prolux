import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/layout/AdminShell'
import { crmAppMetadata, crmAppViewport } from '@/lib/app-metadata'

export const metadata = crmAppMetadata
export const viewport = crmAppViewport

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const email = user.email || ''
  return <AdminShell email={email}>{children}</AdminShell>
}
