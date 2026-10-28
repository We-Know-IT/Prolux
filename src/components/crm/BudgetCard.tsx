'use client'
// The month's budget at a glance: budget, daily budget, sold so far, what is
// left and how it stands in percent, with a marker for where you should be
// today. Used for each salesperson's own budget and for the whole company.
import { Target, TrendingUp, TrendingDown } from 'lucide-react'
import { fmt } from '@/lib/utils'
import { budgetStatus, MONTHS, type YM } from '@/lib/budget'

export default function BudgetCard({ title, budget, sold, ym, company, compact = false }: {
  title: string
  budget: number
  sold: number
  ym: YM
  company?: { budget: number; sold: number }
  compact?: boolean
}) {
  const s = budgetStatus(budget, sold, ym)
  const reached = budget > 0 && sold >= budget
  const ahead = s.vsExpected >= 0
  const barColor = reached ? 'var(--green)' : ahead ? 'linear-gradient(90deg,#4CAF7D,#5EC49A)' : 'linear-gradient(90deg,#E0A85A,#E8B84B)'
  const expectedPct = budget > 0 ? Math.min(100, s.expected / budget * 100) : 0
  const cell: React.CSSProperties = { background: 'rgba(255,255,255,.035)', border: '1px solid var(--line)', borderRadius: 10, padding: compact ? '10px 12px' : '12px 14px', minWidth: 0 }
  const lab: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }
  const val = (c = 'var(--text)'): React.CSSProperties => ({ fontSize: compact ? 18 : 22, fontWeight: 800, color: c, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })

  if (!(budget > 0)) return (
    <section style={{ background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
      <Target size={18} color="var(--text2)" />
      <span style={{ fontSize: 15, color: 'var(--text2)' }}>{title}: ingen budget satt för {MONTHS[ym.month].toLowerCase()} ännu. Sålt hittills <strong style={{ color: 'var(--text)' }}>{fmt(sold)} kr</strong>.</span>
    </section>
  )

  return (
    <section aria-label={title} style={{ background: 'var(--bg3)', border: `1px solid ${reached ? 'rgba(76,175,125,.5)' : 'rgba(232,184,75,.35)'}`, borderRadius: 14, padding: compact ? '14px 16px' : '18px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(232,184,75,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Target size={17} color="var(--gold)" /></span>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{title} — {MONTHS[ym.month]} {ym.year}</span>
        <span style={{ marginLeft: 'auto', fontSize: compact ? 22 : 28, fontWeight: 800, color: reached ? 'var(--green)' : 'var(--text)' }}>{s.pct}%</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
        <div style={cell}><div style={lab}>Månadsbudget</div><div style={val()}>{fmt(budget)} kr</div></div>
        <div style={cell}><div style={lab}>Dagsbudget</div><div style={val()}>{fmt(s.daily)} kr</div><div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{s.workdays} arbetsdagar</div></div>
        <div style={cell}><div style={lab}>Sålt hittills</div><div style={val(sold > 0 ? 'var(--green)' : 'var(--text)')}>{fmt(sold)} kr</div></div>
        <div style={cell}><div style={lab}>Kvar till målet</div><div style={val()}>{reached ? '0 kr' : `${fmt(s.remaining)} kr`}</div></div>
      </div>

      {/* Progress with a marker for where you should be by today */}
      <div style={{ position: 'relative', height: 12, background: 'rgba(255,255,255,.07)', borderRadius: 6, overflow: 'visible' }}>
        <div style={{ height: '100%', width: `${Math.min(100, s.pct)}%`, background: barColor, borderRadius: 6, transition: 'width .4s' }} />
        {!reached && expectedPct > 0 && (
          <div title={`Plan idag: ${fmt(s.expected)} kr`} style={{ position: 'absolute', top: -4, bottom: -4, left: `calc(${expectedPct}% - 1px)`, width: 2, background: 'var(--text)', borderRadius: 1 }} />
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: 14, color: 'var(--text)' }}>
        {reached ? (
          <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Budgeten är nådd – {fmt(sold - budget)} kr över målet</span>
        ) : (<>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: ahead ? 'var(--green)' : '#E0A85A' }}>
            {ahead ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {ahead ? `${fmt(s.vsExpected)} kr före planen` : `${fmt(-s.vsExpected)} kr efter planen`}
          </span>
          <span style={{ color: 'var(--text2)' }}>· plan idag {fmt(s.expected)} kr</span>
          {s.left > 0 && <span style={{ color: 'var(--text2)' }}>· sälj <strong style={{ color: 'var(--text)' }}>{fmt(s.neededPerDay)} kr/dag</strong> de {s.left} arbetsdagar som är kvar</span>}
        </>)}
      </div>
      {company && company.budget > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 14, color: 'var(--text2)' }}>
          Hela bolaget: <strong style={{ color: 'var(--text)' }}>{fmt(company.sold)} kr</strong> av {fmt(company.budget)} kr · <strong style={{ color: company.sold >= company.budget ? 'var(--green)' : 'var(--text)' }}>{Math.round(company.sold / company.budget * 100)}%</strong>
        </div>
      )}
    </section>
  )
}
