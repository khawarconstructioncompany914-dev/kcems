// GET /api/health — reports how Supabase is wired, without exposing any secret values.
// Used once to build the backend against the real setup. Safe to keep (booleans only).
export default async function handler(req, res) {
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

  let db = { tried: false }
  const cs = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL
  if (cs) {
    db = { tried: true, reachable: false }
    try {
      const pg = await import('pg')
      const client = new pg.default.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } })
      await client.connect()
      const r = await client.query(`select
        to_regclass('public.app_user')  as app_user,
        to_regclass('public.expense')   as expense,
        to_regclass('public.site')      as site`)
      let userCount = null
      if (r.rows[0].app_user) {
        const c = await client.query('select count(*)::int as n from app_user')
        userCount = c.rows[0].n
      }
      db = { tried: true, reachable: true, schema: r.rows[0], userCount }
      await client.end()
    } catch (e) {
      db = { tried: true, reachable: false, error: String(e && e.message || e) }
    }
  }

  res.status(200).json({ ok: true, node: process.version, env, db, ts: new Date().toISOString() })
}
