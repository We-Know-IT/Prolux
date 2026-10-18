'use client'
// "Mejla offert": the quote (looking like the PDF) to copy and paste into Gmail,
// since a Gmail link can only carry plain text.
import { useState } from 'react'
import { Check, Copy, FileDown, Mail, X } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { downloadBlob } from '@/lib/quote-pdf'

export interface QuoteShare {
  html: string
  text: string
  to: string
  subject: string
  pdf: { blob: Blob; url: string | null; name: string } | null
}

export default function QuoteShareModal({ share, onClose }: { share: QuoteShare; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([share.html], { type: 'text/html' }),
        'text/plain': new Blob([share.text], { type: 'text/plain' }),
      })])
    } catch {
      // Older browsers: copy the rendered preview as a selection.
      const el = document.getElementById('quote-share-copy')
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r); document.execCommand('copy'); sel?.removeAllRanges() }
    }
    setCopied(true)
  }
  const openGmail = () => window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(share.to)}&su=${encodeURIComponent(share.subject)}`, '_blank')

  return (
    <Portal>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <div role="dialog" aria-modal="true" aria-label="Mejla offerten" onClick={e => e.stopPropagation()}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: 'calc(94vh / var(--vz, 1))', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mail size={18} color="var(--gold)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{share.subject}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Till {share.to || '(kunden saknar e-post)'}</div>
            </div>
            <button onClick={onClose} aria-label="Stäng" style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', padding: 6, display: 'flex' }}><X size={16} /></button>
          </div>
          <div style={{ padding: '14px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--text)', flex: '1 1 220px' }}><b>1.</b> Kopiera offerten <b style={{ marginLeft: 8 }}>2.</b> Öppna Gmail och klistra in (⌘V / Ctrl+V)</span>
            <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 9, background: copied ? 'var(--green)' : 'var(--gold)', border: 'none', color: copied ? '#fff' : '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {copied ? <><Check size={15} /> Kopierad</> : <><Copy size={15} /> Kopiera offerten</>}
            </button>
            <button onClick={openGmail} disabled={!share.to} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 9, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: share.to ? 'pointer' : 'not-allowed' }}>
              <Mail size={15} /> Öppna Gmail
            </button>
            {share.pdf && (
              <button onClick={() => downloadBlob(share.pdf!.blob, share.pdf!.name)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
                <FileDown size={15} /> PDF
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', background: '#f3f1ec', borderRadius: '0 0 16px 16px' }}>
            <div id="quote-share-copy" dangerouslySetInnerHTML={{ __html: share.html }} />
          </div>
        </div>
      </div>
    </Portal>
  )
}
