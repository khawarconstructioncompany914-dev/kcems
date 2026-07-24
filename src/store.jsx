// ============================================================
// KCEMS · client store
// In-memory dataset + the Build-Spec §3 approval state machine.
// Persisted to localStorage. Derived cash/owed are computed,
// never stored (Build Spec §1).
// ============================================================
import { createContext, useContext, useReducer, useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { buildSeed } from './data/seed.js'

const KEY = 'kcems.v1'
const uid = (p = 'x') => `${p}_${Math.random().toString(36).slice(2, 9)}`

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
        id: uid('e'), supervisorId, siteId, amount: Math.round(amount), category, note,
        billImageUrl: action.payload.bill ? 'bill' : null,
        status: 'engineer_review', rejectReason: null, returnNote: null, settledAt: null,
        createdAt: now, decidedAt: null,
      }
      return {
        ...state,
        expenses: [exp, ...state.expenses],
        audit: log({ actorId: supervisorId, action: 'expense.create', entity: 'Expense', entityId: exp.id, after: { status: 'engineer_review', amount } }),
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
    case 'RESUBMIT':
      return patchExpense(action.id, { status: 'engineer_review', returnNote: null },
        { actorId: action.actorId, action: 'expense.resubmit', entity: 'Expense', entityId: action.id, after: { status: 'engineer_review' } })

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

    // owner/finance adds funds
    case 'ADD_FUNDS': {
      const txn = { id: uid('f'), supervisorId: action.supervisorId, type: 'funds_in', method: action.method || 'cash', amount: Math.round(action.amount), byUserId: action.actorId, note: action.note || '', createdAt: now }
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
      const p = action.payload || {}
      const s = {
        id: uid('site'), status: 'active', budget: 0, city: '', phase: '', engineerId: null,
        openingSpend: { materials: 0, labour: 0, fuel: 0, tea_food: 0, other: 0 },
        label: (p.label || p.name || '').slice(0, 12), ...p,
      }
      return {
        ...state,
        sites: [...state.sites, s],
        audit: log({ actorId: action.actorId, action: 'site.create', entity: 'Site', entityId: s.id, after: { name: s.name } }),
      }
    }
    case 'UPDATE_SITE':
      return {
        ...state,
        sites: state.sites.map((s) => (s.id === action.siteId ? { ...s, ...action.patch } : s)),
        audit: log({ actorId: action.actorId, action: 'site.update', entity: 'Site', entityId: action.siteId, after: action.patch }),
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

const API = {
  async get(path) {
    const r = await fetch(path, { credentials: 'same-origin' })
    let body = {}; try { body = await r.json() } catch { /* ignore */ }
    return { status: r.status, body }
  },
  async post(path, data) {
    const r = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) })
    let body = {}; try { body = await r.json() } catch { /* ignore */ }
    return { status: r.status, body }
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
  const value = useMemo(() => ({ state, dispatch, toast, toasts, login, logout, loading: false }), [state, toasts, toast, login, logout])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

// ---- live (Supabase via the /api layer) ----
const EMPTY = { users: [], sites: [], expenses: [], funds: [], audit: [], session: null }
function LiveStoreProvider({ children }) {
  const [state, setState] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const { toasts, toast } = useToasts()
  const hydrate = useCallback(async () => {
    const { status, body } = await API.get('/api/data')
    if (status === 200) setState({ users: body.users || [], sites: body.sites || [], expenses: body.expenses || [], funds: body.funds || [], audit: [], session: body.session || null })
    else setState((s) => ({ ...s, session: null }))
    setLoading(false)
  }, [])
  useEffect(() => { hydrate() }, [hydrate])
  const login = useCallback(async (username, password) => {
    const { status, body } = await API.post('/api/login', { username, password })
    if (status === 200) { await hydrate(); return { ok: true, user: body.user } }
    return { ok: false, reason: body.error || 'bad_password' }
  }, [hydrate])
  const logout = useCallback(async () => { await API.post('/api/logout'); setState(EMPTY) }, [])
  const dispatch = useCallback(async (action) => {
    if (action.type === 'LOGOUT') return logout()
    if (action.type === 'LOGIN' || action.type === 'SWITCH_USER') return
    const res = await API.post('/api/action', action)
    await hydrate()
    return res
  }, [hydrate, logout])
  const value = useMemo(() => ({ state, dispatch, toast, toasts, login, logout, loading }), [state, toasts, toast, loading, dispatch, login, logout])
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
  const cashInHand = (supId) => {
    const fundsIn = state.funds.filter((f) => f.supervisorId === supId && f.type === 'funds_in').reduce((a, f) => a + f.amount, 0)
    const approved = state.expenses.filter((e) => e.supervisorId === supId && e.status === 'approved').reduce((a, e) => a + e.amount, 0)
    return { funded: fundsIn, spent: approved, cash: fundsIn - approved }
  }
  // owed-back = rejected & not settled
  const owedBack = (supId) =>
    state.expenses.filter((e) => e.supervisorId === supId && e.status === 'rejected' && !e.settledAt).reduce((a, e) => a + e.amount, 0)

  // site spend = opening + live approved, per category
  const siteSpend = (siteId) => {
    const site = siteById(siteId)
    const byCat = { ...(site?.openingSpend || { materials: 0, labour: 0, fuel: 0, tea_food: 0, other: 0 }) }
    state.expenses.filter((e) => e.siteId === siteId && e.status === 'approved').forEach((e) => {
      byCat[e.category] = (byCat[e.category] || 0) + e.amount
    })
    const total = Object.values(byCat).reduce((a, v) => a + v, 0)
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
      return state.expenses.filter((e) => supIds.has(e.supervisorId))
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

  // username/password check for the local (demo) provider
  const authenticate = (username, password) => {
    // accept the username OR the person's full name, ignoring case and spaces
    const key = String(username).trim().toLowerCase().replace(/\s+/g, '')
    const u = state.users.find((x) =>
      x.username?.toLowerCase().replace(/\s+/g, '') === key ||
      x.name?.toLowerCase().replace(/\s+/g, '') === key)
    if (!u) return { ok: false, reason: 'no_user' }
    if (u.status === 'disabled') return { ok: false, reason: 'disabled' }
    // ignore surrounding whitespace (copy-paste / phone keyboards add it)
    const trim = (s) => String(s ?? '').replace(/^\s+|\s+$/g, '')
    if (trim(u.password) !== trim(password)) return { ok: false, reason: 'bad_password' }
    return { ok: true, user: u }
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
    cashInHand, owedBack, siteSpend, supsForEngineer, scopedExpenses, scopedSites, expenseView,
    authenticate, usernameTaken,
  }
}
