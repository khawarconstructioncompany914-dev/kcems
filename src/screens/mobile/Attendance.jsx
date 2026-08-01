// Field attendance. One tap to mark today, a smaller path to request leave,
// and a fortnight strip so someone can see their own record without a trip to
// the office grid.
import { useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { fmtDate } from '../../data/model.js'
import { Modal } from '../../components/bits.jsx'
import { MARK, markMeta, dayKey } from '../../data/attendance.js'

// Waiting on GPS must never block the mark itself. If the person denies the
// permission, or the fix takes too long, the attendance still goes in with no
// coordinates — losing a location is a much smaller problem than someone
// standing on a site unable to record that they turned up.
const LOCATION_TIMEOUT = 8000
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: null, lng: null })
    let done = false
    const finish = (v) => { if (!done) { done = true; resolve(v) } }
    const timer = setTimeout(() => finish({ lat: null, lng: null }), LOCATION_TIMEOUT)
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(timer); finish({ lat: p.coords.latitude, lng: p.coords.longitude }) },
      () => { clearTimeout(timer); finish({ lat: null, lng: null }) },
      { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT, maximumAge: 60_000 },
    )
  })
}

const LAST_DAYS = 14

export default function FieldAttendance() {
  const { dispatch, toast } = useStore()
  const { me, attendanceOn, myAttendanceToday } = useSelectors()
  const [busy, setBusy] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const todays = myAttendanceToday()
  const strip = Array.from({ length: LAST_DAYS }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (LAST_DAYS - 1 - i))
    return { d, row: attendanceOn(me.id, dayKey(d)) }
  })

  const markPresent = async () => {
    if (busy || todays) return
    setBusy(true)
    const { lat, lng } = await getLocation()
    const res = await dispatch({ type: 'MARK_ATTENDANCE', kind: 'present', lat, lng, userId: me.id, actorId: me.id })
    setBusy(false)
    if (res && res.status === 409) return toast('You have already marked today', 'warn')
    toast(lat == null ? 'Marked present · no location' : 'Marked present')
  }

  const requestLeave = async (note) => {
    setLeaveOpen(false)
    const res = await dispatch({ type: 'MARK_ATTENDANCE', kind: 'leave', note, userId: me.id, actorId: me.id })
    if (res && res.status === 409) return toast('You already have a mark for today', 'warn')
    toast('Leave requested — waiting for approval', 'info')
  }

  const meta = markMeta(todays)

  return (
    <div className="field-screen">
      <div style={{ padding: '6px 20px 4px' }}>
        <div style={{ font: '700 20px/1 var(--f-display)', color: 'var(--text)' }}>Attendance</div>
      </div>

      {/* today */}
      <div style={{ margin: '12px 16px 0' }}>
        {todays ? (
          <div style={{ background: meta.soft, border: `1px solid ${meta.color}`, borderRadius: 18, padding: 20, textAlign: 'center' }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: meta.color, color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 26px/1 var(--f-body)', margin: '0 auto 12px' }}>
              {todays.kind === 'present' ? '✓' : '↪'}
            </div>
            <div style={{ font: '700 16px/1.3 var(--f-body)', color: 'var(--text)' }}>
              {todays.kind === 'present' ? "You're marked present today" : `Leave ${todays.status}`}
            </div>
            <div style={{ font: '500 12.5px/1.5 var(--f-body)', color: 'var(--text-70)', marginTop: 6 }}>
              {new Date(todays.markedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              {todays.kind === 'present' && todays.lat == null ? ' · no location recorded' : ''}
              {todays.kind === 'leave' && todays.status === 'pending' ? ' · waiting for approval' : ''}
            </div>
          </div>
        ) : (
          <>
            <button className="btn btn-primary" style={{ width: '100%', height: 60, fontSize: 16 }} disabled={busy} onClick={markPresent}>
              {busy ? 'Marking…' : 'Mark today: Present'}
            </button>
            <button className="btn btn-ghost" style={{ width: '100%', height: 46, marginTop: 10 }} onClick={() => setLeaveOpen(true)}>
              Request leave instead
            </button>
            <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--text-50)', marginTop: 10, textAlign: 'center' }}>
              One mark per day. Your location is recorded with a present mark and is visible to the owner and admin only.
            </div>
          </>
        )}
      </div>

      {/* last fortnight */}
      <div style={{ padding: '22px 16px 0' }}>
        <div style={{ font: '600 12px/1.4 var(--f-mono)', letterSpacing: '.1em', color: 'var(--text-50)', margin: '0 4px 12px' }}>LAST {LAST_DAYS} DAYS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {strip.map(({ d, row }) => {
            const m = markMeta(row)
            return (
              <div key={dayKey(d)} className="surface" style={{ borderRadius: 11, padding: '9px 4px', textAlign: 'center', border: '1px solid var(--border-3)' }}>
                <div style={{ font: '500 11px/1.3 var(--f-body)', color: 'var(--text-50)' }}>{d.toLocaleDateString('en-GB', { weekday: 'narrow' })}</div>
                <div style={{ font: '700 13px/1.3 var(--f-display)', color: 'var(--text)', marginTop: 2 }}>{d.getDate()}</div>
                <div style={{ width: 9, height: 9, borderRadius: '50%', margin: '7px auto 0', background: m ? m.color : 'transparent', border: m ? 'none' : '1px solid var(--border)' }} />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
          {Object.entries(MARK).map(([k, v]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 12px/1.4 var(--f-body)', color: 'var(--text-70)' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: v.color }} />{v.label}
            </span>
          ))}
        </div>
      </div>

      <LeaveModal open={leaveOpen} onClose={() => setLeaveOpen(false)} onSubmit={requestLeave} />
    </div>
  )
}

function LeaveModal({ open, onClose, onSubmit }) {
  const [note, setNote] = useState('')
  const [seen, setSeen] = useState(open)
  if (open !== seen) { setSeen(open); if (open) setNote('') }
  if (!open) return null
  return (
    <Modal open onClose={onClose} width={400}>
      <div style={{ padding: 22 }}>
        <div style={{ font: '700 16px/1 var(--f-body)', color: 'var(--text)' }}>Request leave for today</div>
        <div style={{ font: '500 12.5px/1.5 var(--f-body)', color: 'var(--text-70)', marginTop: 8 }}>
          This goes to the owner or admin to approve. It only counts as leave once they do.
        </div>
        <label className="field-label" style={{ marginTop: 16 }}>Reason (optional)</label>
        <input className="field" placeholder="e.g. Family wedding" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={() => onSubmit(note.trim())}>Send request</button>
        </div>
      </div>
    </Modal>
  )
}
