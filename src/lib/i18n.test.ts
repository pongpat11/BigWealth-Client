import { afterEach, describe, expect, it, vi } from 'vitest'
import { th } from '@/locales/th'
import {
  __setLanguageForTests,
  dateLocale,
  getLanguagePreference,
  setLanguagePreference,
  systemLanguage,
  t,
} from './i18n'

/** Every string literal passed to t() in the app source. */
function sourceKeys(): Set<string> {
  const files = import.meta.glob<string>(
    ['../**/*.{ts,tsx}', '!../**/*.test.*', '!../**/mock/**'],
    { query: '?raw', import: 'default', eager: true },
  )
  const keys = new Set<string>()
  for (const src of Object.values(files)) {
    for (const m of src.matchAll(/\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) {
      keys.add(m[2].replace(/\\(.)/g, '$1'))
    }
  }
  return keys
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('Thai dictionary', () => {
  const keys = sourceKeys()

  it('translates every string the app shows', () => {
    const missing = [...keys].filter((k) => !(k in th))
    expect(missing).toEqual([])
  })

  it('has no leftover entries', () => {
    const unused = Object.keys(th).filter((k) => !keys.has(k))
    expect(unused).toEqual([])
  })

  it('keeps the placeholders of each key', () => {
    const broken = Object.entries(th).filter(
      ([en, thai]) => placeholders(en).join() !== placeholders(thai).join(),
    )
    expect(broken).toEqual([])
  })
})

describe('t', () => {
  afterEach(() => __setLanguageForTests('en'))

  it('returns English as written and fills placeholders', () => {
    expect(t('Save')).toBe('Save')
    expect(t('in {n} days', { n: 3 })).toBe('in 3 days')
  })

  it('looks up Thai, falling back to English for unknown text', () => {
    __setLanguageForTests('th')
    expect(t('Save')).toBe('บันทึก')
    expect(t('in {n} days', { n: 3 })).toBe('ในอีก 3 วัน')
    expect(t('Not in the dictionary')).toBe('Not in the dictionary')
    expect(dateLocale()).toBe('th-TH')
  })
})

describe('language preference', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('defaults to system, which follows the browser language', () => {
    expect(getLanguagePreference()).toBe('system')
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('th-TH')
    expect(systemLanguage()).toBe('th')
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
    expect(systemLanguage()).toBe('en')
  })

  it('stores a choice and reports when the active language changes', () => {
    // The test environment runs in English.
    expect(setLanguagePreference('th')).toBe(true)
    expect(getLanguagePreference()).toBe('th')
    expect(setLanguagePreference('en')).toBe(false)
    expect(setLanguagePreference('system')).toBe(false)
    expect(localStorage.getItem('bw.language')).toBeNull()
  })
})
