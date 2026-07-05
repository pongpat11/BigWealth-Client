import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Transactions } from './Transactions'
import * as api from '@/lib/transactions'
import * as labelsApi from '@/lib/labels'
import * as categoriesApi from '@/lib/categories'

vi.mock('@/lib/transactions', () => ({
  listTransactions: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}))

vi.mock('@/lib/labels', () => ({ listLabels: vi.fn() }))
vi.mock('@/lib/categories', () => ({ listCategories: vi.fn() }))

const foodCategory = {
  id: 'food',
  name: 'Food & Dining',
  kind: 'expense' as const,
  parentId: null,
  icon: 'UtensilsCrossed',
  color: '#f59e0b',
  isDefault: true,
}

const sample = {
  id: '1',
  type: 'expense' as const,
  amount: 185,
  currency: 'THB',
  categoryId: 'food',
  subCategoryId: null,
  category: { id: 'food', name: 'Food & Dining', kind: 'expense' as const, icon: 'UtensilsCrossed', color: '#f59e0b' },
  subCategory: null,
  note: 'Lunch — som tam',
  date: new Date().toISOString(),
  timezone: 'Asia/Bangkok',
  createdAt: new Date().toISOString(),
  labels: [],
}

describe('Transactions page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(labelsApi.listLabels).mockResolvedValue([])
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([foodCategory])
  })

  it('renders fetched transactions with their category', async () => {
    vi.mocked(api.listTransactions).mockResolvedValue([sample])
    render(<Transactions />)
    expect(await screen.findByText('Lunch — som tam')).toBeInTheDocument()
    expect(screen.getByText(/Food & Dining/)).toBeInTheDocument()
  })

  it('shows the empty state when there are none', async () => {
    vi.mocked(api.listTransactions).mockResolvedValue([])
    render(<Transactions />)
    expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument()
  })

  it('adds a transaction with a categoryId and timezone', async () => {
    vi.mocked(api.listTransactions).mockResolvedValue([])
    vi.mocked(api.createTransaction).mockResolvedValue({ ...sample, id: '2', note: 'Coffee', amount: 120 })
    const user = userEvent.setup()
    render(<Transactions />)
    await screen.findByText(/no transactions yet/i)

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText(/amount/i), '120')
    await user.selectOptions(await screen.findByLabelText('Category'), 'food')
    await user.click(screen.getByRole('button', { name: /add transaction/i }))

    await waitFor(() =>
      expect(api.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: 'food',
          amount: 120,
          currency: 'THB',
          timezone: expect.any(String),
        }),
      ),
    )
    expect(await screen.findByText('Coffee')).toBeInTheDocument()
  })

  it('edits a transaction by clicking its row', async () => {
    vi.mocked(api.listTransactions).mockResolvedValue([sample])
    vi.mocked(api.updateTransaction).mockResolvedValue({ ...sample, note: 'Dinner', amount: 300 })
    const user = userEvent.setup()
    render(<Transactions />)

    await user.click(await screen.findByRole('button', { name: /lunch — som tam/i }))
    expect(screen.getByText(/edit transaction/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(api.updateTransaction).toHaveBeenCalledWith('1', expect.any(Object)))
    expect(await screen.findByText('Dinner')).toBeInTheDocument()
  })

  it('deletes a transaction (two-tap confirm)', async () => {
    vi.mocked(api.listTransactions).mockResolvedValue([sample])
    vi.mocked(api.deleteTransaction).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Transactions />)

    await user.click(await screen.findByRole('button', { name: /lunch — som tam/i }))
    await user.click(screen.getByRole('button', { name: /delete transaction/i }))
    await user.click(screen.getByRole('button', { name: /tap again to delete/i }))

    await waitFor(() => expect(api.deleteTransaction).toHaveBeenCalledWith('1'))
    expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument()
  })

  it('shows label chips on a transaction row', async () => {
    vi.mocked(api.listTransactions).mockResolvedValue([
      { ...sample, labels: [{ id: 'l1', name: 'Work', color: '#6366f1' }] },
    ])
    render(<Transactions />)
    expect(await screen.findByText('Work')).toBeInTheDocument()
  })

  it('toggles a label in the form and includes it when saving', async () => {
    vi.mocked(labelsApi.listLabels).mockResolvedValue([
      { id: 'l1', name: 'Work', color: '#6366f1', isDefault: true },
    ])
    vi.mocked(api.listTransactions).mockResolvedValue([])
    vi.mocked(api.createTransaction).mockResolvedValue({ ...sample, id: '2', note: 'Coffee' })
    const user = userEvent.setup()
    render(<Transactions />)
    await screen.findByText(/no transactions yet/i)

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText(/amount/i), '120')
    await user.selectOptions(await screen.findByLabelText('Category'), 'food')
    await user.click(await screen.findByRole('button', { name: /^work$/i }))
    await user.click(screen.getByRole('button', { name: /add transaction/i }))

    await waitFor(() =>
      expect(api.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ labelIds: ['l1'] }),
      ),
    )
  })
})
