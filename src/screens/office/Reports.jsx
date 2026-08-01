import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, fmtDate, CATEGORIES, STATUS } from '../../data/model.js'
import { PageHeader, Card } from '../../components/page.jsx'

const iso = (d) => d.toISOString().slice(0, 10)

const STATUS_LABEL = {
  all: 'All statuses', approved: 'Approved', finance_review: 'Finance review',
  engineer_review: 'Head engineer review', rejected: 'Rejected',
}

export default function Reports() {
  const { toast, state, loadFullHistory } = useStore()
  const { me, scopedExpenses, scopedSites, expenseView } = useSelectors()
  const sites = scopedSites(me)
  const rows0 = scopedExpenses(me).map(expenseView)

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const [from, setFrom] = useState(iso(monthStart))
  const [to, setTo] = useState(iso(today))
  const [siteId, setSiteId] = useState('all')
  const [status, setStatus] = useState('approved')
  const [busy, setBusy] = useState('')

  // The snapshot the app runs on is windowed (api/data.js), which is fine for
  // every other screen and wrong for exactly this one: a report is the place
  // people deliberately look further back than the app normally carries. When
  // the chosen start date falls outside the window, pull the full history once.
  const askedForFull = useRef(false)
  useEffect(() => {
    if (askedForFull.current || !state.windowed || !state.windowDays) return
    const cutoff = Date.now() - state.windowDays * 86_400_000
    if (new Date(from).getTime() >= cutoff) return
    askedForFull.current = true
    setBusy('Loading older records…')
    Promise.resolve(loadFullHistory()).finally(() => setBusy(''))
  }, [from, state.windowed, state.windowDays, loadFullHistory])

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
  const siteName = siteId === 'all' ? 'All sites' : (sites.find((s) => s.id === siteId)?.name || '—')
  const baseName = `kcems-report-${from}_to_${to}`

  // Same columns in every format, so the CSV, the spreadsheet and the printed
  // page cannot drift apart.
  const COLUMNS = [
    { head: 'Date', width: 13, get: (e) => fmtDate(e.createdAt) },
    { head: 'Item', width: 40, get: (e) => e.note || '' },
    { head: 'Category', width: 15, get: (e) => CATEGORIES[e.category]?.label || e.category },
    { head: 'Site', width: 22, get: (e) => e.site?.name || '—' },
    { head: 'Site Engineer', width: 22, get: (e) => e.supervisor?.name || '—' },
    { head: 'Status', width: 15, get: (e) => STATUS[e.status]?.short || e.status },
    { head: 'Amount (PKR)', width: 15, get: (e) => e.amount, number: true },
  ]

  const download = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const guard = () => {
    if (rows.length) return true
    toast('Nothing to export — no rows match these filters.', 'warn')
    return false
  }

  const exportCsv = () => {
    if (!guard()) return
    const body = rows.map((e) => COLUMNS.map((c) => c.get(e)))
    const csv = [COLUMNS.map((c) => c.head), ...body]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    download(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${baseName}.csv`)
    toast(`Exported ${rows.length} rows · CSV`)
  }

  // Loaded on demand: the spreadsheet writer is a few hundred KB and this
  // screen is owner/finance only, on a desktop. Nobody's phone should carry it
  // in the main bundle for a button they will never press.
  const exportExcel = async () => {
    if (!guard()) return
    setBusy('Building spreadsheet…')
    try {
      // the /browser entry point — the package has no root export, and the
      // /node one pulls in fs
      const { default: writeXlsxFile } = await import('write-excel-file/browser')
      // v4's `columns` API — `schema` was removed in v4 and throws.
      const columns = COLUMNS.map((c) => ({
        width: c.width,
        header: { value: c.head, fontWeight: 'bold', backgroundColor: '#EFEFEF', align: 'left' },
        // Real numbers with a thousands format, not text that looks like a
        // number — accounts need to sum this column without retyping it.
        cell: (e) => (c.number
          ? { type: Number, value: Number(c.get(e)), format: '#,##0', align: 'right' }
          : { type: String, value: String(c.get(e) ?? '') }),
      }))
      // v4 returns a builder rather than downloading by itself — .toFile() is
      // what actually produces the download.
      await writeXlsxFile(rows, { columns, sheet: 'Expenses' }).toFile(`${baseName}.xlsx`)
      toast(`Exported ${rows.length} rows · Excel`)
    } catch (err) {
      toast(`Excel export failed: ${err?.message || err}`, 'danger')
    } finally {
      setBusy('')
    }
  }

  // The browser's own print pipeline produces the PDF. That gives correct page
  // breaks, page size and margins for free, and keeps a PDF engine out of a
  // bundle that gets downloaded over site mobile data.
  const exportPdf = () => {
    if (!guard()) return
    window.print()
  }

  return (
    <div className="fade-up">
      <div className="print-hide">
        <PageHeader
          eyebrow="Reports · exports"
          title="Build a report"
          sub="Filter the ledger by date, site and status, preview the rows, then export for accounts. CSV and Excel download as files; PDF opens your browser's print dialog — choose “Save as PDF”."
        />
      </div>

      <div className="r-grid print-hide" style={{ alignItems: 'start', maxWidth: 1160 }}>
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
                {Object.entries(STATUS_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label className="field-label">Export as</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={exportCsv} disabled={Boolean(busy)}>⬇ CSV</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={exportExcel} disabled={Boolean(busy)}>⬇ Excel</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={exportPdf} disabled={Boolean(busy)}>⎙ PDF</button>
            </div>
            {busy && <div style={{ font: '600 12px/1.4 var(--f-mono)', color: 'var(--text-50)', marginTop: 10 }}>{busy}</div>}
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

      {/* ---------- printed sheet (hidden on screen, see @media print) ---------- */}
      <div className="print-only print-sheet">
        <div className="print-head">
          <div>
            <h1>Khawar Construction Co.</h1>
            <div className="print-sub">Expense report · {STATUS_LABEL[status]}</div>
          </div>
          <div className="print-meta">
            <div>{fmtDate(from)} — {fmtDate(to)}</div>
            <div>{siteName}</div>
            <div>Prepared by {me?.name} · {fmtDate(new Date().toISOString())}</div>
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>{COLUMNS.map((c) => <th key={c.head} className={c.number ? 'num-col' : ''}>{c.head}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                {COLUMNS.map((c) => (
                  <td key={c.head} className={c.number ? 'num-col' : ''}>
                    {c.number ? Number(c.get(e)).toLocaleString('en-PK') : c.get(e)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={COLUMNS.length - 1}>Total · {rows.length} {rows.length === 1 ? 'row' : 'rows'}</td>
              <td className="num-col">{total.toLocaleString('en-PK')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
