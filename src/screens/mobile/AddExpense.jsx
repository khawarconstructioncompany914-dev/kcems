import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, CATEGORIES, SITE_CATEGORIES } from '../../data/model.js'
import { PhotoTray } from '../../components/photos.jsx'

const MAX_PHOTOS = 8

export default function AddExpense() {
  const nav = useNavigate()
  const { dispatch, toast } = useStore()
  const { me, userById } = useSelectors()
  const eng = userById(me.engineerId)

  const [amount, setAmount] = useState('')
  const [cat, setCat] = useState('materials')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)   // the bill just sent, if any

  const amt = Math.max(0, Math.round(Number(amount.toString().replace(/[^\d]/g, '')) || 0))
  const valid = amt > 0 && note.trim() && photos.length >= 1

  const reset = () => { setAmount(''); setNote(''); setPhotos([]); setCat('materials'); setDone(null) }

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    await dispatch({
      type: 'LOG_EXPENSE',
      payload: {
        supervisorId: me.id, siteId: me.siteId, amount: amt, category: cat, note: note.trim(),
        photos: photos.map((p) => ({ dataUrl: p.dataUrl, capturedAt: p.capturedAt })),
      },
    })
    setBusy(false)
    toast(`Sent to ${eng?.name.split(' ')[0] || 'engineer'} for review`)
    setDone({ amount: amt, note: note.trim() })
  }

  // After a send we stay on the page rather than bouncing to /history: a
  // supervisor clearing a day's pocketful of bills logs several in a row, and
  // navigating away after each one made that a five-tap round trip per bill.
  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', maxWidth: 620, margin: '0 auto', justifyContent: 'center', padding: '0 20px', textAlign: 'center' }}>
        <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 30px/1 var(--f-body)', margin: '0 auto 18px' }}>✓</div>
        <div style={{ font: '700 19px/1.3 var(--f-body)', color: '#fff' }}>Sent for review</div>
        <div style={{ font: '500 13px/1.5 var(--f-body)', color: 'var(--text-50)', marginTop: 8 }}>
          {formatMoney(done.amount)} · {done.note}
        </div>
        <button className="btn btn-primary" style={{ width: '100%', height: 52, fontSize: 15, marginTop: 26 }} onClick={reset}>
          Log another bill →
        </button>
        <button className="btn btn-ghost" style={{ width: '100%', height: 46, marginTop: 10 }} onClick={() => nav('/history')}>
          Done, back to history
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', maxWidth: 620, margin: '0 auto' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 20px 14px' }}>
        <button onClick={() => nav('/home')} style={{ background: 'none', border: 'none', font: '400 24px/1 var(--f-body)', color: '#fff', cursor: 'pointer', padding: 0, minWidth: 44, minHeight: 44, textAlign: 'left' }}>‹</button>
        <div style={{ font: '700 17px/1 var(--f-body)', color: '#fff' }}>Log an expense</div>
      </div>

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

        <div style={{ font: '600 12px/1.4 var(--f-mono)', color: 'var(--text-50)', marginBottom: 9 }}>CATEGORY</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {SITE_CATEGORIES.map((k) => (
            <button key={k} className={`chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>{CATEGORIES[k].label}</button>
          ))}
        </div>

        <div style={{ font: '600 12px/1.4 var(--f-mono)', color: 'var(--text-50)', marginBottom: 9 }}>NOTE</div>
        <input className="field" placeholder="e.g. River sand — 6 trolleys" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginBottom: 16, height: 44 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <span style={{ font: '600 12px/1.4 var(--f-mono)', color: 'var(--text-50)' }}>BILL PHOTOS</span>
          <span style={{ font: '600 10px/1 var(--f-mono)', color: photos.length ? 'var(--text-40)' : 'var(--danger)' }}>
            {photos.length ? `${photos.length} OF ${MAX_PHOTOS}` : 'REQUIRED'}
          </span>
        </div>
        <PhotoTray
          photos={photos} onChange={setPhotos} max={MAX_PHOTOS}
          hint="Front and back, or several items — add as many as the bill needs."
        />
      </div>

      <div style={{ flex: 'none', padding: '14px 20px 26px', background: 'linear-gradient(0deg, var(--bg-panel) 70%, transparent)' }}>
        <button className="btn btn-primary" style={{ width: '100%', height: 52, fontSize: 15, opacity: valid && !busy ? 1 : 0.5 }} disabled={!valid || busy} onClick={submit}>
          {busy ? 'Sending…' : photos.length ? `Send to ${eng?.name.split(' ')[0] || 'engineer'} for review →` : 'Add a bill photo to send'}
        </button>
      </div>
    </div>
  )
}
