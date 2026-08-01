import { useNavigate } from 'react-router-dom'
import { useStore, useSelectors } from '../../store.jsx'
import { Monogram } from '../../components/bits.jsx'
import ThemeToggle from '../../components/ThemeToggle.jsx'
import { useTheme } from '../../theme.js'

export default function Me() {
  const nav = useNavigate()
  const { dispatch } = useStore()
  const { me, userById, siteById } = useSelectors()
  const eng = userById(me.engineerId)
  const site = siteById(me.siteId)

  const logout = () => { dispatch({ type: 'LOGOUT' }); nav('/login', { replace: true }) }
  const [theme] = useTheme()

  const rows = [
    ['Phone', me.phone],
    ['Site', site?.name],
    ['Reports to', eng?.name],
    ['Role', 'Site Engineer · field app'],
  ]

  return (
    <div className="field-screen">
      <div style={{ padding: '6px 20px 4px' }}>
        <div style={{ font: '700 20px/1 var(--f-display)', color: 'var(--text)' }}>Me</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 12px' }}>
        <Monogram name={me.name} color="var(--accent)" soft="var(--accent-soft)" size={72} radius={22} font={26} />
        <div style={{ font: '700 19px/1 var(--f-display)', color: 'var(--text)', marginTop: 14 }}>{me.name}</div>
        <div style={{ font: '500 12px/1.4 var(--f-mono)', color: 'var(--accent)', marginTop: 7 }}>SITE ENGINEER</div>
      </div>

      <div style={{ padding: '8px 16px 0' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderTop: i ? '1px solid var(--border-3)' : 'none' }}>
              <span style={{ font: '500 12px/1 var(--f-mono)', color: 'var(--text-42)', flex: 'none', width: 96 }}>{k}</span>
              <span style={{ font: '600 13px/1.3 var(--f-body)', color: 'var(--text)', textAlign: 'right', flex: 1 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* The sidebar's user card carries the toggle on a desktop, but a site
            engineer never sees a sidebar — this screen is their settings. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '600 13px/1.3 var(--f-body)', color: 'var(--text)' }}>Appearance</div>
            <div style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--text-42)', marginTop: 3 }}>
              {theme === 'light' ? 'Easier to read in bright sun' : 'Easier on the eyes indoors'}
            </div>
          </div>
          <ThemeToggle />
        </div>

        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => nav('/change-password')}>Change password</button>
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10, color: 'var(--danger)', borderColor: 'var(--danger-line)' }} onClick={logout}>Sign out</button>
      </div>
    </div>
  )
}
