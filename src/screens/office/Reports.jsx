import { useMemo, useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, fmtDate, CATEGORIES, STATUS } from '../../data/model.js'
import { PageHeader, Card } from '../../components/page.jsx'

const iso = (d) => d.toISOString().slice(0, 10)

export default function Reports() {
  const { toast } = useStore()
  const { me, scopedExpenses, scopedSites, expenseView } = useSelectors()
  const sites = scopedSites(me)
  const rows0 = scopedExpenses(me).map(expenseView)

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const [from, setFrom] = useState(iso(monthStart))
  const [to, setTo] = useState(iso(today))
  const [siteId, setSiteId] = useState('all')
  const [status, setStatus] = useState('approved')

  const rows = useMemo(() => {
    const f = new Date(from).setHours(0, 0, 0, 0)
    const t = new Date(to).setHours(23, 59, 59, 999)
    return rows0
      .filter((e) => {
        const at = new Date(e.createdAt).getTime()
        if (at < f || at > t) return false
        if (siteId !== 'all' && e.siteId !== siteId) return false
        if (status !== 'all' && e.status !== status) return false
        return true
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [rows0, from, to, siteId, status])

  const total = rows.reduce((a, e) => a + e.amount, 0)

  const exportCsv = () => {
    const head = ['Date', 'Item', 'Category', 'Site', 'Supervisor', 'Status', 'Amount_PKR']
    const body = rows.map((e) => [fmtDate(e.createdAt), e.note, CATEGORIES[e.category].label, e.site?.name, e.supervisor?.name, STATUS[e.status].short, e.amount])
    const csv = [head, ...body].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kcems-report-${from}_to_${to}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast(`Exported ${rows.length} rows · CSV`)
  }

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Reports · exports" title="Build a report" sub="Filter the ledger by date, site and status, preview the rows, then export for accounts. CSV downloads for real; Excel/PDF are stubbed in this prototype." />

      <div className="r-grid" style={{ alignItems: 'start', maxWidth: 1160 }}>
        <Card pad={24}>
          <div style={{ font: '700 15px/1 var(--f-body)', color: '#fff', marginBottom: 16 }}>Filters</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="field-label">From</label><input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} style={{ height: 42 }} /></div>
            <div style={{ flex: 1 }}><label className="field-label">To</label><input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} style={{ height: 42 }} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Site</label>
              <select className="field" value={siteId} onChange={(e) => setSiteId(e.target.value)} style={{ height: 42 }}>
                <option value="all">All sites</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Status</label>
              <select className="field" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 42 }}>
                <option value="all">All statuses</option>
                <option value="approved">Approved</option>
                <option value="finance_review">Finance review</option>
                <option value="engineer_review">Engineer review</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label className="field-label">Export as</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={exportCsv}>⬇ CSV (.csv)</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => toast('Excel export — stubbed in prototype', 'warn')}>Excel</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => toast('PDF export — stubbed in prototype', 'warn')}>PDF</button>
            </div>
          </div>
        </Card>

        <Card pad={20}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ font: '600 12px/1.4 var(--f-mono)', color: 'var(--text-50)' }}>PREVIEW · {rows.length} rows</div>
            <div className="num" style={{ font: '700 20px/1 var(--f-display)', color: 'var(--accent)' }}>{formatMoney(total)}</div>
          </div>
          <div style={{ display: 'flex', font: '500 10px/1 var(--f-mono)', color: 'var(--text-35, var(--text-40))', margin: '16px 0 4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            <span style={{ flex: 2, color: 'var(--text-40)' }}>Date · item</span><span style={{ flex: 1, color: 'var(--text-40)' }}>Site</span><span style={{ flex: 1, textAlign: 'right', color: 'var(--text-40)' }}>Amount</span>
          </div>
          <div style={{ maxHeight: 380, overflow: 'auto' }}>
            {rows.length === 0 && <div style={{ padding: '30px 0', textAlign: 'center', font: '500 12px/1 var(--f-body)', color: 'var(--text-40)' }}>No rows match these filters.</div>}
            {rows.map((e) => (
              <div key={e.id} style={{ display: 'flex', font: '500 12px/1.3 var(--f-body)', color: '#fff', padding: '9px 0', borderTop: '1px solid var(--border-3)' }}>
                <span style={{ flex: 2 }}>{fmtDate(e.createdAt)} · {e.note}</span>
                <span style={{ flex: 1, color: 'var(--text-50)' }}>{e.site?.label}</span>
                <span className="num" style={{ flex: 1, textAlign: 'right' }}>{formatMoney(e.amount).replace('Rs ', '')}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
