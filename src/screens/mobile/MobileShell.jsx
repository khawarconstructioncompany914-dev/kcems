import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useSelectors } from '../../store.jsx'

const TABS = [
  { key: 'home', to: '/m', label: 'HOME', round: false },
  { key: 'history', to: '/m/history', label: 'HISTORY', round: false },
  { key: 'funds', to: '/m/funds', label: 'FUNDS', round: false },
  { key: 'me', to: '/m/me', label: 'ME', round: true },
]

export default function MobileShell() {
  const nav = useNavigate()
  const loc = useLocation()
  const { me } = useSelectors()
  const path = loc.pathname
  const isActive = (to) => (to === '/m' ? path === '/m' || path === '/m/' : path.startsWith(to))
  const onAdd = path.startsWith('/m/add')

  return (
    <div className="phone-stage">
      <div>
        <div className="phone">
          <div className="phone-notch" />
          <div className="phone-screen">
            <div className="phone-status">
              <span>9:41</span>
              <span style={{ fontFamily: 'var(--f-mono)', letterSpacing: 1 }}>▮▮▮ 5G ▰</span>
            </div>

            <div className="phone-body">
              <Outlet />
            </div>

            {!onAdd && (
              <>
                <button className="phone-fab" onClick={() => nav('/m/add')} aria-label="Log an expense">+</button>
                <div className="phone-tabbar">
                  {TABS.map((t, i) => (
                    <button key={t.key} className={`phone-tab ${isActive(t.to) ? 'on' : ''}`} onClick={() => nav(t.to)}>
                      <span className={`ico ${t.round ? 'round' : ''}`} />
                      <span className="lbl">{t.label}</span>
                    </button>
                  )).flatMap((el, i) => (i === 2 ? [<div key="gap" style={{ width: 44 }} />, el] : [el]))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="phone-caption">Supervisor field app · {me.name}</div>
      </div>
    </div>
  )
}
