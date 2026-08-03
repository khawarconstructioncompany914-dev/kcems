// ============================================================
// KCEMS · attendance display rules
//
// One place for the mark → colour/label mapping, because the office grid and
// the field app both render the same dots and must not drift apart.
// ============================================================

export const MARK = {
  present:          { label: 'Present',        short: 'P', color: 'var(--accent)', soft: 'var(--accent-soft)' },
  leave_pending:    { label: 'Leave · pending', short: 'L', color: 'var(--warn)',   soft: 'var(--warn-soft)' },
  leave_approved:   { label: 'Leave · approved', short: 'L', color: 'var(--info)',  soft: 'var(--info-soft)' },
  leave_rejected:   { label: 'Leave · rejected', short: 'L', color: 'var(--danger)', soft: 'var(--danger-soft)' },
}

// A row's display key. Present rows are always approved, so their status is
// not worth encoding into the key.
export const markKey = (a) => (a ? (a.kind === 'present' ? 'present' : `leave_${a.status}`) : null)
export const markMeta = (a) => MARK[markKey(a)] || null

// Local calendar date key — never toISOString(), which is UTC and would roll
// the day over at 5am in Pakistan.
export const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

// Every day in the given YYYY-MM, as Date objects.
export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return Array.from({ length: last }, (_, i) => new Date(y, m - 1, i + 1))
}

export const isWeekend = (d) => d.getDay() === 0          // Sunday off; Saturdays are worked
export const isFuture = (d) => dayKey(d) > dayKey(new Date())

export const monthLabel = (month) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export const shiftMonth = (month, by) => {
  const [y, m] = month.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + by, 1))
}

// Every day key from `from` to `to` inclusive. Built by stepping a local Date
// rather than by adding 86_400_000 to a timestamp — that drifts across a DST
// boundary, and although Pakistan has no DST today it has had it twice before.
export function datesBetween(from, to) {
  const out = []
  const d = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  while (d <= end && out.length < 400) {
    out.push(dayKey(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

// ---------- the clock ----------
//
// One formatter for the whole app, because a 12-hour clock cannot be sorted.
// "07:24" and "08:54" happen to compare correctly as strings; "7:24 AM" and
// "12:30 PM" do not — plain text sort puts noon before seven in the morning.
// So display and ordering are deliberately two different functions, and
// anything that sorts must use arrivalMinutes, never the formatted string.
//
// `compact` is for the printed month chart: 31 day columns have to fit across
// A4 landscape, and "8:54a" fits where "8:54 AM" does not.
export function formatTime12(value, { compact = false } = {}) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const h24 = d.getHours()
  const pm = h24 >= 12
  const h = h24 % 12 || 12                 // 0 -> 12am, 13 -> 1pm
  const mm = String(d.getMinutes()).padStart(2, '0')
  return compact ? `${h}:${mm}${pm ? 'p' : 'a'}` : `${h}:${mm} ${pm ? 'PM' : 'AM'}`
}

// Arrival time in local time. Present marks carry the moment the person
// tapped; leave rows carry the moment they asked, which is not an arrival and
// is never shown as one.
export const arrivalTime = (a) =>
  a && a.kind === 'present' && a.markedAt ? formatTime12(a.markedAt) : null

export const arrivalTimeCompact = (a) =>
  a && a.kind === 'present' && a.markedAt ? formatTime12(a.markedAt, { compact: true }) : null

// Minutes since midnight — the sort key. Null when there is no arrival, so
// callers can push those to the end rather than treating them as 00:00.
export const arrivalMinutes = (a) => {
  if (!a || a.kind !== 'present' || !a.markedAt) return null
  const d = new Date(a.markedAt)
  return Number.isNaN(d.getTime()) ? null : d.getHours() * 60 + d.getMinutes()
}

// A day is "expected" if it is a working day that has already happened.
// Anything else cannot be an absence: you cannot fail to turn up tomorrow, and
// Sunday is not a working day here (Saturdays are worked — see isWeekend).
export const isExpected = (d) => !isWeekend(d) && !isFuture(d)

// Rows of one multi-day request collapsed back into the request the person
// actually made. Older single-day rows were given a group of their own in
// migration 0006, so they arrive here as one-day requests and need no special
// case. Sorted oldest-first: the queue should be answered in the order asked.
export function groupLeave(rows) {
  const by = new Map()
  for (const a of rows) {
    if (a.kind !== 'leave') continue
    const key = a.leaveGroup || a.id
    const g = by.get(key)
    if (g) {
      g.rows.push(a)
      if (a.date < g.from) g.from = a.date
      if (a.date > g.to) g.to = a.date
    } else {
      by.set(key, { group: key, userId: a.userId, from: a.date, to: a.date, note: a.note, status: a.status, rows: [a] })
    }
  }
  return [...by.values()]
    .map((g) => ({ ...g, days: g.rows.length }))
    .sort((a, b) => a.from.localeCompare(b.from))
}

export const rangeLabel = (from, to) => {
  const f = new Date(from), t = new Date(to)
  const d = (x) => x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  if (from === to) return d(f)
  // same month reads better without repeating it: "14–16 Aug", not "14 Aug – 16 Aug".
  // Both days are padded so the pair lines up — "7–09 Aug" looks like a typo.
  return f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()
    ? `${String(f.getDate()).padStart(2, '0')}–${d(t)}`
    : `${d(f)} – ${d(t)}`
}

// Per-person totals for a month. `absent` counts only expected days with no
// mark of any kind — a rejected leave request leaves the day unaccounted for,
// which is exactly what an absence is.
export function summariseMonth(people, attendance, month) {
  const days = daysInMonth(month).filter(isExpected)
  const byKey = new Map(attendance.map((a) => [`${a.userId}|${a.date}`, a]))
  return people.map((u) => {
    let present = 0, leave = 0, pending = 0, rejected = 0, absent = 0
    // Tracked in minutes, not in the formatted string. Comparing "12:05 PM"
    // against "7:24 AM" as text would report noon as the earlier arrival.
    let earliestMins = null, earliest = null
    for (const d of days) {
      const a = byKey.get(`${u.id}|${dayKey(d)}`)
      if (!a) { absent++; continue }
      if (a.kind === 'present') {
        present++
        const mins = arrivalMinutes(a)
        if (mins != null && (earliestMins == null || mins < earliestMins)) {
          earliestMins = mins
          earliest = arrivalTime(a)
        }
      } else if (a.status === 'approved') leave++
      else if (a.status === 'pending') pending++
      else { rejected++; absent++ }
    }
    return { user: u, present, leave, pending, rejected, absent, expected: days.length, earliest }
  })
}
