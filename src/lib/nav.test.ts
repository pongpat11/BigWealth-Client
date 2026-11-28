import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_LAYOUT,
  NAV_ITEMS,
  getNavLayout,
  normalizeLayout,
  resetNavCache,
  setNavLayout,
} from './nav'

const ALL = NAV_ITEMS.map((i) => i.to)

describe('normalizeLayout', () => {
  it('falls back to the default for junk', () => {
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT)
    expect(normalizeLayout('nope')).toEqual(DEFAULT_LAYOUT)
  })

  it('keeps a valid layout as it is', () => {
    const layout = {
      tabs: ['/budgets', '/'],
      more: ALL.filter((p) => p !== '/budgets' && p !== '/'),
    }
    expect(normalizeLayout(layout)).toEqual(layout)
  })

  it('drops unknown and repeated paths, and appends screens it misses', () => {
    const out = normalizeLayout({
      tabs: ['/', '/gone', '/goals', '/'],
      more: ['/reports', '/goals'],
    })
    expect(out.tabs).toEqual(['/', '/goals'])
    expect(out.more[0]).toBe('/reports')
    expect([...out.tabs, ...out.more].sort()).toEqual([...ALL].sort())
  })

  it('caps the tab bar at four, moving the rest to the top of more', () => {
    const out = normalizeLayout({ tabs: ['/', '/goals', '/debts', '/reports', '/labels'] })
    expect(out.tabs).toEqual(['/', '/goals', '/debts', '/reports'])
    expect(out.more[0]).toBe('/labels')
  })

  it('tops a short tab bar up to two from the defaults', () => {
    const out = normalizeLayout({ tabs: ['/labels'], more: [] })
    expect(out.tabs).toEqual(['/labels', '/'])
  })
})

describe('stored layout', () => {
  beforeEach(() => {
    localStorage.clear()
    resetNavCache()
  })

  it('saves, reads back, and clears storage for the default', () => {
    const layout = { tabs: ['/goals', '/'], more: ALL.filter((p) => p !== '/goals' && p !== '/') }
    setNavLayout(layout)
    resetNavCache()
    expect(getNavLayout()).toEqual(layout)

    setNavLayout(DEFAULT_LAYOUT)
    expect(localStorage.getItem('bw.nav.v1')).toBeNull()
  })

  it('survives a corrupt stored value', () => {
    localStorage.setItem('bw.nav.v1', '{oops')
    expect(getNavLayout()).toEqual(DEFAULT_LAYOUT)
  })
})
