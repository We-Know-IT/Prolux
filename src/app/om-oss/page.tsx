'use client'
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import Image from 'next/image'
import { PublicShell, useLoginModal } from '@/components/layout/PublicShell'
import { ArrowRight, ChevronRight, Check, Phone, Mail, MapPin } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'
import { DEFAULT_OM_OSS, DEFAULT_CONTACT, OmOssContent as OmOssPageData, ContactContent } from '@/lib/site-content'
import { useSiteContent, EditableText, EditableImage } from '@/components/site-edit/SiteEdit'
import { createClient } from '@/lib/supabase/client'

// Official brand logos, matched on the brand name in Om oss content.
const BRAND_LOGO: Record<string, { src: string; w: number; h: number }> = {
  frescura: { src: '/brands/frescura.svg', w: 200, h: 18 },
  virtus:   { src: '/brands/virtus.svg',   w: 56,  h: 58 },
}

const brandLogo = (name: string) => BRAND_LOGO[name.trim().toLowerCase()]

// Brand card photo. The old photos were hosted on the WordPress site; when an
// image is missing or fails to load, show the brand's own logo instead.
function BrandPhoto({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const logo = brandLogo(name)
  if (!src || failed) return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 50% 40%, #FFFFFF 0%, #F0EDE8 70%)' }}>
      {logo
        ? <Image src={logo.src} alt={name} width={logo.w * 2} height={logo.h * 2} style={{ height: logo.h > 30 ? 110 : 34, width: 'auto', maxWidth: '75%', objectFit: 'contain' }} />
        : <span style={{ fontFamily: 'var(--font-serif)', fontSize: 40, fontStyle: 'italic', color: '#111' }}>{name}</span>}
    </div>
  )
  return <img src={src} alt={name} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
}

const INPUT_STYLE: React.CSSProperties = { width: '100%', padding: '10px 13px', background: '#fff', border: '1.5px solid rgba(0,0,0,.1)', borderRadius: 8, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const LABEL_STYLE: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }
const EMPTY_LEAD = { name: '', company: '', email: '', phone: '', message: '', website: '' }

