import { useSelectors } from '../../store.jsx'
import { formatMoney, fmtDate } from '../../data/model.js'

export default function Funds() {
  const { me, state, cashInHand, owedBack, siteById } = useSelectors()
  const bal = cashInHand(me.id)
  const owed = owedBack(me.id)
  const txns = state.funds.filter((f) => f.supervisorId === me.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return (
    <div className="field-screen">
      <div style={{ padding: '6px 20px 4px' }}>
        <div style={{ font: '700 20px/1 var(--f-display)', color: '#fff' }}>Funds</div>
      </div>

      <div style={{ margin: '12px 16px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 18 }}>
        <div style={{ font: '600 10px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--text-40)' }}>CASH IN HAND</div>
        <div className="num" style={{ font: '700 36px/1 var(--f-display)', color: 'var(--accent)', margin: '12px 0 4px' }}>{formatMoney(bal.cash)}</div>
        <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
          <div><div style={{ font: '600 9px/1 var(--f-mono)', color: 'var(--text-40)' }}>FUNDED</div><div className="num" style={{ font: '700 15px/1 var(--f-display)', color: '#fff', marginTop: 6 }}>{formatMoney(bal.funded)}</div></div>
          <div><div style={{ font: '600 9px/1 var(--f-mono)', color: 'var(--text-40)' }}>SPENT</div><div className="num" style={{ font: '700 15px/1 var(--f-display)', color: '#fff', marginTop: 6 }}>{formatMoney(bal.spent)}</div></div>
          <div><div style={{ font: '600 9px/1 var(--f-mono)', color: 'var(--text-40)' }}>OWED</div><div className="num" style={{ font: '700 15px/1 var(--f-display)', color: owed ? 'var(--danger)' : 'var(--text-40)', marginTop: 6 }}>{formatMoney(owed)}</div></div>
        </div>
      </div>

      <div style={{ padding: '18px 16px 0' }}>
        <div style={{ font: '600 10px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--text-32)', margin: '0 4px 12px' }}>FUNDING HISTORY</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {txns.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 13, background: '#121412', border: '1px solid var(--border-3)' }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 15px/1 var(--f-body)', flex: 'none' }}>{t.type === 'settlement' ? '↺' : '+'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ font: '600 12px/1.2 var(--f-body)', color: '#fff' }}>{t.type === 'settlement' ? 'Settlement' : (t.note || 'Funds added')}</div>
                <div style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--text-40)', marginTop: 3 }}>{fmtDate(t.createdAt)} · {t.method}</div>
              </div>
              <div className="num" style={{ font: '700 13px/1 var(--f-display)', color: t.type === 'funds_in' ? 'var(--accent)' : 'var(--text-50)' }}>{t.type === 'funds_in' ? '+' : ''}{formatMoney(t.amount).replace('Rs ', '')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
