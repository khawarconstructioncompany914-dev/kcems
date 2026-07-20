import { useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, fmtDate } from '../../data/model.js'
import { PageHeader, Kpi } from '../../components/page.jsx'
import { ExpenseCard } from '../../components/expense.jsx'
import { Empty, Monogram } from '../../components/bits.jsx'
import { AddFundsModal } from '../../components/funds.jsx'

export default function Approvals() {
  const { state, dispatch, toast } = useStore()
  const { me, scopedExpenses, expenseView, userById } = useSelectors()
  const [tab, setTab] = useState('queue')
  const [funds, setFunds] = useState(false)

  const all = scopedExpenses(me)
  const queue = all.filter((e) => e.status === 'finance_review').map(expenseView)
  const owed = all.filter((e) => e.status === 'rejected' && !e.settledAt).map(expenseView)
  const queueTotal = queue.reduce((a, e) => a + e.amount, 0)
  const owedTotal = owed.reduce((a, e) => a + e.amount, 0)

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Finance · approvals"
        title="Approve & settle"
        sub="Second-stage review. Approving deducts the amount from the supervisor's cash-in-hand, atomically. Rejecting turns it into owed-back."
        right={<button className="btn btn-primary" onClick={() => setFunds(true)}>+ Add funds</button>}
      />

      <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        <Kpi label="Awaiting approval" value={queue.length} sub={formatMoney(queueTotal)} accent />
        <Kpi label="Owed back" value={formatMoney(owedTotal)} sub={`${owed.length} rejected · unsettled`} color="var(--danger)" />
        <Kpi label="Approved (all time)" value={all.filter((e) => e.status === 'approved').length} sub="across every site" />
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['queue', `Finance review · ${queue.length}`], ['owed', `Owed back · ${owed.length}`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className="btn btn-sm"
            style={{ background: tab === k ? 'var(--accent)' : 'var(--input)', color: tab === k ? 'var(--accent-ink)' : 'var(--text-70)', border: `1px solid ${tab === k ? 'transparent' : 'var(--border)'}` }}>{label}</button>
        ))}
      </div>

      {tab === 'queue' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 14 }}>
          {queue.length === 0
            ? <Empty title="Nothing to approve" sub="Engineers haven't passed anything up yet." />
            : queue.map((e) => <ExpenseCard key={e.id} e={e} mode="finance" />)}
        </div>
      )}

      {tab === 'owed' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 14 }}>
          {owed.length === 0
            ? <Empty title="No outstanding balances" sub="No supervisor currently owes money back." />
            : owed.map((e) => (
              <div key={e.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
                  <Monogram name={e.supervisor?.name} color="var(--danger)" soft="var(--danger-soft)" size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '700 14px/1.2 var(--f-body)', color: '#fff' }}>{e.note}</div>
                    <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--text-42)', marginTop: 6 }}>{e.supervisor?.name} · {e.site?.label} · {fmtDate(e.createdAt)}</div>
                  </div>
                  <div className="num" style={{ font: '700 17px/1 var(--f-display)', color: 'var(--danger)' }}>{formatMoney(e.amount)}</div>
                </div>
                <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--danger)', background: 'var(--danger-soft)', borderRadius: 10, padding: '9px 12px' }}>✕ {e.rejectReason}</div>
                <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }} onClick={() => { dispatch({ type: 'SETTLE', id: e.id, actorId: me.id }); toast(`Settled ${formatMoney(e.amount)}`) }}>Mark settled</button>
              </div>
            ))}
        </div>
      )}

      <AddFundsModal open={funds} onClose={() => setFunds(false)} />
    </div>
  )
}
