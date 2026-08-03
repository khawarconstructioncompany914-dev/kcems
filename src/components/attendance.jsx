// ============================================================
// KCEMS · marking your own attendance
//
// Shared by the field app and the office screen, because until now only a site
// engineer could mark at all: the office roles were routed to a read-only grid
// that counted them in "of 14 people" and gave them no way to be one of them.
// Muzamil could see everybody's attendance except his own.
//
// One component, two skins. `variant="field"` is the phone: full-width targets,
// no card. `variant="office"` sits in a card on the desktop screen.
// ============================================================
import { useState } from 'react'
import { useStore, useSelectors } from '../store.jsx'
import { Modal } from './bits.jsx'
import { MARK, markMeta, dayKey, arrivalTime, rangeLabel, datesBetween } from '../data/attendance.js'

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

const STATUS_WORD = { pending: 'waiting for approval', approved: 'approved', rejected: 'not approved' }

export function SelfAttendance({ variant = 'office' }) {
  const { dispatch, toast } = useStore()
  const { me, myAttendanceToday, myLeaveRequests } = useSelectors()
  const [busy, setBusy] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const field = variant === 'field'
  const todays = myAttendanceToday()
  const meta = markMeta(todays)

  // Only what is still live: anything already decided and in the past is
  // history, and belongs in the grid rather than at the top of the screen.
  const today = dayKey(new Date())
  const live = myLeaveRequests(me.id).filter((r) => r.status === 'pending' || r.to >= today)

  const markPresent = async () => {
    if (busy || todays) return
    setBusy(true)
    const { lat, lng } = await getLocation()
    const res = await dispatch({ type: 'MARK_ATTENDANCE', kind: 'present', lat, lng, userId: me.id, actorId: me.id })
    setBusy(false)
    if (res && res.status === 409) return toast('You have already marked today', 'warn')
    if (res && res.status >= 400) return toast(res.body?.error || 'Could not mark attendance', 'danger')
    toast(lat == null ? 'Marked present · no location' : 'Marked present')
  }

  const submitLeave = async ({ from, to, note }) => {
    setLeaveOpen(false)
    const res = await dispatch({ type: 'REQUEST_LEAVE', payload: { userId: me.id, from, to, note }, actorId: me.id })
    if (res && res.status >= 400) return toast(res.body?.error || 'Could not send the request', 'danger')
    const days = datesBetween(from, to).length
    toast(`Leave requested · ${days} day${days === 1 ? '' : 's'} — waiting for approval`, 'info')
  }

  return (
    <>
      {todays ? (
        <div style={{
          background: meta.soft, border: `1px solid ${meta.color}`, borderRadius: field ? 18 : 14,
          padding: field ? 20 : '16px 18px', textAlign: field ? 'center' : 'left',
          display: field ? 'block' : 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: field ? 54 : 40, height: field ? 54 : 40, borderRadius: '50%', flex: 'none',
            background: meta.color, color: 'var(--accent-ink)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            font: `700 ${field ? 26 : 19}px/1 var(--f-body)`, margin: field ? '0 auto 12px' : 0,
          }}>
            {todays.kind === 'present' ? '✓' : '↪'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `700 ${field ? 16 : 14}px/1.3 var(--f-body)`, color: 'var(--text)' }}>
              {todays.kind === 'present' ? "You're marked present today" : `Your leave today is ${STATUS_WORD[todays.status]}`}
            </div>
            <div style={{ font: '500 12.5px/1.5 var(--f-body)', color: 'var(--text-70)', marginTop: 4 }}>
              {todays.kind === 'present'
                ? `Marked at ${arrivalTime(todays)}${todays.lat == null ? ' · no location recorded' : ''}`
                : todays.note || 'No reason given'}
            </div>
          </div>
        </div>
      ) : (
        <div style={field ? undefined : { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={field ? { width: '100%', height: 60, fontSize: 16 } : { flex: '1 1 200px' }}
            disabled={busy} onClick={markPresent}
          >
            {busy ? 'Marking…' : field ? 'Mark today: Present' : "Mark me present today"}
          </button>
          <button
            className="btn btn-ghost"
            style={field ? { width: '100%', height: 46, marginTop: 10 } : { flex: '0 1 auto' }}
            onClick={() => setLeaveOpen(true)}
          >
            Request leave
          </button>
        </div>
      )}

      {/* Requesting leave stays available after marking present — you can be at
          work today and still book next week off. */}
      {todays && (
        <button className="btn btn-ghost" style={{ width: field ? '100%' : 'auto', marginTop: 10 }} onClick={() => setLeaveOpen(true)}>
          Request leave for other days
        </button>
      )}

      {!todays && (
        <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--text-50)', marginTop: 10, textAlign: field ? 'center' : 'left' }}>
          One mark per day. Your location is recorded with a present mark and is visible to the owner and admin only.
        </div>
      )}

      {live.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ font: '600 11px/1 var(--f-mono)', letterSpacing: '.08em', color: 'var(--text-40)', textTransform: 'uppercase', marginBottom: 8 }}>
            Your leave
          </div>
          {live.map((r) => {
            const m = MARK[`leave_${r.status}`]
            return (
              <div key={r.group} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--border-3)' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.color, flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 13px/1.3 var(--f-body)', color: 'var(--text)' }}>
                    {rangeLabel(r.from, r.to)} · {r.days} day{r.days === 1 ? '' : 's'}
                  </div>
                  {r.note && <div style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--text-50)', marginTop: 2 }}>{r.note}</div>}
                </div>
                <span style={{ font: '600 11.5px/1 var(--f-body)', color: m.color, flex: 'none' }}>{STATUS_WORD[r.status]}</span>
              </div>
            )
          })}
        </div>
      )}

      <LeaveModal open={leaveOpen} onClose={() => setLeaveOpen(false)} onSubmit={submitLeave} />
    </>
  )
}

