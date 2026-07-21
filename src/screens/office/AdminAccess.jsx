import { useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { ROLES } from '../../data/model.js'
import { PageHeader, Card } from '../../components/page.jsx'
import { Monogram, Modal } from '../../components/bits.jsx'

// Build Spec §2 permission matrix (+ Admin)
const MATRIX = {
  cols: [['owner', 'OWNER', 'var(--accent)'], ['admin', 'ADMIN', 'var(--violet)'], ['finance', 'FIN', 'var(--warn)'], ['engineer', 'ENG', 'var(--info)'], ['supervisor', 'SUP', '#fff']],
  rows: [
    ['Log expense',            ['—', '—', '—', '—', '✓']],
    ['Review / pass up',       ['✓', '—', '—', 'own', '—']],
    ['Approve / reject',       ['✓', '—', '✓', '—', '—']],
    ['Add funds / settle',     ['✓', '—', '✓', '—', '—']],
    ['View sites & ledgers',   ['all', 'all', 'all', 'own', 'self']],
    ['Manage users & wiring',  ['✓', '✓', '—', '—', '—']],
    ['Export reports',         ['✓', '—', '✓', '—', '—']],
  ],
}
function Cell({ v }) {
  if (v === '✓') return <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>
  if (v === '—') return <span style={{ color: 'var(--text-25)' }}>—</span>
  return <span style={{ color: 'var(--warn)', font: '700 11px/1 var(--f-body)' }}>{v}</span>
}

const genTemp = () => 'kc' + Math.floor(1000 + Math.random() * 9000)
const CREATE_ROLES = ['supervisor', 'engineer', 'finance', 'admin']

function RolePill({ role }) {
  const m = ROLES[role]
  return <span className="pill" style={{ background: m.soft, color: m.color, height: 22, fontSize: 10 }}>{m.label.toUpperCase()}</span>
}

export default function AdminAccess() {
  const { state, dispatch, toast } = useStore()
  const { me, engineers, supervisors, supsForEngineer, siteById, userById } = useSelectors()
  const [tab, setTab] = useState('users')
  const [create, setCreate] = useState(false)
  const [edit, setEdit] = useState(null)
  const [moving, setMoving] = useState(null)

  const users = state.users
  const actor = state.session.userId

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Admin · users & access"
        title="Users & access"
        sub="Create logins, wire supervisors to engineers and sites, reset passwords, and review who can do what."
        right={<button className="btn btn-primary" onClick={() => setCreate(true)}>+ Create login</button>}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[['users', `Users · ${users.length}`], ['access', 'Wiring & permissions']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className="btn btn-sm"
            style={{ background: tab === k ? 'var(--accent)' : 'var(--input)', color: tab === k ? 'var(--accent-ink)' : 'var(--text-70)', border: `1px solid ${tab === k ? 'transparent' : 'var(--border)'}` }}>{label}</button>
        ))}
      </div>

      {/* ---------------- USERS ---------------- */}
      {tab === 'users' && (
        <Card pad={0}>
          <div className="r-scroll-x" style={{ '--r-tablemin': '760px' }}>
          <div>
          <div style={{ display: 'flex', font: '500 10px/1 var(--f-mono)', color: 'var(--text-40)', padding: '16px 22px 12px', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border-3)' }}>
            <span style={{ flex: 2.2 }}>Person</span>
            <span style={{ flex: 1.4 }}>Role</span>
            <span style={{ flex: 2 }}>Wiring</span>
            <span style={{ flex: 1 }}>Status</span>
            <span style={{ flex: 1.8, textAlign: 'right' }}>Actions</span>
          </div>
          {users.map((u) => {
            const eng = userById(u.engineerId)
            const site = siteById(u.siteId)
            const disabled = u.status === 'disabled'
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 22px', borderTop: '1px solid var(--border-3)', opacity: disabled ? 0.55 : 1 }}>
                <div style={{ flex: 2.2, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Monogram name={u.name} color={ROLES[u.role].color} soft={ROLES[u.role].soft} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: '700 13px/1.2 var(--f-body)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                    <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--text-42)', marginTop: 4 }}>@{u.username}{u.mustChangePassword ? ' · temp pw' : ''}</div>
                  </div>
                </div>
                <div style={{ flex: 1.4 }}><RolePill role={u.role} /></div>
                <div style={{ flex: 2, font: '500 11px/1.4 var(--f-mono)', color: 'var(--text-50)' }}>
                  {u.role === 'supervisor' ? <>{eng?.name.split(' ')[0] || '—'} · {site?.label || '—'}</> : <span style={{ color: 'var(--text-32)' }}>—</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <span className="pill" style={{ height: 22, fontSize: 10, background: disabled ? 'var(--input)' : 'var(--accent-soft)', color: disabled ? 'var(--text-50)' : 'var(--accent)', border: disabled ? '1px solid var(--border)' : 'none' }}>{disabled ? 'DISABLED' : u.mustChangePassword ? 'PENDING' : 'ACTIVE'}</span>
                </div>
                <div style={{ flex: 1.8, display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { const p = genTemp(); dispatch({ type: 'RESET_PASSWORD', userId: u.id, password: p, actorId: actor }); toast(`New temp password for ${u.username}: ${p}`, 'info') }} title="Reset password">Reset pw</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEdit(u)}>Edit</button>
                </div>
              </div>
            )
          })}
          </div>
          </div>
        </Card>
      )}

      {/* ---------------- WIRING & PERMISSIONS ---------------- */}
      {tab === 'access' && (
        <div className="r-grid" style={{ alignItems: 'start' }}>
          <Card pad={26}>
            <div style={{ font: '700 15px/1 var(--f-body)', color: '#fff' }}>Reporting tree</div>
            <div style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--text-42)', marginTop: 6 }}>An engineer only sees the supervisors wired under them. Click a supervisor to re-assign.</div>
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {engineers.map((eng) => {
                const sups = supsForEngineer(eng.id)
                return (
                  <div key={eng.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginLeft: -27 }}>
                      <Monogram name={eng.name} color="var(--info)" soft="var(--info-soft)" size={34} />
                      <div>
                        <div style={{ font: '700 13px/1 var(--f-body)', color: '#fff' }}>{eng.name}</div>
                        <div style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--text-42)', marginTop: 4 }}>ENGINEER · {sups.length} supervisor{sups.length !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
                      {sups.map((s) => (
                        <button key={s.id} onClick={() => setMoving(s)} title="Re-assign" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 11px', borderRadius: 9, background: 'var(--input)', border: '1px solid var(--border)', font: '600 12px/1 var(--f-body)', color: '#fff', cursor: 'pointer' }}>
                          <span className="mono-badge" style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 8 }}>{s.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                          {s.name.split(' ')[0]} · {siteById(s.siteId)?.label}
                        </button>
                      ))}
                      {sups.length === 0 && <span style={{ font: '500 12px/1 var(--f-mono)', color: 'var(--text-40)' }}>none wired</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card pad={26}>
            <div style={{ font: '700 15px/1 var(--f-body)', color: '#fff' }}>Who can do what</div>
            <div style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--text-42)', marginTop: 6 }}>Enforced server-side on every endpoint. This screen is read-only.</div>
            <div className="r-scroll-x" style={{ marginTop: 20, border: '1px solid var(--border-3)', borderRadius: 12, '--r-tablemin': '560px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.7fr repeat(5, 1fr)' }}>
                <div style={{ padding: '12px 14px', background: 'var(--input)', font: '600 10px/1 var(--f-mono)', color: 'var(--text-50)' }}>CAPABILITY</div>
                {MATRIX.cols.map(([k, label, color]) => (
                  <div key={k} style={{ padding: '12px 6px', background: 'var(--input)', textAlign: 'center', font: '700 10px/1 var(--f-mono)', color }}>{label}</div>
                ))}
                {MATRIX.rows.map(([cap, vals]) => (
                  <div key={cap} style={{ display: 'contents' }}>
                    <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-3)', font: '600 12px/1.2 var(--f-body)', color: '#fff' }}>{cap}</div>
                    {vals.map((v, j) => (
                      <div key={j} style={{ padding: '12px 6px', borderTop: '1px solid var(--border-3)', textAlign: 'center' }}><Cell v={v} /></div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 16, font: '500 11px/1 var(--f-mono)', color: 'var(--text-42)' }}>
              <span style={{ color: 'var(--accent)' }}>✓ full</span>
              <span style={{ color: 'var(--warn)' }}>own = scoped to tree</span>
              <span>— none</span>
            </div>
          </Card>
        </div>
      )}

      <ReassignModal moving={moving} onClose={() => setMoving(null)} onPick={(engId) => {
        dispatch({ type: 'REASSIGN_SUP', supId: moving.id, engineerId: engId, actorId: actor })
        toast(`${moving.name.split(' ')[0]} re-assigned`, 'info'); setMoving(null)
      }} />
      <CreateUserModal open={create} onClose={() => setCreate(false)} />
      <EditUserModal key={edit?.id || 'none'} user={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function ReassignModal({ moving, onClose, onPick }) {
  const { engineers } = useSelectors()
  return (
    <Modal open={!!moving} onClose={onClose} width={380}>
      {moving && (
        <div style={{ padding: 22 }}>
          <div style={{ font: '700 16px/1 var(--f-body)', color: '#fff' }}>Re-assign {moving.name}</div>
          <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--text-42)', marginTop: 8 }}>Move this supervisor to a different engineer's tree. Their cash and history stay with them.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {engineers.map((e) => (
              <button key={e.id} onClick={() => onPick(e.id)} disabled={e.id === moving.engineerId} className="surface" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12, borderRadius: 11, cursor: e.id === moving.engineerId ? 'default' : 'pointer', opacity: e.id === moving.engineerId ? 0.5 : 1, textAlign: 'left' }}>
                <Monogram name={e.name} color="var(--info)" soft="var(--info-soft)" size={32} />
                <div style={{ font: '600 13px/1 var(--f-body)', color: '#fff', flex: 1 }}>{e.name}</div>
                {e.id === moving.engineerId && <span style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--text-40)' }}>CURRENT</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

function CreateUserModal({ open, onClose }) {
  const { state, dispatch, toast } = useStore()
  const { engineers, usernameTaken } = useSelectors()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('supervisor')
  const [engId, setEngId] = useState(engineers[0]?.id)
  const [siteId, setSiteId] = useState(state.sites[0]?.id)
  const [pw, setPw] = useState(genTemp())
  const [err, setErr] = useState('')

  const reset = () => { setName(''); setUsername(''); setPhone(''); setRole('supervisor'); setPw(genTemp()); setErr('') }

  const submit = () => {
    if (!name.trim() || !username.trim()) return setErr('Name and username are required.')
    if (usernameTaken(username)) return setErr('That username is already taken.')
    const payload = { name: name.trim(), username: username.trim().toLowerCase(), phone: phone.trim(), role, password: pw }
    if (role === 'supervisor') { payload.engineerId = engId; payload.siteId = siteId }
    dispatch({ type: 'CREATE_USER', payload, actorId: state.session.userId })
    toast(`Created @${payload.username} · temp password: ${pw}`, 'accent')
    reset(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={440}>
      <div style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span className="mono-badge" style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 15 }}>+</span>
          <div style={{ font: '700 16px/1 var(--f-body)', color: '#fff' }}>Create a login</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label className="field-label">Full name</label><input className="field" placeholder="e.g. Bilal Nawaz" value={name} onChange={(e) => { setName(e.target.value); setErr('') }} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="field-label">Username</label><input className="field" placeholder="e.g. bilal" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => { setUsername(e.target.value); setErr('') }} /></div>
            <div style={{ flex: 1 }}><label className="field-label">Phone (optional)</label><input className="field" placeholder="+92 …" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div>
            <label className="field-label">Role</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {CREATE_ROLES.map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)} className="btn btn-sm" style={{ flex: 1, textTransform: 'capitalize', fontSize: 12, background: role === r ? 'var(--accent)' : 'var(--input)', color: role === r ? 'var(--accent-ink)' : 'var(--text-70)', border: `1px solid ${role === r ? 'transparent' : 'var(--border)'}` }}>{r}</button>
              ))}
            </div>
          </div>
          {role === 'supervisor' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label">Reports to</label>
                <select className="field" value={engId} onChange={(e) => setEngId(e.target.value)}>
                  {engineers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Site</label>
                <select className="field" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                  {state.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          )}
          <div>
            <label className="field-label">Temporary password</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="field" value={pw} onChange={(e) => setPw(e.target.value)} style={{ font: '600 14px/1 var(--f-mono)' }} />
              <button type="button" className="btn btn-ghost btn-sm" style={{ height: 46 }} onClick={() => setPw(genTemp())}>↻</button>
            </div>
            <div style={{ font: '500 11px/1.4 var(--f-body)', color: 'var(--text-40)', marginTop: 7 }}>Share this with them once. They set their own password on first login.</div>
          </div>
        </div>
        {err && <div style={{ marginTop: 14, font: '600 12px/1.4 var(--f-body)', color: 'var(--danger)', background: 'var(--danger-soft)', borderRadius: 10, padding: '9px 12px' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={submit}>Create login</button>
        </div>
      </div>
    </Modal>
  )
}

function EditUserModal({ user, onClose }) {
  const { state, dispatch, toast } = useStore()
  const { engineers } = useSelectors()
  const [engId, setEngId] = useState(user?.engineerId)
  const [siteId, setSiteId] = useState(user?.siteId)

  const save = () => {
    const patch = {}
    if (user.role === 'supervisor') { patch.engineerId = engId; patch.siteId = siteId }
    dispatch({ type: 'UPDATE_USER', userId: user.id, patch, actorId: state.session.userId })
    toast(`${user.name.split(' ')[0]} updated`)
    onClose()
  }
  const toggleStatus = () => {
    const next = user.status === 'disabled' ? 'active' : 'disabled'
    dispatch({ type: 'UPDATE_USER', userId: user.id, patch: { status: next }, actorId: state.session.userId })
    toast(next === 'disabled' ? `${user.name.split(' ')[0]} disabled` : `${user.name.split(' ')[0]} re-enabled`, next === 'disabled' ? 'danger' : 'accent')
    onClose()
  }

  return (
    <Modal open={!!user} onClose={onClose} width={420}>
      {user && (
        <div style={{ padding: 24 }} key={user.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <Monogram name={user.name} color={ROLES[user.role].color} soft={ROLES[user.role].soft} size={40} />
            <div>
              <div style={{ font: '700 16px/1 var(--f-body)', color: '#fff' }}>{user.name}</div>
              <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--text-42)', marginTop: 4 }}>@{user.username} · {ROLES[user.role].label}</div>
            </div>
          </div>

          {user.role === 'supervisor' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="field-label">Reports to (engineer)</label>
                <select className="field" value={engId} onChange={(e) => setEngId(e.target.value)}>
                  {engineers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Assigned site</label>
                <select className="field" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                  {state.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--text-42)' }}>Office roles have no site/engineer wiring. You can enable or disable this login below.</div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button className="btn btn-danger" onClick={toggleStatus} style={{ flex: 1 }}>{user.status === 'disabled' ? 'Re-enable' : 'Disable'}</button>
            {user.role === 'supervisor' && <button className="btn btn-primary" style={{ flex: 1.3 }} onClick={save}>Save changes</button>}
          </div>
        </div>
      )}
    </Modal>
  )
}
