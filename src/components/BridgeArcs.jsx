// Animated bridge/route line-art for the login hero — arcs draw in, sway & shimmer.
export function BridgeArcs() {
  return (
    <svg viewBox="0 0 640 440" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block', animation: 'arcBreathe 6s ease-in-out infinite' }} aria-hidden>
      <g fill="none" stroke="var(--accent)" strokeLinecap="round" style={{ animation: 'arcSway 9s ease-in-out infinite, arcShimmer 5s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
        <path pathLength="1" d="M10 400 Q 300 20 590 200" strokeWidth="11" strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'arcDraw 2.4s ease .1s forwards' }} />
        <path pathLength="1" d="M60 420 Q 330 110 620 250" strokeWidth="6" strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'arcDraw 2.4s ease .35s forwards' }} />
        <path pathLength="1" d="M120 320 Q 350 70 540 150" strokeWidth="4" strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'arcDraw 2.2s ease .55s forwards', opacity: .8 }} />
        <path pathLength="1" d="M255 420 L 425 70" strokeWidth="9" strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'arcDraw 2s ease .5s forwards' }} />
        <path pathLength="1" d="M470 210 Q 545 120 630 175" strokeWidth="4" strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'arcDraw 1.8s ease .8s forwards', opacity: .75 }} />
        <path pathLength="1" d="M500 260 L 585 95" strokeWidth="5" strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'arcDraw 1.8s ease .9s forwards', opacity: .7 }} />
      </g>
      <g stroke="var(--accent-line)" strokeWidth="2" strokeLinecap="round">
        <path fill="none" d="M0 300 L 640 300" style={{ strokeDasharray: '3 14', animation: 'deckFlow 5s linear infinite', opacity: .55 }} />
      </g>
    </svg>
  )
}
