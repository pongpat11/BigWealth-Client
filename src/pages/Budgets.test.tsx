import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Budgets } from './Budgets'
import * as api from '@/lib/budgets'
import type { Budget } from '@/lib/budgets'
import * as categoriesApi from '@/lib/categories'
import { monthKey, shiftMonth } from '@/lib/format'

vi.mock('@/lib/budgets', () => ({
  getBudgets: vi.fn(),
  createBudget: vi.fn(),
  updateBudget: vi.fn(),
  deleteBudget: vi.fn(),
}))
vi.mock('@/lib/categories', () => ({ listCategories: vi.fn() }))

const cat = (id: string, name: string, kind: 'income' | 'expense' = 'expense') => ({
  id,
  name,
  kind,
  parentId: null,
  icon: null,
  color: null,
  isDefault: true,
})

const food: Budget = {
  id: 'b1',
  categoryId: 'food',
  category: { id: 'food', name: 'Food', icon: null, color: '#f59e0b' },
  limit: 12000,
  spent: 9480,
}
const shopping: Budget = {
  id: 'b2',
  categoryId: 'shopping',
  category: { id: 'shopping', name: 'Shopping', icon: null, color: null },
  limit: 5000,
  spent: 5390,
}
const overview = (items: Budget[]) => ({
  month: monthKey(),
  totalLimit: items.reduce((s, b) => s + b.limit, 0),
  totalSpent: items.reduce((s, b) => s + b.spent, 0),
  items,
})

describe('Budgets page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([
      cat('food', 'Food'),
      cat('shopping', 'Shopping'),
      cat('transport', 'Transport'),
      cat('salary', 'Salary', 'income'),
    ])
  })

  it('shows totals and per-category progress, flagging overspend', async () => {
    vi.mocked(api.getBudgets).mockResolvedValue(overview([food, shopping]))
    render(<Budgets />)

    expect(await screen.findByText('Food')).toBeInTheDocument()
    expect(screen.getByText('79% · ฿2,520 left')).toBeInTheDocument()
    expect(screen.getByText('108% · ฿390 over')).toBeInTheDocument()
    // Overall: 14,870 of 17,000
    expect(screen.getByText('87% · ฿2,130 left')).toBeInTheDocument()
    expect(api.getBudgets).toHaveBeenCalledWith(monthKey())
  })

  it('shows an empty state when there are no budgets', async () => {
    vi.mocked(api.getBudgets).mockResolvedValue(overview([]))
    render(<Budgets />)
    expect(await screen.findByText(/no budgets yet/i)).toBeInTheDocument()
  })

  it('loads the previous month from the month picker', async () => {
    vi.mocked(api.getBudgets).mockResolvedValue(overview([food]))
    const user = userEvent.setup()
    render(<Budgets />)
    await screen.findByText('Food')

    await user.click(screen.getByRole('button', { name: /previous month/i }))
    await waitFor(() =>
      expect(api.getBudgets).toHaveBeenLastCalledWith(shiftMonth(monthKey(), -1)),
    )
  })

  it('adds a budget, offering only unbudgeted expense categories', async () => {
    vi.mocked(api.getBudgets).mockResolvedValue(overview([food]))
    vi.mocked(api.createBudget).mockResolvedValue({ ...shopping, spent: 0 })
    const user = userEvent.setup()
    render(<Budgets />)
    await screen.findByText('Food')

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    const select = screen.getByLabelText(/category/i)
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    expect(options).toEqual(['Select…', 'Shopping', 'Transport'])

    await user.selectOptions(select, 'shopping')
    await user.type(screen.getByLabelText(/monthly limit/i), '5000')
    await user.click(screen.getByRole('button', { name: /add budget/i }))

    await waitFor(() =>
      expect(api.createBudget).toHaveBeenCalledWith(
        { categoryId: 'shopping', limit: 5000 },
        monthKey(),
      ),
    )
    // Refetches so the server totals stay authoritative.
    await waitFor(() => expect(api.getBudgets).toHaveBeenCalledTimes(2))
  })

  it('rejects a zero limit without calling the API', async () => {
    vi.mocked(api.getBudgets).mockResolvedValue(overview([food]))
    const user = userEvent.setup()
    render(<Budgets />)

    await user.click(await screen.findByRole('button', { name: /edit food budget/i }))
    const input = screen.getByLabelText(/monthly limit/i)
    await user.clear(input)
    await user.type(input, '0')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/greater than 0/i)
    expect(api.updateBudget).not.toHaveBeenCalled()
  })

  it('removes a budget in one tap with an undo window', async () => {
    vi.mocked(api.getBudgets).mockResolvedValue(overview([food]))
    vi.mocked(api.deleteBudget).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Budgets />)

    await user.click(await screen.findByRole('button', { name: /edit food budget/i }))
    await user.click(screen.getByRole('button', { name: /remove budget/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit food budget/i })).not.toBeInTheDocument()
    expect(api.deleteBudget).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    await waitFor(() => expect(api.deleteBudget).toHaveBeenCalledWith('b1'))
  })
})