// "Intresserad av B2B-avtal?" — lands in the CRM as a prospect, a Prospekt
// deal and a note on the customer card (submit_b2b_lead, migration 0015).
function B2BLeadForm() {
  const [lead, setLead] = useState(EMPTY_LEAD)
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  const set = (k: keyof typeof EMPTY_LEAD) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setLead(l => ({ ...l, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!lead.name.trim() || !lead.company.trim() || !lead.email.trim()) { setError('Fyll i namn, företag och e-post'); return }
    setState('sending'); setError('')
    const { error } = await createClient().rpc('submit_b2b_lead', { p_lead: lead })
    if (error) { setError(error.message || 'Förfrågan kunde inte skickas. Försök igen.'); setState('idle'); return }
    setState('sent'); setLead(EMPTY_LEAD)
  }

  if (state === 'sent') return (
    <div role="status" style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', textAlign: 'center', border: '1.5px solid rgba(76,175,125,.35)' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(76,175,125,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <Check size={22} color="#2E8B57" strokeWidth={2.5} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 6 }}>Tack för din förfrågan!</div>
      <p style={{ fontSize: 14, color: '#666', margin: '0 0 16px', lineHeight: 1.6 }}>En säljare kontaktar dig inom en arbetsdag.</p>
      <button type="button" onClick={() => setState('idle')} style={{ background: 'none', border: 'none', color: '#8A6510', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Skicka en till</button>
    </div>
  )

  return (
    <form onSubmit={submit} noValidate>
      {([
        { key: 'name',    label: 'Ditt namn', placeholder: 'Anna Lindberg',   type: 'text',  auto: 'name' },
        { key: 'company', label: 'Företag',   placeholder: 'Bilverkstad AB',  type: 'text',  auto: 'organization' },
        { key: 'email',   label: 'E-post',    placeholder: 'anna@foretag.se', type: 'email', auto: 'email' },
        { key: 'phone',   label: 'Telefon',   placeholder: '070-123 45 67',   type: 'tel',   auto: 'tel' },
      ] as const).map(f => (
        <div key={f.key} style={{ marginBottom: 14 }}>
          <label htmlFor={`lead-${f.key}`} style={LABEL_STYLE}>{f.label}{f.key !== 'phone' && ' *'}</label>
          <input id={`lead-${f.key}`} type={f.type} autoComplete={f.auto} placeholder={f.placeholder} value={lead[f.key]} onChange={set(f.key)}
            required={f.key !== 'phone'} maxLength={f.key === 'company' ? 160 : 120} style={INPUT_STYLE} />
        </div>
      ))}
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="lead-message" style={LABEL_STYLE}>Meddelande</label>
        <textarea id="lead-message" placeholder="Berätta kort om ditt företag och era behov..." rows={3} maxLength={2000} value={lead.message} onChange={set('message')} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
      </div>
      {/* Honeypot: hidden from people, bots fill it in. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}>
        <label>Webbplats <input tabIndex={-1} autoComplete="off" value={lead.website} onChange={set('website')} /></label>
      </div>
      {error && <p role="alert" style={{ margin: '0 0 14px', fontSize: 13, color: '#C0392B', fontWeight: 600 }}>{error}</p>}
      <button type="submit" disabled={state === 'sending'} style={{ width: '100%', padding: '13px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: state === 'sending' ? 'wait' : 'pointer', opacity: state === 'sending' ? .7 : 1, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {state === 'sending' ? 'Skickar…' : 'Skicka förfrågan'}
      </button>
    </form>
  )
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect() } }, { threshold: 0.08 })
    obs.observe(el); return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(20px)', transition: `opacity .55s ease ${delay}ms, transform .55s ease ${delay}ms` }}>
      {children}
    </div>
  )
}

function OmOssContent() {
  const openLogin = useLoginModal()
  const content = useSiteContent<OmOssPageData>('om_oss', DEFAULT_OM_OSS)
  const contact = useSiteContent<ContactContent>('contact', DEFAULT_CONTACT)

  return (
    <div style={{ paddingTop: 64 }}>

      {/* ── HERO ── */}
      <section style={{ background: '#0D0F13', padding: 'clamp(64px,8vw,100px) 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,151,26,.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: 'rgba(240,237,232,.35)', marginBottom: 24 }}>
            <Link href="/" style={{ color: 'rgba(240,237,232,.5)', textDecoration: 'none' }}>Hem</Link>
            <ChevronRight size={12} />
            <span>Om Prolux</span>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.22em' }}><EditableText doc="om_oss" path={'hero.label'} value={content.hero.label} /></p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px,5vw,60px)', fontWeight: 700, color: '#F0EDE8', margin: '0 0 20px', lineHeight: 1.08, letterSpacing: '-.02em', whiteSpace: 'pre-line' }}>
            <EditableText doc="om_oss" path={'hero.heading'} value={content.hero.heading} multiline />
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(240,237,232,.6)', lineHeight: 1.75, margin: 0, maxWidth: 520, marginInline: 'auto' }}>
            <EditableText doc="om_oss" path={'hero.sub'} value={content.hero.sub} multiline />
          </p>
        </div>
      </section>

      {/* ── VÅR HISTORIA ── */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="about-grid">
          <Reveal>
            <div>
              <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.18em' }}>Vår historia</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, color: '#111', margin: '0 0 20px', lineHeight: 1.1, letterSpacing: '-.02em', whiteSpace: 'pre-line' }}>
                <EditableText doc="om_oss" path={'historia.heading'} value={content.historia.heading} multiline />
              </h2>
              {content.historia.paragraphs.map((p, i) => (
                <p key={i} style={{ fontSize: 15, color: '#666', lineHeight: 1.8, margin: i === content.historia.paragraphs.length - 1 ? '0 0 32px' : '0 0 16px' }}>
                  <EditableText doc="om_oss" path={`historia.paragraphs.${i}`} value={p} multiline />
                </p>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {content.historia.punkter.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F5F2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={11} color="#C9971A" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: 14, color: '#444' }}><EditableText doc="om_oss" path={`historia.punkter.${i}`} value={item} /></span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          {/* Right side: stats */}
          <Reveal delay={150}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {content.stats.map(({ value, label, sub }, i) => (
                <div key={i} style={{ padding: '28px 24px', border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 14, background: '#fff' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 40, fontWeight: 400, color: '#C9971A', lineHeight: 1, marginBottom: 8 }}><EditableText doc="om_oss" path={`stats.${i}.value`} value={value} /></div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 3 }}><EditableText doc="om_oss" path={`stats.${i}.label`} value={label} /></div>
                  <div style={{ fontSize: 12, color: '#666' }}><EditableText doc="om_oss" path={`stats.${i}.sub`} value={sub} /></div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── VARUMÄRKEN ── */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.18em' }}>Våra varumärken</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, color: '#111', margin: 0, letterSpacing: '-.02em' }}>Italiensk precision</h2>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="brand-grid">
            {content.brands.map((b, i) => (
              <Reveal key={i} delay={i * 100}>
                <div style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ height: 200, background: '#F0EDE8', overflow: 'hidden', position: 'relative' }}>
                    <BrandPhoto key={b.img} src={b.img} name={b.name} />
                    <EditableImage doc="om_oss" path={`brands.${i}.img`} bucket="om-oss-images" />
                  </div>
                  <div style={{ padding: '28px 32px 32px' }}>
                    {brandLogo(b.name) ? (
                      <Image src={brandLogo(b.name).src} alt={b.name} width={brandLogo(b.name).w} height={brandLogo(b.name).h}
                        style={{ display: 'block', height: brandLogo(b.name).h, width: 'auto', marginBottom: 14 }} />
                    ) : (
                      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.15em' }}>Varumärke</p>
                    )}
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 400, color: '#111', margin: '0 0 6px', fontStyle: 'italic', lineHeight: 1 }}><EditableText doc="om_oss" path={`brands.${i}.name`} value={b.name} /></h3>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#555', margin: '0 0 14px' }}><EditableText doc="om_oss" path={`brands.${i}.tagline`} value={b.tagline} /></p>
                    <p style={{ fontSize: 14, color: '#666', lineHeight: 1.75, margin: '0 0 20px' }}><EditableText doc="om_oss" path={`brands.${i}.desc`} value={b.desc} multiline /></p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
                      {b.items.map((item, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#555' }}>
                          <Check size={12} color="#C9971A" strokeWidth={2.5} />
                          <EditableText doc="om_oss" path={`brands.${i}.items.${j}`} value={item} />
                        </div>
                      ))}
                    </div>
                    <Link href="/produkter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#C9971A', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                      Se {b.name}-produkter <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── KONTAKT ── */}
      <section id="kontakta-oss" style={{ padding: '80px 24px', scrollMarginTop: 72 }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }} className="contact-grid">
          <Reveal>
            <div>
              <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.18em' }}>Kontakt</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, color: '#111', margin: '0 0 20px', lineHeight: 1.1, letterSpacing: '-.02em' }}>
                Prata med oss
              </h2>
              <p style={{ fontSize: 15, color: '#666', lineHeight: 1.8, margin: '0 0 32px' }}>
                Vill du bli kund, har frågor om sortimentet eller vill veta mer om våra B2B-avtal? Hör av dig — din personliga säljare svarar inom en arbetsdag.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  { icon: Phone, label: 'Telefon', value: <EditableText doc="contact" path="phone" value={contact.phone} />, sub: <EditableText doc="contact" path="hours" value={contact.hours} /> },
                  { icon: Mail,  label: 'E-post',  value: <EditableText doc="contact" path="email" value={contact.email} />, sub: 'Svar inom 24h' },
                  { icon: MapPin, label: 'Adress', value: <EditableText doc="contact" path="address" value={contact.address} />, sub: 'Lagerhållning & kontor' },
                ].map(({ icon: Icon, label, value, sub }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F5F2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color="#C9971A" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{value}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 16, padding: '36px 32px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 6 }}>Intresserad av B2B-avtal?</div>
              <p style={{ fontSize: 14, color: '#888', margin: '0 0 24px', lineHeight: 1.7 }}>Fyll i formuläret så kontaktar vi dig inom en arbetsdag för att diskutera dina behov och vilket prispaket som passar.</p>
              <B2BLeadForm />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── B2B CTA ── */}
      <section style={{ background: '#0D0F13', padding: '64px 24px' }}>
        <Reveal>
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, color: '#F0EDE8', margin: '0 0 14px', lineHeight: 1.1 }}>
              <EditableText doc="om_oss" path={'cta.heading'} value={content.cta.heading} />
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(240,237,232,.55)', margin: '0 0 32px', lineHeight: 1.7 }}>
              <EditableText doc="om_oss" path={'cta.sub'} value={content.cta.sub} multiline />
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => openLogin()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 30px', borderRadius: 8, background: '#C9971A', color: '#111', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Logga in <ArrowRight size={15} />
              </button>
              <Link href="/produkter" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 24px', borderRadius: 8, background: 'transparent', border: '1.5px solid rgba(255,255,255,.2)', color: '#F0EDE8', fontSize: 14, fontWeight: 600, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Se sortimentet
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        .about-grid   { grid-template-columns: 1fr 1fr; }
        .brand-grid   { grid-template-columns: 1fr 1fr; }
        .contact-grid { grid-template-columns: 1fr 1fr; }
        @media (max-width: 760px) {
          .about-grid   { grid-template-columns: 1fr !important; }
          .brand-grid   { grid-template-columns: 1fr !important; }
          .contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

export default function OmOssPage() {
  return <PublicShell><OmOssContent /></PublicShell>
}
