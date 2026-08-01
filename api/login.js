import { q, checkPassword, signToken, setSessionCookie, json, readBody, mapUser, envReady, normPassword, clientIp } from './_lib.js'
import { norm, resolveLogin } from '../src/data/match.js'

// Columns the matcher and the session need. Spelled out rather than `select *`
// so a column added later — a note, a token, anything sensitive — does not
// silently start being pulled into memory on every login attempt.
const LOGIN_COLUMNS = `id, name, username, email, phone, role, engineer_id, site_id,
                       status, must_change_password, password_hash`

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
  if (!envReady()) return json(res, 503, { error: 'backend_not_configured' })
  const { username, password } = await readBody(req)
  if (!username || !password) return json(res, 400, { error: 'missing_fields' })

  // Roster passwords are copy-pasted from a text file that has trailing spaces,
  // and phone keyboards love to append one. Surrounding whitespace is never
  // meaningful here, so ignore it (inner characters are untouched).
  const pw = normPassword(password)

  // Throttling is keyed on the NORMALISED typed name, not on whoever ends up
  // matching. Login is deliberately fuzzy, so "muhammad" reaches eight accounts
  // at once — a per-account counter would miss exactly the probe worth stopping.
  const identifier = norm(username).slice(0, 120) || '(blank)'
  const ip = clientIp(req)

  const gate = await q('select kcems_login_retry_after($1,$2) as wait', [identifier, ip])
  const wait = gate.rows[0].wait
  if (wait > 0) {
    res.setHeader('Retry-After', String(wait))
    return json(res, 429, { error: 'too_many_attempts', retryAfter: wait })
  }

  // Identify by anything the person might reasonably type: their username,
  // their full name, their first or last name, any capitalisation or spacing,
  // and small misspellings. See src/data/match.js — the shortlist is only ever
  // widened, and the password decides which of the shortlist actually gets in,
  // so this can never sign anyone in as somebody else.
  //
  // This does read the whole roster on every attempt. That is inherent to
  // matching on names rather than on an indexable handle, and at ~35 people it
  // is one small query; the limiter above is what stops it being worth grinding.
  const { rows } = await q(`select ${LOGIN_COLUMNS} from app_user`)
  const match = resolveLogin(rows, username, (u) => checkPassword(pw, u.password_hash))

  if (!match.ok) {
    // A disabled account is not a wrong password, so it does not count toward
    // the lockout — otherwise a former employee's repeated attempts would lock
    // out everyone else sharing their site office's IP.
    if (match.reason === 'disabled') return json(res, 403, { error: 'disabled' })
    await q('select kcems_record_login($1,$2,false)', [identifier, ip])
    return json(res, 401, { error: 'bad_credentials' })
  }

  await q('select kcems_record_login($1,$2,true)', [identifier, ip])
  const u = match.user
  setSessionCookie(res, signToken({ uid: u.id, role: u.role }))
  json(res, 200, { user: mapUser(u) })
}
