import { currentUser, q, json, readBody, hashPassword, checkPassword, supaStorage } from './_lib.js'

// Mirrors the client reducer, but authorized server-side (Build Spec §2)
// and running the atomic state-machine RPCs (§3). Front-end refetches /api/data after.
const OWNER_ADMIN = new Set(['owner', 'admin'])
const FINANCE_OWNER = new Set(['owner', 'finance'])

const ok = (res) => json(res, 200, { ok: true })
const deny = (res) => json(res, 403, { error: 'forbidden' })

async function getExpense(id) { const r = await q('select * from expense where id = $1', [id]); return r.rows[0] }
async function isMySupervisor(engId, supId) { const r = await q('select 1 from app_user where id = $1 and engineer_id = $2', [supId, engId]); return r.rowCount > 0 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
  const me = await currentUser(req)
  if (!me) return json(res, 401, { error: 'unauthorized' })
  const b = await readBody(req)
  const actor = me.id

  try {
    switch (b.type) {
      case 'LOG_EXPENSE': {
        if (me.role !== 'supervisor') return deny(res)
        const p = b.payload || {}
        let bill = p.bill ? 'bill' : null
        if (p.billData) {
          const sb = supaStorage()
          if (sb) {
            try {
              const buf = Buffer.from(String(p.billData).split(',').pop(), 'base64')
              const path = `${me.id}/${Date.now()}.jpg`
              const up = await sb.storage.from('bills').upload(path, buf, { contentType: 'image/jpeg', upsert: false })
              if (!up.error) bill = path
            } catch { /* fall back to marker */ }
          }
        }
        await q('select kcems_log_expense($1,$2,$3,$4,$5,$6)',
          [me.id, p.siteId || me.site_id, Math.round(p.amount), p.category, p.note, bill])
        return ok(res)
      }

      case 'PASS_UP':
      case 'RETURN': {
        const e = await getExpense(b.id)
        if (!e) return json(res, 404, { error: 'not_found' })
        const allowed = me.role === 'owner' || (me.role === 'engineer' && await isMySupervisor(me.id, e.supervisor_id))
        if (!allowed) return deny(res)
        if (b.type === 'PASS_UP') await q('select kcems_pass_up($1,$2)', [b.id, actor])
        else await q('select kcems_return_expense($1,$2,$3)', [b.id, actor, b.note || ''])
        return ok(res)
      }

      case 'APPROVE': {
        if (!FINANCE_OWNER.has(me.role)) return deny(res)
        await q('select kcems_approve($1,$2)', [b.id, actor])
        return ok(res)
      }
      case 'REJECT': {
        if (!FINANCE_OWNER.has(me.role)) return deny(res)
        await q('select kcems_reject($1,$2,$3)', [b.id, actor, b.reason || ''])
        return ok(res)
      }
      case 'SETTLE': {
        if (!FINANCE_OWNER.has(me.role)) return deny(res)
        await q('select kcems_settle($1,$2,$3)', [b.id, actor, b.method || 'cash'])
        return ok(res)
      }
      case 'ADD_FUNDS': {
        if (!FINANCE_OWNER.has(me.role)) return deny(res)
        await q('select kcems_add_funds($1,$2,$3,$4,$5)', [b.supervisorId, actor, Math.round(b.amount), b.method || 'cash', b.note || ''])
        return ok(res)
      }

      case 'CREATE_USER': {
        if (!OWNER_ADMIN.has(me.role)) return deny(res)
        const p = b.payload || {}
        if (!p.name || !p.username || !p.role) return json(res, 400, { error: 'missing_fields' })
        const taken = await q('select 1 from app_user where lower(username) = lower($1)', [p.username])
        if (taken.rowCount) return json(res, 409, { error: 'username_taken' })
        await q(`insert into app_user (name, username, phone, role, password_hash, must_change_password, engineer_id, site_id, status)
                 values ($1,$2,$3,$4,$5,true,$6,$7,'active')`,
          [p.name, String(p.username).toLowerCase(), p.phone || null, p.role, hashPassword(p.password || 'kcems'), p.engineerId || null, p.siteId || null])
        return ok(res)
      }
      case 'UPDATE_USER': {
        if (!OWNER_ADMIN.has(me.role)) return deny(res)
        const patch = { ...(b.patch || {}) }
        // usernames are normalised (lowercase, no spaces) and must stay unique
        if ('username' in patch) {
          patch.username = String(patch.username).trim().toLowerCase().replace(/\s+/g, '')
          if (!patch.username) return json(res, 400, { error: 'bad_username' })
          const taken = await q('select 1 from app_user where lower(username) = $1 and id <> $2', [patch.username, b.userId])
          if (taken.rowCount) return json(res, 409, { error: 'username_taken' })
        }
        const map = { engineerId: 'engineer_id', siteId: 'site_id', status: 'status', name: 'name', role: 'role', username: 'username' }
        const cols = [], vals = []; let i = 1
        for (const k of Object.keys(map)) if (k in patch) { cols.push(`${map[k]} = $${i++}`); vals.push(patch[k]) }
        if (!cols.length) return ok(res)
        vals.push(b.userId)
        await q(`update app_user set ${cols.join(', ')} where id = $${i}`, vals)
        return ok(res)
      }
      // set a password directly, WITHOUT forcing a change on next login
      case 'SET_PASSWORD': {
        if (!OWNER_ADMIN.has(me.role)) return deny(res)
        if (!b.password || String(b.password).length < 4) return json(res, 400, { error: 'weak_password' })
        await q('update app_user set password_hash = $1, must_change_password = false where id = $2', [hashPassword(b.password), b.userId])
        return ok(res)
      }
      case 'REASSIGN_SUP': {
        if (!OWNER_ADMIN.has(me.role)) return deny(res)
        await q('update app_user set engineer_id = $1 where id = $2', [b.engineerId, b.supId])
        return ok(res)
      }

      case 'CREATE_SITE': {
        if (!OWNER_ADMIN.has(me.role)) return deny(res)
        const p = b.payload || {}
        if (!p.name) return json(res, 400, { error: 'missing_fields' })
        await q(`insert into site (name,label,city,phase,engineer_id,budget,status)
                 values ($1,$2,$3,$4,$5,$6,$7)`,
          [p.name, p.label || p.name.slice(0, 12), p.city || null, p.phase || null, p.engineerId || null, Math.round(p.budget || 0), p.status || 'active'])
        return ok(res)
      }
      case 'UPDATE_SITE': {
        if (!OWNER_ADMIN.has(me.role)) return deny(res)
        const patch = b.patch || {}
        const map = { name: 'name', label: 'label', city: 'city', phase: 'phase', engineerId: 'engineer_id', budget: 'budget', status: 'status' }
        const cols = [], vals = []; let i = 1
        for (const k of Object.keys(map)) if (k in patch) { cols.push(`${map[k]} = $${i++}`); vals.push(k === 'budget' ? Math.round(patch[k] || 0) : patch[k]) }
        if (!cols.length) return ok(res)
        vals.push(b.siteId)
        await q(`update site set ${cols.join(', ')} where id = $${i}`, vals)
        return ok(res)
      }
      case 'RESET_PASSWORD': {
        if (!OWNER_ADMIN.has(me.role)) return deny(res)
        await q('update app_user set password_hash = $1, must_change_password = true where id = $2', [hashPassword(b.password || 'kcems'), b.userId])
        return ok(res)
      }
      case 'CHANGE_PASSWORD': {
        if (b.currentPassword !== undefined && !checkPassword(b.currentPassword, me.password_hash)) return json(res, 400, { error: 'bad_current' })
        if (!b.password || String(b.password).length < 4) return json(res, 400, { error: 'weak_password' })
        await q('update app_user set password_hash = $1, must_change_password = false where id = $2', [hashPassword(b.password), me.id])
        return ok(res)
      }

      default:
        return json(res, 400, { error: 'unknown_action' })
    }
  } catch (err) {
    return json(res, 400, { error: String(err && err.message || err) })
  }
}
