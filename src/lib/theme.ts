// Theme preference. Dark mode is the `.dark` class on <html> (see index.css);
// "system" follows the OS setting. Stored per device in localStorage.

export type ThemePreference = 'light' | 'dark' | 'system'

const KEY = 'bw.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

/** Reflect a preference onto the document. */
export function applyTheme(preference: ThemePreference = getThemePreference()): void {
  const dark = preference === 'dark' || (preference === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function setThemePreference(preference: ThemePreference): void {
  if (preference === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, preference)
  applyTheme(preference)
}

/** Apply the saved theme at startup and keep "system" in sync with the OS. */
export function initTheme(): void {
  applyTheme()
  if (typeof window.matchMedia !== 'function') return
  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (getThemePreference() === 'system') applyTheme('system')
  })
}
