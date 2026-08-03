// ============================================================
// KCEMS · activity log
//
// Every state-machine function has written an audit_log row since the first
// migration, and until now nothing ever read one back: the trail existed and
// was unreachable. This is the surface for it — owner and admin only, because
// it spans everyone's actions across every site.
// ============================================================
import { useMemo, useState } from 'react'
import { useStore, useSelectors } from '../../store.jsx'
import { formatMoney, fmtDate, ROLES } from '../../data/model.js'
import { formatTime12 } from '../../data/attendance.js'
import { PageHeader, Card } from '../../components/page.jsx'
import { Monogram, Empty } from '../../components/bits.jsx'

// action string -> how it reads in a sentence. Anything unmapped falls back to
// the raw key rather than being hidden: an entry nobody has written a label for
// is still evidence, and dropping it would quietly put holes in the trail.
const VERBS = {
  'expense.create': ['logged an expense', 'money'],
  'expense.claim': ['filed a reimbursement claim', 'money'],
  'expense.pass_up': ['passed an expense to finance', 'flow'],
  'expense.return': ['sent an expense back to be fixed', 'flow'],
  'expense.resubmit': ['re-submitted a returned expense', 'flow'],
  'expense.approve': ['approved an expense', 'good'],
  'expense.reject': ['rejected an expense', 'bad'],
  'expense.settle': ['settled an owed amount', 'good'],
  'funds.add': ['handed over funds', 'money'],
  'user.create': ['created a login', 'admin'],
  'user.update': ['edited a user', 'admin'],
  'user.reassign': ['re-assigned a site engineer', 'admin'],
  'user.reset_password': ['reset a password', 'admin'],
  'user.set_password': ['set a password', 'admin'],
  'user.change_password': ['changed their own password', 'admin'],
  'site.create': ['created a site', 'admin'],
  'site.update': ['edited a site', 'admin'],
  'site.progress': ['logged site progress', 'flow'],
  'attendance.mark': ['marked their attendance', 'flow'],
  'attendance.review': ['decided a leave request', 'flow'],
}

const KIND_COLOR = {
  money: 'var(--accent)', good: 'var(--accent)', bad: 'var(--danger)',
  flow: 'var(--info)', admin: 'var(--text-50)',
}

const GROUPS = {
  all: () => true,
  money: (a) => a.action.startsWith('expense.') || a.action.startsWith('funds.'),
  people: (a) => a.action.startsWith('user.') || a.action.startsWith('attendance.'),
  sites: (a) => a.action.startsWith('site.'),
}

// The `after` blob differs per action; show only the parts that mean something
// to a person reading the list, and never dump raw JSON at them.
function detail(row) {
  const a = row.after || {}
  const bits = []
  if (typeof a.amount === 'number') bits.push(formatMoney(a.amount))
  // Skip the status when the verb already said it — "approved an expense —
  // approved" reads like a stutter. It still shows where it carries new
  // information, e.g. "logged an expense — Rs 12,000 · engineer review".
  const verb = String(row.action).split('.').pop()
  if (a.status && !String(a.status).startsWith(verb.replace(/e$/, ''))) {
    bits.push(String(a.status).replace(/_/g, ' '))
  }
  if (typeof a.pct === 'number') bits.push(`${a.pct}%`)
  if (a.kind) bits.push(a.kind)
  if (a.role) bits.push(ROLES[a.role]?.label || a.role)
  if (a.username) bits.push(a.username)
  if (a.name) bits.push(a.name)
  if (a.rejectReason) bits.push(`“${a.rejectReason}”`)
  if (a.returnNote) bits.push(`“${a.returnNote}”`)
  return bits.join(' · ')
}

const when = (iso) => `${fmtDate(iso)} · ${formatTime12(iso)}`

export default function Activity() {
  const { state } = useStore()
  const { userById } = useSelectors()
  const [group, setGroup] = useState('all')
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (state.audit || [])
      .filter(GROUPS[group] || GROUPS.all)
      .filter((a) => {
        if (!term) return true
        const label = VERBS[a.action]?.[0] || a.action
        return `${a.actorName || ''} ${label} ${detail(a)}`.toLowerCase().includes(term)
      })
  }, [state.audit, group, q])

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Owner · activity"
        title="Activity log"
        sub="Every approval, rejection, hand-over of cash and change to a login, in the order it happened. Written by the database itself as each change is made — it cannot be edited or deleted from inside the app."
      />

      <Card pad={20} style={{ maxWidth: 1000 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all', 'Everything'], ['money', 'Money'], ['people', 'People'], ['sites', 'Sites']].map(([k, label]) => (
              <button key={k} type="button" className={`chip${group === k ? ' on' : ''}`} onClick={() => setGroup(k)}>{label}</button>
            ))}
          </div>
          <input
            className="field"
            style={{ flex: 1, minWidth: 200, height: 40 }}
            placeholder="Search — e.g. a name, an amount, “rejected”"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {rows.length === 0 && (
          <Empty
            title={state.audit?.length ? 'Nothing matches that' : 'No activity recorded yet'}
            sub={state.audit?.length
              ? 'Try a different search, or switch back to Everything.'
              : 'Approvals, funds and account changes will appear here as they happen.'}
          />
        )}

        {rows.map((a) => {
          const [label, kind] = VERBS[a.action] || [a.action, 'admin']
          const actor = userById(a.actorId)
          const role = ROLES[a.actorRole || actor?.role] || {}
          const info = detail(a)
          return (
            <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 0', borderTop: '1px solid var(--border-3)' }}>
              <Monogram name={a.actorName || actor?.name || '?'} color={role.color} soft={role.soft} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 13px/1.45 var(--f-body)', color: 'var(--text)' }}>
                  <b style={{ fontWeight: 700 }}>{a.actorName || actor?.name || 'Someone'}</b>
                  <span style={{ color: KIND_COLOR[kind] || 'var(--text-50)', fontWeight: 600 }}> {label}</span>
                  {info && <span style={{ color: 'var(--text-50)', fontWeight: 500 }}> — {info}</span>}
                </div>
                <div style={{ font: '500 11px/1.4 var(--f-mono)', color: 'var(--text-40)', marginTop: 4, letterSpacing: '.03em' }}>
                  {when(a.createdAt)}{role.label ? ` · ${role.label}` : ''}
                </div>
              </div>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
