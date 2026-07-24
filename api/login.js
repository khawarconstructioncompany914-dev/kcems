import { q, checkPassword, signToken, setSessionCookie, json, readBody, mapUser, envReady, normPassword } from './_lib.js'
import { resolveLogin } from '../src/data/match.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
  if (!envReady()) return json(res, 503, { error: 'backend_not_configured' })
  const { username, password } = await readBody(req)
  if (!username || !password) return json(res, 400, { error: 'missing_fields' })

  // Roster passwords are copy-pasted from a text file that has trailing spaces,
  // and phone keyboards love to append one. Surrounding whitespace is never
  // meaningful here, so ignore it (inner characters are untouched).
  const pw = normPassword(password)

  // Identify by anything the person might reasonably type: their username,
  // their full name, their first or last name, any capitalisation or spacing,
  // and small misspellings. See src/data/match.js — the shortlist is only ever
  // widened, and the password decides which of the shortlist actually gets in,
  // so this can never sign anyone in as somebody else.
  const { rows } = await q('select * from app_user')
  const match = resolveLogin(rows, username, (u) => checkPassword(pw, u.password_hash))

  if (!match.ok) {
    if (match.reason === 'disabled') return json(res, 403, { error: 'disabled' })
    return json(res, 401, { error: 'bad_credentials' })
  }

  const u = match.user
  setSessionCookie(res, signToken({ uid: u.id, role: u.role }))
  json(res, 200, { user: mapUser(u) })
}
