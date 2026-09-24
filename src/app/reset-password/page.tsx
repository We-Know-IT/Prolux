'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { userRole } from '@/lib/roles'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Minst 6 tecken.'); return }
    if (password !== confirm) { setError('Lösenorden matchar inte.'); return }
    setLoading(true)
    const supabase = createClient()
    const { data, error: updateErr } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateErr) { setError('Kunde inte spara: ' + updateErr.message); return }
    setDone(true)
    const role = userRole(data.user)
    const path = role === 'admin' ? '/admin/dashboard' : role === 'crm' ? '/crm/dashboard' : '/portal/dashboard'
    const targetHost = role === 'admin' || role === 'crm' ? 'crm.proluxshine.com' : 'www.proluxshine.com'
    const currentHost = window.location.hostname
    const PROD_HOSTS = ['proluxshine.com', 'www.proluxshine.com', 'crm.proluxshine.com']
    const destination = PROD_HOSTS.includes(currentHost) && currentHost !== targetHost
      ? `https://${targetHost}${path}`
      : path
    setTimeout(() => { window.location.href = destination }, 1200)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 8, color: 'var(--text)',
    fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'var(--bg)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(232,184,75,.06) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 36 }}>
          <Image src="/logo-mark.svg" alt="Prolux Shine" width={72} height={100} priority style={{ display: 'block' }} />
        </div>

        <div style={{
          background: 'rgba(13,16,23,.8)',
          backdropFilter: 'saturate(180%) blur(24px)',
          WebkitBackdropFilter: 'saturate(180%) blur(24px)',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 16,
          boxShadow: '0 1px 0 rgba(255,255,255,.05) inset, 0 8px 40px rgba(0,0,0,.5)',
          padding: '32px 28px',
        }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, color: 'var(--text)', marginBottom: 6 }}>
            Välj lösenord
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 28 }}>Sätt ett nytt lösenord för ditt konto</p>

          {done ? (
            <div style={{ fontSize: 13, color: 'var(--green)', background: 'rgba(76,175,125,.08)', border: '1px solid rgba(76,175,125,.2)', borderRadius: 6, padding: '10px 12px' }}>
              Lösenordet är sparat — du skickas vidare…
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.08em' }}>Nytt lösenord</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.08em' }}>Bekräfta lösenord</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="••••••••" style={inp} />
              </div>
              {error && <div style={{ fontSize: 12, color: 'var(--red)', background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.2)', borderRadius: 6, padding: '8px 12px' }}>{error}</div>}
              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px',
                  background: loading ? 'rgba(232,184,75,.5)' : 'linear-gradient(135deg, #E8B84B 0%, #F5CC6A 50%, #D4A33C 100%)',
                  color: '#0D0A00', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14,
                  letterSpacing: '.03em', border: 'none', borderRadius: 8, cursor: loading ? 'default' : 'pointer',
                }}
              >
                {loading ? 'Sparar…' : 'Spara lösenord'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
