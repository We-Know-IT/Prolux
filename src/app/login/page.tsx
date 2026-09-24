'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { userRole } from '@/lib/roles'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMsg, setForgotMsg]     = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setForgotLoading(true)
    setForgotMsg('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    setForgotLoading(false)
    if (error) setForgotMsg('Något gick fel: ' + error.message)
    else setForgotMsg('Om adressen finns hos oss har vi skickat en återställningslänk till din e-post.')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Fel lösenord eller e-post. Försök igen.'); setLoading(false); return }
    const role = userRole(data.user)
    const path = role === 'admin' ? '/admin/dashboard' : role === 'crm' ? '/crm/dashboard' : '/portal/dashboard'
    const targetHost = role === 'admin' || role === 'crm' ? 'crm.proluxshine.com' : 'www.proluxshine.com'
    const currentHost = window.location.hostname
    const PROD_HOSTS = ['proluxshine.com', 'www.proluxshine.com', 'crm.proluxshine.com']
    window.location.href = PROD_HOSTS.includes(currentHost) && currentHost !== targetHost
      ? `https://${targetHost}${path}`
      : path
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 8, color: 'var(--text)',
    fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'var(--bg)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(232,184,75,.06) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 36 }}>
          <Image src="/logo-mark.svg" alt="Prolux Shine" width={72} height={100} priority style={{ display: 'block' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, letterSpacing: '.18em', color: 'var(--text)', textTransform: 'uppercase' }}>Prolux</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, letterSpacing: '.45em', color: 'var(--gold)', textTransform: 'uppercase' }}>Shine</span>
          </div>
        </div>

        {/* Glass card */}
        <div style={{
          background: 'rgba(13,16,23,.8)',
          backdropFilter: 'saturate(180%) blur(24px)',
          WebkitBackdropFilter: 'saturate(180%) blur(24px)',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 16,
          boxShadow: '0 1px 0 rgba(255,255,255,.05) inset, 0 8px 40px rgba(0,0,0,.5)',
          padding: '32px 28px',
        }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, color: 'var(--text)', marginBottom: 6, letterSpacing: '-.01em' }}>
            {forgotMode ? 'Återställ lösenord' : 'Logga in'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 28 }}>
            {forgotMode ? 'Ange din e-post för att få en återställningslänk' : 'B2B-portal för återförsäljare'}
          </p>

          {forgotMode ? (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.08em' }}>E-post</label>
                <input
                  type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required
                  placeholder="namn@foretag.se"
                  style={inp}
                />
              </div>
              {forgotMsg && <div style={{ fontSize: 12, color: 'var(--text2)', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, padding: '8px 12px' }}>{forgotMsg}</div>}
              <button
                type="submit" disabled={forgotLoading}
                style={{
                  width: '100%', padding: '13px',
                  background: forgotLoading ? 'rgba(232,184,75,.5)' : 'linear-gradient(135deg, #E8B84B 0%, #F5CC6A 50%, #D4A33C 100%)',
                  color: '#0D0A00', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14,
                  letterSpacing: '.03em', border: 'none', borderRadius: 8, cursor: forgotLoading ? 'default' : 'pointer',
                  boxShadow: forgotLoading ? 'none' : '0 2px 16px rgba(232,184,75,.3)',
                  transition: 'all .18s',
                }}
              >
                {forgotLoading ? 'Skickar…' : 'Skicka återställningslänk'}
              </button>
              <button
                type="button" onClick={() => { setForgotMode(false); setForgotMsg('') }}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}
              >
                ← Tillbaka till inloggning
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.08em' }}>E-post</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="namn@foretag.se"
                  style={inp}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,.35)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,184,75,.08)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Lösenord</label>
                  <button
                    type="button" onClick={() => { setForgotMode(true); setForgotEmail(email); setError('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}
                  >
                    Glömt lösenord?
                  </button>
                </div>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  style={inp}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,.35)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,184,75,.08)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
              {error && <div style={{ fontSize: 12, color: 'var(--red)', background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.2)', borderRadius: 6, padding: '8px 12px' }}>{error}</div>}
              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px',
                  background: loading ? 'rgba(232,184,75,.5)' : 'linear-gradient(135deg, #E8B84B 0%, #F5CC6A 50%, #D4A33C 100%)',
                  color: '#0D0A00', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14,
                  letterSpacing: '.03em', border: 'none', borderRadius: 8, cursor: loading ? 'default' : 'pointer',
                  boxShadow: loading ? 'none' : '0 2px 16px rgba(232,184,75,.3)',
                  transition: 'all .18s',
                }}
              >
                {loading ? 'Loggar in…' : 'Logga in'}
              </button>
            </form>
          )}
        </div>

        {/* Demo hint */}
        <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Demo-konton · lösenord: <span style={{ color: 'var(--gold)' }}>prolux2024</span></div>
          {[
            { email: 'bashar@proluxshine.se',    role: 'Admin',   color: '#E8B84B' },
            { email: 'stefan@detailingproffs.se', role: 'Säljare', color: '#4A8FD4' },
            { email: 'demo@proluxshine.se',       role: 'Kund',    color: '#4CAF7D' },
          ].map(({ email, role, color }) => (
            <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text2)' }}>{email}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${color}18`, color }}>{role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
