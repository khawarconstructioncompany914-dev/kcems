import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, CATEGORIES } from '../../data/model.js'

const CATS = ['materials', 'labour', 'fuel', 'tea_food']

export default function AddExpense() {
  const nav = useNavigate()
  const { dispatch, toast } = useStore()
  const { me, userById, siteById } = useSelectors()
  const eng = userById(me.engineerId)

  const camRef = useRef(null)   // opens the camera on mobile
  const galRef = useRef(null)   // opens the photo library / file picker

  const [amount, setAmount] = useState('')
  const [cat, setCat] = useState('materials')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState(null) // { url, name }

  const amt = Math.max(0, Math.round(Number(amount.toString().replace(/[^\d]/g, '')) || 0))
  const valid = amt > 0 && note.trim() && !!photo

  const onPick = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (photo?.url) URL.revokeObjectURL(photo.url)
    setPhoto({ url: URL.createObjectURL(f), name: f.name })
    e.target.value = '' // allow re-selecting the same file
  }
  const clearPhoto = () => { if (photo?.url) URL.revokeObjectURL(photo.url); setPhoto(null) }

  const submit = () => {
    if (!valid) return
    // NOTE: in demo mode the photo stays on-device (preview only). Once Supabase
    // storage is wired, the file uploads to the private "bills" bucket and the
    // returned URL is saved as billImageUrl.
    dispatch({ type: 'LOG_EXPENSE', payload: { supervisorId: me.id, siteId: me.siteId, amount: amt, category: cat, note: note.trim(), bill: true } })
    toast(`Sent to ${eng?.name.split(' ')[0]} for review`)
    nav('/m/history')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '6px 20px 14px' }}>
        <button onClick={() => nav('/m')} style={{ background: 'none', border: 'none', font: '400 24px/1 var(--f-body)', color: '#fff', cursor: 'pointer', padding: 0 }}>‹</button>
        <div style={{ font: '700 17px/1 var(--f-body)', color: '#fff' }}>Log an expense</div>
      </div>

      {/* hidden native inputs — capture="environment" makes phones open the camera */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: 'none' }} />
      <input ref={galRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
          <div style={{ font: '600 10px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--text-40)' }}>AMOUNT SPENT</div>
          <input
            value={amount ? `Rs ${Number(amt).toLocaleString('en-US')}` : ''}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Rs 0" inputMode="numeric"
            style={{ width: '100%', textAlign: 'center', background: 'none', border: 'none', outline: 'none', font: '700 44px/1 var(--f-display)', color: 'var(--accent)', letterSpacing: '-.03em', marginTop: 12 }}
          />
          <div style={{ width: 120, height: 2, background: 'var(--accent)', margin: '12px auto 0', borderRadius: 2 }} />
        </div>

        <div style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--text-50)', marginBottom: 9 }}>CATEGORY</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {CATS.map((k) => (
            <button key={k} className={`chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>{CATEGORIES[k].label}</button>
          ))}
        </div>

        <div style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--text-50)', marginBottom: 9 }}>NOTE</div>
        <input className="field" placeholder="e.g. River sand — 6 trolleys" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginBottom: 16, height: 44 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <span style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--text-50)' }}>BILL PHOTO</span>
          <span style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--danger)' }}>REQUIRED</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          {/* preview of the captured bill */}
          {photo && (
            <div style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', position: 'relative', border: '1px solid var(--accent-line)', flex: 'none' }}>
              <img src={photo.url} alt="bill" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <button onClick={clearPhoto} style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: 'rgba(5,6,5,.8)', border: 'none', color: '#fff', font: '700 12px/1 var(--f-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          )}
          {/* camera */}
          <button onClick={() => camRef.current?.click()} style={{ width: 72, height: 72, borderRadius: 12, background: 'var(--input)', border: '1px dashed var(--accent-line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--accent)', cursor: 'pointer' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span style={{ font: '600 9px/1 var(--f-mono)' }}>CAMERA</span>
          </button>
          {/* gallery */}
          <button onClick={() => galRef.current?.click()} style={{ width: 72, height: 72, borderRadius: 12, background: 'var(--input)', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-40)', cursor: 'pointer' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            <span style={{ font: '600 9px/1 var(--f-mono)' }}>GALLERY</span>
          </button>
        </div>
        {!photo && <div style={{ font: '500 11px/1.4 var(--f-body)', color: 'var(--text-40)', marginTop: 4 }}>Snap the bill (or pick from gallery) — required before you can send.</div>}
      </div>

      <div style={{ flex: 'none', padding: '14px 20px 26px', background: 'linear-gradient(0deg, var(--bg-panel) 70%, transparent)' }}>
        <button className="btn btn-primary" style={{ width: '100%', height: 52, fontSize: 15, opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={submit}>
          {photo ? `Send to ${eng?.name.split(' ')[0] || 'engineer'} for review →` : 'Add a bill photo to send'}
        </button>
      </div>
    </div>
  )
}
