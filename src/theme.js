// ============================================================
// KCEMS · theme
//
// Dark is the product. Light is an option, and it is opt-in: this never reads
// prefers-color-scheme, because "the phone is in light mode" is not the same
// statement as "I want this app light", and the dark theme is the one the
// design was built around.
//
// The only thing that actually switches anything is the data-theme attribute
// on <html>. Everything else here is bookkeeping around that one line.
//
// The attribute is set BEFORE this module loads, by the inline script in
// index.html — otherwise a light-mode user gets a dark flash on every cold
// start while the bundle downloads.
// ============================================================
import { useCallback, useEffect, useState } from 'react'

const KEY = 'kcems.theme'
export const THEMES = ['dark', 'light']

// The phone's status bar is tinted by this, so it has to move with the theme
// or the bar stays black above a white app.
const BAR = { dark: '#070807', light: '#F4F4F1' }

export function getTheme() {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function setTheme(next) {
  const theme = next === 'light' ? 'light' : 'dark'
  const root = document.documentElement

  // Dark is the default, so it is the ABSENCE of the attribute rather than a
  // value of it. That keeps :root as the single description of the dark theme.
  if (theme === 'light') root.dataset.theme = 'light'
  else delete root.dataset.theme

  try { localStorage.setItem(KEY, theme) } catch { /* private mode — session only */ }

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', BAR[theme])

  // Same event the inline script and other tabs can listen for.
  window.dispatchEvent(new CustomEvent('kcems:theme', { detail: theme }))
  return theme
}

export const toggleTheme = () => setTheme(getTheme() === 'light' ? 'dark' : 'light')

// Subscribes to changes from anywhere — this tab's toggle, or another tab.
export function useTheme() {
  const [theme, setLocal] = useState(getTheme)

  useEffect(() => {
    const onLocal = (e) => setLocal(e.detail)
    // Two people on one site office desktop, two tabs: changing the theme in
    // one should not leave the other disagreeing with localStorage.
    const onStorage = (e) => {
      if (e.key !== KEY || !e.newValue) return
      const t = e.newValue === 'light' ? 'light' : 'dark'
      if (t === 'light') document.documentElement.dataset.theme = 'light'
      else delete document.documentElement.dataset.theme
      setLocal(t)
    }
    window.addEventListener('kcems:theme', onLocal)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('kcems:theme', onLocal)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const toggle = useCallback(() => setLocal(toggleTheme()), [])
  return [theme, toggle]
}
