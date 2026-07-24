#!/usr/bin/env node
// ============================================================
// KCEMS · roster reconciliation
//
//   node scripts/roster-sync.js <roster.txt>            # report only
//   node scripts/roster-sync.js <roster.txt> --apply    # fix the database
//
// Reads the roster text file the company maintains (blocks of
// "Name:" / "Password:" / "Role:") and compares it against app_user:
// who is missing, who has the wrong role, whose username does not match
// their name, and whose password no longer matches the file.
//
// The roster file stays OUT of this repository — it holds every employee's
// password in plain text and the repo is public. Pass it in by path and keep
// it wherever the company keeps it.
//
// Needs POSTGRES_URL (or POSTGRES_URL_NON_POOLING / DATABASE_URL) in the
// environment — the same value Vercel uses.
// ============================================================
import { readFileSync } from 'fs'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { norm } from '../src/data/match.js'

const ROLE_WORDS = [
  [/owner|ceo|proprietor/i, 'owner'],
  [/finance|account/i, 'finance'],
  [/admin/i, 'admin'],
  [/engineer/i, 'engineer'],
  [/supervisor|site/i, 'supervisor'],
]
const toRole = (raw) => (ROLE_WORDS.find(([re]) => re.test(raw)) || [])[1] || null

// tolerant of stray spaces, blank lines and numbering
export function parseRoster(text) {
  const people = []
  let cur = {}
  const push = () => { if (cur.name && cur.role) people.push(cur); cur = {} }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(name|password|role)\s*:\s*(.*?)\s*$/i)
    if (!m) continue
    const key = m[1].toLowerCase()
    if (key === 'name' && cur.name) push()
    cur[key] = m[2].trim()
    if (cur.name && cur.password !== undefined && cur.role) push()
  }
  push()
  return people.map((p) => ({
    name: p.name.replace(/\s+/g, ' ').trim(),
    password: (p.password || '').trim(),
    rawRole: p.role,
    role: toRole(p.role),
    username: norm(p.name),
  }))
}

const CONN = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL
const clean = (cs) => { try { const u = new URL(cs); u.searchParams.delete('sslmode'); return u.toString() } catch { return cs } }
// Supabase's pooler presents a cert outside the default trust chain; a local
// Postgres has no TLS at all. Match _lib.js for remote, plain socket for local.
const isLocal = (cs) => /host=\/|localhost|127\.0\.0\.1/.test(cs)

async function main() {
  const file = process.argv[2]
  const apply = process.argv.includes('--apply')
  if (!file) { console.error('usage: node scripts/roster-sync.js <roster.txt> [--apply]'); process.exit(1) }
  if (!CONN) { console.error('set POSTGRES_URL (copy it from the Vercel project settings)'); process.exit(1) }

  const roster = parseRoster(readFileSync(file, 'utf8'))
  if (!roster.length) { console.error('no "Name:/Password:/Role:" blocks found in that file'); process.exit(1) }

  const client = new pg.Client({ connectionString: clean(CONN), ssl: isLocal(CONN) ? false : { rejectUnauthorized: false } })
  await client.connect()
  const { rows } = await client.query('select id, name, username, role, password_hash, status from app_user')

  const byUsername = new Map(rows.map((r) => [norm(r.username), r]))
  const byName = new Map(rows.map((r) => [norm(r.name), r]))
  const seen = new Set()
  const issues = []
  const fix = async (sql, params, label) => {
    if (apply) await client.query(sql, params)
    issues.push(`${apply ? 'FIXED  ' : 'WOULD FIX'}  ${label}`)
  }

  for (const p of roster) {
    if (!p.role) { issues.push(`SKIPPED   ${p.name} — unrecognised role "${p.rawRole}"`); continue }

    // The roster's own name and password disagree for a couple of people
    // (e.g. "Sikandr Shah" with password "sikandarshah@"). That is a spelling
    // question for a human, not something to guess at, so flag and move on.
    const spellingClash = p.password && p.password.replace(/@+$/, '') !== p.username
    const row = byUsername.get(p.username) || byName.get(p.username) ||
      (spellingClash ? byUsername.get(norm(p.password.replace(/@+$/, ''))) : null)

    if (!row) {
      if (spellingClash) issues.push(`CHECK     ${p.name} — roster password "${p.password}" does not match the name spelling; creating with username "${p.username}"`)
      await fix(
        `insert into app_user (name, username, role, password_hash, must_change_password, status)
         values ($1,$2,$3,$4,false,'active')`,
        [p.name, p.username, p.role, bcrypt.hashSync(p.password || p.username + '@', 10)],
        `create ${p.name} (${p.username}, ${p.role})`)
      continue
    }
    seen.add(row.id)

    if (spellingClash) issues.push(`CHECK     ${p.name} — roster password is "${p.password}" but the name spells "${p.username}"; database has name "${row.name}", username "${row.username}". Left alone.`)
    else {
      if (norm(row.username) !== p.username) await fix('update app_user set username = $1 where id = $2', [p.username, row.id], `${p.name}: username "${row.username}" -> "${p.username}"`)
      if (row.name.trim() !== p.name) await fix('update app_user set name = $1 where id = $2', [p.name, row.id], `${row.name}: name -> "${p.name}"`)
    }
    if (row.role !== p.role) await fix('update app_user set role = $1 where id = $2', [p.role, row.id], `${p.name}: role "${row.role}" -> "${p.role}"`)
    if (row.status === 'disabled') issues.push(`CHECK     ${p.name} — account is disabled`)
    if (p.password && !bcrypt.compareSync(p.password, row.password_hash))
      await fix('update app_user set password_hash = $1, must_change_password = false where id = $2',
        [bcrypt.hashSync(p.password, 10), row.id], `${p.name}: password reset to the roster value`)
  }

  for (const r of rows) if (!seen.has(r.id)) issues.push(`EXTRA     ${r.name} (${r.username}, ${r.role}) is in the database but not in the roster file`)

  console.log(`roster: ${roster.length} people · database: ${rows.length} accounts`)
  console.log(issues.length ? issues.join('\n') : 'everything matches — names, usernames, roles and passwords')
  if (!apply && issues.some((i) => i.startsWith('WOULD FIX'))) console.log('\nre-run with --apply to make these changes')
  await client.end()
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1) })
