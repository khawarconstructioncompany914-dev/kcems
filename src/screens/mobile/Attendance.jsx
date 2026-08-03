// Field attendance. One tap to mark today, a leave request that can cover a
// range of days ahead, and a fortnight strip so someone can see their own
// record without a trip to the office grid.
//
// The marking itself lives in components/attendance.jsx — the office screen
// renders the same thing, because every role marks their own attendance now.
import { useStore, useSelectors } from '../../store.jsx'
import { SelfAttendance } from '../../components/attendance.jsx'
import { MARK, markMeta, dayKey } from '../../data/attendance.js'

const LAST_DAYS = 14

export default function FieldAttendance() {
  const { me, attendanceOn } = useSelectors()
  useStore()   // subscribe: the strip has to redraw the moment a mark lands

  const strip = Array.from({ length: LAST_DAYS }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (LAST_DAYS - 1 - i))
    return { d, row: attendanceOn(me.id, dayKey(d)) }
  })

  return (
    <div className="field-screen">
      <div style={{ padding: '6px 20px 4px' }}>
        <div style={{ font: '700 20px/1 var(--f-display)', color: 'var(--text)' }}>Attendance</div>
      </div>

      <div style={{ margin: '12px 16px 0' }}>
        <SelfAttendance variant="field" />
      </div>

      {/* last fortnight */}
      <div style={{ padding: '22px 16px 0' }}>
        <div style={{ font: '600 12px/1.4 var(--f-mono)', letterSpacing: '.1em', color: 'var(--text-50)', margin: '0 4px 12px' }}>LAST {LAST_DAYS} DAYS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {strip.map(({ d, row }) => {
            const m = markMeta(row)
            return (
              <div key={dayKey(d)} className="surface" style={{ borderRadius: 11, padding: '9px 4px', textAlign: 'center', border: '1px solid var(--border-3)' }}>
                <div style={{ font: '500 11px/1.3 var(--f-body)', color: 'var(--text-50)' }}>{d.toLocaleDateString('en-GB', { weekday: 'narrow' })}</div>
                <div style={{ font: '700 13px/1.3 var(--f-display)', color: 'var(--text)', marginTop: 2 }}>{d.getDate()}</div>
                <div style={{ width: 9, height: 9, borderRadius: '50%', margin: '7px auto 0', background: m ? m.color : 'transparent', border: m ? 'none' : '1px solid var(--border)' }} />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
          {Object.entries(MARK).map(([k, v]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 12px/1.4 var(--f-body)', color: 'var(--text-70)' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: v.color }} />{v.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
