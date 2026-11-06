'use client'
// E-mail from the company's own mailbox at one.com (SMTP): order
// confirmations, order notices to the seller and the automations all send
// with these settings (email_config). Only admins can read or change them.
import { useEffect, useState } from 'react'
import { Mail, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Form { from_name: string; from_email: string; smtp_host: string; smtp_port: string; smtp_user: string; password: string }

export default function EmailSettings({ card }: { card: React.CSSProperties }) {
  const sb = createClient()
  const [form, setForm] = useState<Form>({ from_name: 'ProLuxShine', from_email: '', smtp_host: 'send.one.com', smtp_port: '465', smtp_user: '', password: '' })
  const [exists, setExists] = useState(false)
  const [provider, setProvider] = useState<string | null>(null)
  const [hasPassword, setHasPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    sb.from('email_config').select('provider,from_name,from_email,smtp_host,smtp_port,smtp_user,smtp_password').eq('id', 'default').maybeSingle()
      .then(({ data }) => {
        if (!data) { setProvider('pending'); return }
        setExists(true)
        setProvider(data.provider)
        setHasPassword(!!data.smtp_password)
        setForm(f => ({
          ...f,
          from_name: data.from_name || f.from_name,
          from_email: data.from_email || '',
          smtp_host: data.smtp_host || f.smtp_host,
          smtp_port: data.smtp_port ? String(data.smtp_port) : f.smtp_port,
          smtp_user: data.smtp_user || '',
        }))
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => { setForm(f => ({ ...f, [k]: e.target.value })); setMsg(null) }

  async function save() {
    const email = form.from_email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) { setMsg({ ok: false, text: 'Fyll i en giltig avsändaradress, t.ex. order@proluxshine.com.' }); return }
    if (!hasPassword && !form.password) { setMsg({ ok: false, text: 'Fyll i lösenordet till e-postkontot.' }); return }
    setBusy(true); setMsg(null)
    const patch: Record<string, unknown> = {
      provider: 'smtp',
      from_name: form.from_name.trim() || 'ProLuxShine',
      from_email: email,
      smtp_host: form.smtp_host.trim() || 'send.one.com',
      smtp_port: parseInt(form.smtp_port, 10) || 465,
      smtp_user: form.smtp_user.trim() || email,
    }
    if (form.password) patch.smtp_password = form.password
    const { error } = exists
      ? await sb.from('email_config').update(patch).eq('id', 'default')
      : await sb.from('email_config').insert({ id: 'default', ...patch })
    setBusy(false)
    if (error) { setMsg({ ok: false, text: /smtp_/.test(error.message) ? 'Kör migration 0025 i Supabase först.' : `Kunde inte spara: ${error.message}` }); return }
    setExists(true); setProvider('smtp'); if (form.password) setHasPassword(true)
    setForm(f => ({ ...f, password: '' }))
    setMsg({ ok: true, text: 'Sparat. Orderbekräftelser och automationer skickas nu från ' + email + '.' })
  }

  const field: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text2)' }
  const on = provider === 'smtp'

  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mail size={20} color="var(--gold)" /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>E-post (one.com)</div>
          <div style={{ fontSize: 13, color: on ? 'var(--green)' : 'var(--text2)' }}>
            {provider === null ? 'Laddar…' : on ? `Kopplad – skickar från ${form.from_email}` : 'Inte kopplad – inga mejl skickas ännu'}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 14px' }}>
        Skapa först ett e-postkonto hos one.com, t.ex. <strong style={{ color: 'var(--text)' }}>order@proluxshine.com</strong>, och fyll sedan i det här. Orderbekräftelser, ordernotiser till säljarna och automationerna skickas från kontot. Lösenordet visas aldrig igen när det är sparat.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <label style={label}>Avsändarnamn<input value={form.from_name} onChange={set('from_name')} style={field} /></label>
        <label style={label}>Avsändaradress<input type="email" value={form.from_email} onChange={set('from_email')} placeholder="order@proluxshine.com" style={field} autoComplete="off" /></label>
        <label style={label}>Lösenord till e-postkontot<input type="password" value={form.password} onChange={set('password')} placeholder={hasPassword ? '•••••••• (sparat – fyll i för att byta)' : ''} style={field} autoComplete="new-password" /></label>
        <label style={label}>Användarnamn (om annat än adressen)<input value={form.smtp_user} onChange={set('smtp_user')} placeholder={form.from_email || 'samma som adressen'} style={field} autoComplete="off" /></label>
        <label style={label}>Utgående server (SMTP)<input value={form.smtp_host} onChange={set('smtp_host')} style={field} /></label>
        <label style={label}>Port<input inputMode="numeric" value={form.smtp_port} onChange={set('smtp_port')} style={field} /></label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <button onClick={save} disabled={busy} style={{ padding: '11px 18px', borderRadius: 8, background: 'var(--gold)', border: 'none', color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: busy ? .6 : 1 }}>
          {busy ? 'Sparar…' : 'Spara e-postinställningar'}
        </button>
        {msg && <span role={msg.ok ? 'status' : 'alert'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.ok && <Check size={14} />}{msg.text}</span>}
      </div>
    </section>
  )
}
