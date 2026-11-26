import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Transactions } from './Transactions'
import * as api from '@/lib/transactions'
import * as labelsApi from '@/lib/labels'
import * as categoriesApi from '@/lib/categories'
import * as accountsApi from '@/lib/accounts'

vi.mock('@/lib/transactions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/transactions')>()),
  listTransactionPage: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}))

vi.mock('@/lib/labels', () => ({ listLabels: vi.fn() }))
vi.mock('@/lib/categories', () => ({ listCategories: vi.fn() }))
vi.mock('@/lib/accounts', () => ({ listAccounts: vi.fn() }))

const kbank = {
  id: 'kbank',
  name: 'KBank Savings',
  institution: 'Kasikornbank',
  type: 'bank' as const,
  currency: 'THB' as const,
  balance: 50000,
  currentBalance: 50000,
  createdAt: new Date().toISOString(),
}

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
  accountId: null,
  account: null,
  note: 'Lunch — som tam',
  date: new Date().toISOString(),
  timezone: 'Asia/Bangkok',
  createdAt: new Date().toISOString(),
  labels: [],
}

const page = (items: api.Transaction[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
})

function renderPage(url = '/transactions') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Transactions />
    </MemoryRouter>,
  )
}

describe('Transactions page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(labelsApi.listLabels).mockResolvedValue([])
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([foodCategory])
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([])
  })

  it('renders fetched transactions with their category', async () => {
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([sample]))
    renderPage()
    expect(await screen.findByText('Lunch — som tam')).toBeInTheDocument()
    expect(screen.getByText(/Food & Dining/)).toBeInTheDocument()
  })

  it('shows the empty state when there are none', async () => {
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([]))
    renderPage()
    expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument()
  })

  it('adds a transaction with a categoryId and timezone', async () => {
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([]))
    vi.mocked(api.createTransaction).mockResolvedValue({ ...sample, id: '2', note: 'Coffee', amount: 120 })
    const user = userEvent.setup()
    renderPage()
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
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([sample]))
    vi.mocked(api.updateTransaction).mockResolvedValue({ ...sample, note: 'Dinner', amount: 300 })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /lunch — som tam/i }))
    expect(screen.getByText(/edit transaction/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(api.updateTransaction).toHaveBeenCalledWith('1', expect.any(Object)))
    expect(await screen.findByText('Dinner')).toBeInTheDocument()
  })

  it('deletes a transaction in one tap from the edit sheet', async () => {
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([sample]))
    vi.mocked(api.deleteTransaction).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /lunch — som tam/i }))
    expect(screen.getByRole('dialog', { name: /edit transaction/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /delete transaction/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument()
    expect(api.deleteTransaction).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    await waitFor(() => expect(api.deleteTransaction).toHaveBeenCalledWith('1'))
  })

  it('closes the edit sheet with Escape', async () => {
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([sample]))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /lunch — som tam/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows label chips on a transaction row', async () => {
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([
      { ...sample, labels: [{ id: 'l1', name: 'Work', color: '#6366f1' }] },
    ]))
    renderPage()
    expect(await screen.findByText('Work')).toBeInTheDocument()
  })

  it('toggles a label in the form and includes it when saving', async () => {
    vi.mocked(labelsApi.listLabels).mockResolvedValue([
      { id: 'l1', name: 'Work', color: '#6366f1', isDefault: true },
    ])
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([]))
    vi.mocked(api.createTransaction).mockResolvedValue({ ...sample, id: '2', note: 'Coffee' })
    const user = userEvent.setup()
    renderPage()
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

  it('shows the account name on a transaction row', async () => {
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([
      { ...sample, accountId: 'kbank', account: { id: 'kbank', name: 'KBank Savings', type: 'bank' } },
    ]))
    renderPage()
    expect(await screen.findByText(/KBank Savings/)).toBeInTheDocument()
  })

  it('records a transfer between two accounts without a category', async () => {
    const cash = { ...kbank, id: 'cash', name: 'Cash Wallet', institution: null, type: 'cash' as const }
    const usd = { ...kbank, id: 'ibkr', name: 'IBKR', institution: null, currency: 'USD' as const }
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([kbank, cash, usd])
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([]))
    vi.mocked(api.createTransaction).mockResolvedValue({
      ...sample,
      id: '3',
      type: 'transfer',
      note: null,
      categoryId: null,
      category: null,
      accountId: 'kbank',
      account: { id: 'kbank', name: 'KBank Savings', type: 'bank' },
      toAccountId: 'cash',
      toAccount: { id: 'cash', name: 'Cash Wallet', type: 'cash' },
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(/no transactions yet/i)

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    const sheet = screen.getByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: /^transfer$/i }))
    expect(screen.queryByLabelText('Category')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/amount/i), '2000')
    await user.selectOptions(await screen.findByLabelText('From account'), 'kbank')
    // The source account and other-currency accounts are not destinations.
    const to = screen.getByLabelText('To account')
    expect(within(to).queryByRole('option', { name: /KBank/ })).not.toBeInTheDocument()
    expect(within(to).queryByRole('option', { name: /IBKR/ })).not.toBeInTheDocument()
    await user.selectOptions(to, 'cash')
    await user.click(screen.getByRole('button', { name: /add transaction/i }))

    await waitFor(() =>
      expect(api.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'transfer', amount: 2000, accountId: 'kbank', toAccountId: 'cash' }),
      ),
    )
    expect(vi.mocked(api.createTransaction).mock.calls[0][0]).not.toHaveProperty('categoryId')
    expect(await screen.findByText(/KBank Savings → Cash Wallet/)).toBeInTheDocument()
  })

  it('selects an account in the form and includes it when saving', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([kbank])
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([]))
    vi.mocked(api.createTransaction).mockResolvedValue({ ...sample, id: '2', note: 'Coffee' })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(/no transactions yet/i)

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText(/amount/i), '120')
    await user.selectOptions(await screen.findByLabelText('Category'), 'food')
    await user.selectOptions(await screen.findByLabelText(/account/i), 'kbank')
    await user.click(screen.getByRole('button', { name: /add transaction/i }))

    await waitFor(() =>
      expect(api.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'kbank' }),
      ),
    )
  })
  it('groups rows under a day heading', async () => {
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([sample]))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
  })

  it('reads filters from the URL and sends them to the API', async () => {
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([]))
    renderPage('/transactions?type=expense&account=kbank&q=lunch&from=2026-07-01&to=2026-07-31')

    expect(await screen.findByText(/no transactions match these filters/i)).toBeInTheDocument()
    const filters = vi.mocked(api.listTransactionPage).mock.calls[0][0]!
    expect(filters).toMatchObject({ type: 'expense', accountId: 'kbank', q: 'lunch' })
    // Local-midnight bounds; `to` is inclusive in the UI so the API gets 1 Aug.
    expect(filters.from).toBe(new Date(2026, 6, 1).toISOString())
    expect(filters.to).toBe(new Date(2026, 7, 1).toISOString())
  })

  it('filters by type from the segmented control', async () => {
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([sample]))
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Lunch — som tam')

    await user.click(screen.getByRole('button', { name: 'Income' }))
    await waitFor(() =>
      expect(api.listTransactionPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'income' }),
      ),
    )
  })

  it('searches notes after a short pause', async () => {
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([sample]))
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Lunch — som tam')

    await user.type(screen.getByLabelText(/search notes/i), 'som')
    await waitFor(() =>
      expect(api.listTransactionPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'som' }),
      ),
    )
  })

  it('drops a "Load more" page that arrives after the filters changed', async () => {
    let resolveOld: (p: ReturnType<typeof page>) => void = () => undefined
    vi.mocked(api.listTransactionPage).mockImplementation((_filters, cursor) => {
      if (cursor) return new Promise((resolve) => (resolveOld = resolve))
      return Promise.resolve(page([sample], '1'))
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /load more/i }))
    await user.click(screen.getByRole('button', { name: 'Income' }))
    await waitFor(() =>
      expect(api.listTransactionPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'income' }),
      ),
    )

    resolveOld(page([{ ...sample, id: 'stale', note: 'Stale expense' }]))
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText('Stale expense')).not.toBeInTheDocument()
  })

  it('does not show a newly added row that the active filter excludes', async () => {
    vi.mocked(api.listTransactionPage).mockResolvedValue(page([]))
    vi.mocked(api.createTransaction).mockResolvedValue({ ...sample, id: '2', note: 'Coffee' })
    const user = userEvent.setup()
    renderPage('/transactions?type=income')
    await screen.findByText(/no transactions match these filters/i)

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText(/amount/i), '120')
    await user.selectOptions(await screen.findByLabelText('Category'), 'food')
    await user.click(screen.getByRole('button', { name: /add transaction/i }))

    await waitFor(() => expect(api.createTransaction).toHaveBeenCalled())
    // Saved as an expense, so it stays out of the Income view.
    expect(screen.queryByText('Coffee')).not.toBeInTheDocument()
  })

  it('loads the next page and appends it', async () => {
    vi.mocked(api.listTransactionPage)
      .mockResolvedValueOnce(page([sample], '1'))
      .mockResolvedValueOnce(page([{ ...sample, id: '2', note: 'Older coffee' }]))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /load more/i }))

    expect(await screen.findByText('Older coffee')).toBeInTheDocument()
    expect(screen.getByText('Lunch — som tam')).toBeInTheDocument()
    expect(api.listTransactionPage).toHaveBeenLastCalledWith(expect.any(Object), '1')
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })
})
