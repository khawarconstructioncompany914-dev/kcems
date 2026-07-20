import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ROLES } from '../data/model.js'
import { LogoMark } from '../components/Logo.jsx'

const DEV = import.meta.env.DEV
// seeded logins shown only in dev, to make the prototype testable
const DEMO = [
  ['messam', 'Owner'], ['junaid', 'Admin'], ['tariq', 'Finance'],
  ['ali', 'Engineer'], ['faraz', 'Supervisor'],
]

export default function Login() {
  const { login } = useStore()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const go = (user) => nav(user.mustChangePassword ? '/change-password' : (ROLES[user.role]?.landing || '/'), { replace: true })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const res = await login(username, password)
    setBusy(false)
    if (!res.ok) {
      setErr(res.reason === 'disabled' ? 'This account has been disabled. Contact the owner.' : 'Wrong username or password.')
      return
    }
    setErr('')
    go(res.user)
  }

  const quick = async (u) => { const res = await login(u, 'kcems'); if (res.ok) go(res.user) }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'radial-gradient(120% 70% at 80% -10%, rgba(92,230,46,.10), transparent 55%)' }}>
      <div style={{ display: 'flex', gap: 26, alignItems: 'stretch', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 900 }}>

        {/* ---- login ---- */}
        <form onSubmit={submit} className="card fade-up" style={{ width: 430, maxWidth: '100%', minHeight: 540, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '44px 40px' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 60% at 80% 0%, rgba(92,230,46,.14), transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 34 }}>
              <LogoMark size={40} />
              <div>
                <div style={{ font: '800 17px/1 var(--f-display)', color: '#fff' }}>KCEMS</div>
                <div style={{ font: '500 10px/1.2 var(--f-mono)', color: 'var(--text-40)', marginTop: 3 }}>EXPENSE MGMT</div>
              </div>
            </div>
            <div style={{ font: '700 24px/1.15 var(--f-display)', color: '#fff', letterSpacing: '-.02em' }}>Sign in to Khawar<br />Construction</div>
            <div style={{ font: '500 13px/1.5 var(--f-body)', color: 'var(--text-42)', marginTop: 10 }}>Office staff sign in on desktop; supervisors use the same address on their phone.</div>

            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="field-label">Username</label>
                <input className="field" value={username} onChange={(e) => { setUsername(e.target.value); setErr('') }} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="e.g. faraz" autoFocus />
              </div>
              <div>
                <label className="field-label">Password</label>
                <input className="field" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErr('') }} autoComplete="current-password" placeholder="••••••••" />
              </div>
            </div>

            {err && <div style={{ marginTop: 14, font: '600 12px/1.4 var(--f-body)', color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid rgba(242,112,79,.25)', borderRadius: 10, padding: '10px 13px' }}>{err}</div>}

            <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%', height: 50, marginTop: 20, fontSize: 15 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <div style={{ marginTop: 16, font: '500 12px/1 var(--f-body)', color: 'var(--text-40)' }}>Forgot your password? Ask the owner or admin to reset it.</div>
          </div>
        </form>

        {/* ---- info / (dev) demo logins ---- */}
        <div className="card fade-up" style={{ width: 430, maxWidth: '100%', minHeight: 540, padding: 30, display: 'flex', flexDirection: 'column', animationDelay: '.06s' }}>
          <div style={{ font: '700 16px/1 var(--f-body)', color: '#fff' }}>One login, the right screen</div>
          <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--text-42)', marginTop: 7 }}>
            Everyone signs in with a username &amp; password. Your <b style={{ color: 'var(--accent)' }}>role</b> decides what you land on — no OTP, nothing to install (though supervisors can “Add to Home Screen”).
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, justifyContent: 'center' }}>
            {Object.entries(ROLES).map(([role, meta]) => (
              <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span className="mono-badge" style={{ width: 34, height: 34, borderRadius: 9, background: meta.soft, color: meta.color, fontSize: 12 }}>{meta.short}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 12px/1 var(--f-body)', color: '#fff' }}>{meta.label}</div>
                  <div style={{ font: '500 10px/1.2 var(--f-mono)', color: 'var(--text-40)', marginTop: 4 }}>{meta.blurb}</div>
                </div>
                <span style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--text-42)' }}>{meta.landing === '/m' ? 'mobile' : meta.landing}</span>
              </div>
            ))}
          </div>

          {DEV && (
            <div style={{ borderTop: '1px solid var(--border-3)', paddingTop: 14, marginTop: 6 }}>
              <div style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--text-40)', letterSpacing: '.08em', marginBottom: 9 }}>DEV · QUICK LOGIN (password “kcems”)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {DEMO.map(([u, label]) => (
                  <button key={u} type="button" className="chip" onClick={() => quick(u)} title={`Sign in as ${u}`}>{label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
