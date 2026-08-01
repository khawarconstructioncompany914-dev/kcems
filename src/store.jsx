// ============================================================
// KCEMS · client store
// In-memory dataset + the Build-Spec §3 approval state machine.
// Persisted to localStorage. Derived cash/owed are computed,
// never stored (Build Spec §1).
// ============================================================
import { createContext, useContext, useReducer, useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { buildSeed } from './data/seed.js'
import { resolveLogin } from './data/match.js'
import {
  QUEUEABLE, isOnline, enqueue, listQueue, flushQueue, discardFailed,
  saveSnapshot, loadSnapshot, clearOffline, subscribe,
} from './offline.js'

const KEY = 'kcems.v1'
const uid = (p = 'x') => `${p}_${Math.random().toString(36).slice(2, 9)}`
// one shared empty array, so "nothing pending" is referentially stable and
// does not re-render every consumer on each pass
const NONE = []

// Local calendar date as YYYY-MM-DD. Deliberately not toISOString(), which is
// UTC and would roll the day over at 5am in Pakistan — someone marking early
// would land on the previous date.
export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Put the named supervisors on this site and take off anyone who was on it but
// is no longer in the list. Checking a supervisor also files them under the
// site's responsible engineer — that is the whole point of doing it here, so a
// new site comes out complete: a site, an engineer, and the crew beneath them.
// Mirrors the SQL in api/action.js.
function wireSupervisors(users, siteId, ids, engineerId) {
  const keep = new Set(ids || [])
  return users.map((u) => {
    if (u.role !== 'supervisor') return u
    if (keep.has(u.id)) return { ...u, siteId, engineerId: engineerId || u.engineerId }
    if (u.siteId === siteId) return { ...u, siteId: null }   // unchecked → off this site
    return u
  })
}

// Demo-store photo shape. In live mode the API stores a storage path and the
// viewer signs a URL for it; here the data URL itself is the "path", so the
// same PhotoGrid renders both without knowing which mode it is in.
const toPhotos = (photos) =>
  (Array.isArray(photos) ? photos : []).map((p) => ({
    id: uid('ph'),
    path: typeof p === 'string' ? p : p.dataUrl,
    url: typeof p === 'string' ? p : p.dataUrl,
    capturedAt: (typeof p === 'object' && p?.capturedAt) || new Date().toISOString(),
  }))

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return buildSeed()
}

