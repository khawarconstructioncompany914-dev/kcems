// Owner / finance / admin: browse and search every bill photo in the company.
//
// The point of this screen is "find me that bill" — so filtering is by the
// things someone actually remembers about a bill: who submitted it, which
// site, roughly when, and a word from the note.
import { useMemo, useState } from 'react'
import { useSelectors } from '../../store.jsx'
import { formatMoney, fmtDate, CATEGORIES, STATUS } from '../../data/model.js'
import { PageHeader, Kpi } from '../../components/page.jsx'
import { StatusPill, Empty, Monogram } from '../../components/bits.jsx'
import { usePhotoUrls, PhotoViewer, photosOf } from '../../components/photos.jsx'

// Signing is batched, but the server caps a batch at 150 paths — so render a
// page at a time rather than firing a 400-thumbnail request at it.
const PAGE = 60

export default function Bills() {
  const { me, scopedExpenses, expenseView, userById, siteById, state } = useSelectors()

  const [q, setQ] = useState('')
  const [who, setWho] = useState('')
  const [site, setSite] = useState('')
  const [cat, setCat] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState(null)   // { photos, index }

  const all = useMemo(
    () => scopedExpenses(me).map(expenseView).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [me, scopedExpenses, expenseView],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const fromT = from ? new Date(from).setHours(0, 0, 0, 0) : null
    const toT = to ? new Date(to).setHours(23, 59, 59, 999) : null
    return all.filter((e) => {
      if (who && e.supervisorId !== who) return false
      if (site && e.siteId !== site) return false
      if (cat && e.category !== cat) return false
      if (status && e.status !== status) return false
      if (needle && !String(e.note || '').toLowerCase().includes(needle)) return false
      const t = new Date(e.createdAt).getTime()
      if (fromT && t < fromT) return false
      if (toT && t > toT) return false
      return true
    })
  }, [all, q, who, site, cat, status, from, to])

  const page = filtered.slice(0, limit)

  // one signing request for every thumbnail on the page
  const thumbs = useMemo(() => page.map((e) => photosOf(e)[0]).filter(Boolean), [page])
  const src = usePhotoUrls(thumbs)

  const total = filtered.reduce((a, e) => a + e.amount, 0)
  const withPhotos = filtered.filter((e) => photosOf(e).length > 0).length
  const people = useMemo(
    () => [...new Map(all.map((e) => [e.supervisorId, userById(e.supervisorId)])).values()].filter(Boolean),
    [all, userById],
  )

  const clear = () => { setQ(''); setWho(''); setSite(''); setCat(''); setStatus(''); setFrom(''); setTo(''); setLimit(PAGE) }
  const active = q || who || site || cat || status || from || to

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Bills · archive"
        title="Every bill on file"
        sub="Search and filter every photographed bill and receipt across all sites. Click any card to open the photos full size with the time each was taken."
        right={active ? <button className="btn btn-ghost" onClick={clear}>Clear filters</button> : null}
      />

      <div className="r-row" style={{ marginBottom: 20 }}>
        <Kpi label="Bills shown" value={filtered.length} sub={`${withPhotos} with a photo attached`} accent />
        <Kpi label="Value shown" value={formatMoney(total)} sub="sum of matching bills" />
        <Kpi label="Total on file" value={all.length} sub="across every site & status" />
      </div>

      {/* filters */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <input className="field" placeholder="Search the note — e.g. cement, diesel, tiles"
          value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} style={{ marginBottom: 12 }} />
        {/* --r-cols is substituted straight into grid-template-columns, so it
            has to be a track list — a bare "3" is invalid and drops the rule */}
        <div className="r-grid" style={{ '--r-cols': 'repeat(3, 1fr)', gap: 10 }}>
          <select className="field" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Anyone</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="field" value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">All sites</option>
            {state.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="field" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
          <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
          <input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        </div>
      </div>

      {page.length === 0
        ? <Empty title="No bills match" sub={active ? 'Try widening the filters.' : 'Nothing has been logged yet.'} />
        : (
          <div className="r-cards" style={{ '--r-min': '260px' }}>
            {page.map((e) => {
              const ph = photosOf(e)
              const first = ph[0]
              const url = first ? src(first) : null
              return (
                <button key={e.id} type="button" onClick={() => ph.length && setOpen({ photos: ph, index: 0 })}
                  className="card" style={{ padding: 0, overflow: 'hidden', textAlign: 'left', border: '1px solid var(--border)', cursor: ph.length ? 'zoom-in' : 'default', display: 'block', width: '100%' }}>
                  <div style={{ position: 'relative', aspectRatio: '4/3', background: '#0d0f0c' }}>
                    {url
                      ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', font: '600 10px/1 var(--f-mono)', color: 'var(--text-40)' }}>
                          {ph.length ? 'LOADING…' : 'NO PHOTO'}
                        </span>}
                    {ph.length > 1 && (
                      <span style={{ position: 'absolute', top: 8, right: 8, padding: '2px 7px', borderRadius: 6, background: 'rgba(5,6,5,.78)', font: '600 10px/1.6 var(--f-mono)', color: '#fff' }}>
                        {ph.length} photos
                      </span>
                    )}
                    <span style={{ position: 'absolute', bottom: 8, left: 8 }}><StatusPill status={e.status} small /></span>
                  </div>
                  <div style={{ padding: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ font: '700 13px/1.3 var(--f-body)', color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.note}</div>
                      <div className="num" style={{ font: '700 14px/1 var(--f-display)', color: '#fff', flex: 'none' }}>{formatMoney(e.amount)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9 }}>
                      <Monogram name={e.supervisor?.name} color="var(--accent)" soft="var(--accent-soft)" size={22} radius={7} />
                      <span style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--text-42)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.supervisor?.name} · {e.kind === 'reimbursement' ? 'Reimbursement' : (e.site?.label || e.site?.name || '—')}
                      </span>
                      <span style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--text-40)', flex: 'none' }}>{fmtDate(e.createdAt)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

      {filtered.length > page.length && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={() => setLimit((n) => n + PAGE)}>
            Show {Math.min(PAGE, filtered.length - page.length)} more · {filtered.length - page.length} remaining
          </button>
        </div>
      )}

      <PhotoViewer
        photos={open?.photos || []} index={open?.index || 0} open={Boolean(open)}
        onClose={() => setOpen(null)} onIndex={(i) => setOpen((o) => ({ ...o, index: i }))}
      />
    </div>
  )
}
