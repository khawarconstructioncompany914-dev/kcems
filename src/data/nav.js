// ============================================================
// KCEMS · single navigation source of truth.
// ROLE decides WHICH items a user gets. DEVICE decides how they
// are rendered (sidebar >= md, bottom tab bar < md) — see AppShell.
// Nothing in here may reference a device or a layout.
// ============================================================

// 24x24 stroke icons (single `d` may contain sub-paths)
export const NAV_ICONS = {
  dashboard: 'M3 12h7V3H3v9Zm0 9h7v-6H3v6Zm11 0h7V12h-7v9Zm0-18v6h7V3h-7Z',
  approvals: 'M4 12l5 5L20 6',
  review:    'M9 11l2 2 4-4M4 5h16v14H4z',
  people:    'M16 11a4 4 0 10-8 0 4 4 0 008 0Zm-9 9a5 5 0 0110 0',
  sites:     'M3 21V8l9-5 9 5v13M9 21v-6h6v6',
  reports:   'M7 15l3-3 2 2 4-5M4 4v16h16',
  admin:     'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4Z',
  home:      'M3 11l9-8 9 8M5 10v10h14V10',
  history:   'M3.2 12a9 9 0 1 0 2.9-6.6L3 8m0-5v5h5M12 7v5.3l3.6 2.1',
  funds:     'M3 7h18v12H3zM3 11h18M6.5 15.5h4',
  me:        'M16 10.5a4 4 0 10-8 0 4 4 0 008 0M5.5 20a6.5 6.5 0 0113 0',
  more:      'M5 12h.01M12 12h.01M19 12h.01',
  bills:     'M4 3h16v18l-3-2-2 2-3-2-3 2-2-2-3 2zM8 8h8M8 12h5',
  claims:    'M6 2h9l3 3v17l-3-2-3 2-3-2-3 2V2zM9 9h6M9 13h4',
  attendance: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4M8 15l2 2 4-4',
  activity:  'M3 12h4l3 7 4-14 3 7h4',
  vendors:   'M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6',
  bank:      'M3 21h18M4 10h16M6 10v11M12 10v11M18 10v11M12 3l9 7H3l9-7Z',
}

// label = sidebar text, short = bottom-tab text (must stay tiny)
export const NAV_ITEMS = {
  dashboard: { to: '/dashboard', label: 'Dashboard',     short: 'HOME' },
  approvals: { to: '/approvals', label: 'Approvals',     short: 'APPROVE' },
  review:    { to: '/review',    label: 'Review queue',  short: 'REVIEW' },
  people:    { to: '/people',    label: 'People',        short: 'PEOPLE' },
  sites:     { to: '/sites',     label: 'Sites',         short: 'SITES' },
  reports:   { to: '/reports',   label: 'Reports',       short: 'REPORTS' },
  admin:     { to: '/admin',     label: 'Users & access', short: 'ADMIN' },
  home:      { to: '/home',      label: 'Home',          short: 'HOME' },
  history:   { to: '/history',   label: 'My history',    short: 'HISTORY' },
  funds:     { to: '/funds',     label: 'Funds',         short: 'FUNDS' },
  me:        { to: '/me',        label: 'Me',            short: 'ME' },
  bills:     { to: '/bills',        label: 'Bills',       short: 'BILLS' },
  claims:    { to: '/my-expenses',  label: 'My expenses', short: 'MINE' },
  attendance: { to: '/attendance',  label: 'Attendance',  short: 'ATTEND' },
  activity:   { to: '/activity',    label: 'Activity log', short: 'LOG' },
  vendors:    { to: '/vendors',     label: 'Vendors',      short: 'VENDORS' },
  bank:       { to: '/bank',        label: 'Bank ledger',  short: 'BANK' },
}

// role -> ordered nav keys (first 4 become the phone's primary tabs)
// Attendance is the one entry every role carries — unlike the money and bills
// features, which are split by role, everybody marks their own day.
export const ROLE_NAV = {
  // Vendors and the bank ledger split the way the paper does: Muzamil signs the
  // contracts, Tariq moves the money, the owner sees both.
  owner:      ['dashboard', 'approvals', 'people', 'sites', 'vendors', 'bank', 'bills', 'attendance', 'reports', 'activity', 'admin'],
  admin:      ['dashboard', 'people', 'sites', 'vendors', 'attendance', 'bills', 'activity', 'admin'],
  finance:    ['approvals', 'bank', 'people', 'sites', 'attendance', 'bills', 'reports'],
  engineer:   ['review', 'claims', 'sites', 'attendance', 'people'],
  supervisor: ['home', 'history', 'attendance', 'funds', 'me'],
}

// how many nav items fit comfortably in a phone tab bar before overflowing
export const MAX_TABS = 4

export const navFor = (role) => (ROLE_NAV[role] || []).map((k) => ({ key: k, ...NAV_ITEMS[k] }))
