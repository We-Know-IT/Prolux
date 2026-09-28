'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSiteContent, saveSiteContent } from '@/lib/site-content'
import { userRole } from '@/lib/roles'
import { Pencil, Check, Undo2, X, ImageUp } from 'lucide-react'

// Inline editing of the webshop for admins ("Redigera sida").
// Content is the same site_content rows that Admin > Innehåll edits; pages
// read it through useSiteContent(), mark editable text with <EditableText>
// and images with <EditableImage>. Nothing is written until "Spara".

type Docs = Record<string, unknown>

interface Ctx {
  isAdmin: boolean
  editing: boolean
  docs: Docs
  dirty: string[]
  load: (id: string, fallback: unknown) => void
  update: (id: string, path: string, value: unknown) => void
}

const SiteEditContext = createContext<Ctx | null>(null)

// Immutable set of a dotted path such as "hero.0.heading".
function setPath(obj: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value
  const [key, ...rest] = path
  const isIndex = /^\d+$/.test(key)
  const base = (obj ?? (isIndex ? [] : {})) as Record<string, unknown> | unknown[]
  const copy: any = Array.isArray(base) ? [...base] : { ...base }
  copy[isIndex ? Number(key) : key] = setPath(copy[isIndex ? Number(key) : key], rest, value)
  return copy
}

// Saved content merged over the defaults, so fields added later (e.g. the
// trust strip) exist even in rows saved before them.
function withDefaults(data: unknown, fallback: unknown) {
  if (data && typeof data === 'object' && !Array.isArray(data) && fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
    return { ...(fallback as object), ...(data as object) }
  }
  return data ?? fallback
}

export function SiteEditProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [editing, setEditing] = useState(false)
  const [docs, setDocs]       = useState<Docs>({})
  const [saved, setSaved]     = useState<Docs>({})
  const [saving, setSaving]   = useState(false)
  const [message, setMessage] = useState('')
  const loading = useRef(new Set<string>())

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => setIsAdmin(userRole(user) === 'admin'))
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      const admin = userRole(session?.user) === 'admin'
      setIsAdmin(admin)
      if (!admin) setEditing(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const load = useCallback((id: string, fallback: unknown) => {
    if (loading.current.has(id)) return
    loading.current.add(id)
    getSiteContent(id, fallback).then(data => {
      const value = withDefaults(data, fallback)
      setDocs(d => (id in d ? d : { ...d, [id]: value }))
      setSaved(s => ({ ...s, [id]: value }))
    })
  }, [])

  const update = useCallback((id: string, path: string, value: unknown) => {
    setDocs(d => ({ ...d, [id]: setPath(d[id], path.split('.'), value) }))
  }, [])

  const dirty = useMemo(() => Object.keys(docs).filter(id => docs[id] !== saved[id]), [docs, saved])

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty.length) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty.length])

  function flash(msg: string) { setMessage(msg); setTimeout(() => setMessage(''), 3500) }

  async function save() {
    setSaving(true)
    for (const id of dirty) {
      const { error } = await saveSiteContent(id, docs[id])
      if (error) { setSaving(false); flash('Kunde inte spara. Försök igen.'); return }
      setSaved(s => ({ ...s, [id]: docs[id] }))
    }
    setSaving(false)
    flash('Sparat – ändringarna syns nu för alla besökare')
  }

  function discard() {
    setDocs(d => ({ ...d, ...Object.fromEntries(dirty.map(id => [id, saved[id]])) }))
    flash('Ändringarna är ångrade')
  }

  const value: Ctx = { isAdmin, editing: isAdmin && editing, docs, dirty, load, update }

  return (
    <SiteEditContext.Provider value={value}>
      {children}
      {isAdmin && (
        <div role="toolbar" aria-label="Redigera sidan"
          style={{ position: 'fixed', left: '50%', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)', zIndex: 2000,
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 'calc(100vw - 32px)',
            background: '#111418', color: '#F0EDE8', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, padding: '8px 10px',
            boxShadow: '0 10px 30px rgba(0,0,0,.35)', fontFamily: 'var(--font-sans, system-ui)', fontSize: 13 }}>
          {!editing ? (
            <button onClick={() => setEditing(true)} style={btn('#E8B84B', '#111')}><Pencil size={14} /> Redigera sida</button>
          ) : (
            <>
              <span style={{ padding: '0 6px', color: 'rgba(240,237,232,.85)' }}>
                {message || (dirty.length ? `${dirty.length === 1 ? '1 del' : `${dirty.length} delar`} ändrade` : 'Dubbelklicka på en markerad text för att ändra den')}
              </span>
              {dirty.length > 0 && (
                <>
                  <button onClick={discard} disabled={saving} style={btn('transparent', '#F0EDE8', true)}><Undo2 size={14} /> Ångra ändringar</button>
                  <button onClick={save} disabled={saving} style={btn('#E8B84B', '#111')}><Check size={14} /> {saving ? 'Sparar…' : 'Spara'}</button>
                </>
              )}
              <button onClick={() => { if (!dirty.length) setEditing(false); else flash('Spara eller ångra först') }}
                aria-label="Avsluta redigering" style={btn('transparent', '#F0EDE8', true)}><X size={14} /> Avsluta</button>
            </>
          )}
        </div>
      )}
      {isAdmin && editing && (
        <style>{`
          [data-site-edit] { outline: 1.5px dashed rgba(201,151,26,.7); outline-offset: 3px; border-radius: 3px; cursor: text; }
          [data-site-edit]:hover { outline-color: #C9971A; background: rgba(232,184,75,.08); }
          [data-site-edit][contenteditable="true"], [data-site-edit][contenteditable="plaintext-only"] { outline: 2px solid #C9971A; background: rgba(232,184,75,.12); }
        `}</style>
      )}
    </SiteEditContext.Provider>
  )
}

