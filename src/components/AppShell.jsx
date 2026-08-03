// ============================================================
// KCEMS · one shell for every role and every device.
// ROLE  -> which nav items exist (data/nav.js)
// DEVICE-> how they render (CSS only: sidebar >= --bp-md, bottom
//          tabs below it). No JS breakpoint, no role/shell fork.
// ============================================================
import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useStore, useSelectors } from '../store.jsx'
import { ROLES } from '../data/model.js'
import { navFor, NAV_ICONS, MAX_TABS } from '../data/nav.js'
import { Wordmark } from './Logo.jsx'
import { Monogram } from './bits.jsx'
import SyncStatus from './sync.jsx'
import ThemeToggle from './ThemeToggle.jsx'

function Icon({ d, size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
}

// routes that take over the screen (own back + submit affordances)
const FULL_BLEED = new Set(['/log-expense'])

export default function AppShell() {
  const { dispatch } = useStore()
  const { me } = useSelectors()
  const nav = useNavigate()
  const loc = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const items = navFor(me.role)
  const roleMeta = ROLES[me.role] || {}
  const isSupervisor = me.role === 'supervisor'
  const DEV = import.meta.env.DEV
  const hideNav = FULL_BLEED.has(loc.pathname)

  const logout = () => { dispatch({ type: 'LOGOUT' }); nav('/login', { replace: true }) }
  const switchRole = (e) => {
    const map = { owner: 'u_owner', admin: 'u_admin', finance: 'u_fin', engineer: 'u_ali', supervisor: 's_faraz' }
    dispatch({ type: 'SWITCH_USER', userId: map[e.target.value] })
    nav(ROLES[e.target.value].landing, { replace: true })
  }

  const primary = items.slice(0, MAX_TABS)
  const overflow = items.slice(MAX_TABS)
  // supervisor splits its tabs around the centre "log expense" button
  const tabList = isSupervisor ? [...primary.slice(0, 2), { key: '__gap' }, ...primary.slice(2)] : primary

  const UserCard = () => (
    <div className="surface" style={{ padding: 12, borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Monogram name={me.name} color={roleMeta.color} soft={roleMeta.soft} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '700 12px/1.1 var(--f-body)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.name}</div>
          {/* Uppercase mono at 10px with line-height 1 and no tracking was hard
              to read. Colour was never the issue (11.6:1 against the surface) —
              it needed size, leading and letter-spacing, which is what small
              all-caps always needs. */}
          <div style={{ font: '600 12px/1.35 var(--f-mono)', color: roleMeta.color, marginTop: 5, letterSpacing: '.06em' }}>{(roleMeta.label || '').toUpperCase()}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
        {DEV && (
          <select className="field" value={me.role} onChange={switchRole} title="Dev only: switch role" style={{ height: 38, flex: 1, fontSize: 12, padding: '0 10px', fontWeight: 600 }}>
            <option value="owner">Owner view</option>
            <option value="admin">Admin view</option>
            <option value="finance">Finance view</option>
            <option value="engineer">Head Engineer view</option>
            <option value="supervisor">Site Engineer view</option>
          </select>
        )}
        {/* This card is the only place that renders in BOTH the desktop
            sidebar and the phone's "More" sheet, so the toggle lands in both
            without a second copy. */}
        <ThemeToggle />
        <button className="btn btn-ghost" style={{ height: 38, flex: DEV ? 'none' : 1, padding: '0 12px', gap: 8 }} onClick={logout} title="Sign out">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          {!DEV && 'Sign out'}
        </button>
      </div>
    </div>
  )

  return (
    <div className={`app-shell${hideNav ? ' no-nav' : ''}`}>
      {/* ---------- sidebar (>= md) ---------- */}
      <aside className="app-sidebar">
        <div style={{ padding: '4px 8px 18px' }}><Wordmark mark={38} /></div>
        {isSupervisor && (
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 14 }} onClick={() => nav('/log-expense')}>+ Log an expense</button>
        )}
        <nav className="app-nav">
          {items.map((it) => (
            <NavLink key={it.key} to={it.to} className={({ isActive }) => `app-nav-link${isActive ? ' on' : ''}`}>
              <Icon d={NAV_ICONS[it.key]} />{it.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }}><UserCard /></div>
      </aside>

      {/* ---------- top bar (< md) ---------- */}
      <header className="app-topbar">
        <Wordmark mark={30} stacked={false} />
        <div className="spacer" />
        {/* The monogram was decoration. On a phone a site engineer has four
            tabs and no "More" sheet, which left /me — sign out, change
            password, and now the theme — with no way in at all. It is a
            button now: their own surface for a site engineer, the sheet for
            everyone else. */}
        <button
          type="button"
          onClick={() => (isSupervisor ? nav('/me') : setMoreOpen(true))}
          aria-label={isSupervisor ? 'Your account' : 'More'}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
        >
          <Monogram name={me.name} color={roleMeta.color} soft={roleMeta.soft} size={32} />
        </button>
      </header>

      {/* ---------- content ---------- */}
      <main className="app-main"><SyncStatus /><Outlet /></main>

      {/* ---------- bottom tabs (< md) ---------- */}
      <nav className="app-tabbar">
        {tabList.map((it) => it.key === '__gap'
          ? <span key="gap" className="app-tab-gap" aria-hidden />
          : (
            <NavLink key={it.key} to={it.to} className={({ isActive }) => `app-tab${isActive ? ' on' : ''}`}>
              <Icon d={NAV_ICONS[it.key]} size={20} />
              <span className="app-tab-lbl">{it.short}</span>
            </NavLink>
          ))}
        {!isSupervisor && (
          <button type="button" className={`app-tab${moreOpen ? ' on' : ''}`} onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen}>
            <Icon d={NAV_ICONS.more} size={20} />
            <span className="app-tab-lbl">MORE</span>
          </button>
        )}
      </nav>

      {isSupervisor && !hideNav && (
        <button className="app-fab" onClick={() => nav('/log-expense')} aria-label="Log an expense">+</button>
      )}

      {/* ---------- "More" sheet (< md) ---------- */}
      {moreOpen && (
        <div className="app-sheet-scrim" onClick={() => setMoreOpen(false)} role="dialog" aria-modal="true">
          <div className="app-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="app-sheet-grab" />
            {overflow.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                {overflow.map((it) => (
                  <NavLink key={it.key} to={it.to} onClick={() => setMoreOpen(false)} className={({ isActive }) => `app-nav-link${isActive ? ' on' : ''}`}>
                    <Icon d={NAV_ICONS[it.key]} />{it.label}
                  </NavLink>
                ))}
              </div>
            )}
            <UserCard />
          </div>
        </div>
      )}
    </div>
  )
}
