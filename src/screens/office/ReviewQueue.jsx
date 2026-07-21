import { useSelectors } from '../../store.jsx'
import { formatMoney } from '../../data/model.js'
import { PageHeader, Kpi } from '../../components/page.jsx'
import { ExpenseCard } from '../../components/expense.jsx'
import { Empty } from '../../components/bits.jsx'

export default function ReviewQueue() {
  const { me, scopedExpenses, expenseView, supsForEngineer } = useSelectors()
  const mine = scopedExpenses(me)
  const queue = mine.filter((e) => e.status === 'engineer_review').map(expenseView)
  const returned = mine.filter((e) => e.status === 'returned').map(expenseView)
  const queueTotal = queue.reduce((a, e) => a + e.amount, 0)
  const supCount = supsForEngineer(me.id).length

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Engineer · review queue"
        title="Review & pass up"
        sub="Expenses your supervisors logged, waiting for a first-stage check. Open the bill, then pass up to finance, return to fix, or reject."
      />

      <div className="r-row" style={{ marginBottom: 26 }}>
        <Kpi label="Waiting on you" value={queue.length} sub="in engineer review" accent />
        <Kpi label="Queue value" value={formatMoney(queueTotal)} sub="if all passed up" />
        <Kpi label="Your supervisors" value={supCount} sub="wired under you" />
      </div>

      <div className="r-cards" style={{ '--r-min': '420px' }}>
        {queue.length === 0
          ? <Empty title="Inbox zero 🎉" sub="No expenses waiting for review right now." />
          : queue.map((e) => <ExpenseCard key={e.id} e={e} mode="engineer" />)}
      </div>

      {returned.length > 0 && (
        <>
          <div style={{ font: '700 14px/1 var(--f-body)', color: 'var(--text-70)', margin: '30px 0 14px' }}>Returned — waiting on the supervisor to fix</div>
          <div className="r-cards" style={{ '--r-min': '420px' }}>
            {returned.map((e) => <ExpenseCard key={e.id} e={e} mode="none" />)}
          </div>
        </>
      )}
    </div>
  )
}
