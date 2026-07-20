import { useNavigate } from 'react-router-dom'
import { useSelectors } from '../../store.jsx'
import { formatMoney, fmtDate, STATUS, relDay } from '../../data/model.js'

export default function MobileHome() {
  const nav = useNavigate()
  const { me, siteById, cashInHand, owedBack, state } = useSelectors()
  const bal = cashInHand(me.id)
  const owed = owedBack(me.id)
  const site = siteById(me.siteId)
  const owedItem = state.expenses.find((e) => e.supervisorId === me.id && e.status === 'rejected' && !e.settledAt)

  const recent = state.expenses.filter((e) => e.supervisorId === me.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4)

  const glyph = { approved: '✓', engineer_review: '◷', finance_review: '◷', rejected: '✕', returned: '↩', settled: '✓' }

  return (
    <div style={{ paddingBottom: 150 }}>
      {/* hero cash */}
      <div style={{ margin: '6px 16px 0', background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 22, padding: '20px 20px 22px' }} className="fade-up">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ font: '600 10px/1 var(--f-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: '#1C5A10' }}>Cash in your hand</div>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-ink)' }} />
        </div>
        <div className="num" style={{ font: '700 40px/1 var(--f-display)', letterSpacing: '-.03em', margin: '16px 0 6px' }}>{formatMoney(bal.cash)}</div>
        <div style={{ font: '600 12px/1 var(--f-body)', color: '#1C5A10' }}>{me.name} · {site?.name}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <div style={{ flex: 1, background: 'rgba(11,12,11,.14)', borderRadius: 11, padding: '9px 11px' }}>
            <div style={{ font: '600 9px/1 var(--f-mono)', color: '#1C5A10' }}>FUNDED</div>
            <div className="num" style={{ font: '700 15px/1 var(--f-display)', marginTop: 5 }}>{formatMoney(bal.funded)}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(11,12,11,.14)', borderRadius: 11, padding: '9px 11px' }}>
            <div style={{ font: '600 9px/1 var(--f-mono)', color: '#1C5A10' }}>SPENT</div>
            <div className="num" style={{ font: '700 15px/1 var(--f-display)', marginTop: 5 }}>{formatMoney(bal.spent)}</div>
          </div>
        </div>
      </div>

      {/* owed strip */}
      {owed > 0 && (
        <div style={{ margin: '12px 16px 0', background: 'var(--danger-soft)', border: '1px solid rgba(242,112,79,.3)', borderRadius: 13, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={{ font: '700 12px/1 var(--f-body)', color: 'var(--danger)' }}>You owe {formatMoney(owed)}</div>
            <div style={{ font: '500 10px/1.3 var(--f-body)', color: 'var(--text-50)', marginTop: 3 }}>{owedItem ? owedItem.rejectReason.split('—')[0].trim() : 'Rejected expense'}</div>
          </div>
          <span style={{ font: '700 11px/1 var(--f-body)', color: 'var(--danger)' }}>Settle</span>
        </div>
      )}

      {/* recent */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
          <div style={{ font: '700 13px/1 var(--f-body)', color: '#fff' }}>Recent</div>
          <div style={{ font: '600 11px/1 var(--f-body)', color: 'var(--accent)', cursor: 'pointer' }} onClick={() => nav('/m/history')}>See all</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {recent.map((e) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 12px/1 var(--f-display)', color: STATUS[e.status].color, flex: 'none' }}>{glyph[e.status]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 12px/1.2 var(--f-body)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.note}</div>
                <div style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--text-40)', marginTop: 3 }}>{STATUS[e.status].short} · {relDay(e.createdAt)}</div>
              </div>
              <div className="num" style={{ font: '700 12px/1 var(--f-display)', color: '#fff' }}>{formatMoney(e.amount).replace('Rs ', 'Rs ')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
