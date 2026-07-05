// Transactions API client. Requests are authenticated with the stored access token.
import { apiFetch } from './api'
import { getAccessToken } from './auth'

export interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  note: string | null
  date: string
  createdAt: string
}

export interface NewTransaction {
  type: 'income' | 'expense'
  amount: number
  category: string
  note?: string
  date: string // ISO
}

export async function listTransactions(): Promise<Transaction[]> {
  const { items } = await apiFetch<{ items: Transaction[] }>('/transactions', {
    token: getAccessToken() ?? undefined,
  })
  return items
}

export async function createTransaction(input: NewTransaction): Promise<Transaction> {
  return apiFetch<Transaction>('/transactions', {
    method: 'POST',
    body: input,
    token: getAccessToken() ?? undefined,
  })
}
