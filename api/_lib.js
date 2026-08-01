// Shared server helpers for the KCEMS API (Vercel serverless + Supabase/Postgres).
import pg from 'pg'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

// service-role Supabase client for the private "bills" storage bucket
export function supaStorage() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// pg parses int8/bigint as strings by default — return them as JS numbers.
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)))

const POOLED = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL
const DIRECT = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL

// Strip sslmode from the URL so our ssl config (below) wins — Supabase's pooler
// presents a cert outside the default trust chain, so we disable verification.
function clean(cs) {
  if (!cs) return cs
  try { const u = new URL(cs); u.searchParams.delete('sslmode'); return u.toString() } catch { return cs }
}
const SSL = { rejectUnauthorized: false }

// reuse a single pool across warm invocations
export function pool() {
  if (!globalThis.__kcemsPool) {
    globalThis.__kcemsPool = new pg.Pool({ connectionString: clean(POOLED), ssl: SSL, max: 3 })
  }
  return globalThis.__kcemsPool
}
export function directClient() {
  return new pg.Client({ connectionString: clean(DIRECT), ssl: SSL })
}
export const q = (text, params) => pool().query(text, params)

// ---------- auth ----------
export const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || ''
// surrounding whitespace is never meaningful in a password here — strip it on
// both set and check so copy-pasted values always match
export const normPassword = (pw) => String(pw ?? '').replace(/^\s+|\s+$/g, '')
export const hashPassword = (pw) => bcrypt.hashSync(normPassword(pw), 10)
export const checkPassword = (pw, hash) => { try { return bcrypt.compareSync(pw, hash) } catch { return false } }
export const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
export function verifyToken(token) { try { return jwt.verify(token, JWT_SECRET) } catch { return null } }

const COOKIE = 'kc_session'
export function parseCookies(req) {
  const out = {}
  const raw = req.headers?.cookie
  if (!raw) return out
  raw.split(';').forEach((p) => { const i = p.indexOf('='); if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()) })
  return out
}
export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`)
}
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`)
}
// returns { uid, role } from the signed cookie, or null
export function getSession(req) {
  const token = parseCookies(req)[COOKIE]
  if (!token) return null
  return verifyToken(token)
}
export async function currentUser(req) {
  const s = getSession(req)
  if (!s?.uid) return null
  const r = await q('select * from app_user where id = $1', [s.uid])
  const u = r.rows[0]
  if (!u || u.status === 'disabled') return null
  return u
}

// ---------- photo uploads ----------
// Hard ceilings so one request can't be used to fill the bucket. The UI caps
// well below these; these are the server's own limits.
export const MAX_PHOTOS = 8
const MAX_BYTES = 4 * 1024 * 1024   // per photo, after client-side compression

// Uploads an array of { dataUrl, capturedAt } to the private "bills" bucket
// under `prefix`, and returns the rows that actually landed as
// [{ path, capturedAt }]. A single failed upload is skipped rather than
// failing the whole submission — losing one of five photos should not cost
// the supervisor the expense they just typed in.
export async function uploadPhotos(prefix, photos, limit = MAX_PHOTOS) {
  const list = Array.isArray(photos) ? photos.slice(0, limit) : []
  if (!list.length) return []
  const sb = supaStorage()
  if (!sb) return []
  const out = []
  for (let i = 0; i < list.length; i++) {
    const p = list[i] || {}
    const dataUrl = typeof p === 'string' ? p : p.dataUrl
    if (!dataUrl) continue
    try {
      const buf = Buffer.from(String(dataUrl).split(',').pop(), 'base64')
      if (!buf.length || buf.length > MAX_BYTES) continue
      const path = `${prefix}/${Date.now()}_${i}.jpg`
      const up = await sb.storage.from('bills').upload(path, buf, { contentType: 'image/jpeg', upsert: false })
      if (up.error) continue
      const at = p.capturedAt && !Number.isNaN(Date.parse(p.capturedAt)) ? new Date(p.capturedAt).toISOString() : null
      out.push({ path, capturedAt: at })
    } catch { /* skip this one, keep the rest */ }
  }
  return out
}

