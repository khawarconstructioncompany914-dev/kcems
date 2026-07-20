import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, CATEGORIES } from '../../data/model.js'

const CATS = ['materials', 'labour', 'fuel', 'tea_food']

export default function AddExpense() {
  const nav = useNavigate()
  const { dispatch, toast } = useStore()
  const { me, userById, siteById } = useSelectors()
  const eng = userById(me.engineerId)

  const [amount, setAmount] = useState('')
  const [cat, setCat] = useState('materials')
  const [note, setNote] = useState('')
  const [hasBill, setHasBill] = useState(true)

  const amt = Math.max(0, Math.round(Number(amount.toString().replace(/[^\d]/g, '')) || 0))
  const valid = amt > 0 && note.trim()

  const submit = () => {
    if (!valid) return
    dispatch({ type: 'LOG_EXPENSE', payload: { supervisorId: me.id, siteId: me.siteId, amount: amt, category: cat, note: note.trim(), bill: hasBill } })
    toast(`Sent to ${eng?.name.split(' ')[0]} for review`)
    nav('/m/history')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '6px 20px 14px' }}>
        <button onClick={() => nav('/m')} style={{ background: 'none', border: 'none', font: '400 24px/1 var(--f-body)', color: '#fff', cursor: 'pointer', padding: 0 }}>‹</button>
        <div style={{ font: '700 17px/1 var(--f-body)', color: '#fff' }}>Log an expense</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
          <div style={{ font: '600 10px/1 var(--f-mono)', letterSpacing: '.1em', color: 'var(--text-40)' }}>AMOUNT SPENT</div>
          <input
            value={amount ? `Rs ${Number(amt).toLocaleString('en-US')}` : ''}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Rs 0" inputMode="numeric"
            style={{ width: '100%', textAlign: 'center', background: 'none', border: 'none', outline: 'none', font: '700 44px/1 var(--f-display)', color: 'var(--accent)', letterSpacing: '-.03em', marginTop: 12 }}
          />
          <div style={{ width: 120, height: 2, background: 'var(--accent)', margin: '12px auto 0', borderRadius: 2 }} />
        </div>

        <div style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--text-50)', marginBottom: 9 }}>CATEGORY</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {CATS.map((k) => (
            <button key={k} className={`chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>{CATEGORIES[k].label}</button>
          ))}
        </div>

        <div style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--text-50)', marginBottom: 9 }}>NOTE</div>
        <input className="field" placeholder="e.g. River sand — 6 trolleys" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginBottom: 16, height: 44 }} />

        <div style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--text-50)', marginBottom: 9 }}>BILL PHOTO</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <div onClick={() => setHasBill(true)} style={{ width: 72, height: 72, borderRadius: 12, background: hasBill ? 'linear-gradient(135deg,#1a1d17,#0f110d)' : 'var(--input)', border: `1px ${hasBill ? 'solid var(--accent-line)' : 'dashed var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', cursor: 'pointer' }}>
            {hasBill
              ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 17l5-6 4 4 3-4 6 7" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="8" r="2"/></svg>
              : null}
          </div>
          <div onClick={() => setHasBill(true)} style={{ width: 72, height: 72, borderRadius: 12, background: 'var(--input)', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-40)', cursor: 'pointer' }}>
            <span style={{ fontSize: 19 }}>＋</span><span style={{ font: '600 9px/1 var(--f-mono)' }}>CAMERA</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 'none', padding: '14px 20px 26px', background: 'linear-gradient(0deg, var(--bg-panel) 70%, transparent)' }}>
        <button className="btn btn-primary" style={{ width: '100%', height: 52, fontSize: 15, opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={submit}>
          Send to {eng?.name.split(' ')[0] || 'engineer'} for review →
        </button>
      </div>
    </div>
  )
}
