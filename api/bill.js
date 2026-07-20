import { currentUser, json, supaStorage } from './_lib.js'

// GET /api/bill?path=<storage path> — returns a short-lived signed URL for a
// bill photo. Auth required; the bucket is private.
export default async function handler(req, res) {
  const me = await currentUser(req)
  if (!me) return json(res, 401, { error: 'unauthorized' })
  const path = req.query && req.query.path
  if (!path || path === 'bill') return json(res, 400, { error: 'no_path' })
  const sb = supaStorage()
  if (!sb) return json(res, 503, { error: 'storage_unavailable' })
  const { data, error } = await sb.storage.from('bills').createSignedUrl(path, 300)
  if (error) return json(res, 404, { error: 'not_found' })
  json(res, 200, { url: data.signedUrl })
}
