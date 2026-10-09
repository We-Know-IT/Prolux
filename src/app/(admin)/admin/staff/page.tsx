'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, Trash2, Shield, User, Briefcase, Copy, Check, RefreshCw } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Role = 'admin' | 'crm' | 'portal'

interface StaffMember {
  id: string
  email: string
  full_name: string
  role: Role
  created_at: string
}

const ROLE_LABEL: Record<Role, string>            = { admin: 'Administratör', crm: 'Säljare (CRM)', portal: 'Kund (Portal)' }
const ROLE_COLOR: Record<Role, string>            = { admin: '#E8B84B', crm: '#4A8FD4', portal: '#4CAF7D' }
const ROLE_ICON:  Record<Role, React.ElementType> = { admin: Shield, crm: Briefcase, portal: User }

// A new random start password per account (no shared, guessable password).
function startPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

const supabase = createClient()

export default function StaffPage() {
  const [staff, setStaff]               = useState<StaffMember[]>([])
  const [loading, setLoading]           = useState(true)
  const [showInvite, setShowInvite]     = useState(false)
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteName, setInviteName]     = useState('')
  const [inviteRole, setInviteRole]     = useState<Role>('crm')
  const [inviting, setInviting]         = useState(false)
  const [inviteDone, setInviteDone]     = useState(false)
  const [inviteError, setInviteError]   = useState('')
  const [copied, setCopied]             = useState(false)
  const [password, setPassword]         = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting]         = useState<string | null>(null)

  async function loadStaff() {
    setLoading(true)
    const { data } = await supabase.from('staff_members').select('*').order('created_at')
    if (data) setStaff(data as StaffMember[])
    setLoading(false)
  }

  useEffect(() => { loadStaff() }, [])

  async function handleInvite() {
    if (!inviteEmail || !inviteName) return
    setInviting(true)
    setInviteError('')
    const pw = startPassword()

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setInviteError('Inte inloggad.'); setInviting(false); return }

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-staff-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role: inviteRole, password: pw }),
    })

    const json = await res.json()
    if (!res.ok) {
      setInviteError(json.error || 'Något gick fel.')
    } else {
      setPassword(pw)
      setInviteDone(true)
      await loadStaff()
    }
    setInviting(false)
  }

  async function handleDelete(id: string, email: string) {
    if (deleteConfirm !== id) { setDeleteConfirm(id); return }
    setDeleting(id)
    await supabase.from('staff_members').delete().eq('id', id)
    setStaff(s => s.filter(m => m.id !== id))
    setDeleteConfirm(null)
    setDeleting(null)
  }

  function resetInvite() {
    setShowInvite(false)
    setInviteEmail('')
    setInviteName('')
    setInviteRole('crm')
    setInviteDone(false)
    setInviteError('')
    setPassword('')
  }

  function copyPassword() {
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ padding: '32px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 500, color: 'var(--text)', margin: 0 }}>
            Medarbetare
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '4px' }}>
            Hantera ditt team — bjud in säljare, admins och portalanvändare
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={loadStaff} style={{ padding: '9px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} /> Uppdatera
          </button>
          <button onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: 'var(--gold)', color: '#111', border: 'none', borderRadius: '8px', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
            <UserPlus size={15} /> Lägg till medarbetare
          </button>
        </div>
      </div>

      {/* Role legend */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {(Object.keys(ROLE_LABEL) as Role[]).map(r => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--bg3)', borderRadius: '20px', fontSize: '12px', color: 'var(--text2)' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: ROLE_COLOR[r], display: 'inline-block' }} />
            {ROLE_LABEL[r]}
          </div>
        ))}
      </div>

      {/* Staff table */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 140px 100px', padding: '10px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          <span>Namn / E-post</span><span>Roll</span><span>Tillagd</span><span style={{ textAlign: 'right' }}>Åtgärd</span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>Laddar...</div>
        ) : staff.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>Inga medarbetare ännu.</div>
        ) : staff.map((member, i) => {
          const RoleIcon = ROLE_ICON[member.role]
          return (
            <div key={member.id} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 140px 100px', padding: '14px 20px', borderBottom: i < staff.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{member.full_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{member.email}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RoleIcon size={13} style={{ color: ROLE_COLOR[member.role] }} />
                <span style={{ fontSize: '12px', color: ROLE_COLOR[member.role], fontWeight: 500 }}>{ROLE_LABEL[member.role]}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{formatDate(member.created_at)}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => handleDelete(member.id, member.email)}
                  disabled={deleting === member.id}
                  style={{ padding: '5px 10px', background: deleteConfirm === member.id ? 'rgba(224,82,82,.15)' : 'var(--bg3)', border: `1px solid ${deleteConfirm === member.id ? 'rgba(224,82,82,.4)' : 'var(--border)'}`, borderRadius: '6px', color: deleteConfirm === member.id ? '#E05252' : 'var(--text3)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Trash2 size={12} />
                  {deleteConfirm === member.id ? 'Bekräfta?' : 'Ta bort'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: 'var(--text)', marginBottom: '6px' }}>
              Lägg till medarbetare
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '24px' }}>
              Kontot skapas direkt med ett slumpat startlösenord som visas en gång. Be personen byta lösenord efter första inloggningen.
            </div>

            {!inviteDone ? (
              <>
                {inviteError && (
                  <div style={{ padding: '12px 14px', background: 'rgba(224,82,82,.1)', border: '1px solid rgba(224,82,82,.3)', borderRadius: '8px', color: '#E05252', fontSize: '13px', marginBottom: '16px' }}>
                    {inviteError}
                  </div>
                )}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text2)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Namn</label>
                  <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Förnamn Efternamn"
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '14px', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text2)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>E-postadress</label>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="namn@foretag.se"
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '14px', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text2)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Roll</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {(Object.keys(ROLE_LABEL) as Role[]).map(r => {
                      const RIcon = ROLE_ICON[r]
                      const active = inviteRole === r
                      return (
                        <button key={r} onClick={() => setInviteRole(r)}
                          style={{ flex: 1, padding: '12px 8px', background: active ? 'rgba(232,184,75,.08)' : 'var(--bg3)', border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`, borderRadius: '8px', color: active ? 'var(--gold)' : 'var(--text3)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: active ? 600 : 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <RIcon size={16} style={{ color: active ? 'var(--gold)' : ROLE_COLOR[r] }} />
                          {r === 'admin' ? 'Admin' : r === 'crm' ? 'Säljare' : 'Kund'}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text3)' }}>
                    {inviteRole === 'admin' && 'Full tillgång — produkter, ordrar, kunder och medarbetare.'}
                    {inviteRole === 'crm'   && 'CRM-systemet — pipeline, kundkort och orderläggning.'}
                    {inviteRole === 'portal' && 'Kundportalen — produktkatalog och orderhistorik.'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={resetInvite} style={{ flex: 1, padding: '11px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', fontFamily: 'var(--font-sans)', fontSize: '13px', cursor: 'pointer' }}>
                    Avbryt
                  </button>
                  <button onClick={handleInvite} disabled={inviting || !inviteEmail || !inviteName}
                    style={{ flex: 2, padding: '11px', background: 'var(--gold)', color: '#111', border: 'none', borderRadius: '8px', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '13px', cursor: (inviting || !inviteEmail || !inviteName) ? 'not-allowed' : 'pointer', opacity: (inviting || !inviteEmail || !inviteName) ? 0.6 : 1 }}>
                    {inviting ? 'Skapar konto…' : 'Skapa konto'}
                  </button>
                </div>
              </>
            ) : (
              <div>
                <div style={{ padding: '16px', background: 'rgba(76,175,125,.08)', border: '1px solid rgba(76,175,125,.25)', borderRadius: '10px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#4CAF7D', marginBottom: '8px' }}>✓ Konto skapat!</div>
                  <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px' }}>
                    <strong style={{ color: 'var(--text)' }}>{inviteName}</strong> ({inviteEmail}) kan nu logga in med startlösenordet nedan. Det visas bara nu — kopiera och skicka det säkert:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1, padding: '10px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '16px', fontFamily: 'monospace', color: 'var(--text)', letterSpacing: '.08em' }}>
                      {password}
                    </div>
                    <button onClick={copyPassword}
                      style={{ padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: copied ? '#4CAF7D' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                      {copied ? <><Check size={13} /> Kopierat!</> : <><Copy size={13} /> Kopiera</>}
                    </button>
                  </div>
                </div>
                <button onClick={resetInvite}
                  style={{ width: '100%', padding: '12px', background: 'var(--gold)', color: '#111', border: 'none', borderRadius: '8px', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                  Stäng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
