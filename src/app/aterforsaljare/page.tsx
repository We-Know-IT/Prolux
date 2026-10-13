'use client'
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BadgePercent, UserRound, Truck, GraduationCap, Check, Send, PhoneCall, ShoppingBag } from 'lucide-react'
import { PublicShell } from '@/components/layout/PublicShell'
import B2BLeadForm from '@/components/shop/B2BLeadForm'
import { DEFAULT_CONTACT, ContactContent } from '@/lib/site-content'
import { useSiteContent } from '@/components/site-edit/SiteEdit'

const BENEFITS = [
  { icon: BadgePercent, title: 'Priser efter volym', text: 'Prislista A, B eller C ger upp till 40 % rabatt på listpris — anpassat efter hur mycket ni köper.' },
  { icon: UserRound, title: 'Personlig säljare', text: 'En kontaktperson som känner er verksamhet, hjälper med sortimentet och kan besöka er.' },
  { icon: Truck, title: 'Snabba leveranser', text: '1–2 dagars leverans och fri frakt från 2 000 kr. Betala mot faktura.' },
  { icon: GraduationCap, title: 'Kunskap & stöd', text: 'Produktgenomgångar och guider så att ni får ut rätt resultat av varje produkt.' },
]

const STEPS = [
  { icon: Send, title: 'Skicka en förfrågan', text: 'Fyll i formuläret nedan — det tar en minut.' },
  { icon: PhoneCall, title: 'Vi hör av oss', text: 'Inom en arbetsdag går vi igenom era behov och sätter er prislista.' },
  { icon: ShoppingBag, title: 'Beställ', text: 'Handla i webbshoppen med era priser eller via er säljare. Faktura och snabb leverans.' },
]

export default function AterforsaljarePage() {
  return <PublicShell><Content /></PublicShell>
}

