#!/usr/bin/env node
// ============================================================
// KCEMS · emergency password rotation
//
//   node scripts/rotate-passwords.js                     # report only
//   node scripts/rotate-passwords.js --apply             # rotate everyone
//   node scripts/rotate-passwords.js --apply --out pw.txt
//   node scripts/rotate-passwords.js --apply --only faraz,saqib
//
// Gives every account a fresh random temporary password and sets
// must_change_password, so each person is forced to choose their own the first
// time they sign in.
//
// Why this exists: the demo seed used to write a hardcoded password into every
// account it created, and this repository is public — so that password was a
// published way in for anyone who read the source. Running this closes it.
//
// Everyone is locked out until they are told their new password, so print the
// list (or use --out) BEFORE you hand the app back to the team.
//
// Needs POSTGRES_URL (or POSTGRES_URL_NON_POOLING / DATABASE_URL) in the
// environment — the same value Vercel uses.
// ============================================================
import { writeFileSync } from 'fs'
import { randomInt } from 'crypto'
import pg from 'pg'
import bcrypt from 'bcryptjs'

// Temp passwords get read out over the phone to people on a building site, so
// they are words rather than characters: no "was that an l or a 1", no case to
// get wrong. Three words plus two digits out of this list is ~2x10^8
// combinations, which against the login rate limiter is far more than enough
// for a credential that is used exactly once.
const WORDS = (
  'steel brick crane cable timber gravel mortar anchor beam bolt cement chisel ' +
  'copper drill girder hammer ladder level mason nail panel pillar plank plaster ' +
  'rivet sand shovel slab spanner tile trowel wedge winch wire block column ' +
  'ridge tunnel arch bridge canal cargo depot dock fence gate hangar hoist ' +
  'jetty kiln lathe mesh pipe pump quarry ramp roof shaft silo stair torch ' +
  'truss valve vault wall yard zinc amber azure bronze coral ember flint ' +
  'glacier harbour indigo jasmine kestrel lantern meadow nectar orchard prairie ' +
  'quartz river summit thistle umber violet willow xenon yarrow zephyr ' +
  'almond basil cedar dahlia elder fennel ginger hazel ivy juniper laurel maple ' +
  'nutmeg olive poppy quince rosemary saffron tulip vanilla walnut'
).split(/\s+/).filter(Boolean)

const pick = (list) => list[randomInt(0, list.length)]
export const tempPassword = () =>
  `${pick(WORDS)}-${pick(WORDS)}-${pick(WORDS)}-${randomInt(10, 100)}`

const CONN = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL
const clean = (cs) => { try { const u = new URL(cs); u.searchParams.delete('sslmode'); return u.toString() } catch { return cs } }
const isLocal = (cs) => /host=\/|localhost|127\.0\.0\.1/.test(cs)

const pad = (s, n) => String(s ?? '').padEnd(n)

async function main() {
  const argv = process.argv.slice(2)
  const apply = argv.includes('--apply')
  const outAt = argv.indexOf('--out')
  const outFile = outAt > -1 ? argv[outAt + 1] : null
  const onlyAt = argv.indexOf('--only')
  const only = onlyAt > -1 ? new Set(String(argv[onlyAt + 1] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) : null

  if (!CONN) { console.error('set POSTGRES_URL (copy it from the Vercel project settings)'); process.exit(1) }
  if (onlyAt > -1 && (!only || !only.size)) { console.error('--only needs a comma-separated list of usernames'); process.exit(1) }

  const client = new pg.Client({ connectionString: clean(CONN), ssl: isLocal(CONN) ? false : { rejectUnauthorized: false } })
  await client.connect()

  const { rows } = await client.query(
    'select id, name, username, role, status from app_user order by role, name')
  const targets = only ? rows.filter((r) => only.has(String(r.username).toLowerCase())) : rows

  if (!targets.length) {
    console.error(only ? 'no accounts matched --only' : 'no accounts found — has the database been seeded?')
    await client.end(); process.exit(1)
  }
  if (only) {
    const missing = [...only].filter((u) => !targets.some((t) => String(t.username).toLowerCase() === u))
    if (missing.length) console.error(`! no such username: ${missing.join(', ')}\n`)
  }

  const issued = []
  for (const u of targets) {
    const pw = tempPassword()
    if (apply) {
      // bcrypt cost 10, matching _lib.js — a hash written at a different cost
      // still verifies, but keeping them uniform keeps login timing uniform.
      await client.query(
        'update app_user set password_hash = $1, must_change_password = true where id = $2',
        [bcrypt.hashSync(pw, 10), u.id])
    }
    issued.push({ ...u, password: pw })
  }
  await client.end()

  const header = apply
    ? `Rotated ${issued.length} password${issued.length === 1 ? '' : 's'}. Each person must set their own at first login.`
    : `DRY RUN — nothing was changed. ${issued.length} account${issued.length === 1 ? '' : 's'} would be rotated. Re-run with --apply.`

  const table = issued.map((u) =>
    `${pad(u.name, 24)} ${pad(u.username, 20)} ${pad(u.role, 11)} ${pad(u.status, 9)} ${apply ? u.password : '(unchanged)'}`)

  const report = [
    header, '',
    `${pad('NAME', 24)} ${pad('LOGIN', 20)} ${pad('ROLE', 11)} ${pad('STATUS', 9)} TEMP PASSWORD`,
    ...table,
  ].join('\n')

  console.log(report)

  if (outFile && apply) {
    writeFileSync(outFile, report + '\n', 'utf8')
    console.log(`\nWritten to ${outFile} — this file holds live credentials. Delete it once everyone has signed in, and keep it out of git.`)
  } else if (outFile) {
    console.log('\n--out is ignored on a dry run: there are no passwords to write yet.')
  }

  if (!apply) console.log('\nNothing was changed. Add --apply to rotate for real.')
}

main().catch((e) => { console.error(e); process.exit(1) })
