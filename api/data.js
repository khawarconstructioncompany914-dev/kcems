import { currentUser, q, json, mapUser, mapSite, mapExpense, mapFund } from './_lib.js'

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

// Scoped snapshot the front-end store hydrates from (Build Spec §2 scoping).
export default async function handler(req, res) {
  const me = await currentUser(req)
  if (!me) return json(res, 401, { error: 'unauthorized' })

  const [users, sites, expenses, funds, ePhotos, fPhotos] = await Promise.all([
    q('select * from app_user order by created_at'),
    q('select * from site order by created_at'),
    q('select * from expense'),
    q('select * from fund_txn'),
    // One query for every photo rather than one per expense — the whole
    // dataset is small enough that filtering happens below, in memory.
    q('select expense_id, storage_path, captured_at from expense_photo order by captured_at'),
    q('select fund_txn_id, storage_path, captured_at from fund_txn_photo order by captured_at'),
  ])

  const expensePhotos = groupPhotos(ePhotos.rows, 'expense_id')
  const fundPhotos = groupPhotos(fPhotos.rows, 'fund_txn_id')

  // Directory (users + sites) is visible to all so names/wiring render.
  const allUsers = users.rows.map(mapUser)
  const allSites = sites.rows.map(mapSite)
  let exp = expenses.rows.map((e) => ({ ...mapExpense(e), photos: expensePhotos.get(e.id) || [] }))
  let fnd = funds.rows.map((f) => ({ ...mapFund(f), photos: fundPhotos.get(f.id) || [] }))

  if (me.role === 'engineer') {
    const supIds = new Set(allUsers.filter((u) => u.engineerId === me.id).map((u) => u.id))
    // their supervisors' expenses, plus their own reimbursement claims
    exp = exp.filter((e) => supIds.has(e.supervisorId) || (e.supervisorId === me.id && e.kind === 'reimbursement'))
    fnd = fnd.filter((f) => supIds.has(f.supervisorId))
  } else if (me.role === 'supervisor') {
    exp = exp.filter((e) => e.supervisorId === me.id)
    fnd = fnd.filter((f) => f.supervisorId === me.id)
  }

  json(res, 200, { users: allUsers, sites: allSites, expenses: exp, funds: fnd, session: { userId: me.id } })
}
