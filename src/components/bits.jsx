// Small shared building blocks used across screens.
import { useEffect } from 'react'
import { STATUS, CATEGORIES, initials } from '../data/model.js'
import { useStore } from '../store.jsx'

// coloured monogram badge for a person
export function Monogram({ name, color, soft, size = 34, radius = 10, font }) {
  return (
    <span className="mono-badge" style={{ width: size, height: size, borderRadius: radius, background: soft, color, fontSize: font || Math.round(size * 0.35) }}>
      {initials(name)}
    </span>
  )
}

export function StatusPill({ status, small }) {
  const s = STATUS[status] || STATUS.engineer_review
  return (
    <span className={`pill ${s.pill}`} style={small ? { height: 22, fontSize: 10, padding: '0 9px' } : undefined}>
      <span className="dot" />{s.short}
    </span>
  )
}

export function CatDot({ category, size = 8 }) {
  const c = CATEGORIES[category] || CATEGORIES.other
  return <span style={{ width: size, height: size, borderRadius: 3, background: c.color, flex: 'none' }} />
}

export function Progress({ pct, color = 'var(--accent)', height = 9 }) {
  return (
    <div style={{ height, borderRadius: 5, background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5, transition: 'width .5s cubic-bezier(.2,.7,.2,1)' }} />
    </div>
  )
}

// receipt-photo placeholder (no real uploads in the prototype)
export function BillPhoto({ w = 72, h = 72, filled = true, label }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 12, flex: 'none',
      background: filled ? 'linear-gradient(135deg,#1a1d17,#0f110d)' : 'var(--input)',
      border: `1px ${filled ? 'solid var(--accent-line)' : 'dashed var(--border)'}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
      color: filled ? 'var(--accent)' : 'var(--text-40)', overflow: 'hidden', position: 'relative',
    }}>
      {filled
        ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M3 17l5-6 4 4 3-4 6 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.6"/></svg>
        : <><span style={{ fontSize: 19 }}>＋</span>{label && <span style={{ font: '600 9px/1 var(--f-mono)' }}>{label}</span>}</>}
    </div>
  )
}

// centered modal
export function Modal({ open, onClose, width = 440, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(3,4,3,.66)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} className="fade-in">
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', animation: 'scaleIn .22s cubic-bezier(.2,.7,.2,1) both', boxShadow: '0 50px 120px -50px #000' }}>
        {children}
      </div>
    </div>
  )
}

export function Toasts() {
  const { toasts } = useStore()
  const tone = { accent: 'var(--accent)', warn: 'var(--warn)', danger: 'var(--danger)', info: 'var(--info)' }
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="tdot" style={{ background: tone[t.tone] || tone.accent }} />{t.msg}
        </div>
      ))}
    </div>
  )
}

// empty-state
export function Empty({ title, sub }) {
  return (
    <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-40)' }}>
      <div style={{ font: '700 15px/1.2 var(--f-body)', color: 'var(--text-70)' }}>{title}</div>
      {sub && <div style={{ font: '500 12px/1.5 var(--f-body)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}
