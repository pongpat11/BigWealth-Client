import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AccountDetail } from './AccountDetail'
import * as accountsApi from '@/lib/accounts'
import * as txApi from '@/lib/transactions'
import * as portfolioApi from '@/lib/portfolio'
import { handOffDeletedHolding } from '@/lib/holdingHandoff'
import type { Portfolio } from '@/lib/portfolio'
import type { Transaction } from '@/lib/transactions'

vi.mock('@/lib/accounts', () => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}))
vi.mock('@/lib/transactions', () => ({ listTransactionPage: vi.fn() }))
vi.mock('@/lib/portfolio', async (importOriginal) => ({
  // Keep the formatting helpers; stub only the network call.
  ...(await importOriginal<typeof import('@/lib/portfolio')>()),
  getPortfolio: vi.fn(),
  deleteHolding: vi.fn(),
}))

const broker = {
  id: 'settrade',
  name: 'SET Brokerage',
  institution: 'Settrade',
  type: 'investment' as const,
  currency: 'THB' as const,
  balance: 50000,
  cashBalance: 48500,
  holdingsValue: 191250,
  currentBalance: 239750,
  createdAt: '2026-07-01T00:00:00.000Z',
}

const brokerPortfolio: Portfolio = {
  fx: { usdThb: 34, date: '2026-11-20' },
  totalValueTHB: 191250,
  totalCostTHB: 172500,
  totalGainTHB: 18750,
  totalGainPct: 10.87,
  unconvertedCount: 0,
  allocation: [{ assetClass: 'set', valueTHB: 191250, pct: 100 }],
  holdings: [
    {
      id: 'ptt',
      accountId: 'settrade',
      symbol: 'PTT',
      name: null,
      assetClass: 'set',
      currency: 'THB',
      quantity: 5000,
      avgCost: 34.5,
      price: 38.25,
      priceUpdatedAt: '2026-11-20T00:00:00.000Z',
      marketValue: 191250,
      costBasis: 172500,
      marketValueTHB: 191250,
      costBasisTHB: 172500,
      gainPct: 10.87,
    },
  ],
}

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

function ListStub() {
  const state = useLocation().state as { deleteAccountId?: string } | null
  return <p>Accounts list{state?.deleteAccountId ? ` (delete ${state.deleteAccountId})` : ''}</p>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/accounts" element={<ListStub />} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AccountDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('links holdings to their page and takes back a holding deleted there, with undo', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([broker])
    vi.mocked(txApi.listTransactionPage).mockResolvedValue({ items: [], nextCursor: null })
    vi.mocked(portfolioApi.getPortfolio).mockResolvedValue(brokerPortfolio)
    vi.mocked(portfolioApi.deleteHolding).mockResolvedValue(undefined)
    const ptt = brokerPortfolio.holdings.find((h) => h.symbol === 'PTT')!
    handOffDeletedHolding(ptt)
    const user = userEvent.setup()
    renderAt('/accounts/settrade')

    expect(await screen.findByText('Deleted PTT')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('link', { name: /^PTT/ })).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /undo/i }))
    const link = await screen.findByRole('link', { name: /^PTT/ })
    expect(link).toHaveAttribute('href', `/portfolio/${ptt.id}`)
    expect(portfolioApi.deleteHolding).not.toHaveBeenCalled()
  })

  it('splits an investment account into cash and holdings and lists them', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([broker])
    vi.mocked(txApi.listTransactionPage).mockResolvedValue({ items: [], nextCursor: null })
    vi.mocked(portfolioApi.getPortfolio).mockResolvedValue(brokerPortfolio)
    renderAt('/accounts/settrade')

    expect(await screen.findByText('฿239,750')).toBeInTheDocument()
    expect(screen.getByText('฿48,500')).toBeInTheDocument()
    expect(await screen.findByText('PTT')).toBeInTheDocument()
    expect(screen.getByText('▲ +10.9%')).toBeInTheDocument()
    expect(portfolioApi.getPortfolio).toHaveBeenCalledWith('settrade')
    expect(screen.getByRole('link', { name: /open in portfolio/i })).toHaveAttribute(
      'href',
      '/portfolio?account=settrade',
    )
  })

  it('shows no holdings section for other account types', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([card])
    vi.mocked(txApi.listTransactionPage).mockResolvedValue({ items: [], nextCursor: null })
    renderAt('/accounts/card')
    await screen.findByText('KBank Credit Card')
    expect(screen.queryByText('Holdings')).not.toBeInTheDocument()
    expect(portfolioApi.getPortfolio).not.toHaveBeenCalled()
  })

  it("shows the balance, loan details and the account's transactions", async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([card])
    vi.mocked(txApi.listTransactionPage).mockResolvedValue({
      items: [tx('t1', 'Dinner')],
      nextCursor: null,
    })
    renderAt('/accounts/card')

    expect(await screen.findByRole('heading', { name: 'KBank Credit Card' })).toBeInTheDocument()
    const balance = screen.getByRole('region', { name: 'Balance' })
    expect(balance).toHaveTextContent('Owed')
    // Shown as a positive amount owed, like the Debts page.
    expect(balance).toHaveTextContent('฿32,500')
    expect(balance).not.toHaveTextContent('-฿32,500')
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

  it('starts clean when switching to another account', async () => {
    const other = { ...card, id: 'other', name: 'Car Loan' }
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([card, other])
    vi.mocked(txApi.listTransactionPage)
      .mockResolvedValueOnce({ items: [tx('t1', 'Dinner')], nextCursor: null })
      .mockResolvedValueOnce({ items: [], nextCursor: null })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/accounts/card']}>
        <Link to="/accounts/other">Go to other</Link>
        <Routes>
          <Route path="/accounts/:id" element={<AccountDetail />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText('Dinner')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Go to other' }))
    expect(await screen.findByRole('heading', { name: 'Car Loan' })).toBeInTheDocument()
    expect(screen.queryByText('Dinner')).toBeNull()
  })

  it('says so when the account no longer exists', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([])
    vi.mocked(txApi.listTransactionPage).mockResolvedValue({ items: [], nextCursor: null })
    renderAt('/accounts/gone')
    expect(await screen.findByText(/doesn't exist anymore/i)).toBeInTheDocument()
  })

  it('hands a delete over to the list (which offers Undo)', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([card])
    vi.mocked(accountsApi.deleteAccount).mockResolvedValue(undefined)
    vi.mocked(txApi.listTransactionPage).mockResolvedValue({ items: [], nextCursor: null })
    const user = userEvent.setup()
    renderAt('/accounts/card')

    await user.click(await screen.findByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(await screen.findByText('Accounts list (delete card)')).toBeInTheDocument()
    expect(accountsApi.deleteAccount).not.toHaveBeenCalled()
  })
})
