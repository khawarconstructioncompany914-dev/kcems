import { clearSessionCookie, json } from './_lib.js'

export default async function handler(req, res) {
  clearSessionCookie(res)
  json(res, 200, { ok: true })
}
