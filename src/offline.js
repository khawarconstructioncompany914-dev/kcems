// ============================================================
// KCEMS · offline snapshot + write queue
//
// Sites lose signal. Basements, new plots outside town, a bad hour on the
// network — and the person standing there is holding a paper bill they need to
// log now, not when the bars come back. Before this, the fetch simply failed
// and the typing was gone.
//
// Two halves:
//   · snapshot — the last /api/data response, so the app opens and shows real
//     numbers with no connection instead of a spinner or an empty shell.
//   · queue    — field writes made while offline, replayed in order when the
//     connection returns.
//
// Every queued write carries a clientRef that survives retries. The server
// claims that ref before doing the work (kcems_claim_client_ref, migration
// 0005), so a reply lost on the way back cannot turn into a second expense for
// the same bill when the phone tries again.
// ============================================================

const DB_NAME = 'kcems-offline'
const DB_VERSION = 1
const SNAPSHOT_STORE = 'snapshot'
const QUEUE_STORE = 'queue'

// Only field work is queued. Approvals, funds and user administration are done
// in the office on a desktop, and deferring them would be worse than refusing:
// approving an expense against a snapshot that is hours stale is a decision
// made on information the approver did not know was old.
export const QUEUEABLE = new Set(['LOG_EXPENSE', 'LOG_CLAIM', 'RESUBMIT', 'MARK_ATTENDANCE', 'LOG_PROGRESS'])

// What each queued action is called when we tell the user it is waiting.
export const ACTION_LABEL = {
  LOG_EXPENSE: 'Expense',
  LOG_CLAIM: 'Claim',
  RESUBMIT: 'Re-submitted expense',
  MARK_ATTENDANCE: 'Attendance',
  LOG_PROGRESS: 'Site progress',
}

export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

const newRef = () => {
  const rnd = globalThis.crypto?.randomUUID?.()
  return rnd || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

// ---------------- IndexedDB plumbing ----------------
let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexeddb'))
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE)
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  // A failed open must not be cached as a permanently rejected promise, or the
  // app stays broken for the whole session over one transient error.
  dbPromise.catch(() => { dbPromise = null })
  return dbPromise
}

function tx(store, mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
    if (req) { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) }
    else t.oncomplete = () => resolve()
  }))
}

// Private browsing, a full disk, a browser with IndexedDB disabled: none of
// these should take the app down. Offline support degrades to "none" and the
// online path keeps working exactly as it did before.
const safe = (p, fallback) => p.catch(() => fallback)

// ---------------- snapshot ----------------
export const saveSnapshot = (data) =>
  safe(tx(SNAPSHOT_STORE, 'readwrite', (s) => s.put({ data, savedAt: Date.now() }, 'latest')), null)

export const loadSnapshot = () =>
  safe(tx(SNAPSHOT_STORE, 'readonly', (s) => s.get('latest')), null)

export const clearOffline = async () => {
  await safe(tx(SNAPSHOT_STORE, 'readwrite', (s) => s.clear()), null)
  await safe(tx(QUEUE_STORE, 'readwrite', (s) => s.clear()), null)
  notify()
}

// ---------------- queue ----------------
const listeners = new Set()
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
function notify() { for (const fn of listeners) { try { fn() } catch { /* a bad listener is not our problem */ } } }

export const listQueue = () =>
  safe(tx(QUEUE_STORE, 'readonly', (s) => s.getAll()), []).then((rows) => (rows || []).sort((a, b) => a.id - b.id))

export async function enqueue(action) {
  const entry = {
    clientRef: newRef(),
    // Stable id for the optimistically-rendered row, so React keys do not
    // churn every time the derived state is recomputed.
    optimisticId: `q_${newRef().slice(0, 12)}`,
    action,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    error: null,
    failedAt: null,
  }
  const id = await safe(tx(QUEUE_STORE, 'readwrite', (s) => s.add(entry)), null)
  if (id == null) return null              // no IndexedDB — caller falls back to a plain error
  notify()
  return { ...entry, id }
}

const putEntry = (entry) => safe(tx(QUEUE_STORE, 'readwrite', (s) => s.put(entry)), null)
export const removeEntry = (id) => safe(tx(QUEUE_STORE, 'readwrite', (s) => s.delete(id)), null).then(notify)

// A failed entry has been rejected by the server for a reason retrying cannot
// fix (bad data, no longer permitted). It stays in the queue, marked, so the
// person is told their expense did not go through rather than it vanishing.
export const discardFailed = async () => {
  const rows = await listQueue()
  for (const r of rows) if (r.failedAt) await safe(tx(QUEUE_STORE, 'readwrite', (s) => s.delete(r.id)), null)
  notify()
}

let flushing = false

// `post(action)` must resolve to { status, body }. Returns a summary of what
// happened so the caller can decide whether to refetch.
export async function flushQueue(post) {
  if (flushing || !isOnline()) return { sent: 0, failed: 0, stopped: true }
  flushing = true
  let sent = 0, failed = 0, stopped = false
  try {
    const rows = await listQueue()
    for (const entry of rows) {
      if (entry.failedAt) continue                       // already given up on
      let res
      try {
        res = await post({ ...entry.action, clientRef: entry.clientRef })
      } catch {
        // Network died mid-flush. Stop here rather than burning through the
        // rest: order matters, and a re-submit behind a log is not independent.
        stopped = true
        break
      }

      if (res.status === 200) {
        await safe(tx(QUEUE_STORE, 'readwrite', (s) => s.delete(entry.id)), null)
        sent++
        continue
      }

      // 429 and 5xx are "not now"; anything else in the 4xx range is "not
      // ever", and retrying it forever would block everything queued behind it.
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408
      if (permanent) {
        await putEntry({ ...entry, attempts: entry.attempts + 1, failedAt: new Date().toISOString(), error: res.body?.error || `HTTP ${res.status}` })
        failed++
        continue
      }
      await putEntry({ ...entry, attempts: entry.attempts + 1, error: res.body?.error || `HTTP ${res.status}` })
      stopped = true
      break
    }
  } finally {
    flushing = false
    notify()
  }
  return { sent, failed, stopped }
}
