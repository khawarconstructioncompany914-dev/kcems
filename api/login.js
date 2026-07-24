import { q, checkPassword, signToken, setSessionCookie, json, readBody, mapUser, envReady } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
  if (!envReady()) return json(res, 503, { error: 'backend_not_configured' })
  const { username, password } = await readBody(req)
  if (!username || !password) return json(res, 400, { error: 'missing_fields' })
  // Roster passwords are copy-pasted from a text file that has trailing spaces,
  // and phone keyboards love to append one. Surrounding whitespace is never
  // meaningful here, so ignore it (inner characters are untouched).
  const pw = String(password).replace(/^\s+|\s+$/g, '')

  // Be forgiving: people naturally type their display name ("Messam Ali").
  // Usernames never contain spaces, so strip them and compare case-insensitively.
  const r = await q(
    `select * from app_user
      where lower(username) = lower(replace($1, ' ', ''))
         or lower(replace(name, ' ', '')) = lower(replace($1, ' ', ''))
      limit 1`,
    [String(username).trim()])
  const u = r.rows[0]
  if (!u) return json(res, 401, { error: 'bad_credentials' })
  if (u.status === 'disabled') return json(res, 403, { error: 'disabled' })
  if (!checkPassword(pw, u.password_hash)) return json(res, 401, { error: 'bad_credentials' })

  setSessionCookie(res, signToken({ uid: u.id, role: u.role }))
  json(res, 200, { user: mapUser(u) })
}
