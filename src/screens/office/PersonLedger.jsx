import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSelectors } from '../../store.jsx'
import { formatMoney, fmtDate, STATUS } from '../../data/model.js'
import { Card } from '../../components/page.jsx'
import { Monogram, StatusPill, CatDot } from '../../components/bits.jsx'
import { AddFundsModal } from '../../components/funds.jsx'

export default function PersonLedger() {
  const { id } = useParams()
  const { me, state, userById, siteById, cashInHand, owedBack, pendingTotal } = useSelectors()
  const [funds, setFunds] = useState(false)
  const sup = userById(id)
  if (!sup) return <div style={{ color: 'var(--text-50)' }}>Site Engineer not found. <Link to="/people">Back</Link></div>

  const bal = cashInHand(id)
  const owed = owedBack(id)
  const pending = pendingTotal(id)
  const eng = userById(sup.engineerId)
  const site = siteById(sup.siteId)
  const canFund = me.role === 'owner' || me.role === 'finance'

  // build a merged, dated ledger of fund txns + expenses
  const rows = [
    ...state.funds.filter((f) => f.supervisorId === id).map((f) => ({ kind: 'fund', at: f.createdAt, ...f })),
    ...state.expenses.filter((e) => e.supervisorId === id).map((e) => ({ kind: 'exp', at: e.createdAt, ...e })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at))

  return (
    <div className="fade-up">
      <Link to="/people" className="tap" style={{ font: '600 12px/1 var(--f-body)', color: 'var(--text-50)' }}>‹ People</Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 15, margin: '16px 0 24px', flexWrap: 'wrap' }}>
        <Monogram name={sup.name} color="var(--accent)" soft="var(--accent-soft)" size={54} radius={15} font={18} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ font: '700 24px/1 var(--f-display)', color: 'var(--text)', letterSpacing: '-.02em' }}>{sup.name}</div>
          <div style={{ font: '500 12px/1 var(--f-mono)', color: 'var(--text-42)', marginTop: 8 }}>SITE ENGINEER · {site?.name} · reports to {eng?.name}</div>
        </div>
        {canFund && <button className="btn btn-primary" onClick={() => setFunds(true)}>+ Add funds</button>}
      </div>

      <div className="r-row" style={{ marginBottom: 22 }}>
        <div className="card" style={{ padding: '18px 22px', flex: 1, minWidth: 150 }}>
          <div style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--text-40)' }}>CASH IN HAND</div>
          <div className="num" style={{ font: '700 28px/1 var(--f-display)', color: 'var(--accent)', marginTop: 10 }}>{formatMoney(bal.cash)}</div>
        </div>
        <div className="card" style={{ padding: '18px 22px', flex: 1, minWidth: 150 }}>
          <div style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--text-40)' }}>FUNDED</div>
          <div className="num" style={{ font: '700 28px/1 var(--f-display)', color: 'var(--text)', marginTop: 10 }}>{formatMoney(bal.funded)}</div>
        </div>
        <div className="card" style={{ padding: '18px 22px', flex: 1, minWidth: 150 }}>
          <div style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--text-40)' }}>SPENT · APPROVED</div>
          <div className="num" style={{ font: '700 28px/1 var(--f-display)', color: 'var(--text)', marginTop: 10 }}>{formatMoney(bal.spent)}</div>
        </div>
        <div className="card" style={{ padding: '18px 22px', flex: 1, minWidth: 150 }}>
          <div style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--text-40)' }}>OWED BACK</div>
          <div className="num" style={{ font: '700 28px/1 var(--f-display)', color: owed ? 'var(--danger)' : 'var(--text-40)', marginTop: 10 }}>{formatMoney(owed)}</div>
        </div>
        <div className="card" style={{ padding: '18px 22px', flex: 1, minWidth: 150 }}>
          <div style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--text-40)' }}>SUBMITTED · PENDING</div>
          <div className="num" style={{ font: '700 28px/1 var(--f-display)', color: pending ? 'var(--warn)' : 'var(--text-40)', marginTop: 10 }}>{formatMoney(pending)}</div>
        </div>
      </div>

      <Card pad={0}>
        <div style={{ padding: '16px 20px', font: '700 14px/1 var(--f-body)', color: 'var(--text)' }}>Ledger</div>
        <div className="r-scroll-x" style={{ '--r-tablemin': '520px' }}>
        <div>
        <div style={{ display: 'flex', font: '500 10px/1 var(--f-mono)', color: 'var(--text-40)', padding: '0 20px 10px', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border-3)' }}>
          <span style={{ flex: 2 }}>Date · item</span><span style={{ flex: 1 }}>Type</span><span style={{ flex: 1, textAlign: 'right' }}>Amount</span>
        </div>
        {rows.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 20px', borderTop: '1px solid var(--border-3)' }}>
            <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
              {r.kind === 'fund'
                ? <span className="mono-badge" style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 15 }}>+</span>
                : <span style={{ width: 6, height: 30, borderRadius: 3, background: STATUS[r.status].color, flex: 'none' }} />}
              <div>
                <div style={{ font: '600 13px/1.2 var(--f-body)', color: 'var(--text)' }}>{r.kind === 'fund' ? (r.type === 'settlement' ? 'Settlement' : 'Funds added') : r.note}</div>
                <div style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--text-42)', marginTop: 4 }}>{fmtDate(r.at)}{r.kind === 'fund' ? ` · ${r.method}` : ''}</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {r.kind === 'fund'
                ? <span className="pill pill-approved" style={{ height: 22, fontSize: 10 }}>{r.type === 'settlement' ? 'SETTLED' : 'FUNDS IN'}</span>
                : <StatusPill status={r.status} small />}
            </div>
            <div className="num" style={{ flex: 1, textAlign: 'right', font: '700 14px/1 var(--f-display)', color: r.kind === 'fund' && r.type === 'funds_in' ? 'var(--accent)' : 'var(--text)' }}>
              {r.kind === 'fund' && r.type === 'funds_in' ? '+' : ''}{formatMoney(r.amount).replace('Rs ', '')}
            </div>
          </div>
        ))}
        </div>
        </div>
      </Card>

      {canFund && <AddFundsModal open={funds} onClose={() => setFunds(false)} supervisorId={id} />}
    </div>
  )
}
