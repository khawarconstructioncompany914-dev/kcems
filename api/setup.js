import { readFileSync } from 'fs'
import { timingSafeEqual } from 'crypto'
import { directClient, hashPassword, json } from './_lib.js'

// POST /api/setup?token=...  — applies the schema + functions, then seeds the
// demo dataset (once). Idempotent: DDL uses IF NOT EXISTS / OR REPLACE; the seed
// only runs when app_user is empty.
//
// This endpoint runs DDL against production, so it FAILS CLOSED: without a
// SETUP_TOKEN configured in the environment it is disabled outright. Never
// leave it reachable with no token — an unauthenticated caller could otherwise
// replay the migrations against the live database.
const tokenMatches = (given, expected) => {
  const a = Buffer.from(String(given)), b = Buffer.from(String(expected))
  return a.length === b.length && timingSafeEqual(a, b)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
  const expected = process.env.SETUP_TOKEN
  if (!expected) return json(res, 404, { error: 'not_found' })
  const token = (req.query && req.query.token) || req.headers['x-setup-token'] || ''
  if (!tokenMatches(token, expected)) return json(res, 403, { error: 'bad_token' })

  const base = new URL('../supabase/migrations/', import.meta.url)
  let sql1, sql2
  try {
    sql1 = readFileSync(new URL('0001_init.sql', base), 'utf8')
    sql2 = readFileSync(new URL('0002_functions.sql', base), 'utf8')
  } catch (e) {
    return json(res, 500, { error: 'cannot_read_sql', detail: String(e.message || e) })
  }

  const client = directClient()
  try {
    await client.connect()
    await client.query(sql1)
    await client.query(sql2)

    const c = await client.query('select count(*)::int as n from app_user')
    if (c.rows[0].n > 0) {
      await client.end()
      return json(res, 200, { ok: true, migrated: true, seeded: false, users: c.rows[0].n })
    }

    await seed(client)
    const c2 = await client.query('select count(*)::int as n from app_user')
    await client.end()
    return json(res, 200, { ok: true, migrated: true, seeded: true, users: c2.rows[0].n })
  } catch (e) {
    try { await client.end() } catch { /* ignore */ }
    return json(res, 500, { error: 'setup_failed', detail: String(e.message || e) })
  }
}