// ---------------- reducer ----------------
function reducer(state, action) {
  const now = new Date().toISOString()
  const log = (entry) => [{ id: uid('a'), createdAt: now, ...entry }, ...state.audit].slice(0, 200)
  const patchExpense = (id, patch, logEntry) => ({
    ...state,
    expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    audit: logEntry ? log(logEntry) : state.audit,
  })

  switch (action.type) {
    case 'RESET':
      return buildSeed()

    case 'LOGIN':
      return { ...state, session: { userId: action.userId } }
    case 'LOGOUT':
      return { ...state, session: null }
    case 'SWITCH_USER': // demo affordance
      return { ...state, session: { userId: action.userId } }

    // supervisor logs an expense -> engineer_review
    case 'LOG_EXPENSE': {
      const { supervisorId, siteId, amount, category, note } = action.payload
      const exp = {
        // optimisticId is supplied when this action is being replayed from the
        // offline queue to render what is waiting to sync. It keeps the row's
        // identity stable across recomputes; live dispatches have none and get
        // a fresh id as before.
        id: action.optimisticId || uid('e'), supervisorId, siteId, amount: Math.round(amount), category, note,
        billImageUrl: null, kind: 'site_expense',
        photos: toPhotos(action.payload.photos),
        status: 'engineer_review', rejectReason: null, returnNote: null, settledAt: null,
        createdAt: now, decidedAt: null,
      }
      return {
        ...state,
        expenses: [exp, ...state.expenses],
        audit: log({ actorId: supervisorId, action: 'expense.create', entity: 'Expense', entityId: exp.id, after: { status: 'engineer_review', amount } }),
      }
    }

    // engineer files a travel/lodging/food reimbursement claim -> finance_review
    // (no site, no cash-in-hand effect, skips engineer review — they are the claimant)
    case 'LOG_CLAIM': {
      const { claimantId, amount, category, note } = action.payload
      const exp = {
        id: action.optimisticId || uid('e'), supervisorId: claimantId, siteId: null, amount: Math.round(amount), category, note,
        billImageUrl: null, kind: 'reimbursement',
        photos: toPhotos(action.payload.photos),
        status: 'finance_review', rejectReason: null, returnNote: null, settledAt: null,
        createdAt: now, decidedAt: null,
      }
      return {
        ...state,
        expenses: [exp, ...state.expenses],
        audit: log({ actorId: claimantId, action: 'expense.claim', entity: 'Expense', entityId: exp.id, after: { status: 'finance_review', amount, kind: 'reimbursement' } }),
      }
    }

    // engineer passes up -> finance_review
    case 'PASS_UP':
      return patchExpense(action.id, { status: 'finance_review' },
        { actorId: action.actorId, action: 'expense.pass_up', entity: 'Expense', entityId: action.id, before: { status: 'engineer_review' }, after: { status: 'finance_review' } })

    // engineer returns to fix -> returned (returnNote)
    case 'RETURN':
      return patchExpense(action.id, { status: 'returned', returnNote: action.note },
        { actorId: action.actorId, action: 'expense.return', entity: 'Expense', entityId: action.id, after: { status: 'returned', returnNote: action.note } })

    // finance/owner approves -> approved (cash deducted via derived view)
    case 'APPROVE':
      return patchExpense(action.id, { status: 'approved', decidedAt: now },
        { actorId: action.actorId, action: 'expense.approve', entity: 'Expense', entityId: action.id, after: { status: 'approved' } })

    // reject (any review stage) -> rejected (reason required, becomes owed-back)
    case 'REJECT':
      return patchExpense(action.id, { status: 'rejected', rejectReason: action.reason, decidedAt: now },
        { actorId: action.actorId, action: 'expense.reject', entity: 'Expense', entityId: action.id, after: { status: 'rejected', rejectReason: action.reason } })

    // supervisor re-submits a returned item -> engineer_review
    // Photos APPEND, matching the server: the engineer usually sent it back
    // because one photo was unreadable, so the good ones must survive.
    case 'RESUBMIT': {
      const prev = state.expenses.find((e) => e.id === action.id)
      const added = toPhotos(action.photos)
      return patchExpense(action.id, {
        status: 'engineer_review',
        returnNote: null,
        note: action.note || prev?.note,
        photos: [...(prev?.photos || []), ...added],
      }, { actorId: action.actorId, action: 'expense.resubmit', entity: 'Expense', entityId: action.id, after: { status: 'engineer_review' } })
    }

    // settle a rejected/owed item -> records a settlement FundTxn + clears owed
    case 'SETTLE': {
      const exp = state.expenses.find((e) => e.id === action.id)
      if (!exp) return state
      const txn = { id: uid('f'), supervisorId: exp.supervisorId, type: 'settlement', method: action.method || 'cash', amount: exp.amount, byUserId: action.actorId, note: `Settled: ${exp.note}`, createdAt: now }
      return {
        ...state,
        funds: [txn, ...state.funds],
        expenses: state.expenses.map((e) => (e.id === action.id ? { ...e, status: 'settled', settledAt: now } : e)),
        audit: log({ actorId: action.actorId, action: 'expense.settle', entity: 'Expense', entityId: action.id, after: { status: 'settled' } }),
      }
    }

    // owner/finance adds funds (proof photo required — see components/funds.jsx)
    case 'ADD_FUNDS': {
      const txn = { id: uid('f'), supervisorId: action.supervisorId, type: 'funds_in', method: action.method || 'cash', amount: Math.round(action.amount), byUserId: action.actorId, note: action.note || '', photos: toPhotos(action.photos), createdAt: now }
      return {
        ...state,
        funds: [txn, ...state.funds],
        audit: log({ actorId: action.actorId, action: 'funds.add', entity: 'FundTxn', entityId: txn.id, after: { amount: txn.amount, supervisorId: action.supervisorId } }),
      }
    }

    // owner/admin creates a login (temp password, must change on first login)
    case 'CREATE_USER': {
      const u = { id: uid('u'), status: 'active', mustChangePassword: true, ...action.payload }
      return {
        ...state,
        users: [...state.users, u],
        audit: log({ actorId: action.actorId, action: 'user.create', entity: 'User', entityId: u.id, after: { role: u.role, username: u.username } }),
      }
    }

    // owner/admin edits a user (role, engineerId, siteId, name, status)
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map((u) => (u.id === action.userId ? { ...u, ...action.patch } : u)),
        audit: log({ actorId: action.actorId, action: 'user.update', entity: 'User', entityId: action.userId, after: action.patch }),
      }

    // owner/admin resets a password -> forces change on next login
    case 'RESET_PASSWORD':
      return {
        ...state,
        users: state.users.map((u) => (u.id === action.userId ? { ...u, password: action.password, mustChangePassword: true } : u)),
        audit: log({ actorId: action.actorId, action: 'user.reset_password', entity: 'User', entityId: action.userId }),
      }

    // owner/admin sets a password directly, without forcing a change
    case 'SET_PASSWORD':
      return {
        ...state,
        users: state.users.map((u) => (u.id === action.userId ? { ...u, password: action.password, mustChangePassword: false } : u)),
        audit: log({ actorId: action.actorId, action: 'user.set_password', entity: 'User', entityId: action.userId }),
      }

    // a user sets their own password (clears the forced-change flag)
    case 'CHANGE_PASSWORD':
      return {
        ...state,
        users: state.users.map((u) => (u.id === action.userId ? { ...u, password: action.password, mustChangePassword: false } : u)),
        audit: log({ actorId: action.userId, action: 'user.change_password', entity: 'User', entityId: action.userId }),
      }

    // owner/admin creates a construction site
    case 'CREATE_SITE': {
      const { supervisorIds, ...p } = action.payload || {}
      const s = {
        id: uid('site'), status: 'active', budget: 0, city: '', phase: '', engineerId: null,
        openingSpend: { materials: 0, labour: 0, fuel: 0, tea_food: 0, other: 0 },
        label: (p.label || p.name || '').slice(0, 12), ...p,
      }
      return {
        ...state,
        sites: [...state.sites, s],
        users: supervisorIds ? wireSupervisors(state.users, s.id, supervisorIds, s.engineerId) : state.users,
        audit: log({ actorId: action.actorId, action: 'site.create', entity: 'Site', entityId: s.id, after: { name: s.name } }),
      }
    }
    case 'UPDATE_SITE': {
      const { supervisorIds, ...patch } = action.patch || {}
      const site = state.sites.find((s) => s.id === action.siteId)
      return {
        ...state,
        sites: state.sites.map((s) => (s.id === action.siteId ? { ...s, ...patch } : s)),
        users: supervisorIds
          ? wireSupervisors(state.users, action.siteId, supervisorIds, patch.engineerId ?? site?.engineerId)
          : state.users,
        audit: log({ actorId: action.actorId, action: 'site.update', entity: 'Site', entityId: action.siteId, after: patch }),
      }
    }

    // head engineer / owner / admin logs how far along a site is.
    // Append-only, mirroring site_progress: the current figure is the newest
    // row, so history is never overwritten.
    case 'LOG_PROGRESS': {
      const p = action.payload || {}
      const entry = { id: action.optimisticId || uid('pg'), siteId: p.siteId, pct: Math.round(p.pct), note: p.note || null, loggedBy: action.actorId, loggedAt: now }
      return {
        ...state,
        progress: [entry, ...(state.progress || [])],
        sites: state.sites.map((s) => (s.id === p.siteId
          ? { ...s, progress: { pct: entry.pct, note: entry.note, loggedBy: entry.loggedBy, loggedAt: now } }
          : s)),
        audit: log({ actorId: action.actorId, action: 'site.progress', entity: 'Site', entityId: p.siteId, after: { pct: entry.pct } }),
      }
    }

    // a person marks their own day. One row per person per date — the live
    // side enforces that with a unique constraint, so the demo refuses a
    // second mark too rather than letting the two behave differently.
    case 'MARK_ATTENDANCE': {
      const today = todayKey()
      if ((state.attendance || []).some((a) => a.userId === action.userId && a.date === today)) return state
      const kind = action.kind === 'leave' ? 'leave' : 'present'
      const row = {
        id: action.optimisticId || uid('at'), userId: action.userId, date: today, kind,
        status: kind === 'present' ? 'approved' : 'pending',
        markedAt: now, note: action.note || null,
        lat: kind === 'present' ? (action.lat ?? null) : null,
        lng: kind === 'present' ? (action.lng ?? null) : null,
        reviewedBy: null, reviewedAt: null,
      }
      return {
        ...state,
        attendance: [row, ...(state.attendance || [])],
        audit: log({ actorId: action.userId, action: 'attendance.mark', entity: 'Attendance', entityId: row.id, after: { kind, status: row.status } }),
      }
    }

    // owner/admin decides a pending leave request
    case 'REVIEW_LEAVE':
      return {
        ...state,
        attendance: (state.attendance || []).map((a) => (a.id === action.attendanceId && a.kind === 'leave' && a.status === 'pending'
          ? { ...a, status: action.approve ? 'approved' : 'rejected', reviewedBy: action.actorId, reviewedAt: now }
          : a)),
        audit: log({ actorId: action.actorId, action: 'attendance.review', entity: 'Attendance', entityId: action.attendanceId, after: { status: action.approve ? 'approved' : 'rejected' } }),
      }

    // re-wire a supervisor to a different engineer
    case 'REASSIGN_SUP':
      return {
        ...state,
        users: state.users.map((u) => (u.id === action.supId ? { ...u, engineerId: action.engineerId } : u)),
        audit: log({ actorId: action.actorId, action: 'user.reassign', entity: 'User', entityId: action.supId, after: { engineerId: action.engineerId } }),
      }

    default:
      return state
  }
}

