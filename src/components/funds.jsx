// Add-funds modal (owner/finance) — mirrors the mobile "Add funds" screen.
import { useState } from 'react'
import { useStore, useSelectors } from '../store.jsx'
import { formatMoney } from '../data/model.js'
import { Modal, Monogram } from './bits.jsx'
import { PhotoTray } from './photos.jsx'

const METHODS = ['cash', 'cheque', 'online']

// Handing money over is the one step with no paper trail of its own, so the
// transfer has to carry its own evidence. The prompt names the artefact the
// person is actually holding rather than saying "proof" at them.
const PROOF_HINT = {
  cash:   'Photo of the cash',
  cheque: 'Photo of the cheque',
  online: 'Screenshot of the transfer',
}
const MAX_PROOF = 3

export function AddFundsModal({ open, onClose, supervisorId, presetSupervisor = true }) {
  const { state, dispatch, toast } = useStore()
  const { me, supervisors, userById, cashInHand } = useSelectors()
  const [supId, setSupId] = useState(supervisorId || supervisors[0]?.id)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)

  const sid = supervisorId || supId
  const sup = userById(sid)
  const amt = Math.max(0, Math.round(Number(amount.toString().replace(/[^\d]/g, '')) || 0))
  const bal = sup ? cashInHand(sid) : null
  const valid = amt > 0 && sid && photos.length >= 1

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    const res = await dispatch({
      type: 'ADD_FUNDS', supervisorId: sid, amount: amt, method, note, actorId: me.id,
      photos: photos.map((p) => ({ dataUrl: p.dataUrl, capturedAt: p.capturedAt })),
    })
    setBusy(false)
    // Handing over cash is the one action with no paper trail of its own. If
    // the server refused it, saying "Added Rs 50,000" and closing the modal
    // would leave finance believing money was recorded that was not.
    if (res && res.status >= 400) {
      return toast(`Not recorded — ${res.body?.error || 'please try again'}. Nothing was saved.`, 'danger')
    }
    toast(`Added ${formatMoney(amt)} to ${sup?.name?.split(' ')[0]}`, 'accent')
    setAmount(''); setNote(''); setPhotos([]); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={430}>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
          <span className="mono-badge" style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 18 }}>+</span>
          <div style={{ font: '700 16px/1 var(--f-body)', color: 'var(--text)' }}>Add funds</div>
        </div>

        {!supervisorId && (
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Site Engineer</label>
            <select className="field" value={supId} onChange={(e) => setSupId(e.target.value)}>
              {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {sup && (
          <div className="surface" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12, borderRadius: 12, marginBottom: 14 }}>
            <Monogram name={sup.name} color="var(--accent)" soft="var(--accent-soft)" size={34} />
            <div style={{ flex: 1 }}>
              <div style={{ font: '700 13px/1 var(--f-body)', color: 'var(--text)' }}>{sup.name}</div>
              <div style={{ font: '500 12px/1.4 var(--f-mono)', color: 'var(--text-42)', marginTop: 4 }}>current cash · {formatMoney(bal.cash)}</div>
            </div>
          </div>
        )}

        <label className="field-label">Amount (PKR)</label>
        <input className="field" inputMode="numeric" placeholder="e.g. 50,000" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus style={{ font: '700 18px/1 var(--f-display)', height: 52 }} />

        <label className="field-label" style={{ marginTop: 14 }}>Method</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {METHODS.map((m) => (
            <button key={m} type="button" onClick={() => setMethod(m)} className="btn btn-sm" style={{ flex: 1, textTransform: 'capitalize', background: method === m ? 'var(--accent-fill)' : 'var(--input)', color: method === m ? 'var(--accent-ink)' : 'var(--text-70)', border: `1px solid ${method === m ? 'transparent' : 'var(--border)'}` }}>{m}</button>
          ))}
        </div>

        <label className="field-label" style={{ marginTop: 14 }}>Note (optional)</label>
        <input className="field" placeholder="e.g. Top-up for finishing phase" value={note} onChange={(e) => setNote(e.target.value)} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 9 }}>
          <span className="field-label" style={{ margin: 0 }}>Proof</span>
          <span style={{ font: '600 10px/1 var(--f-mono)', color: photos.length ? 'var(--text-40)' : 'var(--danger)' }}>
            {photos.length ? `${photos.length} OF ${MAX_PROOF}` : 'REQUIRED'}
          </span>
        </div>
        <PhotoTray photos={photos} onChange={setPhotos} max={MAX_PROOF} hint={PROOF_HINT[method]} />

        {amt > 0 && bal && (
          <div style={{ font: '500 12px/1.5 var(--f-mono)', color: 'var(--text-50)', marginTop: 14, textAlign: 'center' }}>
            new cash in hand → <b style={{ color: 'var(--accent)' }}>{formatMoney(bal.cash + amt)}</b>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={!valid || busy} onClick={submit}>
            {busy ? 'Adding…' : !photos.length && amt > 0 ? 'Add proof photo' : `Add ${amt ? formatMoney(amt) : 'funds'}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
