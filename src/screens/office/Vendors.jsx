// ============================================================
// KCEMS · vendors & sub-contractor agreements
//
// The top half of the paper form: who the sub-contractor is, what trade, what
// was agreed, and which sites they are deployed to. Owner and admin only —
// finance sees bills read-only on their own screen.
//
// No approval chain here, unlike an expense. A contract is recorded by the
// person who signed it; it is not something to review after the fact. Every
// write is still audit-logged, same as everything else.
// ============================================================
import { useMemo, useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, formatCompact, fmtDate } from '../../data/model.js'
import { PageHeader, Card, Kpi } from '../../components/page.jsx'
import { Monogram, Modal, Empty, Progress } from '../../components/bits.jsx'
import { PhotoTray, PhotoGallery } from '../../components/photos.jsx'

const TABS = [['vendors', 'Vendors'], ['bills', 'Contracts'], ['categories', 'Trades']]

export default function Vendors() {
  const { dispatch, toast } = useStore()
  const s = useSelectors()
  const { me, state, siteById, vendors, vendorBills, vendorById, vendorCategoryById,
          sitesForVendor, billBalance, vendorBillsForVendor, canEditVendors } = s

  const [tab, setTab] = useState('vendors')
  const [vendorModal, setVendorModal] = useState(false)
  const [billModal, setBillModal] = useState(false)
  const [catModal, setCatModal] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const canEdit = canEditVendors()
  const list = vendors || []
  const bills = vendorBills || []
  const categories = state.vendorCategories || []

  const totals = useMemo(() => {
    const open = bills.filter((b) => b.status === 'open')
    const contracted = open.reduce((a, b) => a + b.contractedAmount, 0)
    const outstanding = open.reduce((a, b) => a + billBalance(b).balance, 0)
    return { contracted, outstanding, openCount: open.length }
  }, [bills, billBalance])

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow={`${canEdit ? 'Admin' : 'Finance'} · vendors`}
        title="Vendors & contracts"
        sub="Sub-contractors, what was agreed with each of them, and what is still owed. The balance is worked out from the payments — it is never typed in."
        right={canEdit && tab === 'vendors' ? <button className="btn btn-primary" onClick={() => setVendorModal(true)}>+ Add vendor</button>
          : canEdit && tab === 'bills' ? <button className="btn btn-primary" onClick={() => setBillModal(true)}>+ New contract</button>
          : canEdit && tab === 'categories' ? <button className="btn btn-primary" onClick={() => setCatModal(true)}>+ Add trade</button>
          : null}
      />

      <div className="r-row" style={{ marginBottom: 22 }}>
        <Kpi label="Active vendors" value={list.filter((v) => v.status === 'active').length} sub={`${list.length} on file`} accent />
        <Kpi label="Contracted (open)" value={formatCompact(totals.contracted)} sub={`${totals.openCount} open contract${totals.openCount === 1 ? '' : 's'}`} />
        <Kpi label="Still owed" value={formatCompact(totals.outstanding)} sub="across open contracts" color={totals.outstanding ? 'var(--warn)' : 'var(--text)'} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map(([k, label]) => (
          <button key={k} type="button" className={`chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'vendors' && (
        <Card pad={0}>
          {list.length === 0 && <Empty title="No vendors yet" sub={canEdit ? 'Add the first sub-contractor to get started.' : 'Nothing has been recorded yet.'} />}
          {list.map((v) => {
            const cat = vendorCategoryById(v.categoryId)
            const theirSites = sitesForVendor(v.id)
            const theirBills = vendorBillsForVendor(v.id)
            const owed = theirBills.filter((b) => b.status === 'open').reduce((a, b) => a + billBalance(b).balance, 0)
            const open = expanded === v.id
            return (
              <div key={v.id} style={{ borderTop: '1px solid var(--border-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', flexWrap: 'wrap' }}>
                  <Monogram name={v.name} color={v.status === 'active' ? 'var(--accent)' : 'var(--text-40)'} soft={v.status === 'active' ? 'var(--accent-soft)' : 'var(--input)'} size={36} />
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <div style={{ font: '700 13.5px/1.3 var(--f-body)', color: 'var(--text)' }}>{v.name}</div>
                    <div style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--text-50)' }}>
                      {cat?.name || 'No trade set'}{v.contactPhone ? ` · ${v.contactPhone}` : ''}
                    </div>
                  </div>
                  <div style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--text-50)', minWidth: 90 }}>
                    {theirSites.length} site{theirSites.length === 1 ? '' : 's'}
                  </div>
                  <div className="num" style={{ font: '700 14px/1 var(--f-display)', color: owed ? 'var(--warn)' : 'var(--text-50)', minWidth: 100, textAlign: 'right' }}>
                    {owed ? formatMoney(owed) : '—'}
                  </div>
                  {v.status !== 'active' && <span className="pill pill-rejected" style={{ height: 22, fontSize: 10 }}>INACTIVE</span>}
                  <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(open ? null : v.id)}>{open ? 'Close' : 'Sites'}</button>
                </div>

                {open && (
                  <div style={{ padding: '0 20px 16px 68px' }}>
                    <SiteAssign vendor={v} sites={theirSites} allSites={state.sites} canEdit={canEdit}
                      onAdd={(siteId) => dispatch({ type: 'ASSIGN_VENDOR_SITE', vendorId: v.id, siteId, actorId: me.id })}
                      onRemove={(siteId) => {
                        const has = vendorBillsForVendor(v.id).some((b) => b.siteId === siteId)
                        if (has) return toast('This vendor has a contract on that site — close or move it first.', 'warn')
                        dispatch({ type: 'UNASSIGN_VENDOR_SITE', vendorId: v.id, siteId, actorId: me.id })
                      }} />
                    {canEdit && (
                      <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}
                        onClick={() => dispatch({ type: 'UPDATE_VENDOR', vendorId: v.id, patch: { status: v.status === 'active' ? 'inactive' : 'active' }, actorId: me.id })}>
                        Mark {v.status === 'active' ? 'inactive' : 'active'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </Card>
      )}

      {tab === 'bills' && (
        <Card pad={0}>
          {bills.length === 0 && <Empty title="No contracts yet" sub={canEdit ? 'Record the first sub-contractor agreement.' : 'Nothing has been recorded yet.'} />}
          {bills.map((b) => {
            const { paid, balance } = billBalance(b)
            const pct = b.contractedAmount ? Math.min(100, Math.round((paid / b.contractedAmount) * 100)) : 0
            return (
              <div key={b.id} style={{ padding: '14px 20px', borderTop: '1px solid var(--border-3)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ font: '700 13.5px/1.3 var(--f-body)', color: 'var(--text)' }}>{b.title}</div>
                    <div style={{ font: '500 12px/1.45 var(--f-body)', color: 'var(--text-50)', marginTop: 3 }}>
                      {vendorById(b.vendorId)?.name} · {siteById(b.siteId)?.name}
                      {b.startDate ? ` · from ${fmtDate(b.startDate)}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num" style={{ font: '700 15px/1 var(--f-display)', color: 'var(--text)' }}>{formatMoney(b.contractedAmount)}</div>
                    <div style={{ font: '500 11.5px/1.4 var(--f-body)', color: 'var(--text-50)', marginTop: 3 }}>contracted</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 110 }}>
                    <div className="num" style={{ font: '700 15px/1 var(--f-display)', color: balance > 0 ? 'var(--warn)' : 'var(--accent)' }}>
                      {formatMoney(Math.abs(balance))}
                    </div>
                    <div style={{ font: '500 11.5px/1.4 var(--f-body)', color: 'var(--text-50)', marginTop: 3 }}>
                      {balance > 0 ? 'still owed' : balance === 0 ? 'settled' : 'overpaid'}
                    </div>
                  </div>
                  {b.status === 'closed' && <span className="pill" style={{ height: 22, fontSize: 10, background: 'var(--input)', color: 'var(--text-50)', border: '1px solid var(--border)' }}>CLOSED</span>}
                </div>

                <div style={{ marginTop: 10 }}>
                  <Progress pct={pct} color={balance < 0 ? 'var(--danger)' : 'var(--accent)'} height={7} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 11.5px/1.4 var(--f-body)', color: 'var(--text-50)', marginTop: 6 }}>
                    <span>{formatMoney(paid)} paid · {pct}%</span>
                    {b.rateNote && <span style={{ maxWidth: '60%', textAlign: 'right' }}>{b.rateNote}</span>}
                  </div>
                </div>

                {b.photos?.length > 0 && <div style={{ marginTop: 10 }}><PhotoGallery photos={b.photos} minPx={64} /></div>}

                {canEdit && (
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
                    onClick={() => dispatch({ type: 'SET_VENDOR_BILL_STATUS', billId: b.id, status: b.status === 'open' ? 'closed' : 'open', actorId: me.id })}>
                    {b.status === 'open' ? 'Mark closed' : 'Re-open'}
                  </button>
                )}
              </div>
            )
          })}
        </Card>
      )}

      {tab === 'categories' && (
        <Card pad={0}>
          {categories.length === 0 && <Empty title="No trades yet" sub="Add the trades your sub-contractors work in." />}
          {categories.map((c) => {
            const n = list.filter((v) => v.categoryId === c.id).length
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderTop: '1px solid var(--border-3)' }}>
                <div style={{ flex: 1, font: '600 13px/1.3 var(--f-body)', color: 'var(--text)' }}>{c.name}</div>
                <div style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--text-50)' }}>{n} vendor{n === 1 ? '' : 's'}</div>
              </div>
            )
          })}
        </Card>
      )}

      <VendorModal open={vendorModal} onClose={() => setVendorModal(false)} categories={categories}
        onSubmit={(payload) => { dispatch({ type: 'CREATE_VENDOR', payload, actorId: me.id }); setVendorModal(false); toast(`${payload.name} added`) }} />
      <CategoryModal open={catModal} onClose={() => setCatModal(false)} existing={categories}
        onSubmit={(name) => { dispatch({ type: 'CREATE_VENDOR_CATEGORY', payload: { name }, actorId: me.id }); setCatModal(false); toast(`${name} added`) }} />
      <BillModal open={billModal} onClose={() => setBillModal(false)} vendors={list} sites={state.sites} categories={categories}
        onSubmit={(payload) => { dispatch({ type: 'CREATE_VENDOR_BILL', payload, actorId: me.id }); setBillModal(false); toast('Contract recorded') }} />
    </div>
  )
}

