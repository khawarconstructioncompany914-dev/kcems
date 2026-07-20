import { Link } from 'react-router-dom'
import { useSelectors } from '../../store.jsx'
import { formatMoney, formatCompact, fmtDate, relDay, STATUS, SITE_STATUS } from '../../data/model.js'
import { PageHeader, Kpi, Card } from '../../components/page.jsx'
import { Monogram, StatusPill, Progress } from '../../components/bits.jsx'

export default function Dashboard() {
  const { me, state, siteSpend, supervisors, cashInHand, owedBack, expenseView } = useSelectors()
  const sites = state.sites

  const totals = sites.reduce((a, s) => {
    const sp = siteSpend(s.id)
    a.budget += sp.budget; a.spent += sp.total
    return a
  }, { budget: 0, spent: 0 })
  const pending = state.expenses.filter((e) => e.status === 'finance_review').length
  const inReview = state.expenses.filter((e) => e.status === 'engineer_review').length
  const owedAll = supervisors.reduce((a, s) => a + owedBack(s.id), 0)
  const cashDeployed = supervisors.reduce((a, s) => a + cashInHand(s.id).cash, 0)

  const recent = [...state.expenses]
    .sort((a, b) => new Date(b.decidedAt || b.createdAt) - new Date(a.decidedAt || a.createdAt))
    .slice(0, 6).map(expenseView)

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Owner · overview"
        title={`Good day, ${me.name.split(' ')[0]}`}
        sub="The whole organisation at a glance — every site, every rupee, the approval pipeline and cash in the field."
        right={<Link to="/reports" className="btn btn-ghost">Reports →</Link>}
      />

      <div style={{ display: 'flex', gap: 14, marginBottom: 26, flexWrap: 'wrap' }}>
        <Kpi label="Total budget" value={formatCompact(totals.budget)} sub={`${sites.length} sites`} accent />
        <Kpi label="Spent to date" value={formatCompact(totals.spent)} sub={`${Math.round((totals.spent / totals.budget) * 100)}% of budget`} />
        <Kpi label="Cash in field" value={formatCompact(cashDeployed)} sub={`${supervisors.length} supervisors`} />
        <Kpi label="Awaiting approval" value={pending} sub={`${inReview} in engineer review`} color={pending ? 'var(--warn)' : '#fff'} />
        <Kpi label="Owed back" value={formatMoney(owedAll)} sub="rejected · unsettled" color={owedAll ? 'var(--danger)' : '#fff'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* sites */}
        <Card pad={22}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ font: '700 15px/1 var(--f-body)', color: '#fff' }}>Sites</div>
            <Link to="/sites" style={{ marginLeft: 'auto', font: '600 12px/1 var(--f-body)' }}>All sites →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sites.map((s) => {
              const sp = siteSpend(s.id)
              return (
                <Link key={s.id} to={`/sites/${s.id}`} className="surface" style={{ display: 'block', padding: 15, borderRadius: 13, textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span className="mono-badge" style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)', fontSize: 13 }}>{s.label.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '700 14px/1 var(--f-body)', color: '#fff' }}>{s.name}</div>
                      <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--text-42)', marginTop: 5 }}>{s.city} · {s.phase}</div>
                    </div>
                    <span className={`pill ${SITE_STATUS[s.status].pill}`} style={{ height: 22, fontSize: 10 }}><span className="dot" />{SITE_STATUS[s.status].label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                    <div style={{ flex: 1 }}><Progress pct={sp.pct} height={7} /></div>
                    <div className="num" style={{ font: '600 12px/1 var(--f-display)', color: 'var(--text-70)', whiteSpace: 'nowrap' }}>{formatCompact(sp.total)} <span style={{ color: 'var(--text-40)' }}>/ {formatCompact(sp.budget)}</span></div>
                  </div>
                </Link>
              )
            })}
          </div>
        </Card>

        {/* recent activity */}
        <Card pad={22}>
          <div style={{ font: '700 15px/1 var(--f-body)', color: '#fff', marginBottom: 16 }}>Recent activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {recent.map((e) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid var(--border-3)' }}>
                <Monogram name={e.supervisor?.name} color={STATUS[e.status].color} soft="var(--surface)" size={32} radius={9} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 12px/1.2 var(--f-body)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.note}</div>
                  <div style={{ font: '500 10px/1 var(--f-mono)', color: STATUS[e.status].color, marginTop: 4 }}>{STATUS[e.status].short} · {e.site?.label} · {relDay(e.decidedAt || e.createdAt)}</div>
                </div>
                <div className="num" style={{ font: '700 13px/1 var(--f-display)', color: '#fff' }}>{formatMoney(e.amount).replace('Rs ', '')}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