// Which of `paths` is this user allowed to see? Returns a Set of the allowed
// ones. Authorization is resolved by looking each path up in the photo tables
// and checking the owning expense/fund against the caller's scope — the same
// rules /api/data applies. Deliberately NOT derived from the path string:
// paths are attacker-supplied, and `${someoneElsesId}/...` must not grant
// access just because it is shaped correctly.
export async function visiblePaths(me, paths) {
  const allowed = new Set()
  const list = [...new Set((paths || []).filter((p) => typeof p === 'string' && p && p !== 'bill'))]
  if (!list.length) return allowed
  if (['owner', 'admin', 'finance'].includes(me.role)) return new Set(list)

  const [ep, fp] = await Promise.all([
    q(`select p.storage_path, e.supervisor_id, e.kind
         from expense_photo p join expense e on e.id = p.expense_id
        where p.storage_path = any($1)`, [list]),
    q(`select p.storage_path, f.supervisor_id
         from fund_txn_photo p join fund_txn f on f.id = p.fund_txn_id
        where p.storage_path = any($1)`, [list]),
  ])

  let mine = new Set([me.id])
  if (me.role === 'engineer') {
    const sups = await q('select id from app_user where engineer_id = $1', [me.id])
    mine = new Set([me.id, ...sups.rows.map((r) => r.id)])
  }
  for (const r of ep.rows) if (mine.has(r.supervisor_id)) allowed.add(r.storage_path)
  for (const r of fp.rows) if (mine.has(r.supervisor_id)) allowed.add(r.storage_path)
  return allowed
}

// ---------- helpers ----------
// Caller's address, for rate limiting. On Vercel the platform appends the real
// client to x-forwarded-for, so the FIRST entry is the one to use — and it is
// client-supplied, which is why it only ever loosens a limit here, never grants
// anything. Returns null when there is nothing trustworthy to key on.
export function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  const first = String(Array.isArray(xff) ? xff[0] : (xff || '')).split(',')[0].trim()
  const ip = first || String(req.headers['x-real-ip'] || '').trim()
  return ip ? ip.slice(0, 64) : null
}

export function json(res, code, obj) { res.status(code).setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  return await new Promise((resolve) => {
    let d = ''
    req.on('data', (c) => (d += c))
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}) } catch { resolve({}) } })
    req.on('error', () => resolve({}))
  })
}
export function envReady() {
  return Boolean(POOLED && JWT_SECRET && (process.env.SUPABASE_URL || true))
}

// ---------- row → front-end shape mappers ----------
export const mapUser = (u) => ({
  id: u.id, name: u.name, username: u.username, email: u.email, phone: u.phone, role: u.role,
  engineerId: u.engineer_id, siteId: u.site_id, status: u.status, mustChangePassword: u.must_change_password,
})
export const mapSite = (s) => ({
  id: s.id, name: s.name, label: s.label, city: s.city, phase: s.phase, engineerId: s.engineer_id,
  budget: s.budget, status: s.status,
  startDate: s.start_date, targetFinishDate: s.target_finish_date,
  progress: null,   // latest site_progress row, attached by data.js
  openingSpend: { materials: s.opening_materials, labour: s.opening_labour, fuel: s.opening_fuel, tea_food: s.opening_tea_food, other: s.opening_other },
})

// `lat`/`lng` are omitted unless the caller is allowed to see them — see
// data.js. Everyone can see THAT a colleague was present; where they were
// standing is owner/admin only.
export const mapAttendance = (a) => ({
  id: a.id, userId: a.user_id, date: a.date, kind: a.kind, status: a.status,
  markedAt: a.marked_at, note: a.note,
  reviewedBy: a.reviewed_by, reviewedAt: a.reviewed_at,
})
// `photos` is populated by data.js from expense_photo / fund_txn_photo — it is
// not derived from a column here, so a mapper used without that join still
// yields a well-formed (empty) array rather than undefined.
export const mapExpense = (e) => ({
  id: e.id, supervisorId: e.supervisor_id, siteId: e.site_id, amount: e.amount, category: e.category, note: e.note,
  billImageUrl: e.bill_image_url, status: e.status, rejectReason: e.reject_reason, returnNote: e.return_note,
  settledAt: e.settled_at, createdAt: e.created_at, decidedAt: e.decided_at,
  kind: e.kind || 'site_expense', photos: [],
})
export const mapFund = (f) => ({
  id: f.id, supervisorId: f.supervisor_id, type: f.type, method: f.method, amount: f.amount,
  byUserId: f.by_user_id, note: f.note, createdAt: f.created_at, photos: [],
})
