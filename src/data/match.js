// ============================================================
// KCEMS · forgiving login matching
//
// Field staff type their name, not a handle. They type "Muhammad Ikram",
// "muhammadikram", "M Ikram", "ikram", "MUHAMMAD  IKRAM" — and on a phone
// keyboard, with autocorrect, a stray capital or a missing letter. Any of
// those should get them in, because a supervisor who cannot log in goes
// back to the paper diary.
//
// The safety property that makes this sound: fuzziness only ever WIDENS the
// list of people we consider. Each candidate is then checked against the
// password the person actually typed, and only a candidate whose password
// verifies is allowed in. A loose name match can therefore never sign
// someone in as the wrong person — it can only fail. Exact matches on a
// username or a full name are always ranked first, so a person who types
// their own details precisely always resolves to themselves, even if
// somebody else's name is a near miss.
//
// Shared by the server (api/login.js) and the in-browser demo store, so both
// behave identically.
// ============================================================

// "Muhammad Owais Alvi" -> "muhammadowaisalvi"
export function norm(s) {
  return String(s ?? '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')  // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export const tokens = (s) =>
  String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

// Honorifics and given-name prefixes that people routinely drop in speech and
// in writing. "Muhammad Bilal" is "Bilal" to everyone on site.
const PREFIXES = new Set(['muhammad', 'mohammad', 'mohammed', 'muhammed', 'mohd', 'muhd', 'mhd', 'md', 'm', 'hafiz', 'syed', 'malik', 'ch', 'chaudhry', 'mr'])

// Transliteration from Urdu has no single spelling: Toufeeq/Taufiq,
// Shabbir/Shabir, Sikandr/Sikandar, Abdual/Abdul. Fold the spellings that
// vary most into one shape so they compare equal.
export function fold(s) {
  let x = norm(s)
  x = x.replace(/ph/g, 'f').replace(/gh/g, 'g').replace(/kh/g, 'k')
  x = x.replace(/[qc]/g, 'k').replace(/[yw]/g, 'i').replace(/z/g, 'j')
  x = x.replace(/ee|ea|ie/g, 'i').replace(/oo|ou|au|aw/g, 'u')
  x = x.replace(/(.)\1+/g, '$1')          // shabbir -> shabir
  x = x.replace(/[aeiou]+/g, 'a')          // vowels carry the least signal
  x = x.replace(/(.)\1+/g, '$1')          // squeeze again: abdual -> abdaal -> abdal
  return x
}

// Every string this person should be reachable by.
export function aliases(user) {
  const out = new Set()
  // 2 characters is the floor: "GM TAX" is a real account on this roster.
  const add = (v) => { const n = norm(v); if (n.length >= 2) out.add(n) }

  add(user.username)
  add(user.name)

  const t = tokens(user.name)
  if (t.length > 1) {
    const bare = t.filter((x, i) => !(i === 0 && PREFIXES.has(x)))
    add(bare.join(''))                       // Muhammad Owais Alvi -> owaisalvi
    add(t[0]); add(t[t.length - 1])          // first name / last name
    if (bare.length > 1) { add(bare[0]); add(bare[bare.length - 1]) }
    if (bare.length > 2) add(bare[0] + bare[bare.length - 1])
  }
  return [...out]
}

// classic Levenshtein, bailed out past `max` so a long list stays cheap
export function editDistance(a, b, max = 2) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (cur[j] < best) best = cur[j]
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

// Tier 0 is an exact hit and always wins; higher numbers are looser.
// null = this person is not a plausible match for what was typed.
export function rank(user, typed) {
  const q = norm(typed)
  if (!q) return null
  if (q === norm(user.username) || q === norm(user.name)) return 0

  const al = aliases(user)
  if (al.includes(q)) return 1

  const fq = fold(q)
  if (al.some((a) => fold(a) === fq)) return 2

  // typed a prefix of their name — "muhammadow", "sikand"
  if (q.length >= 4 && al.some((a) => a.startsWith(q) || q.startsWith(a))) return 3

  // small misspelling: one edit for short names, two for long ones
  const budget = q.length >= 8 ? 2 : 1
  if (al.some((a) => editDistance(fq, fold(a), budget) <= budget)) return 4

  return null
}

// How far off the closest thing this person answers to is, in characters.
// Breaks ties inside a tier: eight people are called Muhammad-something, and
// "muhammadzahidtali" should shortlist Muhammad Zahid Talib ahead of the rest.
function closeness(user, typed) {
  const q = norm(typed)
  return Math.min(...aliases(user).map((a) => Math.abs(a.length - q.length)))
}

// Ordered shortlist of who could plausibly have typed this. Capped, because
// each candidate costs one bcrypt comparison on the server. The cap sits above
// the largest natural collision on this roster (the eight Muhammads) so that
// typing a shared first name still works for every one of them.
export function candidates(users, typed, limit = 12) {
  const scored = []
  for (const u of users) {
    const r = rank(u, typed)
    if (r !== null) scored.push({ u, r, d: closeness(u, typed) })
  }
  scored.sort((a, b) => a.r - b.r || a.d - b.d || norm(a.u.username).length - norm(b.u.username).length)
  return scored.slice(0, limit).map((s) => s.u)
}

// The whole point: the password decides. `verify(user)` returns true when the
// supplied password is that user's. Returns { ok, user, reason }.
export function resolveLogin(users, typed, verify) {
  const list = candidates(users, typed)
  if (!list.length) return { ok: false, reason: 'bad_credentials' }
  for (const u of list) {
    if (verify(u)) {
      if (u.status === 'disabled') return { ok: false, reason: 'disabled' }
      return { ok: true, user: u }
    }
  }
  return { ok: false, reason: 'bad_credentials' }
}
