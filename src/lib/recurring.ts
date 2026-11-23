import { dateLocale, getLanguage, t } from '@/lib/i18n'
// Recurring rules API client: transactions the server creates on a schedule
// (salary, rent, subscriptions).
import { apiFetch } from './api'
import { getAccessToken } from './auth'
import type { Currency, TransactionAccount, TransactionCategory } from './transactions'

export type Frequency = 'weekly' | 'monthly' | 'yearly'

export interface RecurringRule {
  id: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  categoryId: string
  subCategoryId: string | null
  category: TransactionCategory | null
  subCategory: TransactionCategory | null
  accountId: string | null
  account: TransactionAccount | null
  note: string | null
  labelIds: string[]
  frequency: Frequency
  interval: number
  /** 'YYYY-MM-DD' */
  startDate: string
  endDate: string | null
  timezone: string
  active: boolean
  /** Date of the next entry; null when paused or finished. */
  nextDate: string | null
  createdAt: string
}

export interface RecurringInput {
  type: 'income' | 'expense'
  amount: number
  currency: Currency
  categoryId: string
  subCategoryId?: string
  accountId?: string
  note?: string
  labelIds: string[]
  frequency: Frequency
  interval: number
  startDate: string
  endDate: string | null
  timezone: string
  active: boolean
}

function auth() {
  return { token: getAccessToken() ?? undefined }
}

export async function listRecurring(): Promise<RecurringRule[]> {
  const { items } = await apiFetch<{ items: RecurringRule[] }>('/recurring', auth())
  return items
}

export async function createRecurring(input: RecurringInput): Promise<RecurringRule> {
  return apiFetch<RecurringRule>('/recurring', { method: 'POST', body: input, ...auth() })
}

export async function updateRecurring(id: string, input: RecurringInput): Promise<RecurringRule> {
  return apiFetch<RecurringRule>(`/recurring/${id}`, { method: 'PUT', body: input, ...auth() })
}

export async function deleteRecurring(id: string): Promise<void> {
  await apiFetch<void>(`/recurring/${id}`, { method: 'DELETE', ...auth() })
}

/** Ask the server to create any entries that have come due. */
export async function runRecurring(): Promise<number> {
  const { created } = await apiFetch<{ created: number }>('/recurring/run', {
    method: 'POST',
    ...auth(),
  })
  return created
}

/** The rule as a rule-of-thumb phrase: "Monthly on the 25th", "Every 2 weeks on Mon". */
export function describeSchedule(
  r: Pick<RecurringRule, 'frequency' | 'interval' | 'startDate'>,
): string {
  const [y, m, d] = r.startDate.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const n = r.interval
  if (r.frequency === 'weekly') {
    const day = start.toLocaleDateString(dateLocale(), { weekday: 'short' })
    return n === 1 ? t('Weekly on {day}', { day }) : t('Every {n} weeks on {day}', { n, day })
  }
  if (r.frequency === 'monthly') {
    const day = getLanguage() === 'th' ? String(d) : ordinal(d)
    return n === 1 ? t('Monthly on the {day}', { day }) : t('Every {n} months on the {day}', { n, day })
  }
  const date = start.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
  return n === 1 ? t('Yearly on {date}', { date }) : t('Every {n} years on {date}', { n, date })
}

function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

// --- Schedule math (mirrors the server) -------------------------------------
// Used by the form's "first entry" hint and by the dev mock API.

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Date of occurrence n; month-end days clamp (31 Jan → 28 Feb). */
export function occurrenceDate(
  r: Pick<RecurringRule, 'frequency' | 'interval' | 'startDate'>,
  n: number,
): string {
  const [y, m, d] = r.startDate.split('-').map(Number)
  if (r.frequency === 'weekly') {
    const t = Date.UTC(y, m - 1, d) + n * r.interval * 7 * 86_400_000
    return new Date(t).toISOString().slice(0, 10)
  }
  const total = y * 12 + (m - 1) + n * r.interval * (r.frequency === 'yearly' ? 12 : 1)
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, daysInMonth(ny, nm))).padStart(2, '0')}`
}

/** First occurrence on or after `date` ('YYYY-MM-DD'). */
export function nextOccurrenceOnOrAfter(
  r: Pick<RecurringRule, 'frequency' | 'interval' | 'startDate'>,
  date: string,
): string {
  let n = 0
  while (occurrenceDate(r, n) < date && n < 10_000) n++
  return occurrenceDate(r, n)
}

/** Today as 'YYYY-MM-DD' in the browser's timezone. */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
