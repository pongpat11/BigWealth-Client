// Logic behind the quick-add sheet: the on-screen keypad, the "frequent"
// one-tap entries and the defaults it pre-fills. Everything is derived from
// recent history (so it follows you across devices) plus a small per-device
// memory of the last type and account you used.
import type { Account } from './accounts'
import type { Category } from './categories'
import type { Currency, Transaction, TransactionInput, TransactionKind } from './transactions'

/** How many recent transactions the sheet looks at (the API's page maximum). */
export const HISTORY_SIZE = 200
/** An entry must repeat this many times to be offered as a one-tap favorite. */
export const MIN_REPEATS = 2
export const MAX_FREQUENT = 6
/** Category chips shown before "More". */
export const TOP_CATEGORIES = 7

const MAX_DIGITS = 10

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back'

/**
 * The amount string after a keypad press: at most two decimals, no leading
 * zeros, a bounded number of digits. Invalid presses leave it unchanged.
 */
export function pressKey(amount: string, key: KeypadKey): string {
  if (key === 'back') return amount.slice(0, -1)
  if (key === '.') {
    if (amount.includes('.')) return amount
    return (amount || '0') + '.'
  }
  const [whole, frac] = amount.split('.')
  if (frac !== undefined) return frac.length >= 2 ? amount : amount + key
  if (whole === '0') return key
  if (whole.length >= MAX_DIGITS) return amount
  return amount + key
}

/** "12345.5" → "12,345.5" for display (keeps a trailing dot while typing). */
export function formatKeypadAmount(amount: string): string {
  if (!amount) return '0'
  const [whole, frac] = amount.split('.')
  const grouped = Number(whole || '0').toLocaleString('en-US')
  return frac === undefined ? grouped : `${grouped}.${frac}`
}

/** A past entry worth repeating with one tap. */
export interface FrequentEntry {
  key: string
  count: number
  type: TransactionKind
  amount: number
  currency: Currency
  categoryId: string | null
  subCategoryId: string | null
  accountId: string | null
  toAccountId: string | null
  note: string | null
  /** The newest matching transaction, for its icon, colour and names. */
  sample: Transaction
}

function entryKey(tx: Transaction): string {
  return [
    tx.type,
    tx.amount,
    tx.currency,
    tx.categoryId ?? '',
    tx.subCategoryId ?? '',
    tx.accountId ?? '',
    tx.toAccountId ?? '',
    (tx.note ?? '').trim().toLowerCase(),
  ].join('|')
}

/**
 * Entries you record again and again (same type, amount, category, account and
 * note), most repeated first, leaving out what recurring rules create, ties broken by the most recent. `history` is
 * newest-first.
 */
export function frequentEntries(history: Transaction[], max = MAX_FREQUENT): FrequentEntry[] {
  const groups = new Map<string, FrequentEntry>()
  for (const tx of history) {
    if (tx.currency !== 'THB' && tx.currency !== 'USD') continue
    if (tx.type !== 'transfer' && !tx.categoryId) continue
    // A recurring rule already records these; repeating one would double it.
    if (tx.recurringRuleId) continue
    const key = entryKey(tx)
    const found = groups.get(key)
    if (found) {
      found.count += 1
      continue
    }
    groups.set(key, {
      key,
      count: 1,
      type: tx.type,
      amount: tx.amount,
      currency: tx.currency,
      categoryId: tx.categoryId,
      subCategoryId: tx.subCategoryId,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId ?? null,
      note: tx.note?.trim() || null,
      sample: tx,
    })
  }
  // Map keeps insertion order = recency of each group's newest entry, and the
  // sort is stable, so equal counts stay newest-first.
  return [...groups.values()]
    .filter((g) => g.count >= MIN_REPEATS)
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
}

/** The request that records `entry` again, now. */
export function entryToInput(entry: FrequentEntry, date: Date, timezone: string): TransactionInput {
  const common = {
    type: entry.type,
    amount: entry.amount,
    currency: entry.currency,
    note: entry.note ?? undefined,
    date: date.toISOString(),
    timezone,
    labelIds: entry.sample.labels.map((l) => l.id),
  }
  return entry.type === 'transfer'
    ? {
        ...common,
        accountId: entry.accountId ?? undefined,
        toAccountId: entry.toAccountId ?? undefined,
      }
    : {
        ...common,
        categoryId: entry.categoryId ?? undefined,
        subCategoryId: entry.subCategoryId ?? undefined,
        accountId: entry.accountId ?? undefined,
      }
}

/**
 * Top-level categories of `kind`, the ones you use most first (a
 * sub-category's use counts for its parent), then the rest by name.
 */
export function rankCategories(
  categories: Category[],
  history: Transaction[],
  kind: 'income' | 'expense',
): Category[] {
  const uses = new Map<string, number>()
  for (const tx of history) {
    if (tx.type === kind && tx.categoryId) {
      uses.set(tx.categoryId, (uses.get(tx.categoryId) ?? 0) + 1)
    }
  }
  return categories
    .filter((c) => c.kind === kind && !c.parentId)
    .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.name.localeCompare(b.name))
}

/** Accounts, the ones you use most for `type` first (stable otherwise). */
export function rankAccounts(
  accounts: Account[],
  history: Transaction[],
  type: TransactionKind,
): Account[] {
  const uses = new Map<string, number>()
  for (const tx of history) {
    if (tx.type !== type) continue
    for (const id of [tx.accountId, tx.toAccountId]) {
      if (id) uses.set(id, (uses.get(id) ?? 0) + 1)
    }
  }
  return [...accounts].sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0))
}

// ── Per-device memory of the last choices ────────────────────────────────────

const PREFS_KEY = 'bw.quickAdd'

export interface QuickAddPrefs {
  type: TransactionKind
  /** Last account used per type ('' = none). For a transfer, the source. */
  account: Partial<Record<TransactionKind, string>>
  /** Last destination of a transfer. */
  toAccount?: string
}

const DEFAULT_PREFS: QuickAddPrefs = { type: 'expense', account: {} }

export function loadQuickAddPrefs(): QuickAddPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<QuickAddPrefs>
    const type =
      parsed.type === 'income' || parsed.type === 'expense' || parsed.type === 'transfer'
        ? parsed.type
        : 'expense'
    return {
      type,
      account: parsed.account && typeof parsed.account === 'object' ? parsed.account : {},
      toAccount: typeof parsed.toAccount === 'string' ? parsed.toAccount : undefined,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function saveQuickAddPrefs(prefs: QuickAddPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Storage blocked: defaults next time.
  }
}

/**
 * The account to pre-select for `type`: the one you used last time if it
 * still exists, else your most used one, else none.
 */
export function defaultAccountId(
  prefs: QuickAddPrefs,
  type: TransactionKind,
  ranked: Account[],
): string {
  const last = prefs.account[type]
  if (last !== undefined && (last === '' || ranked.some((a) => a.id === last))) return last
  return ranked[0]?.id ?? ''
}
