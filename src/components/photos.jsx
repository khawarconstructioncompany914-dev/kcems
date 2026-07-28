// ============================================================
// KCEMS · shared bill/proof photo UI
//
// One component set for every place a photo appears: the supervisor's capture
// tray, the reviewer's bill modal, the funds proof tray, the engineer's claim
// form and the owner's bills gallery. Screens must not hand-roll their own
// fixed-size photo box — that is what made the old 72px inline square and the
// 3:4 modal box unable to become a grid.
//
// A photo is { path, capturedAt, url? }:
//   · live mode  — `path` is a private storage path, signed on demand
//   · demo mode  — `path` is the data URL itself, so nothing needs signing
//   · capturing  — `url` is a local object URL, shown before any upload
// ============================================================
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Modal } from './bits.jsx'
import { LIVE } from '../store.jsx'

// Downscale + JPEG-compress so a phone upload stays small. Returns a data URL.
export async function compress(file, max = 1280, quality = 0.72) {
  if (!file) return null
  try {
    const img = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d').drawImage(img, 0, 0, w, h)
    return c.toDataURL('image/jpeg', quality)
  } catch { return null }
}

const isDirect = (p) => !p || p.startsWith('data:') || p.startsWith('blob:')

// Photos for an expense or fund txn. 0003 backfills every historical
// bill_image_url into expense_photo, but fall back to the legacy column
// anyway so an un-migrated row (or the demo seed) still shows its photo
// rather than silently reading as "no photo on file". 'bill' is the demo
// marker, not a real object.
export function photosOf(entity) {
  if (entity?.photos?.length) return entity.photos
  const legacy = entity?.billImageUrl
  if (legacy && legacy !== 'bill') return [{ path: legacy, capturedAt: entity.createdAt || null }]
  return []
}

// Signed URLs last 5 minutes server-side; drop ours a little early so we never
// hand a just-expired URL to an <img>.
const CACHE = new Map()
const TTL = 240_000

