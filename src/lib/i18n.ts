// UI language. Strings are written in English and passed through t(), which
// looks them up in the Thai dictionary when Thai is active; anything missing
// falls back to English. "system" follows the browser's language, like the
// theme's "system". Stored per device in localStorage.
//
// The language is fixed for the page's lifetime (module-level labels are
// translated when their module loads), so changing it reloads the page.

import { th } from '@/locales/th'

export type Language = 'en' | 'th'
export type LanguagePreference = Language | 'system'

const KEY = 'bw.language'

export function getLanguagePreference(): LanguagePreference {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'en' || stored === 'th' ? stored : 'system'
  } catch {
    return 'system'
  }
}

/** The browser's preferred language, narrowed to the ones we have. */
export function systemLanguage(): Language {
  const lang = typeof navigator === 'undefined' ? '' : (navigator.language ?? '')
  return lang.toLowerCase().startsWith('th') ? 'th' : 'en'
}

function resolve(preference: LanguagePreference): Language {
  return preference === 'system' ? systemLanguage() : preference
}

let current: Language = resolve(getLanguagePreference())

export function getLanguage(): Language {
  return current
}

/** Locale for dates and month names. Thai shows Buddhist-era years. */
export function dateLocale(): string {
  return current === 'th' ? 'th-TH' : 'en-GB'
}

/**
 * Save a preference. Returns true when the active language changes, in which
 * case the caller should reload the page to re-render every label.
 */
export function setLanguagePreference(preference: LanguagePreference): boolean {
  try {
    if (preference === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, preference)
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  return resolve(preference) !== current
}

/**
 * Translate `text` (the English source string). `{name}` placeholders are
 * filled from `vars` in either language.
 */
export function t(text: string, vars?: Record<string, string | number>): string {
  const out = current === 'th' ? (th[text] ?? text) : text
  if (!vars) return out
  return out.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}

/** Re-render every label in the new language. */
export function reloadPage(): void {
  window.location.reload()
}

/** Set <html lang> so screen readers and fonts pick the right language. */
export function initLanguage(): void {
  document.documentElement.lang = current
}

/** Test hook: switch the active language without a reload. */
export function __setLanguageForTests(language: Language): void {
  current = language
}