async function seed(client) {
  const hash = hashPassword('kcems')
  const U = (id) => '00000000-0000-0000-0000-' + String(id).padStart(12, '0')

  const users = [
    [U('01'), 'Messam Khawar', 'messam', '+92 300 8500011', 'messam@khawar.pk', 'owner', null, null],
    [U('02'), 'Junaid Malik', 'junaid', '+92 301 8500033', 'junaid@khawar.pk', 'admin', null, null],
    [U('03'), 'Tariq Mehmood', 'tariq', '+92 301 8500022', 'tariq@khawar.pk', 'finance', null, null],
    [U('11'), 'Ali Khawaja', 'ali', '+92 321 4410001', 'ali@khawar.pk', 'engineer', null, null],
    [U('12'), 'Toufeeq Abbas', 'toufeeq', '+92 321 4410002', 'toufeeq@khawar.pk', 'engineer', null, null],
    [U('13'), 'Zohaib Hassan', 'zohaib', '+92 321 4410003', 'zohaib@khawar.pk', 'engineer', null, null],
    [U('21'), 'Faraz Ahmed', 'faraz', '+92 300 1234567', null, 'supervisor', U('11'), U('101')],
    [U('22'), 'Saqib Riaz', 'saqib', '+92 300 2234567', null, 'supervisor', U('11'), U('102')],
    [U('23'), 'Abdullah Khan', 'abdullah', '+92 300 3234567', null, 'supervisor', U('11'), U('103')],
    [U('24'), 'Hassan Raza', 'hassan', '+92 300 4234567', null, 'supervisor', U('12'), U('104')],
    [U('25'), 'Mubeen Akhtar', 'mubeen', '+92 300 5234567', null, 'supervisor', U('13'), U('105')],
    [U('26'), 'Rana Waseem', 'rana', '+92 300 6234567', null, 'supervisor', U('13'), U('106')],
  ]
  const sites = [
    [U('101'), 'DHA Phase 6', 'DHA 6', 'Lahore', 'Grey structure', U('11'), 2400000, 'active', 1000000, 461500, 120000, 51000],
    [U('102'), 'Gulberg Heights', 'Gulberg', 'Lahore', 'Foundation', U('11'), 1800000, 'active', 512000, 190000, 44000, 12000],
    [U('103'), 'Emaar Canyon Views', 'Emaar', 'Lahore', 'Finishing', U('11'), 3200000, 'active', 1840000, 620000, 88000, 41000],
    [U('104'), 'Bahria Orchard', 'Bahria', 'Lahore', 'Grey structure', U('12'), 1500000, 'active', 402000, 150000, 60000, 18000],
    [U('105'), 'Emaar Oceanfront', 'Emaar', 'Karachi', 'Grey structure', U('13'), 2900000, 'active', 980000, 410000, 95000, 30000],
    [U('106'), 'Park View City', 'Park View', 'Lahore', 'Foundation', U('13'), 2100000, 'on_hold', 220000, 96000, 22000, 8000],
  ]
  const funds = [
    [U('21'), 'funds_in', 'cash', 80000, U('01'), 'Opening float — DHA 6', 18],
    [U('21'), 'funds_in', 'online', 40000, U('03'), 'Top-up', 6],
    [U('22'), 'funds_in', 'cash', 90000, U('01'), 'Opening float — Gulberg', 15],
    [U('23'), 'funds_in', 'cheque', 150000, U('03'), 'Finishing phase float', 12],
    [U('24'), 'funds_in', 'online', 70000, U('03'), 'Opening float — Bahria', 10],
    [U('25'), 'funds_in', 'cash', 110000, U('01'), 'Opening float', 9],
    [U('26'), 'funds_in', 'online', 60000, U('03'), 'Opening float — Park View', 8],
  ]
  // supervisor, site, amount, category, note, status, reject_reason, return_note, createdDaysAgo, decidedDaysAgo
  const expenses = [
    [U('21'), U('101'), 12000, 'materials', 'Cement — 50 bags', 'approved', null, null, 0, 0],
    [U('21'), U('101'), 9500, 'materials', 'River sand — 6 trolleys, plaster', 'engineer_review', null, null, 0, null],
    [U('21'), U('101'), 48000, 'materials', 'Steel — 2 ton', 'approved', null, null, 11, 10],
    [U('21'), U('101'), 17500, 'labour', 'Labour advance', 'approved', null, null, 14, 14],
    [U('21'), U('101'), 3200, 'fuel', 'Diesel — 40L', 'rejected', 'Wrong site — fuel logged against DHA 6 but delivered to Gulberg.', null, 3, 2],
    [U('23'), U('103'), 24000, 'materials', 'Shuttering ply — 12 sheets', 'engineer_review', null, null, 1, null],
    [U('22'), U('102'), 6800, 'materials', 'Rebar tie wire — 40kg', 'engineer_review', null, null, 1, null],
    [U('22'), U('102'), 52000, 'materials', 'Cement — 120 bags', 'finance_review', null, null, 2, null],
    [U('24'), U('104'), 15600, 'fuel', 'Generator diesel — week', 'finance_review', null, null, 2, null],
    [U('26'), U('106'), 88000, 'labour', 'Labour wages — week 28', 'finance_review', null, null, 1, null],
    [U('25'), U('105'), 41500, 'materials', 'Floor tiles — 400 sq ft', 'finance_review', null, null, 1, null],
    [U('22'), U('102'), 4200, 'tea_food', 'Site tea & snacks', 'returned', null, 'Attach a clearer photo of the bill — total is unreadable.', 2, null],
    [U('22'), U('102'), 16000, 'materials', 'Sand — 10 trolleys', 'approved', null, null, 6, 5],
    [U('23'), U('103'), 33500, 'materials', 'Paint — 15 gallons', 'approved', null, null, 7, 6],
    [U('24'), U('104'), 21000, 'labour', 'Mason wages', 'approved', null, null, 9, 8],
    [U('25'), U('105'), 12400, 'fuel', 'Transport — material haul', 'approved', null, null, 4, 3],
  ]

  await client.query('begin')
  // site.engineer_id and app_user.site_id reference each other, so break the
  // cycle: users first with a null site (engineers precede supervisors in the
  // array, satisfying the self-FK), then sites, then backfill supervisor sites.
  for (const u of users) {
    await client.query(
      `insert into app_user (id,name,username,phone,email,role,engineer_id,site_id,password_hash,must_change_password,status)
       values ($1,$2,$3,$4,$5,$6,$7,null,$8,false,'active')`,
      [u[0], u[1], u[2], u[3], u[4], u[5], u[6], hash])
  }
  for (const s of sites) {
    await client.query(
      `insert into site (id,name,label,city,phase,engineer_id,budget,status,opening_materials,opening_labour,opening_fuel,opening_tea_food)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, s)
  }
  for (const u of users) {
    if (u[7]) await client.query('update app_user set site_id = $1 where id = $2', [u[7], u[0]])
  }
  for (const f of funds) {
    await client.query(
      `insert into fund_txn (supervisor_id,type,method,amount,by_user_id,note,created_at)
       values ($1,$2,$3,$4,$5,$6, now() - ($7 || ' days')::interval)`, f)
  }
  for (const e of expenses) {
    await client.query(
      `insert into expense (supervisor_id,site_id,amount,category,note,bill_image_url,status,reject_reason,return_note,created_at,decided_at)
       values ($1,$2,$3,$4,$5,'bill',$6,$7,$8, now() - ($9 || ' days')::interval,
               case when $10::int is null then null else now() - ($10 || ' days')::interval end)`,
      [e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8], e[9]])
  }
  await client.query('commit')
}
