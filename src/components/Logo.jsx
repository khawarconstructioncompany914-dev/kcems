// KCEMS logo — the real Khawar Construction mark (green on transparent).
const SRC = '/logo-green.png'

// small tile version — sidebar, forms
export function LogoMark({ size = 44, radius = 12 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: '#0f110f', border: '1px solid rgba(92,232,56,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxShadow: '0 0 22px rgba(92,232,56,.10) inset' }}>
      <img src={SRC} alt="Khawar Construction" style={{ width: Math.round(size * 0.64), height: 'auto', display: 'block', filter: 'drop-shadow(0 0 6px rgba(92,232,56,.55))' }} />
    </div>
  )
}

// large free-standing logo for the login hero
export function LogoImage({ width = 340, float = true }) {
  return <img src={SRC} alt="Khawar Construction" style={{ width, height: 'auto', display: 'block', filter: 'drop-shadow(0 0 30px rgba(92,232,56,.55))', animation: float ? 'floatY 6s ease-in-out infinite' : 'none' }} />
}

export function Wordmark({ mark = 44, stacked = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <LogoMark size={mark} />
      <div style={{ lineHeight: 1 }}>
        <div style={{ font: '900 18px/1 var(--f-display)', color: '#fff', letterSpacing: '.02em' }}>KCEMS</div>
        {/* spelled out rather than "MGMT" — tightened tracking so the longer
            word still fits the sidebar without wrapping */}
        {stacked && <div style={{ font: '400 10px/1.2 var(--f-mono)', color: 'var(--text-40)', marginTop: 4, letterSpacing: '.11em', whiteSpace: 'nowrap' }}>EXPENSE MANAGEMENT</div>}
      </div>
    </div>
  )
}
