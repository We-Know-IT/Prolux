import type { User } from '@supabase/supabase-js'

export type AppRole = 'admin' | 'crm' | 'portal'

// A user's role. It lives in app_metadata, which only the database can set
// (from staff_members, see migration 0010); user_metadata can be edited by
// the user and is only read for accounts that predate that migration.
export function userRole(user: Pick<User, 'app_metadata' | 'user_metadata'> | null | undefined): AppRole {
  const role = user?.app_metadata?.role ?? user?.user_metadata?.role
  return role === 'admin' || role === 'crm' ? role : 'portal'
}
