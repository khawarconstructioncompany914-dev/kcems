import { directClient, hashPassword, json, readBody } from './_lib.js'

// ============================================================
// ONE-TIME: replace the demo dataset with Khawar Construction's
// real team. Destructive — guarded by an explicit confirm phrase.
// This file is removed again once the seed has been run.
// ============================================================
const CONFIRM = 'REPLACE-ALL-KCEMS-USERS'

// username = full name, lowercase, no spaces. password exactly as supplied.
// (#27 "Sikandr Shah" corrected to "Sikandar Shah" to match sikandarshah@)
const OFFICE = [
  ['Messam Ali',           'messamali',          'owner'],
  ['Tariq Ismail',         'tariqismail',        'finance'],
  ['Muzamil Ali Sher',     'muzamilalisher',     'admin'],
]
const ENGINEERS = [
  ['Ali Khawaja',          'alikhawaja'],
  ['Toufeeq Abbas',        'toufeeqabbas'],
  ['Zohaib Hassan',        'zohaibhassan'],
  ['Shabbir Hussain 2',    'shabbirhussain2'],
  ['Muhammad Zahid Talib', 'muhammadzahidtalib'],
]
const SUPERVISORS = [
  ['Naveed Anjum',         'naveedanjum'],
  ['Ali Irfan',            'aliirfan'],
  ['Saqib Ali',            'saqibali'],
  ['Hassan Raza',          'hassanraza'],
  ['Farhan Haider',        'farhanhaider'],
  ['Muhammad Bilal',       'muhammadbilal'],
  ['Muhammad Abdullah',    'muhammadabdullah'],
  ['Muhammad Mujahid',     'muhammadmujahid'],
  ['Qurban Hussain',       'qurbanhussain'],
  ['Mudassir Khalil',      'mudassirkhalil'],
  ['Muhammad Owais Alvi',  'muhammadowaisalvi'],
  ['Muhammad Irfan',       'muhammadirfan'],
  ['Muhammad Ikram',       'muhammadikram'],
  ['Muhammad Aqeel',       'muhammadaqeel'],
  ['Muhammad Shakeel',     'muhammadshakeel'],
  ['Sohail MDC',           'sohailmdc'],
  ['Abdual Khaliq',        'abdualkhaliq'],
  ['Mirza Saad',           'mirzasaad'],
  ['Sikandar Shah',        'sikandarshah'],
  ['Kashif Hussain',       'kashifhussain'],
  ['Zeeshan Shoukat',      'zeeshanshoukat'],
  ['Mursaleen',            'mursaleen'],
  ['Anees Shah',           'aneesshah'],
  ['GM TAX',               'gmtax'],
]

const uuid = (n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0')
const HOLDING_SITE = uuid(900)

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
  const body = await readBody(req)
  if (body.confirm !== CONFIRM) return json(res, 403, { error: 'confirm_required' })

  const client = directClient()
  try {
    await client.connect()
    await client.query('begin')

    // break FK cycles, then clear the demo dataset
    await client.query('update app_user set site_id = null, engineer_id = null')
    await client.query('update site set engineer_id = null')
    await client.query('delete from audit_log')
    await client.query('delete from expense')
    await client.query('delete from fund_txn')
    await client.query('delete from app_user')
    await client.query('delete from site')

    // provisional holding site — Admin renames / adds real sites in-app
    await client.query(
      `insert into site (id,name,label,city,phase,budget,status,opening_materials,opening_labour,opening_fuel,opening_tea_food)
       values ($1,'Unassigned','UNASSIGNED','—','To be set',0,'active',0,0,0,0)`, [HOLDING_SITE])

    const add = async (id, name, username, role, engineerId, siteId) => {
      await client.query(
        `insert into app_user (id,name,username,role,password_hash,must_change_password,engineer_id,site_id,status)
         values ($1,$2,$3,$4,$5,false,$6,$7,'active')`,
        [id, name, username, role, hashPassword(username + '@'), engineerId, siteId])
    }

    let n = 1
    for (const [name, username, role] of OFFICE) await add(uuid(n++), name, username, role, null, null)

    const engIds = []
    for (const [name, username] of ENGINEERS) {
      const id = uuid(n++)
      engIds.push(id)
      await add(id, name, username, 'engineer', null, null)
    }

    // provisional: round-robin across engineers so every engineer has a queue to test
    let i = 0
    for (const [name, username] of SUPERVISORS) {
      await add(uuid(n++), name, username, 'supervisor', engIds[i++ % engIds.length], HOLDING_SITE)
    }

    await client.query('commit')
    const c = await client.query(`select role, count(*)::int as n from app_user group by role order by role`)
    await client.end()
    return json(res, 200, { ok: true, seeded: true, byRole: c.rows })
  } catch (e) {
    try { await client.query('rollback') } catch { /* ignore */ }
    try { await client.end() } catch { /* ignore */ }
    return json(res, 500, { error: 'seed_failed', detail: String(e.message || e) })
  }
}
