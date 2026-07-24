import { currentUser, q, json } from './_lib.js'

// GET /api/health — liveness probe.
//
// Anonymous callers get a bare {ok:true}: the detailed report describes how the
// deployment is wired (which env vars exist, whether the schema is present) and
// that is reconnaissance, not something to hand to the public. Owners and admins
// get the full picture.
//
// The DB probe goes through the shared pool in _lib.js, so it exercises exactly
// the connection path the real API uses (including the sslmode stripping the
// Supabase pooler needs) instead of hand-rolling its own and reporting a
// false negative.
export default async function handler(req, res) {
  const me = await currentUser(req).catch(() => null)
  if (!me || (me.role !== 'owner' && me.role !== 'admin')) {
    return json(res, 200, { ok: true })
  }

  const has = (k) => Boolean(process.env[k])
  const env = {
    SUPABASE_URL: has('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: has('SUPABASE_SERVICE_ROLE_KEY'),
    SUPABASE_ANON_KEY: has('SUPABASE_ANON_KEY'),
    SUPABASE_JWT_SECRET: has('SUPABASE_JWT_SECRET'),
    JWT_SECRET: has('JWT_SECRET'),
    SETUP_TOKEN: has('SETUP_TOKEN'),
    POSTGRES_URL: has('POSTGRES_URL'),
    POSTGRES_URL_NON_POOLING: has('POSTGRES_URL_NON_POOLING'),
    POSTGRES_PRISMA_URL: has('POSTGRES_PRISMA_URL'),
    DATABASE_URL: has('DATABASE_URL'),
    VITE_SUPABASE_URL: has('VITE_SUPABASE_URL'),
    VITE_DATA_SOURCE: process.env.VITE_DATA_SOURCE || null,
  }

  let db
  try {
    const r = await q(`select
      to_regclass('public.app_user')  as app_user,
      to_regclass('public.expense')   as expense,
      to_regclass('public.site')      as site`)
    const c = r.rows[0].app_user ? await q('select count(*)::int as n from app_user') : null
    db = { reachable: true, schema: r.rows[0], userCount: c ? c.rows[0].n : null }
  } catch (e) {
    db = { reachable: false, error: String((e && e.message) || e) }
  }

  json(res, 200, { ok: true, node: process.version, env, db, ts: new Date().toISOString() })
}
