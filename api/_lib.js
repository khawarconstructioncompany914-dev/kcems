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

// ---------- helpers ----------
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
  openingSpend: { materials: s.opening_materials, labour: s.opening_labour, fuel: s.opening_fuel, tea_food: s.opening_tea_food, other: s.opening_other },
})
export const mapExpense = (e) => ({
  id: e.id, supervisorId: e.supervisor_id, siteId: e.site_id, amount: e.amount, category: e.category, note: e.note,
  billImageUrl: e.bill_image_url, status: e.status, rejectReason: e.reject_reason, returnNote: e.return_note,
  settledAt: e.settled_at, createdAt: e.created_at, decidedAt: e.decided_at,
})
export const mapFund = (f) => ({
  id: f.id, supervisorId: f.supervisor_id, type: f.type, method: f.method, amount: f.amount,
  byUserId: f.by_user_id, note: f.note, createdAt: f.created_at,
})
