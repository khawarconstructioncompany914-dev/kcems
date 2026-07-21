import { useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, fmtDate, relDay, STATUS } from '../../data/model.js'

const FILTERS = [
  ['all', 'All'],
  ['approved', 'Approved'],
  ['review', 'Review'],
  ['owed', 'Owed'],
]

export default function History() {
  const { dispatch, toast } = useStore()
  const { me, userById, state } = useSelectors()
  const [f, setF] = useState('all')
  const eng = userById(me.engineerId)

  let list = state.expenses.filter((e) => e.supervisorId === me.id)
  if (f === 'approved') list = list.filter((e) => e.status === 'approved')
  else if (f === 'review') list = list.filter((e) => e.status === 'engineer_review' || e.status === 'finance_review')
  else if (f === 'owed') list = list.filter((e) => e.status === 'rejected' && !e.settledAt)
  list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // group by today / earlier
  const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString()
  const today = list.filter((e) => isToday(e.createdAt))
  const earlier = list.filter((e) => !isToday(e.createdAt))

  const Row = ({ e }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 13, background: '#121412', border: '1px solid var(--border-3)' }}>
      <span style={{ width: 6, height: 34, borderRadius: 3, background: STATUS[e.status].color, flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '600 12px/1.2 var(--f-body)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.note}</div>
        <div style={{ font: '500 10px/1.2 var(--f-mono)', color: STATUS[e.status].color, marginTop: 4 }}>
          {STATUS[e.status].short}{e.status === 'engineer_review' ? ` · ${eng?.name.split(' ')[0]}` : e.status === 'rejected' ? ' · ' + (e.rejectReason?.split('—')[0].trim() || '') : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="num" style={{ font: '700 13px/1 var(--f-display)', color: '#fff' }}>{formatMoney(e.amount).replace('Rs ', '')}</div>
        {e.status === 'returned' && <button className="btn btn-primary btn-sm" style={{ height: 26, marginTop: 6, fontSize: 11, padding: '0 9px' }} onClick={() => { dispatch({ type: 'RESUBMIT', id: e.id, actorId: me.id }); toast('Re-submitted for review') }}>Re-submit</button>}
      </div>
    </div>
  )

  return (
    <div className="field-screen">
      <div style={{ padding: '6px 20px 12px' }}>
        <div style={{ font: '700 20px/1 var(--f-display)', color: '#fff' }}>My history</div>
        <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
          {FILTERS.map(([k, label]) => (
            <button key={k} className={`chip ${f === k ? 'on' : ''}`} style={{ height: 30, fontSize: 11 }} onClick={() => setF(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '4px 16px 0' }}>
        {list.length === 0 && <div style={{ padding: '40px 0', textAlign: 'center', font: '500 12px/1 var(--f-body)', color: 'var(--text-40)' }}>Nothing here yet.</div>}

        {today.length > 0 && <>
          <div style={{ font: '600 10px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--text-32)', margin: '8px 4px 10px' }}>TODAY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>{today.map((e) => <Row key={e.id} e={e} />)}</div>
        </>}

        {earlier.length > 0 && <>
          <div style={{ font: '600 10px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--text-32)', margin: '0 4px 10px' }}>EARLIER</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{earlier.map((e) => <Row key={e.id} e={e} />)}</div>
        </>}
      </div>
    </div>
  )
}