// ---------------- context ----------------
const StoreCtx = createContext(null)

// Data source: "supabase" talks to the live /api backend; anything else = local demo.
export const LIVE = import.meta.env.VITE_DATA_SOURCE === 'supabase'

// status 0 means the request never reached the server — no signal, DNS gone,
// aeroplane mode. It is deliberately distinct from a 4xx/5xx: one is worth
// retrying later, the other never will be.
const OFFLINE = { status: 0, body: { error: 'offline' } }

const API = {
  async get(path) {
    try {
      const r = await fetch(path, { credentials: 'same-origin' })
      let body = {}; try { body = await r.json() } catch { /* ignore */ }
      return { status: r.status, body }
    } catch { return OFFLINE }
  },
  async post(path, data) {
    try {
      const r = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) })
      let body = {}; try { body = await r.json() } catch { /* ignore */ }
      return { status: r.status, body }
    } catch { return OFFLINE }
  },
}

function useToasts() {
  const [toasts, setToasts] = useState([])
  const tid = useRef(0)
  const toast = useCallback((msg, tone = 'accent') => {
    const id = ++tid.current
    setToasts((t) => [...t, { id, msg, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])
  return { toasts, toast }
}

// ---- local (in-browser demo) ----
function LocalStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const { toasts, toast } = useToasts()
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ } }, [state])
  const login = useCallback(async (username, password) => {
    const res = makeSelectors(state).authenticate(username, password)
    if (res.ok) dispatch({ type: 'LOGIN', userId: res.user.id })
    return res
  }, [state])
  const logout = useCallback(async () => dispatch({ type: 'LOGOUT' }), [])
  // The demo store is the browser, so it is never offline and never has
  // anything waiting to send. The same keys are present so screens can read
  // them without caring which provider they are under.
  const value = useMemo(() => ({
    state, dispatch, toast, toasts, login, logout, loading: false,
    online: true, stale: false, pending: NONE, failed: NONE,
    syncNow: async () => {}, discardFailed: async () => {}, loadFullHistory: async () => {},
  }), [state, toasts, toast, login, logout])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

