'use client'
import { useMemo, useRef, useState } from 'react'
import { Upload, X, FileSpreadsheet, Download, Check, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { IMPORT_FIELDS, guessField, parseCsv, buildRows, TEMPLATE_CSV, type ImportField, type Cell } from '@/lib/customer-import'

const box: React.CSSProperties = { width: '100%', maxWidth: 860, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, boxSizing: 'border-box' }
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  background: primary ? 'var(--gold)' : 'var(--bg3)', color: primary ? '#111' : 'var(--text)', border: primary ? 'none' : '1px solid var(--border)',
})

// "Importera" on the customer lists (admin and CRM): Excel (.xlsx) or CSV.
export function ImportCustomersButton({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} style={btn()}><Upload size={14} /> Importera</button>
      {open && <ImportCustomers onClose={() => setOpen(false)} onImported={onImported} />}
    </>
  )
}

function ImportCustomers({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [sheet, setSheet] = useState<Cell[][] | null>(null)
  const [mapping, setMapping] = useState<(ImportField | '')[]>([])
  const [existing, setExisting] = useState<{ id: string; org_nr: string | null; email: string | null }[]>([])
  const [duplicates, setDuplicates] = useState<'skip' | 'update'>('skip')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; failed: string[] } | null>(null)

  async function readFile(file: File) {
    setError(''); setResult(null); setFileName(file.name)
    try {
      let rows: Cell[][]
      if (/\.(xlsx|xlsm)$/i.test(file.name)) {
        const { readSheet } = await import('read-excel-file/browser')
        rows = (await readSheet(file)) as Cell[][]
      } else if (/\.(csv|txt)$/i.test(file.name)) {
        const buf = await file.arrayBuffer()
        let text = new TextDecoder('utf-8').decode(buf)
        if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf)   // Excel's "CSV (semikolonavgränsad)"
        rows = parseCsv(text)
      } else {
        setError('Välj en Excel-fil (.xlsx) eller CSV-fil (.csv). Äldre .xls: spara om som .xlsx i Excel.')
        return
      }
      if (rows.length < 2) { setError('Filen innehåller inga kundrader (första raden ska vara kolumnrubriker).'); return }
      setSheet(rows)
      setMapping((rows[0] ?? []).map(t => guessField(String(t ?? '')) ?? ''))
      const { data } = await supabase.from('customers').select('id,org_nr,email')
      setExisting(data ?? [])
    } catch (e) {
      setError('Kunde inte läsa filen: ' + (e as Error).message)
    }
  }

  const rows = useMemo(() => sheet ? buildRows(sheet, mapping, existing) : [], [sheet, mapping, existing])
  const ok = rows.filter(r => !r.error)
  const newRows = ok.filter(r => !r.duplicateOf)
  const dupRows = ok.filter(r => r.duplicateOf)
  const bad = rows.filter(r => r.error)
  const hasCompany = mapping.includes('company')

  async function runImport() {
    setBusy(true); setError('')
    const failed: string[] = []
    let created = 0, updated = 0
    // contact_name and email are required (not null) in the database, but a
    // list of companies often lacks them: store them empty, fill in later.
    const base = (v: Record<string, string>) => ({
      ...v,
      contact_name: v.contact_name || '',
      email: v.email || '',
      price_list_id: v.price_list_id || 'Standard',
      customer_type: v.customer_type || 'business',
      status: 'active',
    })
    for (let i = 0; i < newRows.length; i += 100) {
      const chunk = newRows.slice(i, i + 100)
      const { error } = await supabase.from('customers').insert(chunk.map(r => base(r.values as Record<string, string>)))
      if (error) {
        // Retry one by one so a single bad row does not stop the rest.
        for (const r of chunk) {
          const { error: e1 } = await supabase.from('customers').insert(base(r.values as Record<string, string>))
          if (e1) failed.push(`Rad ${r.line}: ${e1.message}`); else created++
        }
      } else created += chunk.length
    }
    if (duplicates === 'update') {
      for (const r of dupRows) {
        const { error } = await supabase.from('customers').update(r.values).eq('id', r.duplicateOf!)
        if (error) failed.push(`Rad ${r.line}: ${error.message}`); else updated++
      }
    }
    setResult({ created, updated, skipped: (duplicates === 'skip' ? dupRows.length : 0) + bad.length, failed })
    setBusy(false)
    if (created || updated) onImported()
  }

  function downloadTemplate() {
    const blob = new Blob(['﻿' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kundimport-mall.csv'; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Importera kunder" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={box}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500, color: 'var(--text)', margin: 0, flex: 1 }}>Importera kunder</h2>
          <button onClick={onClose} aria-label="Stäng" style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 20px', lineHeight: 1.6 }}>
          Excel (.xlsx) eller CSV. Första raden ska vara kolumnrubriker, t.ex. Företag, Org.nr, E-post, Telefon, Adress, Postnummer, Ort.
          Kunder som redan finns (samma org.nr eller e-post) känns igen.
        </p>

        {!result && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.csv,.txt" hidden onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} style={btn(!sheet)}><FileSpreadsheet size={14} /> {sheet ? 'Välj annan fil' : 'Välj fil'}</button>
            <button onClick={downloadTemplate} style={btn()}><Download size={14} /> Ladda ner mall</button>
            {fileName && <span style={{ fontSize: 13, color: 'var(--text2)' }}>{fileName}</span>}
          </div>
        )}

        {error && <div role="alert" style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(224,82,82,.1)', border: '1px solid rgba(224,82,82,.3)', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {sheet && !result && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Kolumner i filen</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, marginBottom: 18 }}>
              {(sheet[0] ?? []).map((title, col) => (
                <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(title ?? '')}>{String(title ?? '') || `Kolumn ${col + 1}`}</span>
                  <select value={mapping[col] ?? ''} onChange={e => setMapping(m => m.map((v, i) => i === col ? e.target.value as ImportField | '' : v))}
                    style={{ width: 140, padding: '6px 8px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 6, color: mapping[col] ? 'var(--text)' : 'var(--text2)', fontSize: 12 }}>
                    <option value="">Hoppa över</option>
                    {IMPORT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {!hasCompany && <p style={{ fontSize: 13, color: 'var(--gold)', margin: '0 0 14px' }}>Välj vilken kolumn som innehåller företagets (eller kundens) namn.</p>}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              {[[`${newRows.length} nya`, 'var(--green)'], [`${dupRows.length} finns redan`, 'var(--blue)'], [`${bad.length} med fel`, bad.length ? 'var(--red)' : 'var(--text2)']].map(([t, c]) => (
                <span key={t} style={{ fontSize: 13, fontWeight: 700, color: c, padding: '5px 10px', background: 'var(--bg3)', borderRadius: 999 }}>{t}</span>
              ))}
            </div>

            {dupRows.length > 0 && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, fontSize: 13, color: 'var(--text)' }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="radio" checked={duplicates === 'skip'} onChange={() => setDuplicates('skip')} /> Hoppa över befintliga kunder</label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="radio" checked={duplicates === 'update'} onChange={() => setDuplicates('update')} /> Uppdatera befintliga med uppgifterna i filen</label>
              </div>
            )}

            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto', maxHeight: 280, marginBottom: 18 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ background: 'var(--bg3)', textAlign: 'left' }}>
                  {['Rad', 'Företag', 'Org.nr', 'E-post', 'Ort', 'Status'].map(h => <th key={h} style={{ padding: '8px 10px', color: 'var(--text2)', fontWeight: 600, position: 'sticky', top: 0, background: 'var(--bg3)' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.slice(0, 200).map(r => (
                    <tr key={r.line} style={{ borderTop: '1px solid var(--border2)' }}>
                      <td style={{ padding: '7px 10px', color: 'var(--text2)' }}>{r.line}</td>
                      <td style={{ padding: '7px 10px', color: 'var(--text)' }}>{r.values.company || '—'}</td>
                      <td style={{ padding: '7px 10px', color: 'var(--text2)' }}>{r.values.org_nr || ''}</td>
                      <td style={{ padding: '7px 10px', color: 'var(--text2)' }}>{r.values.email || ''}</td>
                      <td style={{ padding: '7px 10px', color: 'var(--text2)' }}>{[r.values.postal_code, r.values.city].filter(Boolean).join(' ')}</td>
                      <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: r.error ? 'var(--red)' : r.duplicateOf ? 'var(--blue)' : 'var(--green)' }}>
                        {r.error ?? (r.duplicateOf ? (duplicates === 'update' ? 'Uppdateras' : 'Finns redan') : 'Ny')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 200 && <p style={{ fontSize: 12, color: 'var(--text2)', padding: '8px 10px', margin: 0 }}>… och {rows.length - 200} rader till.</p>}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={btn()}>Avbryt</button>
              <button onClick={runImport} disabled={busy || !hasCompany || (newRows.length === 0 && (duplicates === 'skip' || dupRows.length === 0))} style={{ ...btn(true), opacity: busy || !hasCompany ? .6 : 1 }}>
                {busy ? 'Importerar…' : `Importera ${newRows.length + (duplicates === 'update' ? dupRows.length : 0)} kunder`}
              </button>
            </div>
          </>
        )}

        {result && (
          <div>
            <div style={{ padding: 16, borderRadius: 10, background: 'rgba(76,175,125,.08)', border: '1px solid rgba(76,175,125,.25)', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}><Check size={16} /> Importen är klar</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>
                {result.created} nya kunder{result.updated ? `, ${result.updated} uppdaterade` : ''}{result.skipped ? `, ${result.skipped} hoppades över` : ''}.
              </div>
            </div>
            {result.failed.length > 0 && (
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.25)', marginBottom: 14, fontSize: 12, color: 'var(--text)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}><AlertTriangle size={14} /> {result.failed.length} rader kunde inte sparas</div>
                {result.failed.slice(0, 20).map(f => <div key={f}>{f}</div>)}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={onClose} style={btn(true)}>Stäng</button></div>
          </div>
        )}
      </div>
    </div>
  )
}
