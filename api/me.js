import { currentUser, json, mapUser } from './_lib.js'

export default async function handler(req, res) {
  const u = await currentUser(req)
  if (!u) return json(res, 401, { error: 'unauthorized' })
  json(res, 200, { user: mapUser(u) })
}
