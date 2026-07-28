import { currentUser, json, supaStorage, visiblePaths } from './_lib.js'

// GET /api/bill?path=<storage path> — returns a short-lived signed URL for a
// single bill photo. Auth required; the bucket is private.
//
// The caller must also be entitled to the expense/fund the photo belongs to.
// Without that check any signed-in user could read every bill in the company
// by guessing paths — a supervisor could read another site's ledger. See
// visiblePaths() in _lib.js. For a whole gallery use /api/bills-signed.
export default async function handler(req, res) {
  const me = await currentUser(req)
  if (!me) return json(res, 401, { error: 'unauthorized' })
  const path = req.query && req.query.path
  if (!path || path === 'bill') return json(res, 400, { error: 'no_path' })

  const allowed = await visiblePaths(me, [path])
  if (!allowed.has(path)) return json(res, 403, { error: 'forbidden' })

  const sb = supaStorage()
  if (!sb) return json(res, 503, { error: 'storage_unavailable' })
  const { data, error } = await sb.storage.from('bills').createSignedUrl(path, 300)
  if (error) return json(res, 404, { error: 'not_found' })
  json(res, 200, { url: data.signedUrl })
}
