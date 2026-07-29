import { currentUser, q, json, readBody, hashPassword, checkPassword, normPassword, uploadPhotos, MAX_PHOTOS } from './_lib.js'

// Mirrors the client reducer, but authorized server-side (Build Spec §2)
// and running the atomic state-machine RPCs (§3). Front-end refetches /api/data after.
const OWNER_ADMIN = new Set(['owner', 'admin'])
const FINANCE_OWNER = new Set(['owner', 'finance'])

// what an engineer may claim back — site-only categories are excluded
const CLAIM_CATS = new Set(['travel', 'lodging', 'tea_food', 'other'])

const ok = (res) => json(res, 200, { ok: true })
const deny = (res) => json(res, 403, { error: 'forbidden' })

async function getExpense(id) { const r = await q('select * from expense where id = $1', [id]); return r.rows[0] }
async function isMySupervisor(engId, supId) { const r = await q('select 1 from app_user where id = $1 and engineer_id = $2', [supId, engId]); return r.rowCount > 0 }

// Accept both shapes. New clients send `photos: [{dataUrl, capturedAt}]`; a
// phone still running the previous bundle from the service-worker cache sends
// a single `billData` string, and it should keep working rather than start
// failing the moment this deploys.
const incomingPhotos = (src) => {
  if (Array.isArray(src?.photos) && src.photos.length) return src.photos
  if (src?.billData) return [{ dataUrl: src.billData, capturedAt: null }]
  return []
}

async function saveExpensePhotos(expenseId, uploaded, actor) {
  for (const p of uploaded) {
    await q(`insert into expense_photo (expense_id, storage_path, captured_at, uploaded_by)
             values ($1, $2, coalesce($3::timestamptz, now()), $4)`, [expenseId, p.path, p.capturedAt, actor])
  }
}

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
        const photos = incomingPhotos(p)
        if (!photos.length) return json(res, 400, { error: 'photo_required' })
        // The function returns the `expense` composite, so it can sit in FROM
        // and expand to columns — one call, and we get the new id back.
        const r = await q('select id from kcems_log_expense($1,$2,$3,$4,$5,$6)',
          [me.id, p.siteId || me.site_id, Math.round(p.amount), p.category, p.note, null])
        const id = r.rows[0].id
        await saveExpensePhotos(id, await uploadPhotos(`${me.id}/${id}`, photos), actor)
        return ok(res)
      }

      // engineer files a travel/lodging/food reimbursement claim
      case 'LOG_CLAIM': {
        if (me.role !== 'engineer') return deny(res)
        const p = b.payload || {}
        const amount = Math.round(p.amount)
        if (!(amount > 0)) return json(res, 400, { error: 'bad_amount' })
        if (!CLAIM_CATS.has(p.category)) return json(res, 400, { error: 'bad_category' })
        if (!String(p.note || '').trim()) return json(res, 400, { error: 'missing_fields' })
        const photos = incomingPhotos(p)
        if (!photos.length) return json(res, 400, { error: 'photo_required' })
        const r = await q('select id from kcems_log_reimbursement($1,$2,$3,$4)',
          [me.id, amount, p.category, String(p.note).trim()])
        const id = r.rows[0].id
        await saveExpensePhotos(id, await uploadPhotos(`${me.id}/${id}`, photos), actor)
        return ok(res)
      }

      // supervisor re-submits an item the engineer sent back
      case 'RESUBMIT': {
        const e = await getExpense(b.id)
        if (!e) return json(res, 404, { error: 'not_found' })
        // only the person who logged it (or the owner) can put it back in the queue
        if (me.role !== 'owner' && e.supervisor_id !== me.id) return deny(res)
        // Photos APPEND here rather than replace: an engineer usually returns
        // an item because one photo was unreadable, and wiping the ones that
        // were already fine would make the reviewer's job harder, not easier.
        await q('select kcems_resubmit($1,$2,$3,$4)', [b.id, actor, b.note || null, null])
        const photos = incomingPhotos(b)
        if (photos.length) await saveExpensePhotos(b.id, await uploadPhotos(`${me.id}/${b.id}`, photos), actor)
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
        // Handing over cash is the one step with no paper trail of its own, so
        // proof of the transfer is required before the money is recorded. The
        // SQL function can't see the photos, so the check has to live here.
        const photos = incomingPhotos(b)
        if (!photos.length) return json(res, 400, { error: 'proof_required' })
        const r = await q('select id from kcems_add_funds($1,$2,$3,$4,$5)',
          [b.supervisorId, actor, Math.round(b.amount), b.method || 'cash', b.note || ''])
        const id = r.rows[0].id
        const up = await uploadPhotos(`${b.supervisorId}/funds/${id}`, photos, 3)
        for (const p of up) {
          await q(`insert into fund_txn_photo (fund_txn_id, storage_path, captured_at, uploaded_by)
                   values ($1, $2, coalesce($3::timestamptz, now()), $4)`, [id, p.path, p.capturedAt, actor])
        }
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
        // engineer_id and site_id are uuid columns: an empty string is not a
        // valid uuid and would abort the whole UPDATE. "no engineer" and "no
        // site" are legitimate states, so normalise '' to null here too rather
        // than trusting every caller to have done it.
        const NULLABLE_UUID = new Set(['engineerId', 'siteId'])
        const cols = [], vals = []; let i = 1
        for (const k of Object.keys(map)) if (k in patch) {
          cols.push(`${map[k]} = $${i++}`)
          vals.push(NULLABLE_UUID.has(k) && !patch[k] ? null : patch[k])
        }
        if (!cols.length) return ok(res)
        vals.push(b.userId)
        await q(`update app_user set ${cols.join(', ')} where id = $${i}`, vals)
        return ok(res)
      }
      // set a password directly, WITHOUT forcing a change on next login
      case 'SET_PASSWORD': {
        if (!OWNER_ADMIN.has(me.role)) return deny(res)
        if (normPassword(b.password).length < 4) return json(res, 400, { error: 'weak_password' })
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
        if (b.currentPassword !== undefined && !checkPassword(normPassword(b.currentPassword), me.password_hash)) return json(res, 400, { error: 'bad_current' })
        if (normPassword(b.password).length < 4) return json(res, 400, { error: 'weak_password' })
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
