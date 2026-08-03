import { useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, fmtDate, relDay, STATUS } from '../../data/model.js'
import { Modal } from '../../components/bits.jsx'
import { PhotoTray, PhotoGallery, photosOf } from '../../components/photos.jsx'

const FILTERS = [
  ['all', 'All'],
  ['approved', 'Approved'],
  ['review', 'Review'],
  ['owed', 'Owed'],
]

export default function History() {
  const { dispatch, toast } = useStore()
  const { me, userById, state } = useSelectors()
  const [f, setF] = useState('all')
  const [fixing, setFixing] = useState(null)   // the returned expense being fixed
  const [viewing, setViewing] = useState(null) // expense whose photos are open
  const eng = userById(me.engineerId)

  let list = state.expenses.filter((e) => e.supervisorId === me.id)
  if (f === 'approved') list = list.filter((e) => e.status === 'approved')
  else if (f === 'review') list = list.filter((e) => e.status === 'engineer_review' || e.status === 'finance_review')
  else if (f === 'owed') list = list.filter((e) => e.status === 'rejected' && !e.settledAt)
  list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // group by today / earlier
  const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString()
  const today = list.filter((e) => isToday(e.createdAt))
  const earlier = list.filter((e) => !isToday(e.createdAt))

  const Row = ({ e }) => {
    const ph = photosOf(e)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 13, background: 'var(--surface)', border: '1px solid var(--border-3)' }}>
        <span style={{ width: 6, height: 34, borderRadius: 3, background: STATUS[e.status].color, flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '600 12px/1.2 var(--f-body)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.note}</div>
          <div style={{ font: '500 10px/1.2 var(--f-mono)', color: STATUS[e.status].color, marginTop: 4 }}>
            {STATUS[e.status].short}{e.status === 'engineer_review' ? ` · ${eng?.name.split(' ')[0]}` : e.status === 'rejected' ? ' · ' + (e.rejectReason?.split('—')[0].trim() || '') : ''}
            {ph.length > 0 && (
              <button type="button" onClick={() => setViewing(e)}
                style={{ background: 'none', border: 'none', padding: '0 0 0 6px', font: 'inherit', color: 'var(--text-42)', cursor: 'pointer' }}>
                · {ph.length > 1 ? `${ph.length} photos` : '1 photo'}
              </button>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="num" style={{ font: '700 13px/1 var(--f-display)', color: 'var(--text)' }}>{formatMoney(e.amount).replace('Rs ', '')}</div>
          {e.status === 'returned' && (
            <button className="btn btn-primary btn-sm" style={{ height: 26, marginTop: 6, fontSize: 11, padding: '0 9px' }}
              onClick={() => setFixing(e)}>Fix &amp; re-submit</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="field-screen">
      <div style={{ padding: '6px 20px 12px' }}>
        <div style={{ font: '700 20px/1 var(--f-display)', color: 'var(--text)' }}>My history</div>
        <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
          {FILTERS.map(([k, label]) => (
            <button key={k} className={`chip ${f === k ? 'on' : ''}`} style={{ height: 30, fontSize: 11 }} onClick={() => setF(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '4px 16px 0' }}>
        {list.length === 0 && <div style={{ padding: '40px 0', textAlign: 'center', font: '500 12px/1 var(--f-body)', color: 'var(--text-40)' }}>Nothing here yet.</div>}

        {today.length > 0 && <>
          <div style={{ font: '600 10px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--text-32)', margin: '8px 4px 10px' }}>TODAY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>{today.map((e) => <Row key={e.id} e={e} />)}</div>
        </>}

        {earlier.length > 0 && <>
          <div style={{ font: '600 10px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--text-32)', margin: '0 4px 10px' }}>EARLIER</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{earlier.map((e) => <Row key={e.id} e={e} />)}</div>
        </>}
      </div>

      <ResubmitModal e={fixing} onClose={() => setFixing(null)}
        onDone={(payload) => {
          dispatch({ type: 'RESUBMIT', id: fixing.id, actorId: me.id, ...payload })
          toast('Re-submitted for review')
          setFixing(null)
        }} />

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} width={520}>
        <div style={{ padding: 20 }}>
          <div style={{ font: '700 15px/1 var(--f-body)', color: 'var(--text)', marginBottom: 14 }}>{viewing?.note}</div>
          <PhotoGallery photos={photosOf(viewing || {})} minPx={92} />
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={() => setViewing(null)}>Close</button>
        </div>
      </Modal>
    </div>
  )
}

// An engineer returns an item because something was wrong with it — usually an
// unreadable photo. So re-submitting has to be a chance to FIX it, not just a
// button that throws the same item back into the queue. New photos are added
// alongside the originals rather than replacing them.
function ResubmitModal({ e, onClose, onDone }) {
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)

  // reset whenever a different item is opened
  const key = e?.id
  const [seen, setSeen] = useState(key)
  if (key !== seen) { setSeen(key); setNote(''); setPhotos([]) }

  if (!e) return null
  const existing = photosOf(e)

  const send = async () => {
    setBusy(true)
    await onDone({
      note: note.trim() || undefined,
      photos: photos.map((p) => ({ dataUrl: p.dataUrl, capturedAt: p.capturedAt })),
    })
    setBusy(false)
  }

  return (
    <Modal open onClose={onClose} width={460}>
      <div style={{ padding: 20 }}>
        <div style={{ font: '700 16px/1 var(--f-body)', color: 'var(--text)' }}>Fix &amp; re-submit</div>
        <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--info)', background: 'var(--info-soft)', border: '1px solid var(--info-line)', borderRadius: 10, padding: '9px 12px', marginTop: 12 }}>
          ↩ {e.returnNote || 'Returned to fix.'}
        </div>

        {existing.length > 0 && <>
          <div style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--text-50)', margin: '16px 0 8px' }}>ALREADY ATTACHED</div>
          <PhotoGallery photos={existing} minPx={72} />
        </>}

        <div style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--text-50)', margin: '16px 0 8px' }}>ADD A BETTER PHOTO</div>
        <PhotoTray photos={photos} onChange={setPhotos} max={8} hint="Optional — the old photos are kept either way." />

        <label className="field-label" style={{ marginTop: 14 }}>Correct the note (optional)</label>
        <input className="field" placeholder={e.note} value={note} onChange={(ev) => setNote(ev.target.value)} />

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={busy} onClick={send}>
            {busy ? 'Sending…' : 'Send back for review'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
