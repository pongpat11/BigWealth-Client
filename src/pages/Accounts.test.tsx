import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Accounts } from './Accounts'
import * as api from '@/lib/accounts'

vi.mock('@/lib/accounts', () => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}))

const savings = {
  id: 'a1',
  name: 'SCB Savings',
  institution: 'SCB',
  type: 'bank' as const,
  currency: 'THB' as const,
  balance: 50000,
  createdAt: '2026-07-01T00:00:00.000Z',
}
const wallet = {
  id: 'a2',
  name: 'Wallet',
  institution: null,
  type: 'cash' as const,
  currency: 'THB' as const,
  balance: 2000,
  createdAt: '2026-07-01T00:00:00.000Z',
}
const loan = {
  id: 'a3',
  name: 'Car Loan',
  institution: 'KBank',
  type: 'debt' as const,
  currency: 'THB' as const,
  balance: 12000,
  createdAt: '2026-07-01T00:00:00.000Z',
}

describe('Accounts page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('groups accounts by type and shows a net-worth total (debt subtracted)', async () => {
    vi.mocked(api.listAccounts).mockResolvedValue([savings, wallet, loan])
    render(<Accounts />)

    expect(await screen.findByText('SCB Savings')).toBeInTheDocument()
    expect(screen.getByText('Wallet')).toBeInTheDocument()
    expect(screen.getByText('Car Loan')).toBeInTheDocument()
    // Group headers
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('Bank')).toBeInTheDocument()
    expect(screen.getByText('Debt')).toBeInTheDocument()
    // Net worth = 50000 + 2000 - 12000 = 40000
    expect(screen.getByText(/Net worth/i)).toBeInTheDocument()
    expect(screen.getByText(/฿40,000/)).toBeInTheDocument()
  })

  it('shows an empty state when there are no accounts', async () => {
    vi.mocked(api.listAccounts).mockResolvedValue([])
    render(<Accounts />)
    expect(await screen.findByText(/no accounts yet/i)).toBeInTheDocument()
  })

  it('creates a new account', async () => {
    vi.mocked(api.listAccounts).mockResolvedValue([])
    vi.mocked(api.createAccount).mockResolvedValue({
      id: 'new-1',
      name: 'Bangkok Bank',
      institution: 'BBL',
      type: 'bank',
      currency: 'THB',
      balance: 1000,
      createdAt: '2026-07-11T00:00:00.000Z',
    })
    const user = userEvent.setup()
    render(<Accounts />)
    await screen.findByText(/no accounts yet/i)

    await user.click(screen.getByRole('button', { name: /^new$/i }))
    await user.type(screen.getByLabelText(/^name$/i), 'Bangkok Bank')
    await user.type(screen.getByLabelText(/institution/i), 'BBL')
    await user.type(screen.getByLabelText(/^balance$/i), '1000')
    await user.click(screen.getByRole('button', { name: /add account/i }))

    await waitFor(() =>
      expect(api.createAccount).toHaveBeenCalledWith({
        name: 'Bangkok Bank',
        type: 'bank',
        institution: 'BBL',
        currency: 'THB',
        balance: 1000,
      }),
    )
    expect(await screen.findByText('Bangkok Bank')).toBeInTheDocument()
  })

  it('deletes an account with a two-tap confirm', async () => {
    vi.mocked(api.listAccounts).mockResolvedValue([wallet])
    vi.mocked(api.deleteAccount).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Accounts />)

    await screen.findByText('Wallet')
    await user.click(screen.getByText('×'))
    await user.click(screen.getByText(/confirm\?/i))

    await waitFor(() => expect(api.deleteAccount).toHaveBeenCalledWith('a2'))
    expect(screen.queryByText('Wallet')).not.toBeInTheDocument()
  })
})
