import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ROLES } from '../data/model.js'
import { LogoMark, LogoImage } from '../components/Logo.jsx'
import { BridgeArcs } from '../components/BridgeArcs.jsx'

const DEV = import.meta.env.DEV
const DEMO = [
  ['meesamali', 'Owner'], ['muzamilalisher', 'Admin'], ['tariqismail', 'Finance'],
  ['alikhawaja', 'Engineer'], ['faraz', 'Supervisor'],
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
    if (busy) return
    setBusy(true)
    const res = await login(username, password)
    setBusy(false)
    if (!res.ok) return setErr(res.reason === 'disabled' ? 'This account has been disabled. Contact the owner.' : 'That name and password did not match. Check the password — it is your name in small letters with @ at the end.')
    setErr('')
    go(res.user)
  }
  const quick = async (u) => { const res = await login(u, 'kcems'); if (res.ok) go(res.user) }

  return (
    <div className="login-wrap">
      {/* ---------- HERO ---------- */}
      <div className="login-hero">
        <div style={{ position: 'absolute', inset: 0, opacity: .32 }}><BridgeArcs /></div>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 50% at 50% 45%, rgba(9,10,9,.55), transparent 70%)' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 20 }}>
          <LogoImage width="min(300px, 56%)" />
          <h3 style={{ font: '900 clamp(26px,4.2vw,48px)/.95 var(--f-display)', color: '#fff', margin: 'clamp(20px,3vw,34px) 0 0', textTransform: 'uppercase', letterSpacing: '.02em' }}>
            We build<br />the <span style={{ color: 'var(--accent)' }}>routes</span>
          </h3>
          <div style={{ font: '400 11px/1 var(--f-mono)', letterSpacing: '.24em', color: 'rgba(255,255,255,.45)', marginTop: 16 }}>KHAWAR CONSTRUCTION CO.</div>
        </div>
        <div style={{ position: 'absolute', bottom: 22, left: 0, right: 0, textAlign: 'center', font: '400 10px/1 var(--f-mono)', letterSpacing: '.3em', color: 'rgba(92,232,56,.4)' }}>EST. MULTAN · PAKISTAN</div>
      </div>

      {/* ---------- FORM ---------- */}
      <form className="login-form-panel" onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 'clamp(22px,3vw,34px)' }}>
          <LogoMark size={46} />
          <div style={{ lineHeight: 1 }}>
            <div style={{ font: '900 18px/1 var(--f-display)', color: '#fff', letterSpacing: '.02em' }}>KCEMS</div>
            <div style={{ font: '400 10px/1 var(--f-mono)', letterSpacing: '.16em', color: 'rgba(255,255,255,.42)', marginTop: 5 }}>EXPENSE MANAGEMENT SYSTEM</div>
          </div>
        </div>

        <h1 style={{ font: '900 clamp(24px,3.4vw,33px)/1.02 var(--f-display)', letterSpacing: '-.015em', color: '#fff', margin: '0 0 12px' }}>Sign in to Khawar Construction</h1>
        <p style={{ font: '400 14px/1.55 var(--f-body)', color: 'rgba(255,255,255,.5)', margin: '0 0 28px', maxWidth: '40ch' }}>
          <b style={{ color: 'rgba(255,255,255,.72)', fontWeight: 600 }}>Office staff:</b> sign in using the desktop.<br />
          <b style={{ color: 'rgba(255,255,255,.72)', fontWeight: 600 }}>Supervisors:</b> use the same web address to sign in on your phone.
        </p>

        <label className="login-label">YOUR NAME</label>
        <input className="login-input" style={{ marginBottom: 7 }} value={username} onChange={(e) => { setUsername(e.target.value); setErr('') }} placeholder="e.g. Muhammad Ikram" autoCapitalize="none" spellCheck={false} autoComplete="username" autoFocus />
        <div style={{ font: '400 12px/1.45 var(--f-body)', color: 'rgba(255,255,255,.38)', marginBottom: 18 }}>
          Type your full name or just your first name. Capitals, spaces and small spelling slips are fine.
        </div>

        <label className="login-label">PASSWORD</label>
        <input className="login-input" style={{ marginBottom: err ? 16 : 26, letterSpacing: '.12em' }} type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErr('') }} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="••••••••" />

        {err && <div style={{ font: '600 12px/1.4 var(--f-body)', color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid rgba(242,112,79,.25)', borderRadius: 10, padding: '10px 13px', marginBottom: 22 }}>{err}</div>}

        <button type="submit" className="login-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>

        <p style={{ font: '400 12.5px/1.5 var(--f-body)', color: 'rgba(255,255,255,.38)', margin: '20px 0 0' }}>Forgot your password? Ask the owner or admin to reset it.</p>

        {DEV && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 16, marginTop: 20 }}>
            <div style={{ font: '400 10px/1 var(--f-mono)', color: 'rgba(255,255,255,.4)', letterSpacing: '.14em', marginBottom: 10 }}>DEV · QUICK LOGIN (password “kcems”)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {DEMO.map(([u, label]) => (
                <button key={u} type="button" className="chip" onClick={() => quick(u)} title={`Sign in as ${u}`}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
