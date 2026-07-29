// ============================================================
// KCEMS · shared model constants, metadata & formatters
// (Build Spec §1 enums, §5 tokens)
// ============================================================

// `word` is the one-word role name used in page eyebrows. `label` is the full
// title ("Owner / CEO"), which is too long to sit in front of a page name.
export const ROLES = {
  owner:      { label: 'Owner / CEO',  word: 'Owner',      short: 'OW', color: 'var(--accent)', soft: 'var(--accent-soft)', landing: '/dashboard', blurb: 'full org · all sites · funds' },
  admin:      { label: 'Admin',        word: 'Admin',      short: 'AD', color: 'var(--violet)', soft: 'var(--violet-soft)', landing: '/dashboard', blurb: 'users · wiring · view all' },
  finance:    { label: 'Finance',      word: 'Finance',    short: 'FN', color: 'var(--warn)',   soft: 'var(--warn-soft)',   landing: '/approvals', blurb: 'approvals · ledgers · exports' },
  engineer:   { label: 'Engineer',     word: 'Engineer',   short: 'EN', color: 'var(--info)',   soft: 'var(--info-soft)',   landing: '/review',    blurb: 'review queue · own supervisors' },
  supervisor: { label: 'Supervisor',   word: 'Supervisor', short: 'SU', color: 'var(--accent)', soft: 'var(--accent-soft)', landing: '/home',      blurb: 'logs expenses · own cash' },
}

// "Admin · overview" for whoever is actually signed in. Every one of these
// pages is reachable by more than one role, so hard-coding the role name in
// the eyebrow told admins and finance they were looking at the owner's screen.
export const roleEyebrow = (role, page) => `${ROLES[role]?.word || ''} · ${page}`

// office (desktop) roles vs the mobile field role
export const OFFICE_ROLES = ['owner', 'admin', 'finance', 'engineer']

export const CATEGORIES = {
  materials: { label: 'Materials',  color: 'var(--accent)' },
  labour:    { label: 'Labour',     color: 'var(--info)' },
  fuel:      { label: 'Fuel',       color: 'var(--warn)' },
  tea_food:  { label: 'Tea & food', color: 'var(--danger)' },
  other:     { label: 'Other',      color: 'var(--text-50)' },
  // reimbursement-only categories (engineer travel/lodging claims). They never
  // appear on a site breakdown — site views filter to kind='site_expense' —
  // so travel sharing --info with labour can't collide inside one chart.
  travel:    { label: 'Travel',     color: 'var(--info)' },
  lodging:   { label: 'Lodging',    color: 'var(--violet)' },
}

// what a supervisor may log against a site vs what an engineer may claim back
export const SITE_CATEGORIES = ['materials', 'labour', 'fuel', 'tea_food']
export const CLAIM_CATEGORIES = ['travel', 'lodging', 'tea_food', 'other']

// Expense state machine (Build Spec §3)
export const STATUS = {
  engineer_review: { label: 'In review · engineer', short: 'IN REVIEW', pill: 'pill-review',   color: 'var(--warn)' },
  finance_review:  { label: 'In review · finance',  short: 'FINANCE',   pill: 'pill-review',   color: 'var(--warn)' },
  approved:        { label: 'Approved',             short: 'APPROVED',  pill: 'pill-approved', color: 'var(--accent)' },
  rejected:        { label: 'Rejected',             short: 'REJECTED',  pill: 'pill-rejected', color: 'var(--danger)' },
  returned:        { label: 'Returned to fix',      short: 'RETURNED',  pill: 'pill-info',     color: 'var(--info)' },
  settled:         { label: 'Settled',              short: 'SETTLED',   pill: 'pill-muted',    color: 'var(--text-50)' },
}

export const SITE_STATUS = {
  active:  { label: 'Active',  pill: 'pill-approved' },
  on_hold: { label: 'On hold', pill: 'pill-review' },
  closed:  { label: 'Closed',  pill: 'pill-muted' },
}

// ---------- formatters ----------
const grp = new Intl.NumberFormat('en-US')

export function formatMoney(n) {
  const v = Math.round(Number(n) || 0)
  const sign = v < 0 ? '-' : ''
  return `Rs ${sign}${grp.format(Math.abs(v))}`
}

// short PKR — "Rs 2.4M" / "Rs 690K"
export function formatCompact(n) {
  const v = Math.round(Number(n) || 0)
  const a = Math.abs(v)
  if (a >= 1_000_000) return `Rs ${(v / 1_000_000).toFixed(a % 1_000_000 === 0 ? 0 : 2).replace(/\.?0+$/, '')}M`
  if (a >= 1_000)     return `Rs ${Math.round(v / 1000)}K`
  return `Rs ${v}`
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
}

const DAY = 86_400_000
export function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
export function relDay(iso) {
  const d = new Date(iso)
  const t = new Date()
  const days = Math.floor((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / DAY)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return fmtDate(iso)
}
