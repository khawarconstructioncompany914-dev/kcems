import { currentUser, q, json, mapUser, mapSite, mapExpense, mapFund, mapAttendance } from './_lib.js'

// Group photo rows by their owning entity: { [ownerId]: [{ path, capturedAt }] }
function groupPhotos(rows, key) {
  const by = new Map()
  for (const r of rows) {
    const list = by.get(r[key]) || []
    list.push({ path: r.storage_path, capturedAt: r.captured_at })
    by.set(r[key], list)
  }
  return by
}

// Attendance is fetched for a rolling window rather than the calendar month:
// the office grid wants this month, but the field app's 14-day strip crosses
// the boundary at the start of every month and would otherwise go blank. ~35
// people × 45 days is a couple of thousand small rows — no need to paginate.
const ATTENDANCE_WINDOW_DAYS = 45

// Scoped snapshot the front-end store hydrates from (Build Spec §2 scoping).
export default async function handler(req, res) {
  const me = await currentUser(req)
  if (!me) return json(res, 401, { error: 'unauthorized' })

  const [users, sites, expenses, funds, ePhotos, fPhotos, progress, attendance] = await Promise.all([
    q('select * from app_user order by created_at'),
    q('select * from site order by created_at'),
    q('select * from expense'),
    q('select * from fund_txn'),
    q('select expense_id, storage_path, captured_at from expense_photo order by captured_at'),
    q('select fund_txn_id, storage_path, captured_at from fund_txn_photo order by captured_at'),
    // one row per site: its most recent progress entry
    q(`select distinct on (site_id) site_id, pct, note, logged_by, created_at
         from site_progress order by site_id, created_at desc`),
    q(`select * from attendance where date >= (current_date - $1::int)`, [ATTENDANCE_WINDOW_DAYS]),
  ])

  const expensePhotos = groupPhotos(ePhotos.rows, 'expense_id')
  const fundPhotos = groupPhotos(fPhotos.rows, 'fund_txn_id')
  const latestProgress = new Map(progress.rows.map((r) => [r.site_id, {
    pct: r.pct, note: r.note, loggedBy: r.logged_by, loggedAt: r.created_at,
  }]))

  // Directory (users + sites) is visible to all so names/wiring render.
  const allUsers = users.rows.map(mapUser)
  const allSites = sites.rows.map((s) => ({ ...mapSite(s), progress: latestProgress.get(s.id) || null }))
  let exp = expenses.rows.map((e) => ({ ...mapExpense(e), photos: expensePhotos.get(e.id) || [] }))
  let fnd = funds.rows.map((f) => ({ ...mapFund(f), photos: fundPhotos.get(f.id) || [] }))

  // Attendance is deliberately visible to everyone — that was the requirement.
  // Coordinates are not: only owner/admin get lat/lng, so the grid can show who
  // was present without publishing every colleague's whereabouts to all 32
  // accounts. Stripped here rather than in the UI, so the data never leaves the
  // server for people who should not have it.
  const canSeeLocation = me.role === 'owner' || me.role === 'admin'
  const att = attendance.rows.map((a) => (
    canSeeLocation ? { ...mapAttendance(a), lat: a.lat, lng: a.lng } : mapAttendance(a)
  ))

  if (me.role === 'engineer') {
    const supIds = new Set(allUsers.filter((u) => u.engineerId === me.id).map((u) => u.id))
    // their supervisors' expenses, plus their own reimbursement claims
    exp = exp.filter((e) => supIds.has(e.supervisorId) || (e.supervisorId === me.id && e.kind === 'reimbursement'))
    fnd = fnd.filter((f) => supIds.has(f.supervisorId))
  } else if (me.role === 'supervisor') {
    exp = exp.filter((e) => e.supervisorId === me.id)
    fnd = fnd.filter((f) => f.supervisorId === me.id)
  }

  json(res, 200, {
    users: allUsers, sites: allSites, expenses: exp, funds: fnd,
    attendance: att, session: { userId: me.id },
  })
}
