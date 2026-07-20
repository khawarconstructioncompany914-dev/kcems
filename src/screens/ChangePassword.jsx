import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useStore, useSelectors, LIVE } from '../store.jsx'
import { ROLES } from '../data/model.js'
import { LogoMark } from '../components/Logo.jsx'

export default function ChangePassword() {
  const { dispatch, toast } = useStore()
  const { me, authenticate } = useSelectors()
  const nav = useNavigate()
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (!me) return <Navigate to="/login" replace />
  const forced = me.mustChangePassword

  const submit = async (e) => {
    e.preventDefault()
    if (!LIVE) {
      const check = authenticate(me.username, cur) // server verifies in live mode
      if (!check.ok) return setErr('Current password is incorrect.')
    }
    if (pw.length < 4) return setErr('New password must be at least 4 characters.')
    if (pw === cur) return setErr('New password must be different from the current one.')
    if (pw !== confirm) return setErr('The two new passwords don’t match.')
    setBusy(true)
    const res = await dispatch({ type: 'CHANGE_PASSWORD', userId: me.id, password: pw, currentPassword: cur })
    setBusy(false)
    if (LIVE && res && res.status !== 200) {
      return setErr(res.body?.error === 'bad_current' ? 'Current password is incorrect.' : 'Could not update password. Try again.')
    }
    toast('Password updated')
    nav(ROLES[me.role]?.landing || '/', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'radial-gradient(120% 70% at 80% -10%, rgba(92,230,46,.10), transparent 55%)' }}>
      <form onSubmit={submit} className="card fade-up" style={{ width: 400, maxWidth: '100%', padding: '38px 34px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 22 }}>
          <LogoMark size={38} />
          <div style={{ font: '800 16px/1 var(--f-display)', color: '#fff' }}>KCEMS</div>
        </div>
        <div style={{ font: '700 20px/1.15 var(--f-display)', color: '#fff', letterSpacing: '-.02em' }}>
          {forced ? 'Set your password' : 'Change password'}
        </div>
        <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--text-42)', marginTop: 8 }}>
          {forced
            ? `Welcome, ${me.name.split(' ')[0]}. Choose a password only you know before you continue.`
            : 'Update the password for your account.'}
        </div>

        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div>
            <label className="field-label">{forced ? 'Temporary password' : 'Current password'}</label>
            <input className="field" type="password" value={cur} onChange={(e) => { setCur(e.target.value); setErr('') }} autoFocus autoComplete="current-password" />
          </div>
          <div>
            <label className="field-label">New password</label>
            <input className="field" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr('') }} autoComplete="new-password" />
          </div>
          <div>
            <label className="field-label">Confirm new password</label>
            <input className="field" type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErr('') }} autoComplete="new-password" />
          </div>
        </div>

        {err && <div style={{ marginTop: 14, font: '600 12px/1.4 var(--f-body)', color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid rgba(242,112,79,.25)', borderRadius: 10, padding: '10px 13px' }}>{err}</div>}

        <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%', height: 48, marginTop: 20 }}>{busy ? 'Saving…' : 'Save password'}</button>
        {!forced && <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => nav(-1)}>Cancel</button>}
      </form>
    </div>
  )
}
