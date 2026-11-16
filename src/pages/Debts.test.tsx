import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Debts } from './Debts'
import * as api from '@/lib/accounts'
import type { Account } from '@/lib/accounts'

vi.mock('@/lib/accounts', () => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}))

const debt = (over: Partial<Account>): Account => ({
  id: 'x',
  name: 'Debt',
  institution: null,
  type: 'debt',
  currency: 'THB',
  balance: 0,
  currentBalance: 0,
  interestRate: null,
  minPayment: null,
  originalAmount: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  ...over,
})

const car = debt({
  id: 'car',
  name: 'Car Loan',
  institution: 'TTB',
  balance: 285000,
  currentBalance: 285000,
  interestRate: 3.2,
  minPayment: 8900,
  originalAmount: 480000,
})
const card = debt({
  id: 'card',
  name: 'Credit Card',
  balance: 32500,
  currentBalance: 32500,
  interestRate: 16,
  minPayment: 3250,
})
const savings = debt({ id: 'bank', name: 'Savings', type: 'bank', currentBalance: 50000 })

const order = () =>
  screen.getAllByRole('button', { name: /^edit debt/i }).map((b) => b.getAttribute('aria-label'))

describe('Debts page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists only debt accounts with totals, terms and payoff progress', async () => {
    vi.mocked(api.listAccounts).mockResolvedValue([savings, car, card])
    render(<Debts />)

    expect(await screen.findByText('Car Loan')).toBeInTheDocument()
    expect(screen.queryByText('Savings')).not.toBeInTheDocument()
    expect(screen.getByText('฿317,500')).toBeInTheDocument() // total owed
    expect(screen.getByText('Minimum payments ฿12,150/mo')).toBeInTheDocument()
    expect(screen.getByText('41% paid off · ฿480,000 borrowed')).toBeInTheDocument()
    expect(screen.getByText('3.2% · ฿8,900/mo')).toBeInTheDocument()
    // Only the 16% card is flagged.
    expect(screen.getAllByText('High interest')).toHaveLength(1)
  })

  it('orders by highest rate (avalanche) or smallest balance (snowball)', async () => {
    const student = debt({ id: 's', name: 'Student Loan', currentBalance: 9000, interestRate: 1 })
    vi.mocked(api.listAccounts).mockResolvedValue([car, student, card])
    const user = userEvent.setup()
    render(<Debts />)
    await screen.findByText('Car Loan')

    expect(order()).toEqual([
      'Edit debt Credit Card',
      'Edit debt Car Loan',
      'Edit debt Student Loan',
    ])

    await user.click(screen.getByRole('button', { name: 'Snowball' }))
    expect(order()).toEqual([
      'Edit debt Student Loan',
      'Edit debt Credit Card',
      'Edit debt Car Loan',
    ])
  })

  it('shows an empty state when there are no debts', async () => {
    vi.mocked(api.listAccounts).mockResolvedValue([savings])
    render(<Debts />)
    expect(await screen.findByText(/no debts tracked/i)).toBeInTheDocument()
  })

  it('adds a debt as a THB debt account with its loan details', async () => {
    vi.mocked(api.listAccounts).mockResolvedValue([])
    vi.mocked(api.createAccount).mockResolvedValue(card)
    const user = userEvent.setup()
    render(<Debts />)
    await screen.findByText(/no debts tracked/i)

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText('Name'), 'Credit Card')
    await user.type(screen.getByLabelText('Amount owed'), '32500')
    await user.type(screen.getByLabelText(/interest rate/i), '16')
    await user.click(screen.getByRole('button', { name: /add debt/i }))

    await waitFor(() =>
      expect(api.createAccount).toHaveBeenCalledWith({
        name: 'Credit Card',
        institution: '',
        type: 'debt',
        currency: 'THB',
        balance: 32500,
        interestRate: 16,
        minPayment: null,
        originalAmount: null,
      }),
    )
    expect(await screen.findByText('Credit Card')).toBeInTheDocument()
  })

  it('rejects an interest rate above 100', async () => {
    vi.mocked(api.listAccounts).mockResolvedValue([card])
    const user = userEvent.setup()
    render(<Debts />)

    await user.click(await screen.findByRole('button', { name: /edit debt credit card/i }))
    const rate = screen.getByLabelText(/interest rate/i)
    await user.clear(rate)
    await user.type(rate, '160')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/between 0 and 100/i)
    expect(api.updateAccount).not.toHaveBeenCalled()
  })

  it('clears a loan detail by emptying its field', async () => {
    vi.mocked(api.listAccounts).mockResolvedValue([card])
    vi.mocked(api.updateAccount).mockResolvedValue({ ...card, minPayment: null })
    const user = userEvent.setup()
    render(<Debts />)

    await user.click(await screen.findByRole('button', { name: /edit debt credit card/i }))
    await user.clear(screen.getByLabelText(/minimum payment/i))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(api.updateAccount).toHaveBeenCalledWith(
        'card',
        expect.objectContaining({ minPayment: null, interestRate: 16 }),
      ),
    )
  })

  it('deletes a debt with a two-tap confirm', async () => {
    vi.mocked(api.listAccounts).mockResolvedValue([card])
    vi.mocked(api.deleteAccount).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Debts />)

    await user.click(await screen.findByRole('button', { name: /edit debt credit card/i }))
    await user.click(screen.getByRole('button', { name: /delete debt/i }))
    expect(api.deleteAccount).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /tap again to delete/i }))

    await waitFor(() => expect(api.deleteAccount).toHaveBeenCalledWith('card'))
    expect(await screen.findByText(/no debts tracked/i)).toBeInTheDocument()
  })
})
