import { q, checkPassword, signToken, setSessionCookie, json, readBody, mapUser, envReady } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
  if (!envReady()) return json(res, 503, { error: 'backend_not_configured' })
  const { username, password } = await readBody(req)
  if (!username || !password) return json(res, 400, { error: 'missing_fields' })

  const r = await q('select * from app_user where lower(username) = lower($1)', [String(username).trim()])
  const u = r.rows[0]
  if (!u) return json(res, 401, { error: 'bad_credentials' })
  if (u.status === 'disabled') return json(res, 403, { error: 'disabled' })
  if (!checkPassword(password, u.password_hash)) return json(res, 401, { error: 'bad_credentials' })

  setSessionCookie(res, signToken({ uid: u.id, role: u.role }))
  json(res, 200, { user: mapUser(u) })
}
