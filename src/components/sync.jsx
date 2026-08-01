// ============================================================
// KCEMS · connection + sync status
//
// Shown in the shell on every screen, and only when there is something to say.
// A field app that quietly fails to save is worse than one that refuses, so the
// two states this must never leave ambiguous are "your expense is saved on this
// phone and will send itself" and "your expense could not be sent at all".
// ============================================================
import { useStore } from '../store.jsx'
import { ACTION_LABEL } from '../offline.js'

const Bar = ({ tone, children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    padding: '9px 14px', borderRadius: 10, marginBottom: 14,
    font: '600 12.5px/1.45 var(--f-body)',
    color: tone.fg, background: tone.bg, border: `1px solid ${tone.border}`,
  }}>{children}</div>
)

const TONES = {
  warn: { fg: 'var(--warn)', bg: 'var(--warn-soft, rgba(240,180,41,.1))', border: 'rgba(240,180,41,.28)' },
  danger: { fg: 'var(--danger)', bg: 'var(--danger-soft)', border: 'rgba(242,112,79,.28)' },
  info: { fg: 'var(--info)', bg: 'var(--info-soft)', border: 'rgba(90,160,255,.26)' },
}

const Dot = ({ color }) => (
  <span style={{ width: 7, height: 7, borderRadius: 99, background: color, flex: 'none' }} />
)

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function SyncStatus() {
  const { online, stale, pending, failed, syncNow, discardFailed } = useStore()

  if (!pending.length && !failed.length && online && !stale) return null

  return (
    <>
      {!online && (
        <Bar tone={TONES.warn}>
          <Dot color="var(--warn)" />
          <span style={{ flex: 1, minWidth: 200 }}>
            No connection.{' '}
            <span style={{ fontWeight: 500, opacity: .85 }}>
              You can still log expenses and mark attendance — they save on this device and send themselves when you have signal.
            </span>
          </span>
        </Bar>
      )}

      {online && stale && (
        <Bar tone={TONES.info}>
          <Dot color="var(--info)" />
          <span style={{ flex: 1, minWidth: 200, fontWeight: 500 }}>
            Showing saved data — the server could not be reached on the last refresh.
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => syncNow()}>Retry</button>
        </Bar>
      )}

      {pending.length > 0 && (
        <Bar tone={TONES.warn}>
          <Dot color="var(--warn)" />
          <span style={{ flex: 1, minWidth: 200 }}>
            {plural(pending.length, 'item')} waiting to send
            <span style={{ fontWeight: 500, opacity: .8 }}>
              {' · '}{pending.map((p) => ACTION_LABEL[p.action?.type] || 'Item').join(', ')}
            </span>
          </span>
          {online && <button className="btn btn-ghost btn-sm" onClick={() => syncNow()}>Send now</button>}
        </Bar>
      )}

      {failed.length > 0 && (
        <Bar tone={TONES.danger}>
          <Dot color="var(--danger)" />
          <span style={{ flex: 1, minWidth: 200 }}>
            {plural(failed.length, 'saved item')} could not be sent and will not be retried.
            <span style={{ fontWeight: 500, opacity: .85 }}>
              {' '}You will need to enter {failed.length === 1 ? 'it' : 'them'} again.
              {failed[0]?.error ? ` (${failed[0].error})` : ''}
            </span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => discardFailed()}>Dismiss</button>
        </Bar>
      )}
    </>
  )
}