// ---- live (Supabase via the /api layer) ----
const EMPTY = {
  users: [], sites: [], expenses: [], funds: [], attendance: [], progress: [], audit: [],
  balances: null, siteSpend: null, session: null,
}

const toState = (body) => ({
  users: body.users || [], sites: body.sites || [], expenses: body.expenses || [],
  funds: body.funds || [], attendance: body.attendance || [], progress: body.progress || [],
  audit: body.audit || [],
  // Totals computed server-side from the FULL history — see api/data.js. The
  // row arrays above are windowed, so summing them would understate the money.
  balances: body.balances || null, siteSpend: body.siteSpend || null,
  windowed: Boolean(body.windowed), windowDays: body.windowDays ?? null,
  session: body.session || null,
})

function LiveStoreProvider({ children }) {
  const [server, setServer] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState([])
  const [online, setOnline] = useState(isOnline())
  // true when what is on screen came from the cached snapshot rather than the
  // server. The UI says so — silently showing stale money as if it were live is
  // the one thing an offline mode must not do.
  const [stale, setStale] = useState(false)
  const { toasts, toast } = useToasts()
  const inflight = useRef(null)

  const refreshQueue = useCallback(async () => { setQueue(await listQueue()) }, [])

  // Single-flight: a burst of writes used to fire a burst of identical full
  // refetches. Concurrent callers now share one request.
  const hydrate = useCallback((opts = {}) => {
    if (inflight.current && !opts.full) return inflight.current
    const run = (async () => {
      const { status, body } = await API.get(opts.full ? '/api/data?full=1' : '/api/data')
      if (status === 200) {
        setServer(toState(body))
        setStale(false)
        saveSnapshot(body)
      } else if (status === 0) {
        // Never reached the server. Fall back to the last snapshot so the app
        // still opens with real numbers instead of an empty shell.
        const snap = await loadSnapshot()
        if (snap?.data) { setServer(toState(snap.data)); setStale(true) }
      } else {
        // A real answer, and it was "no" — the session is gone.
        setServer((s) => ({ ...s, session: null }))
      }
      setLoading(false)
    })()
    inflight.current = run
    run.finally(() => { if (inflight.current === run) inflight.current = null })
    return run
  }, [])

  // Push whatever is queued, then refresh if anything actually landed.
  const sync = useCallback(async ({ quiet = false } = {}) => {
    const before = await listQueue()
    if (!before.some((e) => !e.failedAt)) { await refreshQueue(); return }
    const r = await flushQueue((a) => API.post('/api/action', a))
    await refreshQueue()
    if (r.sent) {
      if (!quiet) toast(`Sent ${r.sent} saved item${r.sent === 1 ? '' : 's'}`, 'accent')
      await hydrate()
    }
    if (r.failed && !quiet) toast(`${r.failed} saved item${r.failed === 1 ? '' : 's'} could not be sent — see Waiting to send`, 'danger')
  }, [hydrate, refreshQueue, toast])

  useEffect(() => { hydrate(); refreshQueue() }, [hydrate, refreshQueue])

  // Keep the pending count live when another tab syncs the same queue.
  useEffect(() => subscribe(refreshQueue), [refreshQueue])

  useEffect(() => {
    const up = () => { setOnline(true); sync() }
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    // The 'online' event only fires on a TRANSITION. A phone that was offline
    // when the app was closed and has signal by the time it reopens never gets
    // one, so try once on mount too.
    if (isOnline()) sync({ quiet: true })
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [sync])

  const login = useCallback(async (username, password) => {
    const { status, body } = await API.post('/api/login', { username, password })
    if (status === 200) { await hydrate(); return { ok: true, user: body.user } }
    if (status === 0) return { ok: false, reason: 'offline' }
    return { ok: false, reason: body.error || 'bad_password', retryAfter: body.retryAfter }
  }, [hydrate])

  const logout = useCallback(async () => {
    await API.post('/api/logout')
    // The snapshot holds this person's ledger. Signing out has to take it with
    // them, or the next person to open the app on a shared site phone sees it.
    await clearOffline()
    setServer(EMPTY)
    setQueue([])
  }, [])

  const dispatch = useCallback(async (action) => {
    if (action.type === 'LOGOUT') return logout()
    if (action.type === 'LOGIN' || action.type === 'SWITCH_USER') return

    const queueable = QUEUEABLE.has(action.type)
    const park = async (msg) => {
      const entry = await enqueue(action)
      if (!entry) return null                  // no IndexedDB — fail honestly below
      await refreshQueue()
      toast(msg, 'warn')
      return { status: 200, body: { ok: true, queued: true } }
    }

    // Don't even try the network when the device says there isn't one: the
    // fetch would hang for its full timeout with somebody watching a spinner.
    if (queueable && !isOnline()) {
      const parked = await park('No signal — saved on this device and will send itself later')
      if (parked) return parked
    }

    const res = await API.post('/api/action', action)

    if (res.status === 0) {
      if (queueable) {
        const parked = await park('No connection — saved on this device and will send itself later')
        if (parked) return parked
      }
      toast('No connection. This needs to be online — try again when you have signal.', 'danger')
      return res
    }

    await hydrate()
    return res
  }, [hydrate, logout, refreshQueue, toast])

  const pending = useMemo(() => queue.filter((e) => !e.failedAt), [queue])
  const failed = useMemo(() => queue.filter((e) => e.failedAt), [queue])

  // What is on screen = the server's answer with everything still queued
  // replayed on top, so a supervisor sees the expense they just logged sitting
  // in their history rather than nothing at all. Replayed through the same
  // reducer the demo store uses, so the two cannot drift.
  const state = useMemo(() => {
    if (!pending.length) return server
    const ids = new Set(pending.map((e) => e.optimisticId))
    const next = pending.reduce((s, e) => reducer(s, { ...e.action, optimisticId: e.optimisticId }), server)
    return {
      ...next,
      expenses: next.expenses.map((e) => (ids.has(e.id) ? { ...e, pendingSync: true } : e)),
      attendance: (next.attendance || []).map((a) => (ids.has(a.id) ? { ...a, pendingSync: true } : a)),
    }
  }, [server, pending])

  const value = useMemo(() => ({
    state, dispatch, toast, toasts, login, logout, loading,
    online, stale, pending, failed,
    syncNow: sync, discardFailed: async () => { await discardFailed(); await refreshQueue() },
    loadFullHistory: () => hydrate({ full: true }),
  }), [state, toasts, toast, loading, dispatch, login, logout, online, stale, pending, failed, sync, refreshQueue, hydrate])

  if (loading) return <Splash />
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

function Splash() {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-root)', color: 'var(--accent)', font: '700 13px/1 var(--f-mono)', letterSpacing: '.1em' }}>KCEMS · loading…</div>
}

export function StoreProvider({ children }) {
  return LIVE ? <LiveStoreProvider>{children}</LiveStoreProvider> : <LocalStoreProvider>{children}</LocalStoreProvider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// ---------------- selectors (pure helpers) ----------------
export const selById = (list, id) => list.find((x) => x.id === id)

export function useSelectors() {
  const { state } = useStore()
  return useMemo(() => makeSelectors(state), [state])
}

export function makeSelectors(state) {
  const userById = (id) => state.users.find((u) => u.id === id)
  const siteById = (id) => state.sites.find((s) => s.id === id)
  const me = state.session ? userById(state.session.userId) : null

  const supervisors = state.users.filter((u) => u.role === 'supervisor')
  const engineers = state.users.filter((u) => u.role === 'engineer')

  // derived cash-in-hand for a supervisor (Build Spec §1)
  //
  // In live mode these come from v_supervisor_balance, computed over the whole
  // ledger. They are NOT summed from state.expenses/state.funds any more:
  // /api/data windows those arrays to keep the payload bounded, and a balance
  // added up from a truncated history is confidently wrong — the worst kind of
  // wrong for a number somebody settles cash against. The local sums below are
  // the demo store's path, and the fallback if a snapshot predates this field.
  const cashInHand = (supId) => {
    const b = state.balances?.[supId]
    if (b) return { funded: b.funded, spent: b.spent, cash: b.cash }
    const fundsIn = state.funds.filter((f) => f.supervisorId === supId && f.type === 'funds_in').reduce((a, f) => a + f.amount, 0)
    const approved = state.expenses.filter((e) => e.supervisorId === supId && e.status === 'approved').reduce((a, e) => a + e.amount, 0)
    return { funded: fundsIn, spent: approved, cash: fundsIn - approved }
  }
  // owed-back = rejected & not settled
  const owedBack = (supId) => {
    const b = state.balances?.[supId]
    if (b) return b.owed
    return state.expenses.filter((e) => e.supervisorId === supId && e.status === 'rejected' && !e.settledAt).reduce((a, e) => a + e.amount, 0)
  }

  // Money this person has submitted that nobody has decided on yet. Kept
  // separate from cashInHand().spent on purpose: "spent" means APPROVED spend
  // and drives the cash maths, so folding pending into it would misstate the
  // balance. This is the "how much is sitting in the queue" number.
  const pendingTotal = (supId) =>
    state.expenses
      .filter((e) => e.supervisorId === supId && (e.status === 'engineer_review' || e.status === 'finance_review'))
      .reduce((a, e) => a + e.amount, 0)

  // site spend = opening + live approved, per category.
  // Reimbursement claims carry no site, but filter on kind as well so the
  // number stays right even if a claim ever gets one (mirrors v_site_spend).
  // Same story as cashInHand: v_site_spend when live, local sum otherwise.
  const siteSpend = (siteId) => {
    const site = siteById(siteId)
    const server = state.siteSpend?.[siteId]
    const byCat = server
      ? { ...server.byCat }
      : { ...(site?.openingSpend || { materials: 0, labour: 0, fuel: 0, tea_food: 0, other: 0 }) }
    if (!server) {
      state.expenses.filter((e) => e.siteId === siteId && e.status === 'approved' && e.kind !== 'reimbursement').forEach((e) => {
        byCat[e.category] = (byCat[e.category] || 0) + e.amount
      })
    }
    const total = Object.values(byCat).reduce((a, v) => a + (v || 0), 0)
    const budget = site?.budget || 0
    return { byCat, total, budget, remaining: budget - total, pct: budget ? Math.min(100, Math.round((total / budget) * 100)) : 0 }
  }

  // scoping (Build Spec §2)
  const supsForEngineer = (engId) => supervisors.filter((s) => s.engineerId === engId)
  const VIEW_ALL = new Set(['owner', 'admin', 'finance'])
  const scopedExpenses = (user) => {
    if (!user) return []
    if (VIEW_ALL.has(user.role)) return state.expenses
    if (user.role === 'engineer') {
      const supIds = new Set(supsForEngineer(user.id).map((s) => s.id))
      // their supervisors' expenses, plus their own reimbursement claims — so
      // /my-expenses and finance's /approvals both see claims without either
      // screen needing a special case
      return state.expenses.filter((e) => supIds.has(e.supervisorId) || (e.supervisorId === user.id && e.kind === 'reimbursement'))
    }
    return state.expenses.filter((e) => e.supervisorId === user.id)
  }
  const scopedSites = (user) => {
    if (!user) return []
    if (VIEW_ALL.has(user.role)) return state.sites
    if (user.role === 'engineer') return state.sites.filter((s) => s.engineerId === user.id)
    const s = userById(user.id)
    return state.sites.filter((x) => x.id === s?.siteId)
  }

  // ---------- attendance ----------
  const attendance = state.attendance || []
  const attendanceFor = (userId, month) => attendance.filter((a) =>
    a.userId === userId && (!month || String(a.date).startsWith(month)))
  const attendanceOn = (userId, date) => attendance.find((a) => a.userId === userId && a.date === date) || null
  const myAttendanceToday = () => (me ? attendanceOn(me.id, todayKey()) : null)
  // only leave needs deciding — a present mark is a statement, not a request
  const pendingLeave = () => attendance.filter((a) => a.kind === 'leave' && a.status === 'pending')
  const pendingLeaveCount = () => pendingLeave().length

  // ---------- site progress ----------
  // Expected progress assumes even, linear work between the two dates. That is
  // a rough model and the UI says so — it is a prompt to look, not a verdict.
  const siteSchedule = (site) => {
    if (!site?.startDate || !site?.targetFinishDate) return null
    const start = new Date(site.startDate).getTime()
    const end = new Date(site.targetFinishDate).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
    const pctExpected = Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100)))
    const actual = site.progress?.pct ?? 0
    const daysLeft = Math.ceil((end - Date.now()) / 86_400_000)
    return { pctExpected, actual, daysLeft, behind: actual < pctExpected - 5, overdue: daysLeft < 0 && actual < 100 }
  }
  const progressHistory = (siteId) => (state.progress || [])
    .filter((p) => p.siteId === siteId)
    .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt))

  // username/password check for the local (demo) provider — same matching
  // rules as the server (src/data/match.js) so the demo behaves like live
  const authenticate = (username, password) => {
    const trim = (s) => String(s ?? '').replace(/^\s+|\s+$/g, '')
    return resolveLogin(state.users, username, (u) => trim(u.password) === trim(password))
  }
  const usernameTaken = (username, exceptId) =>
    state.users.some((u) => u.id !== exceptId && u.username?.toLowerCase() === String(username).trim().toLowerCase())

  const expenseView = (e) => ({
    ...e,
    supervisor: userById(e.supervisorId),
    site: siteById(e.siteId),
  })

  return {
    state, me, userById, siteById, supervisors, engineers,
    cashInHand, owedBack, pendingTotal, siteSpend, supsForEngineer, scopedExpenses, scopedSites, expenseView,
    authenticate, usernameTaken,
    attendance, attendanceFor, attendanceOn, myAttendanceToday, pendingLeave, pendingLeaveCount,
    siteSchedule, progressHistory,
  }
}
