import { currentUser, json, readBody, supaStorage, visiblePaths } from './_lib.js'

// POST /api/bills-signed  { paths: string[] }  ->  { urls: { [path]: signedUrl } }
//
// The bills gallery renders dozens of thumbnails at once; signing them one
// HTTP request at a time would mean dozens of round trips for a single screen.
// This signs a whole page of them in one call.
//
// Paths the caller isn't entitled to are simply absent from the response
// rather than erroring, so one out-of-scope path can't blank the whole grid.
const MAX_PATHS = 150
const TTL = 300

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
  const me = await currentUser(req)
  if (!me) return json(res, 401, { error: 'unauthorized' })

  const body = await readBody(req)
  const paths = Array.isArray(body.paths) ? body.paths.slice(0, MAX_PATHS) : []
  if (!paths.length) return json(res, 200, { urls: {} })

  const sb = supaStorage()
  if (!sb) return json(res, 503, { error: 'storage_unavailable' })

  const allowed = [...(await visiblePaths(me, paths))]
  if (!allowed.length) return json(res, 200, { urls: {} })

  const urls = {}
  const { data, error } = await sb.storage.from('bills').createSignedUrls(allowed, TTL)
  if (error) return json(res, 502, { error: 'sign_failed' })
  for (const row of data || []) if (row.signedUrl && !row.error) urls[row.path] = row.signedUrl

  json(res, 200, { urls })
}