function btn(bg: string, color: string, outlined = false): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: bg, color,
    border: outlined ? '1px solid rgba(255,255,255,.2)' : 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
}

function useSiteEdit() {
  return useContext(SiteEditContext)
}

// A site_content row for a page: the saved content (merged over `fallback`),
// including any unsaved edits while "Redigera sida" is on.
export function useSiteContent<T>(id: string, fallback: T): T {
  const ctx = useSiteEdit()
  const [own, setOwn] = useState<T>(fallback)
  useEffect(() => {
    if (ctx) ctx.load(id, fallback)
    else getSiteContent(id, fallback).then(d => setOwn(withDefaults(d, fallback) as T))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!ctx) return own
  return (ctx.docs[id] as T) ?? fallback
}

// Text from site_content that admins can edit in place. Renders plain text
// (inheriting the surrounding style) unless "Redigera sida" is on.
export function EditableText({ doc, path, value, multiline = false }: {
  doc: string
  path: string
  value: string
  multiline?: boolean
}) {
  const ctx = useSiteEdit()
  const [active, setActive] = useState(false)
  const [version, setVersion] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const touch = useRef(false)

  useEffect(() => {
    if (!active || !ref.current) return
    const el = ref.current
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges(); sel?.addRange(range)
  }, [active])

  if (!ctx?.editing) return <>{value}</>

  function commit() {
    const el = ref.current
    if (!el) return
    let text = el.innerText.replace(/ /g, ' ')
    text = multiline ? text.replace(/\n{3,}/g, '\n\n').trim() : text.replace(/\s*\n\s*/g, ' ').trim()
    setActive(false)
    setVersion(v => v + 1)   // remount so React owns the text again
    if (text !== value) ctx!.update(doc, path, text)
  }

  function cancel() {
    setActive(false)
    setVersion(v => v + 1)
  }

  return (
    <span
      key={version}
      ref={ref}
      data-site-edit=""
      title={active ? undefined : 'Dubbelklicka för att ändra'}
      contentEditable={active ? ('plaintext-only' as unknown as boolean) : false}
      suppressContentEditableWarning
      role={active ? 'textbox' : undefined}
      aria-multiline={active ? multiline : undefined}
      onPointerDown={e => { touch.current = e.pointerType === 'touch' }}
      // Links and buttons around the text must not fire while editing.
      onClick={e => {
        e.preventDefault(); e.stopPropagation()
        if (!active && (touch.current || e.detail >= 2)) setActive(true)
      }}
      onDoubleClick={e => { e.preventDefault(); e.stopPropagation(); if (!active) setActive(true) }}
      onBlur={() => { if (active) commit() }}
      onKeyDown={e => {
        if (!active) return
        if (e.key === 'Escape') { e.preventDefault(); cancel() }
        if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); ref.current?.blur() }
      }}
      style={{ whiteSpace: multiline ? 'pre-line' : undefined }}
    >
      {value}
    </span>
  )
}

// "Byt bild" button over an image from site_content. Place it inside a
// positioned container; it only shows while "Redigera sida" is on.
export function EditableImage({ doc, path, bucket, top = 10 }: { doc: string; path: string; bucket: string; top?: number }) {
  const ctx = useSiteEdit()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  if (!ctx?.editing) return null

  async function upload(file: File) {
    setBusy(true); setError('')
    const sb = createClient()
    const name = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: err } = await sb.storage.from(bucket).upload(name, file, { upsert: false })
    setBusy(false)
    if (err) { setError('Uppladdningen misslyckades'); return }
    ctx!.update(doc, path, sb.storage.from(bucket).getPublicUrl(name).data.publicUrl)
  }

  return (
    <div onClick={e => { e.preventDefault(); e.stopPropagation() }}
      style={{ position: 'absolute', top, right: 10, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        style={{ ...btn('#111418', '#F0EDE8', true), boxShadow: '0 4px 14px rgba(0,0,0,.35)' }}>
        <ImageUp size={14} /> {busy ? 'Laddar upp…' : 'Byt bild'}
      </button>
      {error && <span style={{ background: '#111418', color: '#FF8A8A', fontSize: 12, padding: '3px 8px', borderRadius: 6 }}>{error}</span>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
    </div>
  )
}

// True while an admin has "Redigera sida" on (e.g. to pause the hero slider).
export function useIsEditingSite() {
  return !!useSiteEdit()?.editing
}