// ------------------------------------------------------------
// Leave request — a range, booked ahead
// ------------------------------------------------------------
function LeaveModal({ open, onClose, onSubmit }) {
  const { me, leaveClash } = useSelectors()
  const today = dayKey(new Date())
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [note, setNote] = useState('')
  const [seen, setSeen] = useState(open)

  if (open !== seen) {
    setSeen(open)
    if (open) { setFrom(today); setTo(today); setNote('') }
  }
  if (!open) return null

  const backwards = to < from
  // Moving the first day past the last is almost always someone editing the
  // start of a range they already set — carry the end with it rather than
  // showing them an error they did not mean to create.
  const setFromSafe = (v) => { setFrom(v); if (to < v) setTo(v) }

  const clash = backwards ? [] : leaveClash(me.id, from, to)
  const days = backwards ? 0 : datesBetween(from, to).length
  const tooLong = days > 31
  const blocked = backwards || tooLong || clash.length > 0 || days === 0

  const clashLabel = clash
    .slice(0, 4)
    .map((d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }))
    .join(', ') + (clash.length > 4 ? ` and ${clash.length - 4} more` : '')

  return (
    <Modal open onClose={onClose} width={420}>
      <div style={{ padding: 22 }}>
        <div style={{ font: '700 16px/1 var(--f-body)', color: 'var(--text)' }}>Request leave</div>
        <div style={{ font: '500 12.5px/1.5 var(--f-body)', color: 'var(--text-70)', marginTop: 8 }}>
          This goes to the owner or admin. It only counts as leave once they approve it.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">First day</label>
            <input type="date" className="field" value={from} onChange={(e) => setFromSafe(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Last day</label>
            <input type="date" className="field" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <label className="field-label" style={{ marginTop: 14 }}>Reason (optional)</label>
        <input className="field" placeholder="e.g. Family wedding" value={note} onChange={(e) => setNote(e.target.value)} />

        {!blocked && (
          <div style={{ font: '500 12.5px/1.5 var(--f-body)', color: 'var(--text-50)', marginTop: 12 }}>
            {days} day{days === 1 ? '' : 's'} · {rangeLabel(from, to)}
          </div>
        )}
        {clash.length > 0 && (
          <div style={{ font: '600 12px/1.5 var(--f-body)', color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', borderRadius: 10, padding: '9px 12px', marginTop: 12 }}>
            You already have a mark on {clashLabel}. Choose different days.
          </div>
        )}
        {tooLong && (
          <div style={{ font: '600 12px/1.5 var(--f-body)', color: 'var(--warn)', marginTop: 12 }}>
            One request can cover at most 31 days.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={blocked}
                  onClick={() => onSubmit({ from, to, note: note.trim() })}>
            Send request
          </button>
        </div>
      </div>
    </Modal>
  )
}
