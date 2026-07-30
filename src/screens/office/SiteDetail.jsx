import { useParams, Link } from 'react-router-dom'
import { useSelectors } from '../../store.jsx'
import { formatMoney, formatCompact, fmtDate, CATEGORIES, SITE_STATUS, STATUS } from '../../data/model.js'
import { Card } from '../../components/page.jsx'
import { Monogram, Progress, StatusPill } from '../../components/bits.jsx'

export default function SiteDetail() {
  const { id } = useParams()
  const { state, siteById, userById, siteSpend, cashInHand, supervisors, expenseView } = useSelectors()
  const site = siteById(id)
  if (!site) return <div style={{ color: 'var(--text-50)' }}>Site not found. <Link to="/sites">Back</Link></div>

  const sp = siteSpend(id)
  const eng = userById(site.engineerId)
  const sups = supervisors.filter((s) => s.siteId === id)
  const cats = ['materials', 'labour', 'fuel', 'tea_food'].map((k) => ({ k, val: sp.byCat[k] || 0 }))
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
              <div style={{ font: '700 20px/1 var(--f-display)', color: '#fff' }}>{site.name}</div>
              <div style={{ font: '500 12px/1.3 var(--f-mono)', color: 'var(--text-42)', marginTop: 7 }}>{site.city} · {site.phase} · {eng?.name} (eng)</div>
            </div>
            <span className={`pill ${SITE_STATUS[site.status].pill}`}><span className="dot" />{SITE_STATUS[site.status].label.toUpperCase()}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 22 }}>
            {[['BUDGET', formatCompact(sp.budget), '#fff'], ['SPENT', formatCompact(sp.total), '#fff'], ['REMAINING', formatCompact(sp.remaining), 'var(--accent)']].map(([l, v, c]) => (
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

          <div style={{ font: '700 13px/1 var(--f-body)', color: '#fff', margin: '24px 0 14px' }}>Spend by category</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cats.map(({ k, val }) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 70, font: '500 12px/1.4 var(--f-mono)', color: 'var(--text-50)' }}>{CATEGORIES[k].label}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 5, background: 'var(--surface)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((val / maxCat) * 100)}%`, height: '100%', background: CATEGORIES[k].color, transition: 'width .5s' }} />
                </div>
                <span className="num" style={{ width: 74, textAlign: 'right', font: '700 11px/1 var(--f-display)', color: '#fff' }}>{formatCompact(val)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* right: supervisors + recent */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card pad={22}>
            <div style={{ font: '700 14px/1 var(--f-body)', color: '#fff', marginBottom: 14 }}>On this site</div>
            {sups.length === 0 && <div style={{ font: '500 12px/1 var(--f-body)', color: 'var(--text-40)' }}>No site engineer assigned.</div>}
            {sups.map((s) => {
              const bal = cashInHand(s.id)
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 11, paddingTop: 4 }}>
                  <Monogram name={s.name} color="var(--accent)" soft="var(--accent-soft)" size={34} radius={17} />
                  <div style={{ font: '500 12px/1.3 var(--f-body)', color: 'var(--text-70)', flex: 1 }}>{s.name} · <b style={{ color: '#fff' }}>{formatMoney(bal.cash)}</b> cash in hand</div>
                  <Link to={`/people/${s.id}`} className="tap" style={{ font: '600 12px/1 var(--f-body)' }}>Ledger →</Link>
                </div>
              )
            })}
          </Card>

          <Card pad={22}>
            <div style={{ font: '700 14px/1 var(--f-body)', color: '#fff', marginBottom: 12 }}>Recent expenses</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recent.map((e) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderTop: '1px solid var(--border-3)' }}>
                  <span style={{ width: 6, height: 30, borderRadius: 3, background: STATUS[e.status].color, flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 12px/1.2 var(--f-body)', color: '#fff' }}>{e.note}</div>
                    <div style={{ font: '500 10px/1 var(--f-mono)', color: STATUS[e.status].color, marginTop: 4 }}>{STATUS[e.status].short} · {fmtDate(e.createdAt)}</div>
                  </div>
                  <div className="num" style={{ font: '700 13px/1 var(--f-display)', color: '#fff' }}>{formatMoney(e.amount).replace('Rs ', '')}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
