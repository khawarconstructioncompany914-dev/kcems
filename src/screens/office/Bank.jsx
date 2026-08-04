// ============================================================
// KCEMS · bank accounts & ledger
//
// The bottom half of the paper form: cash in, cash out, and the balance that
// follows from them. Owner and finance only — admin never sees an account, a
// balance or a transaction, mirroring the split where Muzamil signs the
// contract and Tariq holds the cheque book.
//
// The closing balance is derived, never typed. That is the whole reason this
// beats the paper version, where the running total is crossed out and rewritten
// by hand every time a payment lands.
// ============================================================
import { useMemo, useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, formatCompact, fmtDate } from '../../data/model.js'
import { formatTime12 } from '../../data/attendance.js'
import { PageHeader, Card, Kpi } from '../../components/page.jsx'
import { Monogram, Modal, Empty } from '../../components/bits.jsx'

export const PURPOSES = [
  ['vendor_payment', 'Vendor payment'],
  ['owner_deposit', 'Owner deposit'],
  ['withdrawal', 'Withdrawal'],
  ['salary', 'Salary'],
  ['other', 'Other'],
]
const purposeLabel = (p) => (PURPOSES.find(([k]) => k === p) || [null, 'Other'])[1]

export default function Bank() {
  const { dispatch, toast } = useStore()
  const { me, state, userById, siteById, bankAccounts, bankTxns, vendorBills,
          vendorById, billBalance, accountBalance } = useSelectors()

  const [tab, setTab] = useState('accounts')
  const [accountModal, setAccountModal] = useState(false)
  const [txnModal, setTxnModal] = useState(false)
  const [filter, setFilter] = useState('all')

  const accounts = bankAccounts || []
  const txns = bankTxns || []
  const bills = vendorBills || []

  const totals = useMemo(() => {
    const held = accounts.reduce((a, acc) => a + accountBalance(acc).closingBalance, 0)
    const out = txns.filter((t) => t.type === 'cash_out').reduce((a, t) => a + t.amount, 0)
    const inn = txns.filter((t) => t.type === 'cash_in').reduce((a, t) => a + t.amount, 0)
    return { held, out, inn }
  }, [accounts, txns, accountBalance])

  // Newest first for reading, but the running balance has to be accumulated
  // oldest-first — so compute forwards, then reverse for display.
  const ledger = useMemo(() => {
    const rows = txns.filter((t) => filter === 'all' || t.bankAccountId === filter)
    const byAccount = new Map()
    const oldestFirst = [...rows].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const withRunning = oldestFirst.map((t) => {
      const acc = accounts.find((a) => a.id === t.bankAccountId)
      const prev = byAccount.has(t.bankAccountId) ? byAccount.get(t.bankAccountId) : (acc?.openingBalance || 0)
      const next = prev + (t.type === 'cash_in' ? t.amount : -t.amount)
      byAccount.set(t.bankAccountId, next)
      return { ...t, running: next }
    })
    return withRunning.reverse()
  }, [txns, filter, accounts])

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Finance · bank"
        title="Bank ledger"
        sub="Company accounts and every rupee in and out of them. Payments can be tied to a sub-contractor's contract, which is what keeps its balance right without anyone adding it up."
        right={tab === 'accounts'
          ? <button className="btn btn-primary" onClick={() => setAccountModal(true)}>+ Add account</button>
          : <button className="btn btn-primary" disabled={!accounts.length} onClick={() => setTxnModal(true)}>+ Record entry</button>}
      />

      <div className="r-row" style={{ marginBottom: 22 }}>
        <Kpi label="Held across accounts" value={formatCompact(totals.held)} sub={`${accounts.length} account${accounts.length === 1 ? '' : 's'}`} accent />
        <Kpi label="Total in" value={formatCompact(totals.inn)} sub="recorded deposits" />
        <Kpi label="Total out" value={formatCompact(totals.out)} sub="payments & withdrawals" color={totals.out ? 'var(--warn)' : 'var(--text)'} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['accounts', 'Accounts'], ['ledger', 'Ledger']].map(([k, label]) => (
          <button key={k} type="button" className={`chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'accounts' && (
        <div className="r-cards" style={{ '--r-min': '320px' }}>
          {accounts.length === 0 && (
            <Card pad={0}><Empty title="No accounts yet" sub="Add the company's first bank account to start the ledger." /></Card>
          )}
          {accounts.map((a) => {
            const bal = accountBalance(a)
            return (
              <Card key={a.id} pad={20}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <Monogram name={a.bankName} color="var(--info)" soft="var(--info-soft)" size={38} radius={11} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 14px/1.3 var(--f-body)', color: 'var(--text)' }}>{a.bankName}</div>
                    <div style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--text-50)' }}>{a.accountTitle}</div>
                  </div>
                  {a.status !== 'active' && <span className="pill" style={{ height: 22, fontSize: 10, background: 'var(--input)', color: 'var(--text-50)', border: '1px solid var(--border)' }}>CLOSED</span>}
                </div>

                <div className="num" style={{ font: '700 26px/1 var(--f-display)', color: bal.closingBalance < 0 ? 'var(--danger)' : 'var(--accent)', margin: '16px 0 4px' }}>
                  {formatMoney(bal.closingBalance)}
                </div>
                <div style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--text-50)' }}>closing balance</div>

                <div style={{ display: 'flex', gap: 18, marginTop: 14, font: '500 12px/1.5 var(--f-body)', color: 'var(--text-50)' }}>
                  <span>In <b style={{ color: 'var(--text-70)' }}>{formatCompact(bal.cashIn)}</b></span>
                  <span>Out <b style={{ color: 'var(--text-70)' }}>{formatCompact(bal.cashOut)}</b></span>
                  <span>Opened at <b style={{ color: 'var(--text-70)' }}>{formatCompact(a.openingBalance)}</b></span>
                </div>

                <div style={{ font: '500 11.5px/1.5 var(--f-mono)', color: 'var(--text-40)', marginTop: 12, borderTop: '1px solid var(--border-3)', paddingTop: 10 }}>
                  {a.accountNumber}{a.branch ? ` · ${a.branch}` : ''}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'ledger' && (
        <Card pad={0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid var(--border-3)', flexWrap: 'wrap' }}>
            <label className="field-label" style={{ margin: 0 }}>Account</label>
            <select className="field" style={{ height: 36, maxWidth: 260 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All accounts</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} · {a.accountTitle}</option>)}
            </select>
            <div className="spacer" />
            <div style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--text-50)' }}>{ledger.length} entries</div>
          </div>

          {ledger.length === 0 && <Empty title="Nothing recorded yet" sub="Record a deposit or a payment to start the ledger." />}

          {ledger.map((t) => {
            const bill = t.vendorBillId ? bills.find((b) => b.id === t.vendorBillId) : null
            const acc = accounts.find((a) => a.id === t.bankAccountId)
            const inbound = t.type === 'cash_in'
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--border-3)', flexWrap: 'wrap' }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 9, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: inbound ? 'var(--accent-soft)' : 'var(--warn-soft)', color: inbound ? 'var(--accent)' : 'var(--warn)',
                  font: '700 15px/1 var(--f-body)',
                }}>{inbound ? '↓' : '↑'}</span>

                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ font: '600 13px/1.3 var(--f-body)', color: 'var(--text)' }}>
                    {purposeLabel(t.purpose)}
                    {bill && <span style={{ color: 'var(--text-50)', fontWeight: 500 }}> · {vendorById(bill.vendorId)?.name} — {bill.title}</span>}
                  </div>
                  <div style={{ font: '500 11.5px/1.4 var(--f-body)', color: 'var(--text-50)', marginTop: 3 }}>
                    {fmtDate(t.createdAt)} · {formatTime12(t.createdAt)} · {acc?.bankName || '—'}
                    {t.note ? ` · ${t.note}` : ''}
                  </div>
                </div>

                <div className="num" style={{ font: '700 14px/1 var(--f-display)', color: inbound ? 'var(--accent)' : 'var(--text)', minWidth: 110, textAlign: 'right' }}>
                  {inbound ? '+' : '−'}{formatMoney(t.amount).replace('Rs ', '')}
                </div>
                <div className="num" style={{ font: '600 12.5px/1 var(--f-display)', color: 'var(--text-50)', minWidth: 110, textAlign: 'right' }}>
                  {filter === 'all' ? '' : formatMoney(t.running).replace('Rs ', '')}
                </div>
              </div>
            )
          })}
        </Card>
      )}

      <AccountModal open={accountModal} onClose={() => setAccountModal(false)}
        onSubmit={(payload) => { dispatch({ type: 'CREATE_BANK_ACCOUNT', payload, actorId: me.id }); setAccountModal(false); toast(`${payload.bankName} added`) }} />

      <TxnModal open={txnModal} onClose={() => setTxnModal(false)} accounts={accounts} bills={bills}
        vendorById={vendorById} siteById={siteById} billBalance={billBalance}
        onSubmit={(payload) => {
          dispatch({ type: 'BANK_TXN', payload, actorId: me.id })
          setTxnModal(false)
          toast(`${payload.type === 'cash_in' ? 'Deposit' : 'Payment'} recorded`, payload.type === 'cash_in' ? 'accent' : 'info')
        }} />
    </div>
  )
}

// ------------------------------------------------------------
function AccountModal({ open, onClose, onSubmit }) {
  const [f, setF] = useState({ bankName: '', accountTitle: '', accountNumber: '', branch: '', address: '', openingBalance: '' })
  const [seen, setSeen] = useState(open)
  if (open !== seen) { setSeen(open); if (open) setF({ bankName: '', accountTitle: '', accountNumber: '', branch: '', address: '', openingBalance: '' }) }
  if (!open) return null
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const ready = f.bankName.trim() && f.accountTitle.trim() && f.accountNumber.trim()
  return (
    <Modal open onClose={onClose} width={470}>
      <div style={{ padding: 22 }}>
        <div style={{ font: '700 16px/1 var(--f-body)', color: 'var(--text)' }}>Add a bank account</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1 }}><label className="field-label">Bank</label><input className="field" placeholder="e.g. UBL" value={f.bankName} onChange={set('bankName')} autoFocus /></div>
          <div style={{ flex: 1.4 }}><label className="field-label">Title of account</label><input className="field" placeholder="e.g. Khawar Construction Co." value={f.accountTitle} onChange={set('accountTitle')} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1.4 }}><label className="field-label">Account number</label><input className="field" placeholder="0123-456789012" value={f.accountNumber} onChange={set('accountNumber')} /></div>
          <div style={{ flex: 1 }}><label className="field-label">Branch</label><input className="field" placeholder="e.g. Sector I-9" value={f.branch} onChange={set('branch')} /></div>
        </div>
        <label className="field-label" style={{ marginTop: 12 }}>Address</label>
        <input className="field" placeholder="Branch address" value={f.address} onChange={set('address')} />
        <label className="field-label" style={{ marginTop: 12 }}>Opening balance (PKR)</label>
        <input className="field" inputMode="numeric" placeholder="0" value={f.openingBalance} onChange={set('openingBalance')} />
        <div style={{ font: '500 12px/1.5 var(--f-body)', color: 'var(--text-50)', marginTop: 8 }}>
          What is in the account today. Everything recorded from here is added to or taken off this figure.
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={!ready}
            onClick={() => onSubmit({
              bankName: f.bankName.trim(), accountTitle: f.accountTitle.trim(), accountNumber: f.accountNumber.trim(),
              branch: f.branch.trim(), address: f.address.trim(),
              openingBalance: Math.round(Number(String(f.openingBalance).replace(/[^\d]/g, '')) || 0),
            })}>
            Add account
          </button>
        </div>
      </div>
    </Modal>
  )
}

function TxnModal({ open, onClose, accounts, bills, vendorById, siteById, billBalance, onSubmit }) {
  const [accountId, setAccountId] = useState('')
  const [type, setType] = useState('cash_out')
  const [purpose, setPurpose] = useState('vendor_payment')
  const [amount, setAmount] = useState('')
  const [vendorBillId, setVendorBillId] = useState('')
  const [note, setNote] = useState('')
  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) { setAccountId(accounts[0]?.id || ''); setType('cash_out'); setPurpose('vendor_payment'); setAmount(''); setVendorBillId(''); setNote('') }
  }
  if (!open) return null

  const amt = Math.round(Number(String(amount).replace(/[^\d]/g, '')) || 0)
  const openBills = bills.filter((b) => b.status === 'open')
  const linked = vendorBillId ? bills.find((b) => b.id === vendorBillId) : null
  const linkedBal = linked ? billBalance(linked) : null
  // Paying more than is left is allowed — a final settlement can exceed the
  // estimate, and the paper form has scribbled-in extras all over it. Warn,
  // don't block.
  const over = linkedBal && type === 'cash_out' && amt > linkedBal.balance && linkedBal.balance >= 0
  const ready = accountId && amt > 0

  return (
    <Modal open onClose={onClose} width={480}>
      <div style={{ padding: 22 }}>
        <div style={{ font: '700 16px/1 var(--f-body)', color: 'var(--text)' }}>Record a ledger entry</div>

        <label className="field-label" style={{ marginTop: 16 }}>Account</label>
        <select className="field" value={accountId} onChange={(e) => setAccountId(e.target.value)} autoFocus>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} · {a.accountTitle}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[['cash_out', 'Cash out'], ['cash_in', 'Cash in']].map(([k, label]) => (
            <button key={k} type="button" className="btn btn-sm" style={{
              flex: 1,
              background: type === k ? 'var(--accent-fill)' : 'var(--input)',
              color: type === k ? 'var(--accent-ink)' : 'var(--text-70)',
              border: `1px solid ${type === k ? 'transparent' : 'var(--border)'}`,
            }} onClick={() => {
              setType(k)
              // A deposit is never a vendor payment; move the default so the
              // form does not have to be corrected twice.
              if (k === 'cash_in') { setPurpose('owner_deposit'); setVendorBillId('') }
              else setPurpose('vendor_payment')
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Amount (PKR)</label>
            <input className="field" inputMode="numeric" placeholder="e.g. 50,000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Purpose</label>
            <select className="field" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {PURPOSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        </div>

        {type === 'cash_out' && (
          <>
            <label className="field-label" style={{ marginTop: 12 }}>Against a contract (optional)</label>
            <select className="field" value={vendorBillId} onChange={(e) => setVendorBillId(e.target.value)}>
              <option value="">Not tied to a contract</option>
              {openBills.map((b) => (
                <option key={b.id} value={b.id}>
                  {vendorById(b.vendorId)?.name} · {b.title} · {siteById(b.siteId)?.label || siteById(b.siteId)?.name} — {formatMoney(billBalance(b).balance)} left
                </option>
              ))}
            </select>
            {linkedBal && (
              <div style={{ font: '500 12px/1.5 var(--f-body)', color: over ? 'var(--warn)' : 'var(--text-50)', marginTop: 8 }}>
                {over
                  ? `That is ${formatMoney(amt - linkedBal.balance)} more than the ${formatMoney(linkedBal.balance)} left on this contract. It will be recorded as an overpayment.`
                  : `${formatMoney(linkedBal.paid)} paid so far · ${formatMoney(linkedBal.balance)} left`}
              </div>
            )}
          </>
        )}

        <label className="field-label" style={{ marginTop: 12 }}>Note (optional)</label>
        <input className="field" placeholder="e.g. Cheque 365816" value={note} onChange={(e) => setNote(e.target.value)} />

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={!ready}
            onClick={() => onSubmit({ accountId, type, purpose, amount: amt, vendorBillId: vendorBillId || null, note: note.trim() })}>
            Record {type === 'cash_in' ? 'deposit' : 'payment'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
