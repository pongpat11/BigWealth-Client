import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from './Dashboard'
import * as dashboardApi from '@/lib/dashboard'
import * as accountsApi from '@/lib/accounts'
import * as txApi from '@/lib/transactions'
import * as authApi from '@/lib/auth'

vi.mock('@/lib/dashboard', () => ({ getDashboardSummary: vi.fn() }))
vi.mock('@/lib/accounts', () => ({ listAccounts: vi.fn() }))
vi.mock('@/lib/transactions', () => ({ listTransactions: vi.fn() }))
vi.mock('@/lib/auth', () => ({ me: vi.fn(), getAccessToken: vi.fn(() => 'token') }))

const summary = {
  netWorth: 40000,
  totalAssets: 52000,
  totalDebt: 12000,
  monthDelta: 4500,
  cashFlow: [
    { month: '2026-02', income: 0, expense: 0 },
    { month: '2026-03', income: 65000, expense: 40000 },
    { month: '2026-04', income: 65000, expense: 42000 },
    { month: '2026-05', income: 67000, expense: 39000 },
    { month: '2026-06', income: 65000, expense: 41000 },
    { month: '2026-07', income: 67400, expense: 62900 },
  ],
}

const bank = {
  id: 'a1',
  name: 'SCB Savings',
  institution: 'SCB',
  type: 'bank' as const,
  currency: 'THB' as const,
  balance: 50000,
  currentBalance: 50000,
  createdAt: '2026-07-01T00:00:00.000Z',
}
const wallet = {
  id: 'a2',
  name: 'Wallet',
  institution: null,
  type: 'cash' as const,
  currency: 'THB' as const,
  balance: 2000,
  currentBalance: 2000,
  createdAt: '2026-07-01T00:00:00.000Z',
}

const lunch = {
  id: 't1',
  type: 'expense' as const,
  amount: 185,
  currency: 'THB',
  categoryId: 'food',
  subCategoryId: null,
  category: {
    id: 'food',
    name: 'Food & Dining',
    kind: 'expense' as const,
    icon: 'UtensilsCrossed',
    color: '#f59e0b',
  },
  subCategory: null,
  accountId: null,
  account: null,
  note: 'Lunch — som tam',
  date: '2026-07-11T05:30:00.000Z',
  timezone: 'Asia/Bangkok',
  createdAt: '2026-07-11T05:30:00.000Z',
  labels: [],
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dashboardApi.getDashboardSummary).mockResolvedValue(summary)
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([bank, wallet])
    vi.mocked(txApi.listTransactions).mockResolvedValue([lunch])
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'u1',
      email: 'demo@bigwealth.app',
      name: 'Pong',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('shows the net worth hero from the summary API', async () => {
    renderDashboard()
    expect(await screen.findByText('฿40,000')).toBeInTheDocument()
    expect(screen.getByText(/net worth/i)).toBeInTheDocument()
  })

  it('greets the signed-in user by name', async () => {
    renderDashboard()
    expect(await screen.findByText(/, Pong$/)).toBeInTheDocument()
  })

  it('shows assets and debts stat cards', async () => {
    renderDashboard()
    expect(await screen.findByText('Assets')).toBeInTheDocument()
    expect(screen.getByText('Debts')).toBeInTheDocument()
    expect(screen.getByText('฿52.0K')).toBeInTheDocument()
    expect(screen.getByText('฿12.0K')).toBeInTheDocument()
  })

  it('shows the allocation legend grouped by account type', async () => {
    renderDashboard()
    expect(await screen.findByText('Allocation')).toBeInTheDocument()
    expect(screen.getByText('Bank')).toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
    // 50k of 52k ≈ 96%, 2k ≈ 4%
    expect(screen.getByText('96%')).toBeInTheDocument()
    expect(screen.getByText('4%')).toBeInTheDocument()
  })

  it('lists recent transactions with a link to see all', async () => {
    renderDashboard()
    expect(await screen.findByText('Lunch — som tam')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /see all/i })).toHaveAttribute(
      'href',
      '/transactions',
    )
  })

  it('shows the add-your-first-account CTA when there are no accounts', async () => {
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([])
    renderDashboard()
    expect(
      await screen.findByRole('button', { name: /add your first account/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/net worth/i)).not.toBeInTheDocument()
  })
})
