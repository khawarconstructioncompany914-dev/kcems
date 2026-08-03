// ============================================================
// KCEMS · office attendance
//
// Three things stacked, and who sees what is decided by role:
//
//   everyone            mark yourself present, request leave
//   owner/admin/finance the company record — day view with arrival times,
//                       month grid, and the monthly PDF
//   owner/admin         decide leave requests, and see coordinates
//
// Scoping is enforced in api/data.js, not here. A head engineer is not sent
// everyone's rows and then shown a smaller screen — they are sent their own
// rows only, and this renders what arrived.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { ROLES, roleEyebrow, fmtDate } from '../../data/model.js'
import { PageHeader, Kpi, Card } from '../../components/page.jsx'
import { Monogram, Modal, Empty } from '../../components/bits.jsx'
import { SelfAttendance } from '../../components/attendance.jsx'
import {
  MARK, markMeta, dayKey, monthKey, daysInMonth, isWeekend, isFuture,
  monthLabel, shiftMonth, arrivalTime, rangeLabel, summariseMonth, isExpected,
} from '../../data/attendance.js'

export default function Attendance() {
  const { dispatch, toast, loadAttendanceMonth } = useStore()
  const { me, state, attendance, pendingLeaveRequests, userById, canSeeAllAttendance } = useSelectors()
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [view, setView] = useState('month')
  const [day, setDay] = useState(() => dayKey(new Date()))
  const [open, setOpen] = useState(null)

  const canReview = me.role === 'owner' || me.role === 'admin'
  const seesEveryone = canSeeAllAttendance()
  const days = useMemo(() => daysInMonth(month), [month])
  const today = dayKey(new Date())

  // The snapshot carries a rolling 45-day window, so paging back to an older
  // month used to show an empty grid — and would have produced a blank PDF.
  // Ask the server for the month being looked at.
  const asked = useRef(new Set())
  useEffect(() => {
    if (!seesEveryone || asked.current.has(month)) return
    asked.current.add(month)
    loadAttendanceMonth(month)
  }, [month, seesEveryone, loadAttendanceMonth])

  // Everyone who could mark a day. Office staff included — attendance is the
  // one feature every role gets.
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

  const requests = pendingLeaveRequests()
  const presentToday = attendance.filter((a) => a.date === today && a.kind === 'present').length
  const onLeaveToday = attendance.filter((a) => a.date === today && a.kind === 'leave' && a.status === 'approved').length
  const summary = useMemo(() => summariseMonth(people, attendance, month), [people, attendance, month])

  const review = async (req, approve) => {
    const res = await dispatch({ type: 'REVIEW_LEAVE', leaveGroup: req.group, approve, actorId: me.id })
    if (res && res.status >= 400) return toast(res.body?.error || 'Could not record that decision', 'danger')
    const who = userById(req.userId)?.name.split(' ')[0]
    toast(`${who}'s leave ${approve ? 'approved' : 'rejected'} · ${req.days} day${req.days === 1 ? '' : 's'}`, approve ? 'accent' : 'danger')
  }

  return (
    <div className="fade-up">
      <div className="print-hide">
        <PageHeader
          eyebrow={roleEyebrow(me.role, 'attendance')}
          title="Attendance"
          sub={seesEveryone
            ? 'One mark per person per day. Present marks are recorded with the time they happen; leave needs approval before it counts.'
            : 'Mark yourself present each day, and request leave in advance. The office keeps the company record.'}
        />

        {/* ---------- everyone marks their own ---------- */}
        <Card pad={20} style={{ marginBottom: 22, maxWidth: seesEveryone ? undefined : 620 }}>
          <div style={{ font: '700 14px/1 var(--f-body)', color: 'var(--text)', marginBottom: 14 }}>Today · {fmtDate(today)}</div>
          <SelfAttendance />
        </Card>

        {seesEveryone && (
          <div className="r-row" style={{ marginBottom: 22 }}>
            <Kpi label="Present today" value={presentToday} sub={`of ${people.length} people`} accent />
            <Kpi label="On leave today" value={onLeaveToday} sub="approved leave" />
            <Kpi label="Awaiting approval" value={requests.length} sub={`leave request${requests.length === 1 ? '' : 's'}`} color={requests.length ? 'var(--warn)' : 'var(--text)'} />
          </div>
        )}

        {/* ---------- leave queue, one line per request ---------- */}
        {canReview && requests.length > 0 && (
          <Card pad={0} style={{ marginBottom: 20 }}>
            <div style={{ padding: '16px 20px 12px', font: '700 14px/1 var(--f-body)', color: 'var(--text)' }}>
              Leave awaiting your approval · {requests.length}
            </div>
            {requests.map((req) => {
              const u = userById(req.userId)
              return (
                <div key={req.group} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--border-3)', flexWrap: 'wrap' }}>
                  <Monogram name={u?.name} color="var(--warn)" soft="var(--warn-soft)" size={34} />
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ font: '700 13px/1.3 var(--f-body)', color: 'var(--text)' }}>{u?.name}</div>
                    <div style={{ font: '500 12px/1.45 var(--f-body)', color: 'var(--text-70)' }}>
                      {ROLES[u?.role]?.label} · {rangeLabel(req.from, req.to)} · {req.days} day{req.days === 1 ? '' : 's'}
                      {req.note ? ` · ${req.note}` : ''}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => review(req, false)}>Reject</button>
                  <button className="btn btn-primary btn-sm" onClick={() => review(req, true)}>Approve</button>
                </div>
              )
            })}
          </Card>
        )}

        {/* ---------- the company record ---------- */}
        {seesEveryone && (
          <Card pad={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border-3)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className={`chip${view === 'month' ? ' on' : ''}`} onClick={() => setView('month')}>Month</button>
                <button type="button" className={`chip${view === 'day' ? ' on' : ''}`} onClick={() => setView('day')}>Day · times</button>
              </div>

              {view === 'month' ? (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">‹</button>
                  <div style={{ font: '700 14px/1 var(--f-body)', color: 'var(--text)', minWidth: 150, textAlign: 'center' }}>{monthLabel(month)}</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month">›</button>
                </>
              ) : (
                <input type="date" className="field" style={{ height: 38, width: 170 }} value={day} max={today} onChange={(e) => setDay(e.target.value)} />
              )}

              <div className="spacer" />
              <button className="btn btn-ghost btn-sm" onClick={() => window.print()} title="Opens the print dialog — choose “Save as PDF”">
                ⎙ Download month PDF
              </button>
            </div>

            {view === 'month' ? (
              <MonthGrid days={days} people={people} byPersonDay={byPersonDay} today={today} onOpen={setOpen} />
            ) : (
              <DayList people={people} byPersonDay={byPersonDay} day={day} onOpen={setOpen} />
            )}
          </Card>
        )}

        {/* Everyone else gets their own month, same grid, one row. */}
        {!seesEveryone && (
          <Card pad={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border-3)', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">‹</button>
              <div style={{ font: '700 14px/1 var(--f-body)', color: 'var(--text)', minWidth: 150, textAlign: 'center' }}>{monthLabel(month)}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month">›</button>
              <div className="spacer" />
              <Legend />
            </div>
            <MonthGrid days={days} people={people.filter((u) => u.id === me.id)} byPersonDay={byPersonDay} today={today} onOpen={setOpen} />
          </Card>
        )}
      </div>

      <CellModal open={open} onClose={() => setOpen(null)} canSeeLocation={canReview} />

      {seesEveryone && (
        <PrintSheet month={month} days={days} summary={summary} byPersonDay={byPersonDay} by={me} />
      )}
    </div>
  )
}

