// Expense row + review/approve action controls shared by the office queues.
import { useState } from 'react'
import { useStore, useSelectors } from '../store.jsx'
import { formatMoney, fmtDate, ROLES } from '../data/model.js'
import { Monogram, StatusPill, CatDot, Modal } from './bits.jsx'
import { PhotoGallery, photosOf } from './photos.jsx'

// A single expense card with actions appropriate to `mode`:
//  'engineer' -> pass up / return / reject      'finance' -> approve / reject
export function ExpenseCard({ e, mode }) {
  const { dispatch, toast } = useStore()
  const { me } = useSelectors()
  const [bill, setBill] = useState(false)
  const [reject, setReject] = useState(false)
  const [ret, setRet] = useState(false)
  const photos = photosOf(e)
  const isClaim = e.kind === 'reimbursement'

  const act = (fn) => fn()

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
        <Monogram name={e.supervisor?.name} color="var(--accent)" soft="var(--accent-soft)" size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ font: '700 14px/1.2 var(--f-body)', color: 'var(--text)' }}>{e.note}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ font: '500 12px/1.4 var(--f-mono)', color: 'var(--text-42)' }}>{e.supervisor?.name}</span>
            <span style={{ color: 'var(--text-25)' }}>·</span>
            {/* a reimbursement claim has no site, so show what it is instead */}
            {isClaim
              ? <span className="pill pill-info" style={{ height: 20, fontSize: 9 }}>REIMBURSEMENT</span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: '500 12px/1.4 var(--f-mono)', color: 'var(--text-42)' }}><CatDot category={e.category} />{e.site?.label || e.site?.name}</span>}
            <span style={{ color: 'var(--text-25)' }}>·</span>
            <span style={{ font: '500 12px/1.4 var(--f-mono)', color: 'var(--text-40)' }}>{fmtDate(e.createdAt)}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flex: 'none' }}>
          <div className="num" style={{ font: '700 17px/1 var(--f-display)', color: 'var(--text)' }}>{formatMoney(e.amount)}</div>
          <div style={{ marginTop: 7 }}><StatusPill status={e.status} small /></div>
        </div>
      </div>

      {e.returnNote && <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--info)', background: 'var(--info-soft)', border: '1px solid var(--info-line)', borderRadius: 10, padding: '9px 12px' }}>↩ Returned: {e.returnNote}</div>}
      {e.rejectReason && <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', borderRadius: 10, padding: '9px 12px' }}>✕ {e.rejectReason}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setBill(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 17l5-6 4 4 3-4 6 7" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="8" r="2"/></svg>
          {photos.length > 1 ? `Bills · ${photos.length}` : 'Bill'}
        </button>
        <div className="spacer" />
        {mode === 'engineer' && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setRet(true)}>Return</button>
            <button className="btn btn-danger btn-sm" onClick={() => setReject(true)}>Reject</button>
            <button className="btn btn-primary btn-sm" onClick={() => act(() => { dispatch({ type: 'PASS_UP', id: e.id, actorId: me.id }); toast(`Passed up · ${formatMoney(e.amount)}`) })}>Pass up →</button>
          </>
        )}
        {mode === 'finance' && (
          <>
            <button className="btn btn-danger btn-sm" onClick={() => setReject(true)}>Reject</button>
            <button className="btn btn-primary btn-sm" onClick={() => act(() => { dispatch({ type: 'APPROVE', id: e.id, actorId: me.id }); toast(`Approved · ${formatMoney(e.amount)} deducted`) })}>Approve ✓</button>
          </>
        )}
      </div>

      {/* bill modal */}
      <Modal open={bill} onClose={() => setBill(false)} width={520}>
        <div style={{ padding: 20 }}>
          <div style={{ font: '700 15px/1 var(--f-body)', color: 'var(--text)', marginBottom: 4 }}>
            {photos.length > 1 ? `Bill photos · ${photos.length}` : 'Bill photo'}
          </div>
          <div style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--text-42)', marginBottom: 16 }}>{e.note} · {formatMoney(e.amount)}</div>
          {/* a responsive grid, so this reflows instead of being one fixed 3:4 box */}
          <PhotoGallery photos={photos} minPx={96} />
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={() => setBill(false)}>Close</button>
        </div>
      </Modal>

      {/* reject modal */}
      <ReasonModal open={reject} onClose={() => setReject(false)} title="Reject expense" tone="danger" cta="Reject · mark owed"
        hint="A rejected expense becomes money the site engineer owes back. Reason is required."
        placeholder="e.g. Wrong site — belongs to Gulberg"
        onSubmit={(reason) => { dispatch({ type: 'REJECT', id: e.id, actorId: me.id, reason }); toast(`Rejected · owed ${formatMoney(e.amount)}`, 'danger') }} />

      {/* return modal */}
      <ReasonModal open={ret} onClose={() => setRet(false)} title="Return to fix" tone="info" cta="Send back"
        hint="Sends the item back to the site engineer's phone with a note to fix &amp; re-submit."
        placeholder="e.g. Attach a clearer photo of the bill"
        onSubmit={(note) => { dispatch({ type: 'RETURN', id: e.id, actorId: me.id, note }); toast('Returned to site engineer', 'info') }} />
    </div>
  )
}

export function ReasonModal({ open, onClose, title, hint, placeholder, cta, tone = 'danger', onSubmit }) {
  const [val, setVal] = useState('')
  const submit = () => { if (!val.trim()) return; onSubmit(val.trim()); setVal(''); onClose() }
  const btn = tone === 'danger' ? 'btn-danger' : 'btn-primary'
  return (
    <Modal open={open} onClose={onClose} width={420}>
      <div style={{ padding: 22 }}>
        <div style={{ font: '700 16px/1 var(--f-body)', color: 'var(--text)' }}>{title}</div>
        <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--text-42)', marginTop: 8 }} dangerouslySetInnerHTML={{ __html: hint }} />
        <textarea className="field" style={{ marginTop: 16, minHeight: 88 }} placeholder={placeholder} value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn ${btn}`} style={{ flex: 1.4 }} disabled={!val.trim()} onClick={submit}>{cta}</button>
        </div>
      </div>
    </Modal>
  )
}
