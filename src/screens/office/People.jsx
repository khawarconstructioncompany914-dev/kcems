import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelectors } from '../../store.jsx'
import { formatMoney, formatCompact } from '../../data/model.js'
import { PageHeader, Kpi } from '../../components/page.jsx'
import { Monogram, Progress } from '../../components/bits.jsx'
import { AddFundsModal } from '../../components/funds.jsx'

export default function People() {
  const { me, supervisors, supsForEngineer, userById, siteById, cashInHand, owedBack, pendingTotal } = useSelectors()
  const [funds, setFunds] = useState(false)

  const list = me.role === 'engineer' ? supsForEngineer(me.id) : supervisors
  const canFund = me.role === 'owner' || me.role === 'finance'
  const totalCash = list.reduce((a, s) => a + cashInHand(s.id).cash, 0)
  const totalOwed = list.reduce((a, s) => a + owedBack(s.id), 0)
  const totalPending = list.reduce((a, s) => a + pendingTotal(s.id), 0)

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow={me.role === 'engineer' ? 'Head Engineer · your team' : 'People · site engineers'}
        title="Site Engineers & cash"
        sub="Every site engineer's live cash-in-hand, funded total and any money owed back. Open a ledger for the full transaction history."
        right={canFund && <button className="btn btn-primary" onClick={() => setFunds(true)}>+ Add funds</button>}
      />

      <div className="r-row" style={{ marginBottom: 24 }}>
        <Kpi label="Site Engineers" value={list.length} accent />
        <Kpi label="Cash in field" value={formatCompact(totalCash)} sub="sum of cash-in-hand" />
        <Kpi label="Owed back" value={formatMoney(totalOwed)} color={totalOwed ? 'var(--danger)' : '#fff'} />
        <Kpi label="Pending review" value={formatCompact(totalPending)} sub="submitted, not yet decided" color={totalPending ? 'var(--warn)' : '#fff'} />
      </div>

      <div className="r-cards" style={{ '--r-min': '340px' }}>
        {list.map((s) => {
          const bal = cashInHand(s.id)
          const owed = owedBack(s.id)
          const pending = pendingTotal(s.id)
          const eng = userById(s.engineerId)
          const site = siteById(s.siteId)
          const pct = bal.funded ? Math.round((bal.spent / bal.funded) * 100) : 0
          return (
            <Link key={s.id} to={`/people/${s.id}`} className="card" style={{ padding: 18, textDecoration: 'none', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Monogram name={s.name} color="var(--accent)" soft="var(--accent-soft)" size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 15px/1 var(--f-body)', color: '#fff' }}>{s.name}</div>
                  <div style={{ font: '500 12px/1.4 var(--f-mono)', color: 'var(--text-42)', marginTop: 5 }}>{site?.label} · {eng ? eng.name.split(' ')[0] : '—'}</div>
                </div>
                {owed > 0 && <span className="pill pill-rejected" style={{ height: 22, fontSize: 10 }}><span className="dot" />OWES</span>}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <div className="surface" style={{ flex: 1, padding: '11px 13px', borderRadius: 11 }}>
                  <div style={{ font: '600 9px/1 var(--f-mono)', color: 'var(--text-40)' }}>CASH IN HAND</div>
                  <div className="num" style={{ font: '700 18px/1 var(--f-display)', color: 'var(--accent)', marginTop: 7 }}>{formatMoney(bal.cash).replace('Rs ', 'Rs ')}</div>
                </div>
                <div className="surface" style={{ flex: 1, padding: '11px 13px', borderRadius: 11 }}>
                  <div style={{ font: '600 9px/1 var(--f-mono)', color: 'var(--text-40)' }}>OWED BACK</div>
                  <div className="num" style={{ font: '700 18px/1 var(--f-display)', color: owed ? 'var(--danger)' : 'var(--text-40)', marginTop: 7 }}>{formatMoney(owed).replace('Rs ', 'Rs ')}</div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 10px/1 var(--f-mono)', color: 'var(--text-42)', marginBottom: 7 }}>
                  <span>spent {formatCompact(bal.spent)}</span><span>funded {formatCompact(bal.funded)}</span>
                </div>
                <Progress pct={pct} height={6} />
                {/* scanning this grid is exactly where "who has a pile of
                    unapproved bills" matters, so surface it without a click */}
                {pending > 0 && (
                  <div style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--warn)', marginTop: 8 }}>
                    {formatCompact(pending)} pending review
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {canFund && <AddFundsModal open={funds} onClose={() => setFunds(false)} />}
    </div>
  )
}
