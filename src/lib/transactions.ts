// Transactions API client. Requests are authenticated with the stored access token.
import { apiFetch } from './api'
import { getAccessToken } from './auth'

export type Currency = 'THB' | 'USD'

export interface TransactionLabel {
  id: string
  name: string
  color: string | null
}

export interface TransactionCategory {
  id: string
  name: string
  kind: 'income' | 'expense'
  icon: string | null
  color: string | null
}

export interface TransactionAccount {
  id: string
  name: string
  type: 'cash' | 'bank' | 'investment' | 'debt'
}

/** transfer = money moved between two of the user's own accounts. */
export type TransactionKind = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: string
  type: TransactionKind
  amount: number
  currency: string
  categoryId: string | null
  subCategoryId: string | null
  category: TransactionCategory | null
  subCategory: TransactionCategory | null
  accountId: string | null
  account: TransactionAccount | null
  /** Transfers only: the destination account (`account` is the source). */
  toAccountId?: string | null
  toAccount?: TransactionAccount | null
  note: string | null
  date: string
  timezone: string | null
  createdAt: string
  labels: TransactionLabel[]
  /** Set when a recurring rule created this entry. */
  recurringRuleId?: string | null
}

export interface TransactionInput {
  type: TransactionKind
  amount: number
  currency: Currency
  /** Required for income/expense; omitted for a transfer. */
  categoryId?: string
  subCategoryId?: string
  /** For a transfer: the account the money leaves (required). */
  accountId?: string
  /** Transfers only: the account the money goes to (required). */
  toAccountId?: string
  note?: string
  date: string // full ISO timestamp
  timezone: string // IANA, e.g. "Asia/Bangkok"
  labelIds?: string[]
}

function auth() {
  return { token: getAccessToken() ?? undefined }
}

export interface TransactionFilters {
  type?: TransactionKind
  accountId?: string
  /** Matches the category or the sub-category. */
  categoryId?: string
  labelId?: string
  /** ISO instants: `from` inclusive, `to` exclusive. */
  from?: string
  to?: string
  /** Case-insensitive note search. */
  q?: string
}

export interface TransactionPage {
  items: Transaction[]
  /** Pass to the next call to continue; null when there are no more. */
  nextCursor: string | null
}

/** One page of transactions, newest first, narrowed by `filters`. */
export async function listTransactionPage(
  filters: TransactionFilters = {},
  cursor?: string,
  limit = 50,
): Promise<TransactionPage> {
  const params = new URLSearchParams({ limit: String(limit) })
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  if (cursor) params.set('cursor', cursor)
  const page = await apiFetch<Partial<TransactionPage> & { items: Transaction[] }>(
    `/transactions?${params}`,
    auth(),
  )
  return { items: page.items, nextCursor: page.nextCursor ?? null }
}

/** The most recent transactions (first page, unfiltered). */
export async function listTransactions(): Promise<Transaction[]> {
  const { items } = await apiFetch<{ items: Transaction[] }>('/transactions', auth())
  return items
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  return apiFetch<Transaction>('/transactions', { method: 'POST', body: input, ...auth() })
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<Transaction> {
  return apiFetch<Transaction>(`/transactions/${id}`, {
    method: 'PUT',
    body: input,
    ...auth(),
  })
}

export async function deleteTransaction(id: string): Promise<void> {
  await apiFetch<void>(`/transactions/${id}`, { method: 'DELETE', ...auth() })
}

/** Lucide icon name shown for transfers (they have no category). */
export const TRANSFER_ICON = 'ArrowLeftRight'
export const TRANSFER_COLOR = '#0ea5e9'

/** "KBank → Cash" for a transfer; '' for anything else. */
export function transferRoute(tx: Transaction): string {
  if (tx.type !== 'transfer') return ''
  return `${tx.account?.name ?? '?'} → ${tx.toAccount?.name ?? '?'}`
}
