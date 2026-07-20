import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStore, useSelectors } from '../../store.jsx'
import { ROLES } from '../../data/model.js'
import { Wordmark } from '../../components/Logo.jsx'
import { Monogram } from '../../components/bits.jsx'

const ICONS = {
  dashboard: 'M3 12h7V3H3v9Zm0 9h7v-6H3v6Zm11 0h7V12h-7v9Zm0-18v6h7V3h-7Z',
  approvals: 'M4 12l5 5L20 6',
  review: 'M12 5v14M5 12h14',
  people: 'M16 11a4 4 0 10-8 0 4 4 0 008 0Zm-9 9a5 5 0 0110 0',
  sites: 'M3 21V8l9-5 9 5v13M9 21v-6h6v6',
  reports: 'M7 15l3-3 2 2 4-5M4 4v16h16',
  admin: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4Z',
}

// which surfaces each role sees in the sidebar
const NAV = {
  owner:    ['dashboard', 'approvals', 'people', 'sites', 'reports', 'admin'],
  admin:    ['dashboard', 'people', 'sites', 'admin'],
  finance:  ['approvals', 'people', 'sites', 'reports'],
  engineer: ['review', 'people', 'sites'],
}

const META = {
  dashboard: { to: '/dashboard', label: 'Dashboard' },
  approvals: { to: '/approvals', label: 'Approvals' },
  review:    { to: '/review', label: 'Review queue' },
  people:    { to: '/people', label: 'People' },
  sites:     { to: '/sites', label: 'Sites' },
  reports:   { to: '/reports', label: 'Reports' },
  admin:     { to: '/admin', label: 'Users & access' },
}

function Icon({ d }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
}

export default function DesktopShell() {
  const { state, dispatch } = useStore()
  const { me } = useSelectors()
  const nav = useNavigate()
  const items = NAV[me.role] || []
  const roleMeta = ROLES[me.role]

  const logout = () => { dispatch({ type: 'LOGOUT' }); nav('/login', { replace: true }) }
  const switchRole = (e) => {
    const map = { owner: 'u_owner', admin: 'u_admin', finance: 'u_fin', engineer: 'u_ali' }
    const uid = map[e.target.value]
    dispatch({ type: 'SWITCH_USER', userId: uid })
    nav(ROLES[e.target.value].landing, { replace: true })
  }
  const DEV = import.meta.env.DEV

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-root)' }}>
      {/* ---- sidebar ---- */}
      <aside style={{ width: 244, flex: 'none', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '22px 16px', borderRight: '1px solid var(--border-2)', background: 'var(--bg-panel)' }}>
        <div style={{ padding: '4px 8px 20px' }}><Wordmark mark={38} /></div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((k) => {
            const m = META[k]
            return (
              <NavLink key={k} to={m.to} className="nav-link" style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 11,
                font: '600 13px/1 var(--f-body)', textDecoration: 'none',
                color: isActive ? 'var(--accent-ink)' : 'var(--text-70)',
                background: isActive ? 'var(--accent)' : 'transparent',
                transition: 'background .12s, color .12s',
              })}>
                <Icon d={ICONS[k]} />{m.label}
              </NavLink>
            )
          })}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* demo role switcher */}
          <div className="surface" style={{ padding: 12, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Monogram name={me.name} color={roleMeta.color} soft={roleMeta.soft} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 12px/1.1 var(--f-body)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.name}</div>
                <div style={{ font: '600 10px/1 var(--f-mono)', color: roleMeta.color, marginTop: 4 }}>{roleMeta.label.toUpperCase()}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
              {DEV && (
                <select className="field btn-sm" value={me.role} onChange={switchRole} title="Dev only: switch role" style={{ height: 34, flex: 1, fontSize: 12, padding: '0 10px', fontWeight: 600 }}>
                  <option value="owner">Owner view</option>
                  <option value="admin">Admin view</option>
                  <option value="finance">Finance view</option>
                  <option value="engineer">Engineer view</option>
                </select>
              )}
              <button className="btn btn-ghost btn-sm" style={{ height: 34, flex: DEV ? 'none' : 1, padding: '0 11px', gap: 8 }} onClick={logout} title="Sign out">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                {!DEV && 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ---- main ---- */}
      <main style={{ flex: 1, minWidth: 0, maxWidth: 1240, margin: '0 auto', width: '100%', padding: '30px 34px 70px' }}>
        <Outlet />
      </main>
    </div>
  )
}
