// Shared layout atoms for the office (desktop) surfaces.

export function PageHeader({ eyebrow, title, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 10 }}>{eyebrow}</div>}
        <h1 style={{ font: '700 26px/1.05 var(--f-display)', color: '#fff', letterSpacing: '-.02em', margin: 0 }}>{title}</h1>
        {sub && <div style={{ font: '500 13px/1.5 var(--f-body)', color: 'var(--text-42)', marginTop: 8, maxWidth: 560 }}>{sub}</div>}
      </div>
      {right}
    </div>
  )
}

export function Kpi({ label, value, sub, color = '#fff', accent }) {
  return (
    <div className="card" style={{ padding: '18px 20px', flex: 1, minWidth: 150, position: 'relative', overflow: 'hidden' }}>
      {accent && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 100% 0%, rgba(92,232,56,.08), transparent 60%)', pointerEvents: 'none' }} />}
      <div style={{ font: '600 10px/1 var(--f-mono)', letterSpacing: '.06em', color: 'var(--text-40)', textTransform: 'uppercase' }}>{label}</div>
      <div className="num" style={{ font: '700 26px/1 var(--f-display)', color, marginTop: 12 }}>{value}</div>
      {sub && <div style={{ font: '500 11px/1.3 var(--f-body)', color: 'var(--text-42)', marginTop: 8 }}>{sub}</div>}
    </div>
  )
}

export function SectionTitle({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0 14px' }}>
      <div style={{ font: '700 15px/1 var(--f-body)', color: '#fff' }}>{children}</div>
      {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
    </div>
  )
}

export function Card({ children, style, pad = 22, className = '' }) {
  return <div className={`card ${className}`} style={{ padding: pad, ...style }}>{children}</div>
}
