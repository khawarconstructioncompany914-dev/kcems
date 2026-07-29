import { useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { ROLES, SITE_STATUS, roleEyebrow } from '../../data/model.js'
import { PageHeader, Card } from '../../components/page.jsx'
import { Monogram, Modal } from '../../components/bits.jsx'

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
  const [siteEdit, setSiteEdit] = useState(null)

  const users = state.users
  const actor = state.session.userId

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow={roleEyebrow(me.role, 'users & access')}
        title="Users & access"
        sub="Create logins, wire supervisors to engineers and sites, reset passwords, and review who can do what."
        right={<button className="btn btn-primary" onClick={() => setCreate(true)}>+ Create login</button>}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[['users', `Users · ${users.length}`], ['sites', `Sites · ${state.sites.length}`], ['access', 'Wiring & permissions']].map(([k, label]) => (
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
                    <div style={{ font: '700 14px/1.3 var(--f-body)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                  {/* This line is the person's sign-in name. It used to read
                      "@meesamali" in a monospace face at 4.06:1 — developer
                      shorthand, in the least legible font at the smallest size,
                      for an audience of site staff. Now it says what it is, in
                      the body font. */}
                  <div style={{ font: '500 13px/1.45 var(--f-body)', color: 'var(--text-70)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: 'var(--text-40)' }}>Login · </span>{u.username}
                      {u.mustChangePassword && <span style={{ color: 'var(--warn)' }}> · temporary password</span>}
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1.4 }}><RolePill role={u.role} /></div>
                <div style={{ flex: 2, font: '500 12px/1.45 var(--f-mono)', color: 'var(--text-70)' }}>
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

      {/* ---------------- SITES ---------------- */}
      {tab === 'sites' && (
        <Card pad={0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--border-3)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ font: '700 14px/1 var(--f-body)', color: '#fff' }}>Construction sites</div>
              <div style={{ font: '500 11px/1.4 var(--f-body)', color: 'var(--text-42)', marginTop: 5 }}>Add your real sites here, then assign each supervisor to one from the Users tab.</div>
            </div>
            <div className="spacer" />
            <button className="btn btn-primary btn-sm" onClick={() => setSiteEdit({})}>+ Add site</button>
          </div>
          {state.sites.length === 0 && (
            <div style={{ padding: '28px 22px', textAlign: 'center', font: '500 13px/1.5 var(--f-body)', color: 'var(--text-40)' }}>No sites yet — add your first one.</div>
          )}
          {state.sites.map((s) => {
            const eng = userById(s.engineerId)
            const sups = supervisors.filter((u) => u.siteId === s.id).length
            const st = SITE_STATUS[s.status] || SITE_STATUS.active
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px', borderTop: '1px solid var(--border-3)', flexWrap: 'wrap' }}>
                <span className="mono-badge" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)', fontSize: 12 }}>
                  {String(s.label || s.name).replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ font: '700 13px/1.2 var(--f-body)', color: '#fff' }}>{s.name}</div>
                  <div style={{ font: '500 11px/1.3 var(--f-mono)', color: 'var(--text-42)', marginTop: 4 }}>
                    {[s.city, s.phase].filter(Boolean).join(' · ') || '—'} · {sups} supervisor{sups !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--text-50)', minWidth: 96 }}>{eng ? eng.name.split(' ')[0] : 'no engineer'}</div>
                <span className={`pill ${st.pill}`} style={{ height: 22, fontSize: 10 }}>{st.label}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setSiteEdit(s)}>Edit</button>
              </div>
            )
          })}
        </Card>
      )}

      {/* ---------------- WIRING & PERMISSIONS ---------------- */}
      {tab === 'access' && (
        <div>
          {/* the read-only permission matrix that used to sit beside this was
              removed — it documented the rules rather than doing anything, and
              the reporting tree now has the full width */}
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
                          {/* a supervisor with no site would otherwise render a dangling "·" */}
                          {s.name.split(' ')[0]}
                          {s.siteId
                            ? <> · {siteById(s.siteId)?.label || siteById(s.siteId)?.name}</>
                            : <span style={{ color: 'var(--warn)' }}> · no site</span>}
                        </button>
                      ))}
                      {sups.length === 0 && <span style={{ font: '500 12px/1 var(--f-mono)', color: 'var(--text-40)' }}>none wired</span>}
                    </div>
                  </div>
                )
              })}
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
      <SiteModal key={siteEdit?.id || 'new-site'} site={siteEdit} onClose={() => setSiteEdit(null)} />
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

