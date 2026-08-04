// Head Engineer's own reimbursement claims — travel, lodging, food.
//
// Deliberately NOT a cash-in-hand screen. A head engineer is never funded a float,
// so there is no balance to show: this is a claims log. Money spent, receipt
// attached, finance decides. Claims skip engineer review (the engineer is the
// claimant) and land straight in finance's existing Approvals queue.
import { useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, fmtDate, CATEGORIES, CLAIM_CATEGORIES } from '../../data/model.js'
import { PageHeader, Kpi, Card } from '../../components/page.jsx'
import { StatusPill, Empty } from '../../components/bits.jsx'
import { PhotoTray, PhotoGallery, photosOf } from '../../components/photos.jsx'

const MAX_PHOTOS = 8

export default function MyExpenses() {
  const { dispatch, toast } = useStore()
  const { me, scopedExpenses } = useSelectors()

  const [amount, setAmount] = useState('')
  const [cat, setCat] = useState('travel')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState(null)

  const amt = Math.max(0, Math.round(Number(amount.toString().replace(/[^\d]/g, '')) || 0))
  const valid = amt > 0 && note.trim() && photos.length >= 1

  const mine = scopedExpenses(me)
    .filter((e) => e.supervisorId === me.id && e.kind === 'reimbursement')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const pending = mine.filter((e) => e.status === 'finance_review').reduce((a, e) => a + e.amount, 0)
  const approved = mine.filter((e) => e.status === 'approved').reduce((a, e) => a + e.amount, 0)

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    const res = await dispatch({
      type: 'LOG_CLAIM',
      payload: {
        claimantId: me.id, amount: amt, category: cat, note: note.trim(),
        photos: photos.map((p) => ({ dataUrl: p.dataUrl, capturedAt: p.capturedAt })),
      },
    })
    setBusy(false)
    // Don't clear the form and claim success without checking — a refused
    // claim used to wipe what was typed and report that it had been sent.
    if (res && res.status >= 400) {
      return toast(`Not sent — ${res.body?.error || 'please try again'}. Nothing was saved.`, 'danger')
    }
    setAmount(''); setNote(''); setPhotos([]); setCat('travel')
    toast(res?.body?.queued ? 'No signal — saved, it will send itself' : `Claim sent to finance · ${formatMoney(amt)}`)
  }

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Head Engineer · reimbursements"
        title="My expenses"
        sub="Claim back travel, lodging and food you paid for yourself. Attach the receipt — it goes straight to finance for approval, not through a site review."
      />

      <div className="r-row" style={{ marginBottom: 22 }}>
        <Kpi label="Awaiting finance" value={formatMoney(pending)} sub={`${mine.filter((e) => e.status === 'finance_review').length} claim(s) in the queue`} accent />
        <Kpi label="Approved (all time)" value={formatMoney(approved)} sub={`${mine.filter((e) => e.status === 'approved').length} reimbursed`} />
        <Kpi label="Claims filed" value={mine.length} sub="travel · lodging · food" />
      </div>

      <div className="r-cards" style={{ '--r-min': '420px' }}>
        <Card>
          <div style={{ font: '700 15px/1 var(--f-body)', color: 'var(--text)', marginBottom: 16 }}>New claim</div>

          <label className="field-label">Amount (PKR)</label>
          <input className="field" inputMode="numeric" placeholder="e.g. 4,500" value={amount}
            onChange={(e) => setAmount(e.target.value)} style={{ font: '700 18px/1 var(--f-display)', height: 52 }} />

          <label className="field-label" style={{ marginTop: 14 }}>Category</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {CLAIM_CATEGORIES.map((k) => (
              <button key={k} type="button" className={`chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>{CATEGORIES[k].label}</button>
            ))}
          </div>

          <label className="field-label" style={{ marginTop: 14 }}>What was it for</label>
          <input className="field" placeholder="e.g. Bus to Bahria site — return" value={note} onChange={(e) => setNote(e.target.value)} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 9 }}>
            <span className="field-label" style={{ margin: 0 }}>Receipt</span>
            <span style={{ font: '600 10px/1 var(--f-mono)', color: photos.length ? 'var(--text-40)' : 'var(--danger)' }}>
              {photos.length ? `${photos.length} OF ${MAX_PHOTOS}` : 'REQUIRED'}
            </span>
          </div>
          <PhotoTray photos={photos} onChange={setPhotos} max={MAX_PHOTOS} hint="Ticket, bill or booking confirmation." />

          <button className="btn btn-primary" style={{ width: '100%', height: 46, marginTop: 18 }} disabled={!valid || busy} onClick={submit}>
            {busy ? 'Sending…' : photos.length ? `Send claim · ${amt ? formatMoney(amt) : ''}` : 'Attach a receipt to send'}
          </button>
        </Card>

        <Card pad={0}>
          <div style={{ padding: '18px 20px 14px', font: '700 15px/1 var(--f-body)', color: 'var(--text)' }}>My claims</div>
          {mine.length === 0
            ? <Empty title="No claims yet" sub="Anything you pay for yourself goes here." />
            : mine.map((e) => {
              const ph = photosOf(e)
              return (
                <div key={e.id} style={{ padding: '13px 20px', borderTop: '1px solid var(--border-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '600 13px/1.3 var(--f-body)', color: 'var(--text)' }}>{e.note}</div>
                      <div style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--text-42)', marginTop: 5 }}>
                        {CATEGORIES[e.category]?.label} · {fmtDate(e.createdAt)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <div className="num" style={{ font: '700 15px/1 var(--f-display)', color: 'var(--text)' }}>{formatMoney(e.amount)}</div>
                      <div style={{ marginTop: 6 }}><StatusPill status={e.status} small /></div>
                    </div>
                  </div>
                  {e.rejectReason && <div style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--danger)', marginTop: 8 }}>✕ {e.rejectReason}</div>}
                  {ph.length > 0 && (
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setOpenId(openId === e.id ? null : e.id)}>
                      {openId === e.id ? 'Hide receipt' : ph.length > 1 ? `Receipts · ${ph.length}` : 'Receipt'}
                    </button>
                  )}
                  {openId === e.id && <div style={{ marginTop: 10 }}><PhotoGallery photos={ph} minPx={88} /></div>}
                </div>
              )
            })}
        </Card>
      </div>
    </div>
  )
}
