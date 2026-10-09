import type { AuthError } from '@supabase/supabase-js'

// Why a login failed, in Swedish, so people know what to fix.
export function loginErrorMessage(error: AuthError): string {
  const code = (error as AuthError & { code?: string }).code || ''
  const msg = error.message.toLowerCase()
  if (code === 'email_not_confirmed' || msg.includes('not confirmed'))
    return 'E-postadressen är inte bekräftad ännu. Klicka på länken i bekräftelsemejlet (eller bekräfta kontot i Supabase).'
  if (code === 'invalid_credentials' || msg.includes('invalid login'))
    return 'Fel e-post eller lösenord. Kontrollera stavningen och försök igen.'
  if (code === 'user_banned') return 'Kontot är spärrat. Kontakta en administratör.'
  if (error.status === 429 || msg.includes('rate limit')) return 'För många försök. Vänta en stund och försök igen.'
  return `Inloggningen misslyckades: ${error.message}`
}