// ------------------------------------------------------------
function SiteAssign({ vendor, sites, allSites, canEdit, onAdd, onRemove }) {
  const [pick, setPick] = useState('')
  const available = allSites.filter((s) => !sites.some((x) => x.id === s.id))
  return (
    <div>
      <div style={{ font: '600 11px/1 var(--f-mono)', letterSpacing: '.08em', color: 'var(--text-40)', textTransform: 'uppercase', marginBottom: 8 }}>
        Deployed to
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: canEdit ? 10 : 0 }}>
        {sites.length === 0 && <span style={{ font: '500 12px/1.4 var(--f-body)', color: 'var(--text-50)' }}>No sites yet.</span>}
        {sites.map((s) => (
          <span key={s.id} className="pill" style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'var(--text-70)' }}>
            {s.name}
            {canEdit && (
              <button type="button" onClick={() => onRemove(s.id)} aria-label={`Remove ${vendor.name} from ${s.name}`}
                style={{ background: 'none', border: 'none', color: 'var(--text-50)', cursor: 'pointer', font: '700 13px/1 var(--f-body)', padding: 0, marginLeft: 2 }}>×</button>
            )}
          </span>
        ))}
      </div>
      {canEdit && available.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="field" style={{ height: 36, maxWidth: 240 }} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Assign to a site…</option>
            {available.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" disabled={!pick} onClick={() => { onAdd(pick); setPick('') }}>Add</button>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
function VendorModal({ open, onClose, categories, onSubmit }) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [seen, setSeen] = useState(open)
  if (open !== seen) { setSeen(open); if (open) { setName(''); setCategoryId(''); setContactName(''); setContactPhone('') } }
  if (!open) return null
  return (
    <Modal open onClose={onClose} width={430}>
      <div style={{ padding: 22 }}>
        <div style={{ font: '700 16px/1 var(--f-body)', color: 'var(--text)' }}>Add a vendor</div>
        <label className="field-label" style={{ marginTop: 16 }}>Name</label>
        <input className="field" placeholder="e.g. Safder Bhatti" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <label className="field-label" style={{ marginTop: 12 }}>Trade</label>
        <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Not set</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Contact</label>
            <input className="field" placeholder="e.g. Safder" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Phone</label>
            <input className="field" placeholder="+92 …" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={!name.trim()}
            onClick={() => onSubmit({ name: name.trim(), categoryId: categoryId || null, contactName: contactName.trim(), contactPhone: contactPhone.trim() })}>
            Add vendor
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CategoryModal({ open, onClose, existing, onSubmit }) {
  const [name, setName] = useState('')
  const [seen, setSeen] = useState(open)
  if (open !== seen) { setSeen(open); if (open) setName('') }
  if (!open) return null
  const clash = existing.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())
  return (
    <Modal open onClose={onClose} width={380}>
      <div style={{ padding: 22 }}>
        <div style={{ font: '700 16px/1 var(--f-body)', color: 'var(--text)' }}>Add a trade</div>
        <div style={{ font: '500 12.5px/1.5 var(--f-body)', color: 'var(--text-70)', marginTop: 8 }}>
          Plaster, RCC, tile, glass, ceiling, electrical — whatever your sub-contractors are hired for.
        </div>
        <label className="field-label" style={{ marginTop: 16 }}>Name</label>
        <input className="field" placeholder="e.g. Marble work" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {clash && <div style={{ font: '600 12px/1.5 var(--f-body)', color: 'var(--danger)', marginTop: 10 }}>That trade already exists.</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={!name.trim() || clash} onClick={() => onSubmit(name.trim())}>Add</button>
        </div>
      </div>
    </Modal>
  )
}

function BillModal({ open, onClose, vendors, sites, categories, onSubmit }) {
  const [vendorId, setVendorId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [rateNote, setRateNote] = useState('')
  const [startDate, setStartDate] = useState('')
  const [photos, setPhotos] = useState([])
  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) { setVendorId(''); setSiteId(''); setCategoryId(''); setTitle(''); setAmount(''); setRateNote(''); setStartDate(''); setPhotos([]) }
  }
  if (!open) return null

  const amt = Math.round(Number(String(amount).replace(/[^\d]/g, '')) || 0)
  const ready = vendorId && siteId && title.trim() && amt > 0

  return (
    <Modal open onClose={onClose} width={520}>
      <div style={{ padding: 22 }}>
        <div style={{ font: '700 16px/1 var(--f-body)', color: 'var(--text)' }}>Record a contract</div>
        <div style={{ font: '500 12.5px/1.5 var(--f-body)', color: 'var(--text-70)', marginTop: 8 }}>
          The agreement as signed. Payments against it are recorded by finance on the bank ledger.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Vendor</label>
            <select className="field" value={vendorId} onChange={(e) => setVendorId(e.target.value)} autoFocus>
              <option value="">Choose…</option>
              {vendors.filter((v) => v.status === 'active').map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Site</label>
            <select className="field" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Choose…</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <label className="field-label" style={{ marginTop: 12 }}>What the work is</label>
        <input className="field" placeholder="e.g. Plaster — blocks A & B" value={title} onChange={(e) => setTitle(e.target.value)} />

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Agreed amount (PKR)</label>
            <input className="field" inputMode="numeric" placeholder="e.g. 1,500,000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Trade</label>
            <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Not set</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Start date</label>
            <input type="date" className="field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>

        <label className="field-label" style={{ marginTop: 12 }}>Rates & terms</label>
        <textarea className="field" style={{ minHeight: 76 }} placeholder="e.g. Chinai/plaster Rs 32/sq ft, RCC Rs 55/sq ft. Rates hold only if work follows the drawing."
          value={rateNote} onChange={(e) => setRateNote(e.target.value)} />

        <div style={{ marginTop: 14 }}>
          <label className="field-label">Photo of the signed agreement (optional)</label>
          <PhotoTray photos={photos} onChange={setPhotos} max={4}
            hint="The stamped and signed page, if you have it to hand." />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={!ready}
            onClick={() => onSubmit({ vendorId, siteId, categoryId: categoryId || null, title: title.trim(), amount: amt, rateNote: rateNote.trim(), startDate: startDate || null, photos })}>
            Record contract
          </button>
        </div>
      </div>
    </Modal>
  )
}
