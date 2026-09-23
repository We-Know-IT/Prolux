'use client'
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import Image from 'next/image'
import { PublicShell, useLoginModal } from '@/components/layout/PublicShell'
import { ArrowRight, ChevronRight, Check, Phone, Mail, MapPin } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'
import { getSiteContent, DEFAULT_OM_OSS, DEFAULT_CONTACT, OmOssContent as OmOssPageData, ContactContent } from '@/lib/site-content'

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
  const [content, setContent] = useState<OmOssPageData>(DEFAULT_OM_OSS)
  const [contact, setContact] = useState<ContactContent>(DEFAULT_CONTACT)

  useEffect(() => {
    getSiteContent('om_oss', DEFAULT_OM_OSS).then(setContent)
    getSiteContent('contact', DEFAULT_CONTACT).then(setContact)
  }, [])

  return (
    <div style={{ paddingTop: 64, background: '#fff' }}>

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
          <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.22em' }}>{content.hero.label}</p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px,5vw,60px)', fontWeight: 700, color: '#F0EDE8', margin: '0 0 20px', lineHeight: 1.08, letterSpacing: '-.02em', whiteSpace: 'pre-line' }}>
            {content.hero.heading}
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(240,237,232,.6)', lineHeight: 1.75, margin: 0, maxWidth: 520, marginInline: 'auto' }}>
            {content.hero.sub}
          </p>
        </div>
      </section>

      {/* ── VÅR HISTORIA ── */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="about-grid">
          <Reveal>
            <div>
              <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.18em' }}>Vår historia</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, color: '#111', margin: '0 0 20px', lineHeight: 1.1, letterSpacing: '-.02em', whiteSpace: 'pre-line' }}>
                {content.historia.heading}
              </h2>
              {content.historia.paragraphs.map((p, i) => (
                <p key={i} style={{ fontSize: 15, color: '#666', lineHeight: 1.8, margin: i === content.historia.paragraphs.length - 1 ? '0 0 32px' : '0 0 16px' }}>
                  {p}
                </p>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {content.historia.punkter.map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F5F2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={11} color="#C9971A" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: 14, color: '#444' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          {/* Right side: stats */}
          <Reveal delay={150}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {content.stats.map(({ value, label, sub }) => (
                <div key={label} style={{ padding: '28px 24px', border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 14, background: '#F8F5F0' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 40, fontWeight: 400, color: '#C9971A', lineHeight: 1, marginBottom: 8 }}>{value}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{sub}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── VARUMÄRKEN ── */}
      <section style={{ background: '#F8F5F0', padding: '80px 24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.18em' }}>Våra varumärken</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, color: '#111', margin: 0, letterSpacing: '-.02em' }}>Italiensk precision</h2>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="brand-grid">
            {content.brands.map((b, i) => (
              <Reveal key={b.name} delay={i * 100}>
                <div style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ height: 200, background: '#F0EDE8', overflow: 'hidden' }}>
                    <img src={b.img} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ padding: '28px 32px 32px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#C9971A', textTransform: 'uppercase', letterSpacing: '.15em' }}>Varumärke</p>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 400, color: '#111', margin: '0 0 6px', fontStyle: 'italic', lineHeight: 1 }}>{b.name}</h3>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#555', margin: '0 0 14px' }}>{b.tagline}</p>
                    <p style={{ fontSize: 14, color: '#777', lineHeight: 1.75, margin: '0 0 20px' }}>{b.desc}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
                      {b.items.map(item => (
                        <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#555' }}>
                          <Check size={12} color="#C9971A" strokeWidth={2.5} />
                          {item}
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
      <section style={{ background: '#fff', padding: '80px 24px' }}>
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
                  { icon: Phone, label: 'Telefon', value: contact.phone, sub: contact.hours },
                  { icon: Mail,  label: 'E-post',  value: contact.email, sub: 'Svar inom 24h' },
                  { icon: MapPin, label: 'Adress', value: contact.address, sub: 'Lagerhållning & kontor' },
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
            <div style={{ background: '#F8F5F0', borderRadius: 16, padding: '36px 32px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 6 }}>Intresserad av B2B-avtal?</div>
              <p style={{ fontSize: 14, color: '#888', margin: '0 0 24px', lineHeight: 1.7 }}>Fyll i formuläret så kontaktar vi dig inom en arbetsdag för att diskutera dina behov och vilket prispaket som passar.</p>
              {[
                { label: 'Ditt namn', placeholder: 'Anna Lindberg', type: 'text' },
                { label: 'Företag', placeholder: 'Bilverkstad AB', type: 'text' },
                { label: 'E-post', placeholder: 'anna@foretag.se', type: 'email' },
                { label: 'Telefon', placeholder: '070-123 45 67', type: 'tel' },
              ].map(({ label, placeholder, type }) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>{label}</label>
                  <input type={type} placeholder={placeholder} style={{ width: '100%', padding: '10px 13px', background: '#fff', border: '1.5px solid rgba(0,0,0,.1)', borderRadius: 8, fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>Meddelande</label>
                <textarea placeholder="Berätta kort om ditt företag och era behov..." rows={3} style={{ width: '100%', padding: '10px 13px', background: '#fff', border: '1.5px solid rgba(0,0,0,.1)', borderRadius: 8, fontSize: 14, color: '#111', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
              <button onClick={() => alert('Tack! Vi kontaktar dig inom en arbetsdag.')} style={{ width: '100%', padding: '13px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Skicka förfrågan
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── B2B CTA ── */}
      <section style={{ background: '#0D0F13', padding: '64px 24px' }}>
        <Reveal>
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, color: '#F0EDE8', margin: '0 0 14px', lineHeight: 1.1 }}>
              {content.cta.heading}
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(240,237,232,.55)', margin: '0 0 32px', lineHeight: 1.7 }}>
              {content.cta.sub}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={openLogin} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 30px', borderRadius: 8, background: '#C9971A', color: '#111', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.06em' }}>
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
