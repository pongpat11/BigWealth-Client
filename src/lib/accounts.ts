// Accounts API client. Each account (cash, bank, investment, debt) is scoped
// to the signed-in user.
import { apiFetch } from './api'
import { getAccessToken } from './auth'
import type { Currency } from '@/types'

export type AccountType = 'cash' | 'bank' | 'investment' | 'debt'

export interface Account {
  id: string
  name: string
  institution: string | null
  type: AccountType
  currency: Currency
  /** Starting balance entered at setup. */
  balance: number
  /** What the account is worth (what to display): cash + holdings. */
  currentBalance: number
  /** Starting balance ± this account's transactions. Absent from older servers. */
  cashBalance?: number
  /** Market value of the holdings in this account, in its currency. */
  holdingsValue?: number
  /** Loan details for debt accounts. Absent/null when not set. */
  interestRate?: number | null // annual %
  minPayment?: number | null // per month
  originalAmount?: number | null // amount borrowed
  createdAt: string
}

export interface NewAccount {
  name: string
  type: AccountType
  institution?: string
  currency?: Currency
  balance?: number
  interestRate?: number | null
  minPayment?: number | null
  originalAmount?: number | null
}

export interface AccountEdit {
  name?: string
  type?: AccountType
  institution?: string
  currency?: Currency
  balance?: number
  interestRate?: number | null
  minPayment?: number | null
  originalAmount?: number | null
}

function auth() {
  return { token: getAccessToken() ?? undefined }
}

export async function listAccounts(): Promise<Account[]> {
  const { items } = await apiFetch<{ items: Account[] }>('/accounts', auth())
  return items
}

export async function createAccount(input: NewAccount): Promise<Account> {
  return apiFetch<Account>('/accounts', { method: 'POST', body: input, ...auth() })
}

export async function updateAccount(id: string, input: AccountEdit): Promise<Account> {
  return apiFetch<Account>(`/accounts/${id}`, { method: 'PATCH', body: input, ...auth() })
}

export async function deleteAccount(id: string): Promise<void> {
  await apiFetch<void>(`/accounts/${id}`, { method: 'DELETE', ...auth() })
}
