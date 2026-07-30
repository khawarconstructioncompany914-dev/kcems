// Office attendance: a month grid of everyone, plus the pending-leave queue.
//
// Everyone can see who was present — that was the requirement. Coordinates are
// a different matter and the server only sends them to owner/admin, so the
// "view location" link simply is not there for anyone else rather than being
// hidden client-side over data that already arrived.
import { useMemo, useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { ROLES, roleEyebrow, fmtDate } from '../../data/model.js'
import { PageHeader, Kpi, Card } from '../../components/page.jsx'
import { Monogram, Modal, Empty } from '../../components/bits.jsx'
import { MARK, markMeta, dayKey, monthKey, daysInMonth, isWeekend, isFuture, monthLabel, shiftMonth } from '../../data/attendance.js'

export default function Attendance() {
  const { dispatch, toast } = useStore()
  const { me, state, attendance, pendingLeave, userById } = useSelectors()
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [open, setOpen] = useState(null)      // the cell being inspected

  const canReview = me.role === 'owner' || me.role === 'admin'
  const days = useMemo(() => daysInMonth(month), [month])
  const today = dayKey(new Date())

  // Everyone who could mark a day. Office staff are included — attendance is
  // the one feature every role gets.
  const people = useMemo(
    () => state.users.filter((u) => u.status !== 'disabled')
      .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role.localeCompare(b.role))),
    [state.users],
  )

  const byPersonDay = useMemo(() => {
    const m = new Map()
    for (const a of attendance) m.set(`${a.userId}|${a.date}`, a)
    return m
  }, [attendance])

  const pending = pendingLeave()
  const presentToday = attendance.filter((a) => a.date === today && a.kind === 'present').length
  const onLeaveToday = attendance.filter((a) => a.date === today && a.kind === 'leave' && a.status === 'approved').length

  const review = (row, approve) => {
    dispatch({ type: 'REVIEW_LEAVE', attendanceId: row.id, approve, actorId: me.id })
    toast(`${userById(row.userId)?.name.split(' ')[0]}'s leave ${approve ? 'approved' : 'rejected'}`, approve ? 'accent' : 'danger')
  }

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow={roleEyebrow(me.role, 'attendance')}
        title="Attendance"
        sub="One mark per person per day. Present marks are recorded as they happen; leave needs approval before it counts."
      />

      <div className="r-row" style={{ marginBottom: 22 }}>
        <Kpi label="Present today" value={presentToday} sub={`of ${people.length} people`} accent />
        <Kpi label="On leave today" value={onLeaveToday} sub="approved leave" />
        <Kpi label="Awaiting approval" value={pending.length} sub="leave requests" color={pending.length ? 'var(--warn)' : '#fff'} />
      </div>

      {/* pending leave queue — owner/admin only */}
      {canReview && pending.length > 0 && (
        <Card pad={0} style={{ marginBottom: 20 }}>
          <div style={{ padding: '16px 20px 12px', font: '700 14px/1 var(--f-body)', color: '#fff' }}>
            Leave awaiting your approval · {pending.length}
          </div>
          {pending.map((row) => {
            const u = userById(row.userId)
            return (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--border-3)', flexWrap: 'wrap' }}>
                <Monogram name={u?.name} color="var(--warn)" soft="var(--warn-soft)" size={34} />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ font: '700 13px/1.3 var(--f-body)', color: '#fff' }}>{u?.name}</div>
                  <div style={{ font: '500 12px/1.45 var(--f-body)', color: 'var(--text-70)' }}>
                    {ROLES[u?.role]?.label} · {fmtDate(row.date)}{row.note ? ` · ${row.note}` : ''}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => review(row, false)}>Reject</button>
                <button className="btn btn-primary btn-sm" onClick={() => review(row, true)}>Approve</button>
              </div>
            )
          })}
        </Card>
      )}

      {/* month grid */}
      <Card pad={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border-3)', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">‹</button>
          <div style={{ font: '700 14px/1 var(--f-body)', color: '#fff', minWidth: 150, textAlign: 'center' }}>{monthLabel(month)}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month">›</button>
          <div className="spacer" />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(MARK).map(([k, v]) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 12px/1.4 var(--f-body)', color: 'var(--text-70)' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: v.color }} />{v.label}
              </span>
            ))}
          </div>
        </div>

        {/* wide table scrolls inside the card rather than the page */}
        <div className="r-scroll-x" style={{ '--r-tablemin': `${190 + days.length * 26}px` }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px 8px' }}>
              <div style={{ width: 170, flex: 'none', font: '600 10px/1 var(--f-mono)', color: 'var(--text-40)', letterSpacing: '.05em' }}>PERSON</div>
              {days.map((d) => (
                <div key={dayKey(d)} style={{ width: 26, flex: 'none', textAlign: 'center', font: '600 10px/1.3 var(--f-mono)', color: dayKey(d) === today ? 'var(--accent)' : 'var(--text-40)' }}>
                  {d.getDate()}
                </div>
              ))}
            </div>
            {people.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', padding: '7px 20px', borderTop: '1px solid var(--border-3)' }}>
                <div style={{ width: 170, flex: 'none', minWidth: 0, paddingRight: 8 }}>
                  <div style={{ font: '600 12.5px/1.35 var(--f-body)', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                  <div style={{ font: '500 11.5px/1.35 var(--f-body)', color: 'var(--text-70)' }}>{ROLES[u.role]?.label}</div>
                </div>
                {days.map((d) => {
                  const k = dayKey(d)
                  const row = byPersonDay.get(`${u.id}|${k}`)
                  const meta = markMeta(row)
                  return (
                    <div key={k} style={{ width: 26, flex: 'none', display: 'flex', justifyContent: 'center' }}>
                      <button
                        type="button" disabled={!row} onClick={() => setOpen({ row, user: u })}
                        title={row ? `${u.name} · ${meta.label}` : ''}
                        style={{
                          width: 16, height: 16, borderRadius: '50%', padding: 0, cursor: row ? 'pointer' : 'default',
                          background: meta ? meta.color : 'transparent',
                          border: meta ? 'none' : `1px solid ${isFuture(d) ? 'transparent' : isWeekend(d) ? 'var(--border-3)' : 'var(--border)'}`,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
            {people.length === 0 && <Empty title="Nobody to show" sub="Create logins first." />}
          </div>
        </div>
      </Card>

      <CellModal open={open} onClose={() => setOpen(null)} canSeeLocation={canReview} />
    </div>
  )
}

function CellModal({ open, onClose, canSeeLocation }) {
  if (!open?.row) return null
  const { row, user } = open
  const meta = markMeta(row)
  const at = new Date(row.markedAt)
  return (
    <Modal open onClose={onClose} width={380}>
      <div style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <Monogram name={user.name} color={meta.color} soft={meta.soft} size={38} />
          <div>
            <div style={{ font: '700 15px/1.3 var(--f-body)', color: '#fff' }}>{user.name}</div>
            <div style={{ font: '500 12.5px/1.4 var(--f-body)', color: 'var(--text-70)' }}>{ROLES[user.role]?.label}</div>
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row k="Date" v={fmtDate(row.date)} />
          <Row k="Mark" v={meta.label} color={meta.color} />
          <Row k="Marked at" v={at.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })} />
          {row.note && <Row k="Note" v={row.note} />}
        </div>

        {row.kind === 'present' && (
          <div style={{ marginTop: 14 }}>
            {/* the server only sends coordinates to owner/admin, so for anyone
                else there is nothing to show rather than something hidden */}
            {canSeeLocation && row.lat != null && row.lng != null
              ? <a className="btn btn-ghost" style={{ width: '100%' }} href={`https://maps.google.com/?q=${row.lat},${row.lng}`} target="_blank" rel="noreferrer">View location on map</a>
              : <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--text-50)' }}>
                  {canSeeLocation ? 'No location recorded for this mark.' : 'Location is visible to the owner and admin only.'}
                </div>}
          </div>
        )}

        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}

const Row = ({ k, v, color }) => (
  <div style={{ display: 'flex', gap: 12, font: '500 12.5px/1.45 var(--f-body)' }}>
    <span style={{ width: 84, flex: 'none', color: 'var(--text-40)' }}>{k}</span>
    <span style={{ color: color || 'var(--text-70)' }}>{v}</span>
  </div>
)
