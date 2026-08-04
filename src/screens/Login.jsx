import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { ROLES } from '../data/model.js'
import { LogoMark, LogoImage } from '../components/Logo.jsx'
import { BridgeArcs } from '../components/BridgeArcs.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'

const DEV = import.meta.env.DEV
const DEMO = [
  ['meesamali', 'Owner'], ['muzamilalisher', 'Admin'], ['tariqismail', 'Finance'],
  ['alikhawaja', 'Head Engineer'], ['faraz', 'Site Engineer'],
]

export default function Login() {
  const { login } = useStore()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const go = (user) => nav(user.mustChangePassword ? '/change-password' : (ROLES[user.role]?.landing || '/'), { replace: true })

  // "in about 4 minutes" reads better on a lockout than "in 213 seconds".
  const waitWords = (secs) => {
    const m = Math.ceil((secs || 0) / 60)
    return m <= 1 ? 'in a minute' : `in about ${m} minutes`
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const res = await login(username, password)
    setBusy(false)
    if (!res.ok) {
      if (res.reason === 'disabled') return setErr('This account has been disabled. Contact the owner.')
      if (res.reason === 'server_error') {
        return setErr('The system is not responding — this is not your password. Tell the office; nobody can sign in until it is fixed.')
      }
      if (res.reason === 'offline') {
        return setErr('No internet connection. Signing in needs one — check your signal and try again.')
      }
      // `backend_not_configured` needs no case of its own: it arrives as a 503,
      // which the 5xx branch above already reports as "tell the office".
      if (res.reason === 'too_many_attempts') {
        return setErr(`Too many sign-in attempts from here. Try again ${waitWords(res.retryAfter)}, or ask the owner or admin to reset your password.`)
      }
      return setErr('That name and password did not match. Check the password — it is your name in small letters with @ at the end.')
    }
    setErr('')
    go(res.user)
  }
  const quick = async (u) => { const res = await login(u, 'kcems'); if (res.ok) go(res.user) }

  return (
    <div className="login-wrap">
      {/* ---------- HERO ---------- */}
      <div className="login-hero">
        <div style={{ position: 'absolute', inset: 0, opacity: .32 }}><BridgeArcs /></div>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 50% at 50% 45%, var(--hero-veil), transparent 70%)' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 20 }}>
          <LogoImage width="min(300px, 56%)" />
          <h3 style={{ font: '900 clamp(26px,4.2vw,48px)/.95 var(--f-display)', color: 'var(--text)', margin: 'clamp(20px,3vw,34px) 0 0', textTransform: 'uppercase', letterSpacing: '.02em' }}>
            We build<br />the <span style={{ color: 'var(--accent)' }}>routes</span>
          </h3>
          <div style={{ font: '400 12px/1.4 var(--f-mono)', letterSpacing: '.24em', color: 'var(--text-42)', marginTop: 16 }}>KHAWAR CONSTRUCTION CO.</div>
        </div>
        <div style={{ position: 'absolute', bottom: 22, left: 0, right: 0, textAlign: 'center', font: '400 10px/1 var(--f-mono)', letterSpacing: '.3em', color: 'var(--accent)' }}>EST. MULTAN · PAKISTAN</div>
      </div>

      {/* ---------- FORM ---------- */}
      <form className="login-form-panel" onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 'clamp(22px,3vw,34px)' }}>
          <LogoMark size={46} />
          <div style={{ lineHeight: 1 }}>
            <div style={{ font: '900 18px/1 var(--f-display)', color: 'var(--text)', letterSpacing: '.02em' }}>KCEMS</div>
            <div style={{ font: '400 10px/1 var(--f-mono)', letterSpacing: '.16em', color: 'var(--text-42)', marginTop: 5 }}>EXPENSE MANAGEMENT SYSTEM</div>
          </div>
          {/* Login is outside the shell, so it needs its own copy — and it is
              where someone squinting at a phone in the sun will want it. */}
          <div style={{ marginLeft: 'auto' }}><ThemeToggle compact /></div>
        </div>

        <h1 style={{ font: '900 clamp(24px,3.4vw,33px)/1.02 var(--f-display)', letterSpacing: '-.015em', color: 'var(--text)', margin: '0 0 12px' }}>Sign in to Khawar Construction</h1>
        <p style={{ font: '400 14px/1.55 var(--f-body)', color: 'var(--text-50)', margin: '0 0 28px', maxWidth: '40ch' }}>
          <b style={{ color: 'var(--text-70)', fontWeight: 600 }}>Office staff:</b> sign in using the desktop.<br />
          <b style={{ color: 'var(--text-70)', fontWeight: 600 }}>Site Engineers:</b> use the same web address to sign in on your phone.
        </p>

        <label className="login-label">YOUR NAME</label>
        <input className="login-input" style={{ marginBottom: 7 }} value={username} onChange={(e) => { setUsername(e.target.value); setErr('') }} placeholder="e.g. Muhammad Ikram" autoCapitalize="none" spellCheck={false} autoComplete="username" autoFocus />
        <div style={{ font: '400 12px/1.45 var(--f-body)', color: 'var(--text-40)', marginBottom: 18 }}>
          Type your full name or just your first name. Capitals, spaces and small spelling slips are fine.
        </div>

        <label className="login-label">PASSWORD</label>
        <input className="login-input" style={{ marginBottom: err ? 16 : 26, letterSpacing: '.12em' }} type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErr('') }} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="••••••••" />

        {err && <div style={{ font: '600 12px/1.4 var(--f-body)', color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', borderRadius: 10, padding: '10px 13px', marginBottom: 22 }}>{err}</div>}

        <button type="submit" className="login-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>

        <p style={{ font: '400 12.5px/1.5 var(--f-body)', color: 'var(--text-40)', margin: '20px 0 0' }}>Forgot your password? Ask the owner or admin to reset it.</p>

        {DEV && (
          <div style={{ borderTop: '1px solid var(--hover-bg)', paddingTop: 16, marginTop: 20 }}>
            <div style={{ font: '400 10px/1 var(--f-mono)', color: 'var(--text-42)', letterSpacing: '.14em', marginBottom: 10 }}>DEV · QUICK LOGIN (password “kcems”)</div>
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
