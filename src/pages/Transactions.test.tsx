import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Transactions } from './Transactions'
import * as api from '@/lib/transactions'

vi.mock('@/lib/transactions', () => ({
  listTransactions: vi.fn(),
  createTransaction: vi.fn(),
}))

const sample = {
  id: '1',
  type: 'expense' as const,
  amount: 185,
  category: 'food',
  note: 'Lunch — som tam',
  date: new Date().toISOString(),
  createdAt: new Date().toISOString(),
}

describe('Transactions page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders fetched transactions', async () => {
    vi.mocked(api.listTransactions).mockResolvedValue([sample])
    render(<Transactions />)
    expect(await screen.findByText('Lunch — som tam')).toBeInTheDocument()
  })

  it('shows the empty state when there are none', async () => {
    vi.mocked(api.listTransactions).mockResolvedValue([])
    render(<Transactions />)
    expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument()
  })

  it('adds a transaction through the form', async () => {
    vi.mocked(api.listTransactions).mockResolvedValue([])
    vi.mocked(api.createTransaction).mockResolvedValue({
      ...sample,
      id: '2',
      note: 'Coffee',
      amount: 120,
    })
    const user = userEvent.setup()
    render(<Transactions />)
    await screen.findByText(/no transactions yet/i)

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText(/amount/i), '120')
    await user.selectOptions(screen.getByLabelText(/category/i), 'food')
    await user.click(screen.getByRole('button', { name: /add transaction/i }))

    await waitFor(() =>
      expect(api.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'expense', amount: 120, category: 'food' }),
      ),
    )
    expect(await screen.findByText('Coffee')).toBeInTheDocument()
  })
})
