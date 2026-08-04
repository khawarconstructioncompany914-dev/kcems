import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, formatCompact, fmtDate, CATEGORIES, SITE_STATUS, STATUS } from '../../data/model.js'
import { Card } from '../../components/page.jsx'
import { Monogram, Progress, StatusPill, Modal } from '../../components/bits.jsx'

export default function SiteDetail() {
  const { id } = useParams()
  const { dispatch, toast } = useStore()
  const { state, me, siteById, userById, siteSpend, cashInHand, supervisors, expenseView, siteSchedule, progressHistory,
          canSeeVendors, vendorById, billBalance, vendorBillsForSite } = useSelectors()
  const [logging, setLogging] = useState(false)
  const site = siteById(id)
  if (!site) return <div style={{ color: 'var(--text-50)' }}>Site not found. <Link to="/sites">Back</Link></div>

  const sp = siteSpend(id)
  const eng = userById(site.engineerId)
  const sups = supervisors.filter((s) => s.siteId === id)
  const cats = ['materials', 'labour', 'fuel', 'tea_food'].map((k) => ({ k, val: sp.byCat[k] || 0 }))
  const sched = siteSchedule(site)
  const history = progressHistory(id)
  const siteBills = vendorBillsForSite(id)
  const pct = site.progress?.pct ?? 0
  // progress is never self-reported by the people being measured: a head
  // engineer may log it for their own sites, the office for any
  const canLogProgress = me.role === 'owner' || me.role === 'admin' || (me.role === 'engineer' && site.engineerId === me.id)
  const maxCat = Math.max(1, ...cats.map((c) => c.val))
  const recent = state.expenses.filter((e) => e.siteId === id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5).map(expenseView)

  return (
    <div className="fade-up">
      <Link to="/sites" className="tap" style={{ font: '600 12px/1 var(--f-body)', color: 'var(--text-50)' }}>‹ Sites</Link>

      <div className="r-grid" style={{ '--r-cols': '1.1fr .9fr', alignItems: 'start', marginTop: 16 }}>
        {/* left: budget + categories */}
        <Card pad={26}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <span className="mono-badge" style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)', fontSize: 16 }}>{site.label.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '700 20px/1 var(--f-display)', color: 'var(--text)' }}>{site.name}</div>
              <div style={{ font: '500 12px/1.3 var(--f-mono)', color: 'var(--text-42)', marginTop: 7 }}>{site.city} · {site.phase} · {eng?.name} (eng)</div>
            </div>
            <span className={`pill ${SITE_STATUS[site.status].pill}`}><span className="dot" />{SITE_STATUS[site.status].label.toUpperCase()}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 22 }}>
            {[['BUDGET', formatCompact(sp.budget), 'var(--text)'], ['SPENT', formatCompact(sp.total), 'var(--text)'], ['REMAINING', formatCompact(sp.remaining), 'var(--accent)']].map(([l, v, c]) => (
              <div key={l} className="surface" style={{ padding: 14, borderRadius: 13 }}>
                <div style={{ font: '600 9px/1 var(--f-mono)', color: 'var(--text-40)' }}>{l}</div>
                <div className="num" style={{ font: '700 20px/1 var(--f-display)', color: c, marginTop: 9 }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 12px/1.4 var(--f-body)', color: 'var(--text-50)', marginBottom: 8 }}><span>Budget used</span><span style={{ color: 'var(--accent)' }}>{sp.pct}%</span></div>
            <Progress pct={sp.pct} />
          </div>

          {/* ---------- construction progress ---------- */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '26px 0 14px' }}>
            <div style={{ font: '700 13px/1 var(--f-body)', color: 'var(--text)' }}>Construction progress</div>
            {sched && (
              <span className={`pill ${sched.behind || sched.overdue ? 'pill-rejected' : 'pill-approved'}`} style={{ height: 22, fontSize: 10 }}>
                <span className="dot" />{sched.overdue ? 'OVERDUE' : sched.behind ? 'BEHIND SCHEDULE' : 'ON TRACK'}
              </span>
            )}
            <div className="spacer" />
            {canLogProgress && <button className="btn btn-ghost btn-sm" onClick={() => setLogging(true)}>+ Log progress</button>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 12px/1.4 var(--f-body)', color: 'var(--text-50)', marginBottom: 8 }}>
            <span>{site.progress ? `Last logged ${fmtDate(site.progress.loggedAt)}` : 'Not logged yet'}</span>
            <span style={{ color: 'var(--accent)' }}>{pct}%</span>
          </div>
          <Progress pct={pct} />

          {sched ? (
            <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--text-50)', marginTop: 9 }}>
              {/* say what the comparison assumes rather than quietly implying precision */}
              About {sched.pctExpected}% expected by today if work ran evenly from {fmtDate(site.startDate)} to {fmtDate(site.targetFinishDate)}
              {sched.overdue
                ? <> · <b style={{ color: 'var(--danger)' }}>target date passed</b></>
                : <> · {sched.daysLeft} day{sched.daysLeft === 1 ? '' : 's'} left</>}.
              {' '}Even pace is a rough guide, not a schedule.
            </div>
          ) : (
            <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--text-50)', marginTop: 9 }}>
              Add a start date and target finish in <b style={{ color: 'var(--text-70)' }}>Users &amp; access → Sites</b> to compare this against a deadline.
            </div>
          )}

          {history.length > 0 && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--border-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {history.slice(0, 4).map((h) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, font: '500 12px/1.4 var(--f-body)', color: 'var(--text-70)' }}>
                  <span className="num" style={{ font: '700 12px/1.4 var(--f-display)', color: 'var(--accent)', width: 38 }}>{h.pct}%</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{h.note || <span style={{ color: 'var(--text-50)' }}>no note</span>}</span>
                  <span style={{ flex: 'none', color: 'var(--text-50)' }}>{fmtDate(h.loggedAt)} · {userById(h.loggedBy)?.name.split(' ')[0] || '—'}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ font: '700 13px/1 var(--f-body)', color: 'var(--text)', margin: '24px 0 14px' }}>Spend by category</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cats.map(({ k, val }) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 70, font: '500 12px/1.4 var(--f-mono)', color: 'var(--text-50)' }}>{CATEGORIES[k].label}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 5, background: 'var(--surface)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((val / maxCat) * 100)}%`, height: '100%', background: CATEGORIES[k].color, transition: 'width .5s' }} />
                </div>
                <span className="num" style={{ width: 74, textAlign: 'right', font: '700 11px/1 var(--f-display)', color: 'var(--text)' }}>{formatCompact(val)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* right: supervisors + recent */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card pad={22}>
            <div style={{ font: '700 14px/1 var(--f-body)', color: 'var(--text)', marginBottom: 14 }}>On this site</div>
            {sups.length === 0 && <div style={{ font: '500 12px/1 var(--f-body)', color: 'var(--text-40)' }}>No site engineer assigned.</div>}
            {sups.map((s) => {
              const bal = cashInHand(s.id)
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 11, paddingTop: 4 }}>
                  <Monogram name={s.name} color="var(--accent)" soft="var(--accent-soft)" size={34} radius={17} />
                  <div style={{ font: '500 12px/1.3 var(--f-body)', color: 'var(--text-70)', flex: 1 }}>{s.name} · <b style={{ color: 'var(--text)' }}>{formatMoney(bal.cash)}</b> cash in hand</div>
                  <Link to={`/people/${s.id}`} className="tap" style={{ font: '600 12px/1 var(--f-body)' }}>Ledger →</Link>
                </div>
              )
            })}
          </Card>

          {/* Sub-contractors on this site. Read-only — assigning them and
              recording contracts lives on /vendors, which finance cannot reach
              at all, so this only renders for the roles that are shown them. */}
          {canSeeVendors() && siteBills.length > 0 && (
            <Card pad={22}>
              <div style={{ font: '700 14px/1 var(--f-body)', color: 'var(--text)', marginBottom: 12 }}>Sub-contractors</div>
              {siteBills.map((b) => {
                const { paid, balance } = billBalance(b)
                return (
                  <div key={b.id} style={{ padding: '11px 0', borderTop: '1px solid var(--border-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: '600 12.5px/1.3 var(--f-body)', color: 'var(--text)' }}>{vendorById(b.vendorId)?.name}</div>
                        <div style={{ font: '500 11.5px/1.4 var(--f-body)', color: 'var(--text-50)', marginTop: 2 }}>{b.title}</div>
                      </div>
                      <div className="num" style={{ font: '700 12.5px/1 var(--f-display)', color: balance > 0 ? 'var(--warn)' : 'var(--accent)' }}>
                        {balance > 0 ? formatCompact(balance) : 'settled'}
                      </div>
                    </div>
                    <div style={{ marginTop: 7 }}>
                      <Progress pct={b.contractedAmount ? Math.min(100, Math.round((paid / b.contractedAmount) * 100)) : 0} height={6} />
                    </div>
                  </div>
                )
              })}
            </Card>
          )}

          <Card pad={22}>
            <div style={{ font: '700 14px/1 var(--f-body)', color: 'var(--text)', marginBottom: 12 }}>Recent expenses</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recent.map((e) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderTop: '1px solid var(--border-3)' }}>
                  <span style={{ width: 6, height: 30, borderRadius: 3, background: STATUS[e.status].color, flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 12px/1.2 var(--f-body)', color: 'var(--text)' }}>{e.note}</div>
                    <div style={{ font: '500 10px/1 var(--f-mono)', color: STATUS[e.status].color, marginTop: 4 }}>{STATUS[e.status].short} · {fmtDate(e.createdAt)}</div>
                  </div>
                  <div className="num" style={{ font: '700 13px/1 var(--f-display)', color: 'var(--text)' }}>{formatMoney(e.amount).replace('Rs ', '')}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <LogProgressModal
        open={logging} site={site} current={pct}
        onClose={() => setLogging(false)}
        onSubmit={({ pct: next, note }) => {
          dispatch({ type: 'LOG_PROGRESS', payload: { siteId: site.id, pct: next, note }, actorId: me.id })
          toast(`${site.label || site.name} at ${next}%`)
          setLogging(false)
        }}
      />
    </div>
  )
}

// Slider plus a number box: the slider is quick, the box is exact, and a
// percentage is the kind of value people want to type rather than drag to.
function LogProgressModal({ open, site, current, onClose, onSubmit }) {
  const [pct, setPct] = useState(current)
  const [note, setNote] = useState('')
  const [seen, setSeen] = useState(open)
  if (open !== seen) { setSeen(open); if (open) { setPct(current); setNote('') } }
  if (!open) return null

  const delta = pct - current
  return (
    <Modal open onClose={onClose} width={420}>
      <div style={{ padding: 22 }}>
        <div style={{ font: '700 16px/1 var(--f-body)', color: 'var(--text)' }}>Log progress</div>
        <div style={{ font: '500 12.5px/1.5 var(--f-body)', color: 'var(--text-70)', marginTop: 8 }}>
          {site.name} — currently {current}%.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 20 }}>
          <input type="range" min="0" max="100" value={pct} onChange={(e) => setPct(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)' }} aria-label="Percent complete" />
          <input className="field" type="number" min="0" max="100" value={pct}
            onChange={(e) => setPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            style={{ width: 84, textAlign: 'center', font: '700 16px/1 var(--f-display)' }} />
        </div>
        <div style={{ marginTop: 12 }}><Progress pct={pct} /></div>
        {delta !== 0 && (
          <div style={{ font: '500 12px/1.4 var(--f-body)', color: delta > 0 ? 'var(--accent)' : 'var(--warn)', marginTop: 8 }}>
            {delta > 0 ? `+${delta} points since the last update` : `${delta} points — this moves the site backwards`}
          </div>
        )}

        <label className="field-label" style={{ marginTop: 16 }}>Note (optional)</label>
        <input className="field" placeholder="e.g. Slab poured on block B" value={note} onChange={(e) => setNote(e.target.value)} />

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={() => onSubmit({ pct, note: note.trim() })}>Save {pct}%</button>
        </div>
      </div>
    </Modal>
  )
}