const Legend = () => (
  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
    {Object.entries(MARK).map(([k, v]) => (
      <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 12px/1.4 var(--f-body)', color: 'var(--text-70)' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: v.color }} />{v.label}
      </span>
    ))}
  </div>
)

// ------------------------------------------------------------
// Month grid — the shape of the month at a glance
// ------------------------------------------------------------
function MonthGrid({ days, people, byPersonDay, today, onOpen }) {
  return (
    <>
      <div style={{ padding: '12px 20px 0' }}><Legend /></div>
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
                <div style={{ font: '600 12.5px/1.35 var(--f-body)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                <div style={{ font: '500 11.5px/1.35 var(--f-body)', color: 'var(--text-70)' }}>{ROLES[u.role]?.label}</div>
              </div>
              {days.map((d) => {
                const k = dayKey(d)
                const row = byPersonDay.get(`${u.id}|${k}`)
                const meta = markMeta(row)
                const time = arrivalTime(row)
                return (
                  <div key={k} style={{ width: 26, flex: 'none', display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button" disabled={!row} onClick={() => onOpen({ row, user: u })}
                      title={row ? `${u.name} · ${meta.label}${time ? ` · ${time}` : ''}` : ''}
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
    </>
  )
}

// ------------------------------------------------------------
// Day view — who turned up, and when
// ------------------------------------------------------------
// The grid answers "what did the month look like"; this answers "who was on
// site and what time did they get there", which is the question the office
// actually asks and which a dot cannot answer.
function DayList({ people, byPersonDay, day, onOpen }) {
  const rows = people.map((u) => {
    const a = byPersonDay.get(`${u.id}|${day}`)
    return { u, a, time: arrivalTime(a), meta: markMeta(a) }
  })
  // Earliest arrivals first, then leave, then whoever has no mark at all.
  const rank = (r) => (r.time ? 0 : r.a ? 1 : 2)
  rows.sort((x, y) => rank(x) - rank(y) || (x.time || '').localeCompare(y.time || '') || x.u.name.localeCompare(y.u.name))

  const marked = rows.filter((r) => r.a).length
  const d = new Date(`${day}T00:00:00`)
  const expected = isExpected(d)

  return (
    <div>
      <div style={{ padding: '14px 20px 10px', font: '500 12.5px/1.4 var(--f-body)', color: 'var(--text-50)' }}>
        {marked} of {rows.length} marked{isWeekend(d) ? ' · Sunday' : ''}{isFuture(d) ? ' · this day has not happened yet' : ''}
      </div>
      {rows.map(({ u, a, time, meta }) => (
        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderTop: '1px solid var(--border-3)' }}>
          <Monogram name={u.name} color={meta ? meta.color : 'var(--text-40)'} soft={meta ? meta.soft : 'var(--input)'} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '600 13px/1.3 var(--f-body)', color: 'var(--text)' }}>{u.name}</div>
            <div style={{ font: '500 11.5px/1.35 var(--f-body)', color: 'var(--text-70)' }}>{ROLES[u.role]?.label}</div>
          </div>
          {a?.note && <div style={{ flex: '1 1 160px', minWidth: 0, font: '500 12px/1.4 var(--f-body)', color: 'var(--text-50)' }}>{a.note}</div>}
          <div style={{ textAlign: 'right', flex: 'none' }}>
            {time ? (
              <button type="button" onClick={() => onOpen({ row: a, user: u })}
                      className="num" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: '700 15px/1 var(--f-display)', color: 'var(--accent)' }}>
                {time}
              </button>
            ) : (
              <span style={{ font: '600 12px/1 var(--f-body)', color: meta ? meta.color : 'var(--text-40)' }}>
                {meta ? meta.label : expected ? 'No mark' : '—'}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------
// The printed month sheet
// ------------------------------------------------------------
// Hidden on screen; @media print in index.css reveals it and hides everything
// else. The browser's own print pipeline makes the PDF, so page breaks and
// margins are handled properly and no PDF engine ships in the bundle.
//
// Cells carry the arrival TIME rather than a tick: a record that says somebody
// was present is worth much less than one that says they arrived at 07:40.
function PrintSheet({ month, days, summary, byPersonDay, by }) {
  const shortTime = (t) => (t ? t.replace(/^0/, '') : null)   // "08:42" -> "8:42", buys a column of width
  return (
    <div className="print-only print-sheet">
      <div className="print-head">
        <div>
          <h1>Khawar Construction Co.</h1>
          <div className="print-sub">Attendance · {monthLabel(month)}</div>
        </div>
        <div className="print-meta">
          <div>{summary.length} people</div>
          <div>Prepared by {by?.name}</div>
          <div>{fmtDate(new Date().toISOString())}</div>
        </div>
      </div>

      <table className="print-table att-chart">
        <thead>
          <tr>
            <th className="att-name">Person</th>
            {days.map((d) => (
              <th key={dayKey(d)} className={isWeekend(d) ? 'att-off' : ''}>{d.getDate()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summary.map(({ user }) => (
            <tr key={user.id}>
              <td className="att-name">
                {user.name}
                <span className="att-role">{ROLES[user.role]?.label}</span>
              </td>
              {days.map((d) => {
                const a = byPersonDay.get(`${user.id}|${dayKey(d)}`)
                const t = shortTime(arrivalTime(a))
                const off = isWeekend(d)
                let content = ''
                if (t) content = t
                else if (a?.kind === 'leave') content = a.status === 'approved' ? 'LV' : a.status === 'pending' ? 'lv?' : '—'
                else if (!off && !isFuture(d)) content = '—'
                return <td key={dayKey(d)} className={off ? 'att-off' : ''}>{content}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="att-legend">
        Times are when the person marked themselves present. <b>LV</b> approved leave ·
        <b> lv?</b> leave still awaiting approval · <b>—</b> no mark on a working day ·
        shaded columns are Sundays.
      </div>

      <h2 className="att-h2">Summary · {monthLabel(month)}</h2>
      <table className="print-table">
        <thead>
          <tr>
            <th>Person</th><th>Role</th>
            <th className="num-col">Present</th>
            <th className="num-col">Leave</th>
            <th className="num-col">Absent</th>
            <th className="num-col">Working days</th>
            <th className="num-col">Earliest</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((s) => (
            <tr key={s.user.id}>
              <td>{s.user.name}</td>
              <td>{ROLES[s.user.role]?.label}</td>
              <td className="num-col">{s.present}</td>
              <td className="num-col">{s.leave}{s.pending ? ` (+${s.pending}?)` : ''}</td>
              <td className="num-col">{s.absent}</td>
              <td className="num-col">{s.expected}</td>
              <td className="num-col">{s.earliest || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="att-legend">
        Working days exclude Sundays and any day still in the future. Absent counts working
        days with no mark of any kind, including leave that was refused.
      </div>
    </div>
  )
}

// ------------------------------------------------------------
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
            <div style={{ font: '700 15px/1.3 var(--f-body)', color: 'var(--text)' }}>{user.name}</div>
            <div style={{ font: '500 12.5px/1.4 var(--f-body)', color: 'var(--text-70)' }}>{ROLES[user.role]?.label}</div>
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row k="Date" v={fmtDate(row.date)} />
          <Row k="Mark" v={meta.label} color={meta.color} />
          <Row
            k={row.kind === 'present' ? 'Arrived' : 'Requested'}
            v={at.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
          />
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