function Content() {
  const contact = useSiteContent<ContactContent>('contact', DEFAULT_CONTACT)
  const toForm = () => document.getElementById('ansok')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="rs">
      {/* Hero */}
      <section className="rs-hero">
        <div className="rs-wrap rs-hero-grid">
          <div>
            <p className="rs-eyebrow">Återförsäljare & proffs</p>
            <h1 className="rs-h1">Bli återförsäljare av Frescura och Virtus</h1>
            <p className="rs-lead">
              ProLuxShine är officiell distributör av två av Italiens ledande varumärken inom bilvård. För biltvättar,
              detailers, verkstäder och butiker — med B2B-priser, personlig service och snabba leveranser.
            </p>
            <div className="rs-ctas">
              <button type="button" onClick={toForm} className="rs-btn rs-btn-gold">Ansök om B2B-konto <ArrowRight size={16} /></button>
              <Link href="/produkter" className="rs-btn rs-btn-ghost">Se sortimentet</Link>
            </div>
          </div>
          <div className="rs-brands" aria-label="Officiell distributör av Frescura och Virtus">
            <span className="rs-brands-label">Officiell distributör</span>
            <Image src="/brands/frescura.svg" alt="Frescura" width={260} height={24} style={{ width: '78%', height: 'auto' }} />
            <Image src="/brands/virtus.svg" alt="Virtus" width={110} height={114} style={{ width: 'auto', height: 104 }} />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="rs-wrap rs-section">
        <h2 className="rs-h2">Därför väljer proffsen ProLuxShine</h2>
        <div className="rs-benefits">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rs-card">
              <span className="rs-icon"><Icon size={20} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="rs-wrap rs-section">
        <h2 className="rs-h2">Så går det till</h2>
        <ol className="rs-steps">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rs-step">
              <span className="rs-step-nr">{i + 1}</span>
              <Icon size={20} className="rs-step-icon" />
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Form */}
      <section id="ansok" className="rs-wrap rs-section rs-form-grid">
        <div>
          <h2 className="rs-h2" style={{ textAlign: 'left' }}>Ansök om B2B-konto</h2>
          <p className="rs-muted">Berätta kort om er verksamhet så återkommer en säljare inom en arbetsdag.</p>
          <ul className="rs-list">
            {['Ingen bindningstid', 'Betala mot faktura', 'Personlig prislista', 'Hela sortimentet från Frescura och Virtus'].map(t => (
              <li key={t}><Check size={15} strokeWidth={2.5} /> {t}</li>
            ))}
          </ul>
          <p className="rs-muted" style={{ marginTop: 24 }}>
            Hellre prata direkt? Ring <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>{contact.phone}</a> eller mejla{' '}
            <a href={`mailto:${contact.email}`}>{contact.email}</a>.
          </p>
        </div>
        <div className="rs-form-card"><B2BLeadForm /></div>
      </section>

      <style>{`
        .rs { color: #111; }
        .rs-wrap { max-width: 1160px; margin: 0 auto; padding: 0 24px; box-sizing: border-box; }
        .rs-hero { background: radial-gradient(120% 140% at 85% 20%, #2a2210 0%, #0D0F13 55%); color: #F0EDE8; padding: 88px 0 80px; }
        .rs-hero-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 56px; align-items: center; }
        .rs-eyebrow { margin: 0 0 14px; font-size: 12px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: #E8B84B; }
        .rs-h1 { font-family: var(--font-serif); font-size: clamp(34px, 4.6vw, 58px); line-height: 1.08; font-weight: 700; margin: 0 0 18px; letter-spacing: -.01em; }
        .rs-lead { font-size: 17px; line-height: 1.7; color: rgba(240,237,232,.82); margin: 0 0 32px; max-width: 580px; }
        .rs-ctas { display: flex; gap: 12px; flex-wrap: wrap; }
        .rs-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 26px; border-radius: 40px; font-size: 15px; font-weight: 700; text-decoration: none; cursor: pointer; border: none; }
        .rs-btn-gold { background: #E8B84B; color: #0F1115; }
        .rs-btn-ghost { background: rgba(255,255,255,.08); color: #F0EDE8; border: 1px solid rgba(255,255,255,.25); }
        .rs-brands { display: flex; flex-direction: column; align-items: center; gap: 28px; padding: 40px 28px; border-radius: 20px;
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1); }
        .rs-brands-label { font-size: 11px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: rgba(240,237,232,.7); }
        .rs-section { padding-top: 72px; }
        .rs-h2 { font-family: var(--font-serif); font-size: clamp(26px, 3vw, 38px); font-weight: 700; margin: 0 0 28px; text-align: center; }
        .rs-benefits { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
        .rs-card { background: #fff; border: 1px solid rgba(17,17,17,.07); border-radius: 16px; padding: 24px 22px; }
        .rs-card h3, .rs-step h3 { font-size: 16px; font-weight: 700; margin: 14px 0 6px; }
        .rs-card p, .rs-step p { font-size: 14px; line-height: 1.6; color: #555; margin: 0; }
        .rs-icon { display: inline-flex; width: 42px; height: 42px; border-radius: 12px; align-items: center; justify-content: center; background: #111; color: #E8B84B; }
        .rs-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; counter-reset: s; }
        .rs-step { position: relative; background: rgba(255,255,255,.75); border: 1px solid rgba(17,17,17,.07); border-radius: 16px; padding: 26px 22px 24px; }
        .rs-step-nr { position: absolute; top: 18px; right: 20px; font-family: var(--font-serif); font-size: 34px; font-weight: 700; color: rgba(17,17,17,.12); }
        .rs-step-icon { color: #8A6510; }
        .rs-form-grid { display: grid; grid-template-columns: 1fr 1.1fr; gap: 48px; align-items: start; padding-bottom: 88px; }
        .rs-muted { font-size: 15px; line-height: 1.7; color: #555; margin: 0; }
        .rs-muted a { color: #8A6510; font-weight: 600; }
        .rs-list { list-style: none; padding: 0; margin: 22px 0 0; display: grid; gap: 10px; }
        .rs-list li { display: flex; align-items: center; gap: 10px; font-size: 15px; color: #222; }
        .rs-list svg { color: #2E8B57; }
        .rs-form-card { background: #fff; border: 1px solid rgba(17,17,17,.08); border-radius: 18px; padding: 28px; box-shadow: 0 10px 30px rgba(17,17,17,.06); }
        @media (max-width: 960px) {
          .rs-hero-grid, .rs-form-grid { grid-template-columns: 1fr; }
          .rs-benefits { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .rs-steps { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .rs-hero { padding: 56px 0; }
          .rs-benefits { grid-template-columns: 1fr; }
          .rs-form-card { padding: 20px; }
        }
      `}</style>
    </div>
  )
}
