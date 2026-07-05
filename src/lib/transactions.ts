// Transactions API client. Requests are authenticated with the stored access token.
import { apiFetch } from './api'
import { getAccessToken } from './auth'

export type Currency = 'THB' | 'USD'

export interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  category: string
  note: string | null
  date: string
  createdAt: string
}

export interface TransactionInput {
  type: 'income' | 'expense'
  amount: number
  currency: Currency
  category: string
  note?: string
  date: string // ISO
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
