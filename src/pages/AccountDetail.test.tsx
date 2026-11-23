import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AccountDetail } from './AccountDetail'
import * as accountsApi from '@/lib/accounts'
import * as txApi from '@/lib/transactions'
import type { Transaction } from '@/lib/transactions'

vi.mock('@/lib/accounts', () => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}))
vi.mock('@/lib/transactions', () => ({ listTransactionPage: vi.fn() }))

const card = {
  id: 'card',
  name: 'KBank Credit Card',
  institution: 'Kasikornbank',
  type: 'debt' as const,
  currency: 'THB' as const,
  balance: 30000,
  currentBalance: 32500,
  interestRate: 16,
  minPayment: 3250,
  createdAt: '2026-07-01T00:00:00.000Z',
}

const tx = (id: string, note: string): Transaction => ({
  id,
  type: 'expense',
  amount: 1290,
  currency: 'THB',
  categoryId: 'food',
  subCategoryId: null,
  category: { id: 'food', name: 'Food', kind: 'expense', icon: null, color: null },
  subCategory: null,
  accountId: 'card',
  account: { id: 'card', name: 'KBank Credit Card', type: 'debt' },
  note,
  date: '2026-11-20T12:00:00.000Z',
  timezone: 'Asia/Bangkok',
  createdAt: '2026-11-20T12:00:00.000Z',
  labels: [],
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/accounts" element={<p>Accounts list</p>} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AccountDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows the balance, loan details and the account's transactions", async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([card])
    vi.mocked(txApi.listTransactionPage).mockResolvedValue({
      items: [tx('t1', 'Dinner')],
      nextCursor: null,
    })
    renderAt('/accounts/card')

    expect(await screen.findByRole('heading', { name: 'KBank Credit Card' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Balance' })).toHaveTextContent('Owed')
    expect(screen.getByText('16% a year')).toBeInTheDocument()
    expect(screen.getByText('Dinner')).toBeInTheDocument()
    expect(txApi.listTransactionPage).toHaveBeenCalledWith({ accountId: 'card' }, undefined, 30)
  })

  it('loads more transactions with the cursor', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([card])
    vi.mocked(txApi.listTransactionPage)
      .mockResolvedValueOnce({ items: [tx('t1', 'Dinner')], nextCursor: 't1' })
      .mockResolvedValueOnce({ items: [tx('t2', 'Groceries')], nextCursor: null })
    const user = userEvent.setup()
    renderAt('/accounts/card')

    await user.click(await screen.findByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('Groceries')).toBeInTheDocument()
    expect(txApi.listTransactionPage).toHaveBeenLastCalledWith({ accountId: 'card' }, 't1', 30)
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('says so when the account no longer exists', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([])
    vi.mocked(txApi.listTransactionPage).mockResolvedValue({ items: [], nextCursor: null })
    renderAt('/accounts/gone')
    expect(await screen.findByText(/doesn't exist anymore/i)).toBeInTheDocument()
  })

  it('deletes the account from the edit form and returns to the list', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([card])
    vi.mocked(accountsApi.deleteAccount).mockResolvedValue(undefined)
    vi.mocked(txApi.listTransactionPage).mockResolvedValue({ items: [], nextCursor: null })
    const user = userEvent.setup()
    renderAt('/accounts/card')

    await user.click(await screen.findByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(accountsApi.deleteAccount).toHaveBeenCalledWith('card'))
    expect(await screen.findByText('Accounts list')).toBeInTheDocument()
  })
})
