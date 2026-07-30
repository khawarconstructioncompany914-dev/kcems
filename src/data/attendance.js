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
