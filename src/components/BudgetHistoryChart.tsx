'use client'
import { useEffect, useRef, useState } from 'react'
import { fmt } from '@/lib/utils'
import type { BudgetMonth } from '@/hooks/useBudgetHistory'

const H = 132            // plot height
const PAD_L = 34         // y-axis labels
const PAD_B = 20         // month labels
const PAD_T = 8          // room for the top axis label
const BAR_MAX = 24

const kr = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))

// Gridline step of 1, 2, 2.5 or 5 × 10^n giving about three gridlines, so the
// axis reads 0 / 25k / 50k / 75k instead of odd numbers.
function niceStep(max: number) {
  const raw = max / 3
  const pow = 10 ** Math.floor(Math.log10(raw))
  return ([1, 2, 2.5, 5, 10].find(m => m * pow >= raw) || 10) * pow
}

// Sold (bars) vs budget (tick) per month for one salesperson.
export default function BudgetHistoryChart({ salesperson, months }: { salesperson: string; months: BudgetMonth[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [asTable]) // the chart container remounts when switching back from the table

  const rows = months.map(m => ({ ...m, s: m.sold[salesperson] || 0, b: m.budget[salesperson] || 0 }))
  const step = niceStep(Math.max(1, ...rows.map(r => Math.max(r.s, r.b))))
  const max = Math.ceil(Math.max(1, ...rows.map(r => Math.max(r.s, r.b))) / step) * step
  const plotW = Math.max(0, width - PAD_L)
  const band = rows.length ? plotW / rows.length : 0
  const barW = Math.min(BAR_MAX, band * 0.55)
  const y = (v: number) => PAD_T + H - (v / max) * H
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step)
  const cur = rows[rows.length - 1]
  const hovered = hover !== null ? rows[hover] : null

  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{salesperson}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Sålt per månad mot budget</div>
        </div>
        <button onClick={() => setAsTable(t => !t)}
          style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          {asTable ? 'Visa diagram' : 'Visa tabell'}
        </button>
      </div>

      {asTable ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: 'var(--text2)', textAlign: 'right' }}>
              <th style={{ textAlign: 'left', fontWeight: 600, padding: '4px 0' }}>Månad</th>
              <th style={{ fontWeight: 600 }}>Sålt</th><th style={{ fontWeight: 600 }}>Budget</th><th style={{ fontWeight: 600 }}>Utfall</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={`${r.year}-${r.month}`} style={{ borderTop: '1px solid var(--border)', color: 'var(--text)', textAlign: 'right' }}>
                <td style={{ textAlign: 'left', padding: '5px 0' }}>{r.label} {r.year}</td>
                <td>{fmt(r.s)} kr</td>
                <td style={{ color: 'var(--text2)' }}>{r.b ? `${fmt(r.b)} kr` : '—'}</td>
                <td>{r.b ? `${Math.round((r.s / r.b) * 100)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={wrapRef} style={{ position: 'relative', width: '100%' }} onMouseLeave={() => setHover(null)}>
          {width > 0 && (
            <svg width={width} height={PAD_T + H + PAD_B} role="img"
              aria-label={`${salesperson}: ${rows.map(r => `${r.label} ${fmt(r.s)} kr av ${r.b ? fmt(r.b) + ' kr' : 'ingen budget'}`).join(', ')}`}>
              {ticks.map(t => (
                <g key={t}>
                  <line x1={PAD_L} x2={width} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.06)" strokeWidth={1} />
                  <text x={PAD_L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--text3)">{kr(t)}</text>
                </g>
              ))}
              {rows.map((r, i) => {
                const cx = PAD_L + band * i + band / 2
                const top = y(r.s)
                const h = PAD_T + H - top
                const rad = Math.min(4, h / 2, barW / 2)
                return (
                  <g key={`${r.year}-${r.month}`}>
                    {h > 0 && (
                      <path fill="#4A8FD4" opacity={hover === null || hover === i ? 1 : .45}
                        d={`M${cx - barW / 2},${PAD_T + H} V${top + rad} Q${cx - barW / 2},${top} ${cx - barW / 2 + rad},${top} H${cx + barW / 2 - rad} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + rad} V${PAD_T + H} Z`} />
                    )}
                    {r.b > 0 && (
                      <line x1={cx - barW / 2 - 5} x2={cx + barW / 2 + 5} y1={y(r.b)} y2={y(r.b)} stroke="var(--text)" strokeWidth={2} strokeLinecap="round" />
                    )}
                    <text x={cx} y={PAD_T + H + 14} textAnchor="middle" fontSize={10}
                      fill={i === rows.length - 1 ? 'var(--text)' : 'var(--text2)'} fontWeight={i === rows.length - 1 ? 700 : 400}>{r.label}</text>
                    {/* hit target: the whole column */}
                    <rect x={PAD_L + band * i} y={0} width={band} height={PAD_T + H + PAD_B} fill="transparent"
                      onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} style={{ cursor: 'default' }} />
                  </g>
                )
              })}
            </svg>
          )}
          {hovered && hover !== null && (
            <div style={{
              position: 'absolute', top: 0, pointerEvents: 'none',
              left: Math.min(Math.max(PAD_L + band * hover + band / 2 - 70, 0), Math.max(0, width - 140)),
              width: 140, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: 'var(--text)', boxShadow: '0 6px 20px rgba(0,0,0,.4)',
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{hovered.label} {hovered.year}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text2)' }}>Sålt</span><span>{fmt(hovered.s)} kr</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text2)' }}>Budget</span><span>{hovered.b ? `${fmt(hovered.b)} kr` : '—'}</span></div>
              {hovered.b > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text2)' }}>Utfall</span><span>{Math.round((hovered.s / hovered.b) * 100)}%</span></div>}
            </div>
          )}
        </div>
      )}

      {cur && !asTable && (
        <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--text2)', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#4A8FD4' }} />Sålt</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 2, borderRadius: 1, background: 'var(--text)' }} />Budget</span>
          {cur.b > 0 && <span style={{ marginLeft: 'auto', color: 'var(--text)' }}>{cur.label}: {Math.round((cur.s / cur.b) * 100)}% av budget</span>}
        </div>
      )}
    </div>
  )
}
