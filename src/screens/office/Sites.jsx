import { Link } from 'react-router-dom'
import { useSelectors } from '../../store.jsx'
import { formatCompact, SITE_STATUS } from '../../data/model.js'
import { PageHeader } from '../../components/page.jsx'
import { Progress } from '../../components/bits.jsx'

export default function Sites() {
  const { me, scopedSites, siteSpend, userById, siteSchedule, supervisors } = useSelectors()
  const sites = scopedSites(me)

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Sites"
        title="Construction sites"
        sub={me.role === 'engineer' ? 'The sites wired under you. Budget, spend and remaining update as expenses are approved.' : 'Every active project. Budget, spend and remaining update live as expenses are approved.'}
      />

      <div className="r-cards" style={{ '--r-min': '360px', gap: 16 }}>
        {sites.map((s) => {
          const sp = siteSpend(s.id)
          const eng = userById(s.engineerId)
          const sched = siteSchedule(s)
          const built = s.progress?.pct ?? 0
          const crew = supervisors.filter((u) => u.siteId === s.id)
          return (
            <Link key={s.id} to={`/sites/${s.id}`} className="card" style={{ padding: 22, textDecoration: 'none', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
                <span className="mono-badge" style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)', fontSize: 15 }}>{s.label.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 17px/1.1 var(--f-display)', color: '#fff' }}>{s.name}</div>
                  <div style={{ font: '500 12px/1.4 var(--f-mono)', color: 'var(--text-42)', marginTop: 6 }}>{s.city} · {s.phase} · {eng?.name.split(' ')[0]}</div>
                </div>
                <span className={`pill ${SITE_STATUS[s.status].pill}`} style={{ height: 24, fontSize: 10 }}><span className="dot" />{SITE_STATUS[s.status].label}</span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                {[['BUDGET', formatCompact(sp.budget), '#fff'], ['SPENT', formatCompact(sp.total), '#fff'], ['REMAINING', formatCompact(sp.remaining), 'var(--accent)']].map(([l, v, c]) => (
                  <div key={l} className="surface" style={{ flex: 1, padding: '11px 12px', borderRadius: 11 }}>
                    <div style={{ font: '600 9px/1 var(--f-mono)', color: 'var(--text-40)' }}>{l}</div>
                    <div className="num" style={{ font: '700 16px/1 var(--f-display)', color: c, marginTop: 7 }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 12px/1.4 var(--f-body)', color: 'var(--text-50)', marginBottom: 8 }}><span>Budget used</span><span style={{ color: 'var(--accent)' }}>{sp.pct}%</span></div>
                <Progress pct={sp.pct} />
              </div>

              {/* Construction progress next to budget, because the pair is the
                  actual question: how much is built for how much is spent. */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', font: '600 12px/1.4 var(--f-body)', color: 'var(--text-50)', marginBottom: 8 }}>
                  <span>Built{sched && (sched.overdue || sched.behind) && <span style={{ color: 'var(--danger)' }}> · {sched.overdue ? 'overdue' : 'behind'}</span>}</span>
                  <span style={{ color: s.progress ? 'var(--info)' : 'var(--text-40)' }}>{s.progress ? `${built}%` : 'not logged'}</span>
                </div>
                <Progress pct={built} color="var(--info)" />
              </div>

              {/* who is on this site — the site-first view of the wiring */}
              <div style={{ marginTop: 14, font: '500 12px/1.5 var(--f-body)', color: 'var(--text-70)' }}>
                <span style={{ color: 'var(--text-40)' }}>Crew · </span>
                {crew.length
                  ? crew.map((c) => c.name).join(', ')
                  : <span style={{ color: 'var(--warn)' }}>no site engineers assigned</span>}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