// Resolve every photo to something an <img src> can use, signing private
// storage paths in ONE request for the whole set rather than one per image.
export function usePhotoUrls(photos) {
  const [urls, setUrls] = useState({})
  const paths = useMemo(
    () => [...new Set((photos || []).map((p) => p.path).filter((p) => p && !isDirect(p)))],
    [photos],
  )
  const key = paths.join('|')

  useEffect(() => {
    if (!LIVE || !paths.length) return
    let alive = true
    const now = Date.now()
    const fresh = {}, need = []
    for (const p of paths) {
      const hit = CACHE.get(p)
      if (hit && now - hit.at < TTL) fresh[p] = hit.url
      else need.push(p)
    }
    if (Object.keys(fresh).length) setUrls((u) => ({ ...u, ...fresh }))
    if (!need.length) return
    fetch('/api/bills-signed', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: need }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.urls) return
        const at = Date.now()
        for (const [p, url] of Object.entries(d.urls)) CACHE.set(p, { url, at })
        setUrls((u) => ({ ...u, ...d.urls }))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return useCallback((p) => p?.url || (isDirect(p?.path) ? p.path : urls[p?.path]) || null, [urls])
}

const stamp = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ---------- responsive thumbnail grid ----------
// auto-fill + minmax is what makes this survive from a 375px phone to a wide
// desktop panel without any per-screen width being hard-coded anywhere.
export function PhotoGrid({ photos = [], onRemove, onOpen, minPx = 72, children }) {
  const src = usePhotoUrls(photos)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minPx}px, 1fr))`, gap: 8 }}>
      {photos.map((p, i) => {
        const url = src(p)
        return (
          <div key={p.id || p.path || i}
            style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--accent-line)', background: 'var(--input)' }}>
            <button type="button" onClick={() => onOpen?.(i)} aria-label={`Photo ${i + 1}`}
              style={{ all: 'unset', display: 'block', width: '100%', height: '100%', cursor: onOpen ? 'zoom-in' : 'default' }}>
              {url
                ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', font: '600 9px/1 var(--f-mono)', color: 'var(--text-40)' }}>…</span>}
            </button>
            {onRemove && (
              <button type="button" onClick={() => onRemove(i)} aria-label="Remove photo"
                style={{ position: 'absolute', top: 3, right: 3, width: 22, height: 22, borderRadius: '50%', background: 'rgba(5,6,5,.82)', border: 'none', color: '#fff', font: '700 13px/1 var(--f-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            )}
            {photos.length > 1 && (
              <span style={{ position: 'absolute', left: 4, bottom: 4, padding: '1px 5px', borderRadius: 5, background: 'rgba(5,6,5,.72)', font: '600 9px/1.5 var(--f-mono)', color: '#fff' }}>{i + 1}</span>
            )}
          </div>
        )
      })}
      {children}
    </div>
  )
}

// ---------- full-size viewer ----------
export function PhotoViewer({ photos = [], index = 0, open, onClose, onIndex }) {
  const src = usePhotoUrls(photos)
  const many = photos.length > 1
  const go = useCallback((d) => onIndex?.((index + d + photos.length) % photos.length), [index, photos.length, onIndex])

  useEffect(() => {
    if (!open || !many) return
    const onKey = (e) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, many, go])

  const p = photos[index]
  const url = p ? src(p) : null
  const when = stamp(p?.capturedAt)

  return (
    <Modal open={open} onClose={onClose} width={760}>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {many && <button className="btn btn-ghost btn-sm" onClick={() => go(-1)} aria-label="Previous photo">‹</button>}
          <div style={{ flex: 1, textAlign: 'center', font: '600 11px/1 var(--f-mono)', color: 'var(--text-50)' }}>
            {many ? `${index + 1} / ${photos.length}` : 'Photo'}
          </div>
          {many && <button className="btn btn-ghost btn-sm" onClick={() => go(1)} aria-label="Next photo">›</button>}
        </div>

        <div style={{ marginTop: 12, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: '#0d0f0c', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          {url
            ? <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }} />
            : <span style={{ padding: 40, font: '600 12px/1 var(--f-mono)', color: 'var(--text-40)' }}>LOADING…</span>}
        </div>

        <div style={{ marginTop: 10, textAlign: 'center', font: '500 11px/1.5 var(--f-mono)', color: 'var(--text-42)' }}>
          {when ? `Taken ${when}` : 'Capture time not recorded'}
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}

// ---------- view mode: grid that opens its own viewer ----------
export function PhotoGallery({ photos = [], minPx = 72, empty = 'No photo on file' }) {
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  if (!photos.length) {
    return <div style={{ padding: '22px 0', textAlign: 'center', font: '600 11px/1 var(--f-mono)', color: 'var(--text-40)' }}>{empty}</div>
  }
  return (
    <>
      <PhotoGrid photos={photos} minPx={minPx} onOpen={(n) => { setI(n); setOpen(true) }} />
      <PhotoViewer photos={photos} index={i} open={open} onClose={() => setOpen(false)} onIndex={setI} />
    </>
  )
}

// ---------- edit mode: capture tray ----------
// `photos` is [{ url, dataUrl, capturedAt }]. capturedAt is stamped the moment
// the photo is ATTACHED, client-side — not at upload — so a bill photographed
// at the yard keeps that time even if the phone uploads it hours later.
export function PhotoTray({ photos = [], onChange, max = 8, hint, disabled }) {
  const camRef = useRef(null)
  const galRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const full = photos.length >= max

  useEffect(() => () => photos.forEach((p) => p.url?.startsWith('blob:') && URL.revokeObjectURL(p.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, max - photos.length)
    e.target.value = '' // let the same file be picked again
    if (!files.length) return
    setBusy(true)
    const added = []
    for (const f of files) {
      const dataUrl = await compress(f)
      if (dataUrl) added.push({ url: URL.createObjectURL(f), dataUrl, capturedAt: new Date().toISOString() })
    }
    setBusy(false)
    if (added.length) onChange([...photos, ...added])   // APPEND, never replace
  }

  const remove = (i) => {
    const p = photos[i]
    if (p?.url?.startsWith('blob:')) URL.revokeObjectURL(p.url)
    onChange(photos.filter((_, n) => n !== i))
  }

  const Tile = ({ onClick, label, icon, accent }) => (
    <button type="button" onClick={onClick} disabled={disabled || full || busy}
      style={{ aspectRatio: '1', borderRadius: 12, background: 'var(--input)', border: `1px dashed ${accent ? 'var(--accent-line)' : 'var(--border)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: accent ? 'var(--accent)' : 'var(--text-40)', cursor: full || busy ? 'not-allowed' : 'pointer', opacity: full ? 0.4 : 1 }}>
      {icon}
      <span style={{ font: '600 9px/1 var(--f-mono)' }}>{label}</span>
    </button>
  )

  return (
    <div>
      {/* `multiple` lets a supervisor pick several bill pages in one go */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: 'none' }} />
      <input ref={galRef} type="file" accept="image/*" multiple onChange={onPick} style={{ display: 'none' }} />

      <PhotoGrid photos={photos} onRemove={disabled ? undefined : remove}>
        <Tile accent onClick={() => camRef.current?.click()} label="CAMERA"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>} />
        <Tile onClick={() => galRef.current?.click()} label="GALLERY"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>} />
      </PhotoGrid>

      <div style={{ font: '500 11px/1.4 var(--f-body)', color: 'var(--text-40)', marginTop: 8 }}>
        {busy ? 'Processing…' : full ? `Maximum ${max} photos.` : hint}
      </div>
    </div>
  )
}
