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

// Ledger rows older than this are left out of the default snapshot. Expenses
// only ever accumulate, and this endpoint is re-fetched after every single
// write, so "send the entire history each time" gets slower every week the
// company uses the app and never gets faster.
//
// What is NEVER windowed: anything still in the approval chain, and anything
// rejected but not yet settled. An item nobody has decided on has to stay
// visible however long it has been sitting there — that is precisely the thing
// you must not hide — and an unsettled debt is still owed.
//
// `?full=1` returns the lot, for the report builder and the person ledger where
// the whole point is to look further back.
const HISTORY_WINDOW_DAYS = 365

// How many audit rows the activity view gets. Newest-first, and it is a
// review surface rather than an archive — the table itself is append-only and
// keeps everything.
const AUDIT_LIMIT = 300

export default async function handler(req, res) {
  const me = await currentUser(req)
  if (!me) return json(res, 401, { error: 'unauthorized' })

  const full = String(req.query?.full || '') === '1'
  const canSeeAudit = me.role === 'owner' || me.role === 'admin'

  // `$1 = full` short-circuits the date test, so one query serves both modes
  // rather than string-building two variants of the same SQL.
  const [users, sites, expenses, funds, progress, attendance, balances, siteSpend, audit] = await Promise.all([
    q('select * from app_user order by created_at'),
    q('select * from site order by created_at'),
    q(`select * from expense
        where $1::boolean
           or created_at >= now() - ($2::int || ' days')::interval
           or status in ('engineer_review','finance_review','returned')
           or (status = 'rejected' and settled_at is null)`, [full, HISTORY_WINDOW_DAYS]),
    q(`select * from fund_txn
        where $1::boolean or created_at >= now() - ($2::int || ' days')::interval`, [full, HISTORY_WINDOW_DAYS]),
    q(`select site_id, pct, note, logged_by, created_at
         from site_progress order by created_at desc`),
    q('select * from attendance where date >= (current_date - $1::int)', [ATTENDANCE_WINDOW_DAYS]),
    // Money comes from the views, never from summing the rows above — those are
    // windowed, and a balance computed from a truncated history is simply wrong.
    q('select * from v_supervisor_balance'),
    q('select * from v_site_spend'),
    canSeeAudit
      ? q(`select a.id, a.actor_id, a.action, a.entity, a.entity_id, a.before, a.after, a.created_at,
                  u.name as actor_name, u.role as actor_role
             from audit_log a left join app_user u on u.id = a.actor_id
            order by a.created_at desc limit $1`, [AUDIT_LIMIT])
      : Promise.resolve({ rows: [] }),
  ])

  // Photos are fetched for the rows actually being returned. Fetching the whole
  // table and throwing most of it away was fine while the window was "all of
  // it"; it is not fine now, and it was never necessary.
  const expenseIds = expenses.rows.map((e) => e.id)
  const fundIds = funds.rows.map((f) => f.id)
  const [ePhotos, fPhotos] = await Promise.all([
    expenseIds.length
      ? q(`select expense_id, storage_path, captured_at from expense_photo
            where expense_id = any($1::uuid[]) order by captured_at`, [expenseIds])
      : Promise.resolve({ rows: [] }),
    fundIds.length
      ? q(`select fund_txn_id, storage_path, captured_at from fund_txn_photo
            where fund_txn_id = any($1::uuid[]) order by captured_at`, [fundIds])
      : Promise.resolve({ rows: [] }),
  ])

  const expensePhotos = groupPhotos(ePhotos.rows, 'expense_id')
  const fundPhotos = groupPhotos(fPhotos.rows, 'fund_txn_id')

  // One pass over progress, newest-first: the first row seen for a site is that
  // site's current figure, and the rest is its history.
  const latestProgress = new Map()
  const progressLog = progress.rows.map((r) => {
    const entry = { siteId: r.site_id, pct: r.pct, note: r.note, loggedBy: r.logged_by, loggedAt: r.created_at }
    if (!latestProgress.has(r.site_id)) {
      latestProgress.set(r.site_id, { pct: r.pct, note: r.note, loggedBy: r.logged_by, loggedAt: r.created_at })
    }
    return entry
  })

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

  let bal = balances.rows
  if (me.role === 'engineer') {
    const supIds = new Set(allUsers.filter((u) => u.engineerId === me.id).map((u) => u.id))
    // their supervisors' expenses, plus their own reimbursement claims
    exp = exp.filter((e) => supIds.has(e.supervisorId) || (e.supervisorId === me.id && e.kind === 'reimbursement'))
    fnd = fnd.filter((f) => supIds.has(f.supervisorId))
    bal = bal.filter((b) => supIds.has(b.supervisor_id))
  } else if (me.role === 'supervisor') {
    exp = exp.filter((e) => e.supervisorId === me.id)
    fnd = fnd.filter((f) => f.supervisorId === me.id)
    bal = bal.filter((b) => b.supervisor_id === me.id)
  }

  json(res, 200, {
    users: allUsers, sites: allSites, expenses: exp, funds: fnd,
    attendance: att, progress: progressLog,
    balances: Object.fromEntries(bal.map((b) => [b.supervisor_id, {
      funded: b.funded, spent: b.spent, cash: b.cash_in_hand, owed: b.owed_back,
    }])),
    siteSpend: Object.fromEntries(siteSpend.rows.map((s) => [s.site_id, {
      budget: s.budget,
      byCat: { materials: s.materials, labour: s.labour, fuel: s.fuel, tea_food: s.tea_food, other: s.other },
    }])),
    audit: audit.rows.map((a) => ({
      id: a.id, actorId: a.actor_id, actorName: a.actor_name, actorRole: a.actor_role,
      action: a.action, entity: a.entity, entityId: a.entity_id,
      before: a.before, after: a.after, createdAt: a.created_at,
    })),
    windowed: !full, windowDays: full ? null : HISTORY_WINDOW_DAYS,
    session: { userId: me.id },
  })
}
