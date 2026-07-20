// KCEMS logo mark — a white tile with an acid-green "beam" monogram.
export function LogoMark({ size = 40, radius = 11 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        {/* stylised K / girder */}
        <path d="M5 4h5v10.5L20 4h6.5L15 15.8 27 28h-7L10 17.6V28H5V4Z" fill="#0B0C0B" />
        <rect x="4" y="4" width="24" height="3" rx="1.5" fill="#5CE62E" />
      </svg>
    </div>
  )
}

export function Wordmark({ mark = 40, stacked = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <LogoMark size={mark} />
      <div>
        <div style={{ font: `800 17px/1 var(--f-display)`, color: '#fff', letterSpacing: '-.01em' }}>KCEMS</div>
        {stacked && <div style={{ font: `500 10px/1.2 var(--f-mono)`, color: 'var(--text-40)', marginTop: 3, letterSpacing: '.08em' }}>EXPENSE MGMT</div>}
      </div>
    </div>
  )
}
