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

export interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  categoryId: string | null
  subCategoryId: string | null
  category: TransactionCategory | null
  subCategory: TransactionCategory | null
  note: string | null
  date: string
  timezone: string | null
  createdAt: string
  labels: TransactionLabel[]
}

export interface TransactionInput {
  type: 'income' | 'expense'
  amount: number
  currency: Currency
  categoryId: string
  subCategoryId?: string
  note?: string
  date: string // full ISO timestamp
  timezone: string // IANA, e.g. "Asia/Bangkok"
  labelIds?: string[]
}

function auth() {
  return { token: getAccessToken() ?? undefined }
}

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
