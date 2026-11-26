import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickAddProvider as QuickAdd, useQuickAdd } from './QuickAdd'
import * as api from '@/lib/transactions'
import * as categoriesApi from '@/lib/categories'
import * as accountsApi from '@/lib/accounts'
import * as labelsApi from '@/lib/labels'

vi.mock('@/lib/transactions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/transactions')>()),
  listTransactionPage: vi.fn(),
  createTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}))
vi.mock('@/lib/categories', () => ({ listCategories: vi.fn() }))
vi.mock('@/lib/accounts', () => ({ listAccounts: vi.fn() }))
vi.mock('@/lib/labels', () => ({ listLabels: vi.fn() }))

const account = (id: string, name: string) => ({
  id,
  name,
  institution: null,
  type: 'bank' as const,
  currency: 'THB' as const,
  balance: 0,
  currentBalance: 0,
  createdAt: '',
})

const category = (id: string, name: string) => ({
  id,
  name,
  kind: 'expense' as const,
  parentId: null,
  icon: 'Coffee',
  color: '#a16207',
  isDefault: true,
})

const latte = {
  id: 'x',
  type: 'expense' as const,
  amount: 65,
  currency: 'THB',
  categoryId: 'coffee',
  subCategoryId: null,
  category: { id: 'coffee', name: 'Coffee', kind: 'expense' as const, icon: 'Coffee', color: '#a16207' },
  subCategory: null,
  accountId: 'kbank',
  account: { id: 'kbank', name: 'KBank', type: 'bank' as const },
  note: 'Latte',
  date: '2026-11-20T02:00:00.000Z',
  timezone: 'Asia/Bangkok',
  createdAt: '2026-11-20T02:00:00.000Z',
  labels: [],
}

describe('QuickAdd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([
      account('cash', 'Cash'),
      account('kbank', 'KBank'),
    ])
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([
      category('food', 'Food'),
      category('coffee', 'Coffee'),
    ])
    vi.mocked(api.listTransactionPage).mockResolvedValue({
      items: [latte, { ...latte, id: 'y' }],
      nextCursor: null,
    })
    vi.mocked(api.createTransaction).mockImplementation(async (input) => ({
      ...latte,
      id: 'new',
      amount: input.amount,
    }))
    vi.mocked(api.deleteTransaction).mockResolvedValue()
    vi.mocked(labelsApi.listLabels).mockResolvedValue([
      { id: 'work', name: 'Work', color: '#2563eb', isDefault: false },
    ])
  })

  it('saves an expense from the keypad with the most used account preselected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<QuickAdd onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    const dialog = await screen.findByRole('dialog', { name: 'Quick add' })
    for (const k of ['1', '2', '0']) await user.click(screen.getByRole('button', { name: k }))
    expect(screen.getByRole('status', { name: 'Amount' })).toHaveTextContent('−฿120')

    // Coffee is used most, so it comes first; KBank is the default account.
    await user.click(await screen.findByRole('button', { name: 'Coffee' }))
    expect(screen.getByRole('button', { name: 'KBank' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.createTransaction).toHaveBeenCalled())
    expect(api.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'expense', amount: 120, categoryId: 'coffee', accountId: 'kbank', currency: 'THB' }),
    )
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Saved ฿120')).toBeInTheDocument()
  })

  it('asks for an amount and a category first', async () => {
    const user = userEvent.setup()
    render(<QuickAdd onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than 0.')
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a category.')
    expect(api.createTransaction).not.toHaveBeenCalled()
  })

  it('repeats a frequent entry in one tap, and Undo deletes it', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<QuickAdd onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    await user.click(await screen.findByRole('button', { name: /Add Latte ฿65 again/ }))

    await waitFor(() => expect(api.createTransaction).toHaveBeenCalledTimes(1))
    expect(api.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 65, note: 'Latte', categoryId: 'coffee', accountId: 'kbank' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(api.deleteTransaction).toHaveBeenCalledWith('new'))
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('types amounts with the physical keyboard and saves on Enter', async () => {
    const user = userEvent.setup()
    render(<QuickAdd onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    await user.click(await screen.findByRole('button', { name: 'Food' }))
    screen.getByRole('dialog').querySelector('form')!.focus()
    await user.keyboard('45.5')
    expect(screen.getByRole('status', { name: 'Amount' })).toHaveTextContent('฿45.5')
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(api.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 45.5, categoryId: 'food' }),
      ),
    )
  })

  it('adds labels and switches currency when no account is picked', async () => {
    const user = userEvent.setup()
    render(<QuickAdd onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    await user.click(await screen.findByRole('button', { name: 'Food' }))
    await user.click(screen.getByRole('button', { name: 'No account' }))
    await user.click(screen.getByRole('button', { name: 'Currency' }))
    await user.click(screen.getByRole('button', { name: '9' }))
    expect(screen.getByRole('status', { name: 'Amount' })).toHaveTextContent('$9')
    await user.click(screen.getByRole('button', { name: 'Labels' }))
    await user.click(screen.getByRole('button', { name: 'Work' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(api.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD', accountId: undefined, labelIds: ['work'] }),
      ),
    )
  })

  it('hides the currency switch when an account sets it', async () => {
    const user = userEvent.setup()
    render(<QuickAdd onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Quick add' }))
    expect(await screen.findByRole('button', { name: 'KBank' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Currency' })).not.toBeInTheDocument()
  })

  it('opens from any screen through useQuickAdd', async () => {
    function Screen() {
      const open = useQuickAdd()
      return <button onClick={() => open?.()}>Add</button>
    }
    const user = userEvent.setup()
    render(
      <QuickAdd onChange={() => {}}>
        <Screen />
      </QuickAdd>,
    )
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('dialog', { name: 'Quick add' })).toBeInTheDocument()
  })
})