function SiteModal({ site, onClose }) {
  const { state, dispatch, toast } = useStore()
  const { engineers, supervisors, siteById } = useSelectors()
  const isNew = !site?.id
  // who is already on this site — the starting state of the checkboxes
  const [supIds, setSupIds] = useState(() => new Set(
    site?.id ? supervisors.filter((u) => u.siteId === site.id).map((u) => u.id) : [],
  ))
  const toggleSup = (id) => setSupIds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const [name, setName] = useState(site?.name || '')
  const [label, setLabel] = useState(site?.label || '')
  const [city, setCity] = useState(site?.city || '')
  const [phase, setPhase] = useState(site?.phase || '')
  const [engId, setEngId] = useState(site?.engineerId || '')
  const [budget, setBudget] = useState(site?.budget ? String(site.budget) : '')
  const [status, setStatus] = useState(site?.status || 'active')

  const submit = () => {
    if (!name.trim()) return
    const payload = {
      name: name.trim(),
      label: (label || name).trim().slice(0, 14),
      city: city.trim(),
      phase: phase.trim(),
      engineerId: engId || null,
      budget: Math.round(Number(String(budget).replace(/[^\d]/g, '')) || 0),
      status,
      supervisorIds: [...supIds],
    }
    if (isNew) dispatch({ type: 'CREATE_SITE', payload, actorId: state.session.userId })
    else dispatch({ type: 'UPDATE_SITE', siteId: site.id, patch: payload, actorId: state.session.userId })
    const n = supIds.size
    toast(isNew
      ? `Site “${payload.name}” created${n ? ` · ${n} supervisor${n > 1 ? 's' : ''} assigned` : ''}`
      : `${payload.name} updated${n ? ` · ${n} supervisor${n > 1 ? 's' : ''} on site` : ''}`)
    onClose()
  }

  return (
    <Modal open={!!site} onClose={onClose} width={440}>
      {site && (
        <div style={{ padding: 26 }}>
          <div style={{ font: '700 16px/1 var(--f-body)', color: '#fff', marginBottom: 18 }}>{isNew ? 'Add a site' : 'Edit site'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label className="field-label">Site name</label><input className="field" placeholder="e.g. DHA Phase 6" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><label className="field-label">Short label</label><input className="field" placeholder="e.g. DHA 6" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
              <div style={{ flex: 1 }}><label className="field-label">City</label><input className="field" placeholder="e.g. Multan" value={city} onChange={(e) => setCity(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><label className="field-label">Phase</label><input className="field" placeholder="e.g. Grey structure" value={phase} onChange={(e) => setPhase(e.target.value)} /></div>
              <div style={{ flex: 1 }}><label className="field-label">Budget (PKR)</label><input className="field" inputMode="numeric" placeholder="e.g. 2400000" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label">Responsible engineer</label>
                <select className="field" value={engId} onChange={(e) => setEngId(e.target.value)}>
                  <option value="">— none —</option>
                  {engineers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Status</label>
                <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="on_hold">On hold</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {/* Assigning the crew here is what makes a new site complete in one
                pass — site, engineer, supervisors — instead of creating the
                site and then editing every supervisor individually. */}
            <div>
              <label className="field-label">
                Site supervisors {supIds.size > 0 && <span style={{ color: 'var(--accent)' }}>· {supIds.size} selected</span>}
              </label>
              {supervisors.length === 0
                ? <div style={{ font: '500 11px/1.4 var(--f-body)', color: 'var(--warn)' }}>No supervisors exist yet — create them in the Users tab.</div>
                : (
                  <div className="surface" style={{ maxHeight: 176, overflowY: 'auto', borderRadius: 11, padding: 6 }}>
                    {supervisors.map((s) => {
                      const on = supIds.has(s.id)
                      const their = s.siteId ? siteById(s.siteId) : null
                      const elsewhere = s.siteId && s.siteId !== site?.id
                      return (
                        <label key={s.id} className="tap" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', background: on ? 'var(--accent-soft)' : 'transparent' }}>
                          <input type="checkbox" checked={on} onChange={() => toggleSup(s.id)} style={{ width: 15, height: 15, accentColor: 'var(--accent)', flex: 'none' }} />
                          <span style={{ flex: 1, minWidth: 0, font: '600 12px/1.2 var(--f-body)', color: on ? '#fff' : 'var(--text-70)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                          <span style={{ flex: 'none', font: '500 10px/1 var(--f-mono)', color: elsewhere ? 'var(--warn)' : 'var(--text-40)' }}>
                            {elsewhere ? `on ${their?.label || their?.name}` : s.siteId ? 'here' : 'unassigned'}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              <div style={{ font: '500 11px/1.4 var(--f-body)', color: 'var(--text-40)', marginTop: 6 }}>
                {engId
                  ? <>Checked supervisors move to this site and report to <b style={{ color: 'var(--text-70)' }}>{engineers.find((e) => e.id === engId)?.name}</b>.</>
                  : 'Checked supervisors move to this site. Pick a responsible engineer above and they will be filed under them too.'}
                {' '}Anyone in amber is currently on another site and will be moved.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={!name.trim()} onClick={submit}>{isNew ? 'Create site' : 'Save changes'}</button>
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
                <select className="field" value={engId || ''} onChange={(e) => setEngId(e.target.value)}>
                  <option value="">— Not assigned —</option>
                  {engineers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                {/* same empty option as the edit modal: a new supervisor can
                    legitimately exist before their site does */}
                <label className="field-label">Site</label>
                <select className="field" value={siteId || ''} onChange={(e) => setSiteId(e.target.value)}>
                  <option value="">— Not assigned —</option>
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
  const { engineers, usernameTaken } = useSelectors()
  const [engId, setEngId] = useState(user?.engineerId)
  const [siteId, setSiteId] = useState(user?.siteId)
  const [name, setName] = useState(user?.name || '')
  const [username, setUsername] = useState(user?.username || '')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  const save = async () => {
    const cleanUser = String(username).trim().toLowerCase().replace(/\s+/g, '')
    if (!name.trim()) return setErr('Name cannot be empty.')
    if (!cleanUser) return setErr('Username cannot be empty.')
    if (usernameTaken(cleanUser, user.id)) return setErr('That username is already taken.')
    if (pw && pw.length < 4) return setErr('Password must be at least 4 characters.')

    const patch = { name: name.trim(), username: cleanUser }
    // '' comes from the "— Not assigned —" option; the columns are uuid, so it
    // has to reach the API as null rather than an empty string.
    if (user.role === 'supervisor') { patch.engineerId = engId || null; patch.siteId = siteId || null }
    const res = await dispatch({ type: 'UPDATE_USER', userId: user.id, patch, actorId: state.session.userId })
    if (res && res.status === 409) return setErr('That username is already taken.')
    // Anything else that failed used to fall straight through to the success
    // toast, so a rejected write looked identical to a saved one.
    if (res && res.status >= 400) return setErr(`Could not save: ${res.body?.error || `server returned ${res.status}`}`)
    if (pw) {
      const pwRes = await dispatch({ type: 'SET_PASSWORD', userId: user.id, password: pw, actorId: state.session.userId })
      if (pwRes && pwRes.status >= 400) return setErr(`Details saved, but the password did not change: ${pwRes.body?.error || pwRes.status}`)
    }
    toast(`${name.trim().split(' ')[0]} updated`)
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
              <div style={{ font: '500 12.5px/1.45 var(--f-body)', color: 'var(--text-70)', marginTop: 4 }}>
                <span style={{ color: 'var(--text-40)' }}>Login · </span>{user.username} · {ROLES[user.role].label}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label className="field-label">Full name</label><input className="field" value={name} onChange={(e) => { setName(e.target.value); setErr('') }} /></div>
            <div>
              <label className="field-label">Username</label>
              <input className="field" value={username} autoCapitalize="none" spellCheck={false} onChange={(e) => { setUsername(e.target.value); setErr('') }} />
              <div style={{ font: '500 11px/1.4 var(--f-body)', color: 'var(--text-40)', marginTop: 6 }}>They can also sign in by typing their full name.</div>
            </div>
            <div>
              <label className="field-label">New password (leave blank to keep)</label>
              <input className="field" value={pw} autoComplete="new-password" onChange={(e) => { setPw(e.target.value); setErr('') }} placeholder="••••••••" />
            </div>

            {/* Both selects need an explicit empty option. Without one, a
                supervisor with no site set value="" against a list where
                nothing matches, and the browser falls back to showing the
                FIRST site — so the dropdown claimed they were on DHA Phase 6
                while the state was still null. Worse, picking that same site
                fired no change event, so the assignment silently saved as
                null and the admin was told it worked. */}
            {user.role === 'supervisor' && (
              <>
                <div>
                  <label className="field-label">Reports to (engineer)</label>
                  <select className="field" value={engId || ''} onChange={(e) => setEngId(e.target.value)}>
                    <option value="">— Not assigned —</option>
                    {engineers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Assigned site</label>
                  <select className="field" value={siteId || ''} onChange={(e) => setSiteId(e.target.value)}>
                    <option value="">— Not assigned —</option>
                    {state.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {!state.sites.length && <div style={{ font: '500 11px/1.4 var(--f-body)', color: 'var(--warn)', marginTop: 6 }}>No sites exist yet — create one in the Sites tab first.</div>}
                </div>
              </>
            )}
          </div>

          {err && <div style={{ marginTop: 14, font: '600 12px/1.4 var(--f-body)', color: 'var(--danger)', background: 'var(--danger-soft)', borderRadius: 10, padding: '9px 12px' }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button className="btn btn-danger" onClick={toggleStatus} style={{ flex: 1 }}>{user.status === 'disabled' ? 'Re-enable' : 'Disable'}</button>
            <button className="btn btn-primary" style={{ flex: 1.3 }} onClick={save}>Save changes</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
