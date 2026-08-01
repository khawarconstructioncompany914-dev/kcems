// ============================================================
// KCEMS · theme toggle
//
// Two shapes, same control:
//   compact — an icon button, for the login screen's corner
//   default — icon + label, for the user card in the shell
//
// It shows the CURRENT theme and says what pressing it does, rather than
// showing the destination: a lone sun icon is ambiguous about whether it means
// "you are in light" or "go to light".
// ============================================================
import { useTheme } from '../theme.js'

const SUN = 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66l1.41-1.41M4.93 19.07l1.41-1.41m11.32 0l1.41 1.41M4.93 4.93l1.41 1.41M16 12a4 4 0 11-8 0 4 4 0 018 0Z'
const MOON = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z'

function Icon({ theme, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={theme === 'light' ? SUN : MOON} />
    </svg>
  )
}

export default function ThemeToggle({ compact = false }) {
  const [theme, toggle] = useTheme()
  const goingTo = theme === 'light' ? 'dark' : 'light'
  const label = `Switch to ${goingTo} mode`

  if (compact) {
    return (
      <button
        type="button" onClick={toggle} title={label} aria-label={label}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 11, cursor: 'pointer',
          background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--text-50)',
        }}
      >
        <Icon theme={theme} size={17} />
      </button>
    )
  }

  return (
    <button
      type="button" onClick={toggle} title={label} aria-label={label}
      className="btn btn-ghost"
      style={{ height: 38, padding: '0 12px', gap: 8, flex: 'none' }}
    >
      <Icon theme={theme} />
      <span style={{ font: '600 12px/1 var(--f-body)' }}>{theme === 'light' ? 'Light' : 'Dark'}</span>
    </button>
  )
}
