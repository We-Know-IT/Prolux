import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CrmShell from '@/components/layout/CrmShell'
import { AdminShell } from '@/components/layout/AdminShell'
import { crmAppMetadata, crmAppViewport } from '@/lib/app-metadata'

export const metadata = crmAppMetadata
export const viewport = crmAppViewport

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const role = user.user_metadata?.role
  if (role !== 'crm' && role !== 'admin') redirect('/login')
  if (role === 'admin') return <AdminShell email={user.email || ''}>{children}</AdminShell>
  return <CrmShell>{children}</CrmShell>
}
