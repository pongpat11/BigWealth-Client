// Navigation menu: which screens sit in the mobile tab bar, and in what order
// the rest are listed (More page, desktop sidebar). The user arranges both in
// the "Customize tab bar" sheet (docs/DESIGN_SPEC.md §8.11). Stored per device
// in localStorage.

import { useSyncExternalStore } from 'react'
import {
  ArrowLeftRight,
  BarChart3,
  CreditCard,
  FileDown,
  Home,
  Landmark,
  PieChart,
  Repeat,
  Settings,
  Tag,
  Tags,
  Target,
  Wallet,
} from 'lucide-react'
import { t } from '@/lib/i18n'

export interface NavItem {
  to: string
  /** Short label: tab bar and sidebar. */
  label: string
  /** Longer label for the More page list. */
  longLabel: string
  icon: typeof Home
  /** Match the path exactly (the root route). */
  end?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: t('Home'), longLabel: t('Home'), icon: Home, end: true },
  { to: '/transactions', label: t('Transactions'), longLabel: t('Transactions'), icon: ArrowLeftRight },
  { to: '/portfolio', label: t('Portfolio'), longLabel: t('Portfolio'), icon: PieChart },
  { to: '/budgets', label: t('Budgets'), longLabel: t('Budgets'), icon: Wallet },
  { to: '/recurring', label: t('Recurring'), longLabel: t('Recurring'), icon: Repeat },
  { to: '/goals', label: t('Goals'), longLabel: t('Savings Goals'), icon: Target },
  { to: '/debts', label: t('Debts'), longLabel: t('Debts'), icon: CreditCard },
  { to: '/reports', label: t('Reports'), longLabel: t('Reports'), icon: BarChart3 },
  { to: '/export', label: t('Export'), longLabel: t('Export & tax report'), icon: FileDown },
  { to: '/accounts', label: t('Accounts'), longLabel: t('Accounts'), icon: Landmark },
  { to: '/categories', label: t('Categories'), longLabel: t('Categories'), icon: Tag },
  { to: '/labels', label: t('Labels'), longLabel: t('Labels'), icon: Tags },
  { to: '/settings', label: t('Settings'), longLabel: t('Settings'), icon: Settings },
]

const BY_PATH = new Map(NAV_ITEMS.map((item) => [item.to, item]))

export function navItem(path: string): NavItem {
  const item = BY_PATH.get(path)
  if (!item) throw new Error(`Unknown nav path ${path}`)
  return item
}

/** Slots in the tab bar before the fixed "More" tab. */
export const MIN_TABS = 2
export const MAX_TABS = 4

export interface NavLayout {
  /** Paths in the tab bar, in order (More always follows). */
  tabs: string[]
  /** Every other path, in order. */
  more: string[]
}

export const DEFAULT_LAYOUT: NavLayout = {
  tabs: ['/', '/transactions', '/portfolio', '/budgets'],
  more: NAV_ITEMS.map((i) => i.to).filter(
    (p) => !['/', '/transactions', '/portfolio', '/budgets'].includes(p),
  ),
}

/**
 * Make any stored value a valid layout: unknown or repeated paths go, screens
 * it doesn't mention (added in a later release) join the end of `more`, and
 * the tab count is kept within MIN_TABS..MAX_TABS.
 */
export function normalizeLayout(value: unknown): NavLayout {
  if (!value || typeof value !== 'object') return cloneLayout(DEFAULT_LAYOUT)
  const raw = value as Partial<Record<keyof NavLayout, unknown>>
  const seen = new Set<string>()
  const pick = (list: unknown) =>
    (Array.isArray(list) ? list : []).filter((p): p is string => {
      if (typeof p !== 'string' || !BY_PATH.has(p) || seen.has(p)) return false
      seen.add(p)
      return true
    })
  let tabs = pick(raw.tabs)
  let more = pick(raw.more)
  more.push(...NAV_ITEMS.map((i) => i.to).filter((p) => !seen.has(p)))

  if (tabs.length > MAX_TABS) {
    more = [...tabs.slice(MAX_TABS), ...more]
    tabs = tabs.slice(0, MAX_TABS)
  }
  while (tabs.length < MIN_TABS) {
    // Refill from the defaults first, so a broken value lands somewhere familiar.
    const next =
      DEFAULT_LAYOUT.tabs.find((p) => more.includes(p)) ?? more[0]
    tabs.push(next)
    more = more.filter((p) => p !== next)
  }
  return { tabs, more }
}

function cloneLayout(layout: NavLayout): NavLayout {
  return { tabs: [...layout.tabs], more: [...layout.more] }
}

export function sameLayout(a: NavLayout, b: NavLayout): boolean {
  return a.tabs.join() === b.tabs.join() && a.more.join() === b.more.join()
}

// --- Storage -----------------------------------------------------------------

const KEY = 'bw.nav.v1'
const listeners = new Set<() => void>()
let cached: NavLayout | null = null

function read(): NavLayout {
  try {
    const stored = localStorage.getItem(KEY)
    return normalizeLayout(stored ? JSON.parse(stored) : null)
  } catch {
    return cloneLayout(DEFAULT_LAYOUT)
  }
}

export function getNavLayout(): NavLayout {
  if (!cached) cached = read()
  return cached
}

export function setNavLayout(layout: NavLayout): void {
  cached = normalizeLayout(layout)
  try {
    if (sameLayout(cached, DEFAULT_LAYOUT)) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(cached))
  } catch {
    // Storage blocked: the layout lasts for this page only.
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  // Another tab saved a layout.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      cached = null
      fn()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', onStorage)
  }
}

/** The current layout; re-renders when it's saved. */
export function useNavLayout(): NavLayout {
  return useSyncExternalStore(subscribe, getNavLayout, getNavLayout)
}

/** For tests: forget the cached layout so the next read hits storage. */
export function resetNavCache(): void {
  cached = null
}
