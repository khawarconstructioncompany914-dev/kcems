import { currentUser, q, json, mapUser, mapSite, mapExpense, mapFund } from './_lib.js'

// Scoped snapshot the front-end store hydrates from (Build Spec §2 scoping).
export default async function handler(req, res) {
  const me = await currentUser(req)
  if (!me) return json(res, 401, { error: 'unauthorized' })

  const [users, sites, expenses, funds] = await Promise.all([
    q('select * from app_user order by created_at'),
    q('select * from site order by created_at'),
    q('select * from expense'),
    q('select * from fund_txn'),
  ])

  // Directory (users + sites) is visible to all so names/wiring render.
  const allUsers = users.rows.map(mapUser)
  const allSites = sites.rows.map(mapSite)
  let exp = expenses.rows.map(mapExpense)
  let fnd = funds.rows.map(mapFund)

  if (me.role === 'engineer') {
    const supIds = new Set(allUsers.filter((u) => u.engineerId === me.id).map((u) => u.id))
    exp = exp.filter((e) => supIds.has(e.supervisorId))
    fnd = fnd.filter((f) => supIds.has(f.supervisorId))
  } else if (me.role === 'supervisor') {
    exp = exp.filter((e) => e.supervisorId === me.id)
    fnd = fnd.filter((f) => f.supervisorId === me.id)
  }

  json(res, 200, { users: allUsers, sites: allSites, expenses: exp, funds: fnd, session: { userId: me.id } })
}
