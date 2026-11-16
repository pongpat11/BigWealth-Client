import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Reports } from './Reports'
import * as api from '@/lib/reports'
import type { Report } from '@/lib/reports'

vi.mock('@/lib/reports', async (importOriginal) => ({
  // Keep the pure CSV helper and constants; stub only the network call.
  ...(await importOriginal<typeof import('@/lib/reports')>()),
  getReport: vi.fn(),
}))

const report: Report = {
  range: '3M',
  months: [
    { month: '2026-05', income: 65000, expense: 40000, netWorth: 900000 },
    { month: '2026-06', income: 65000, expense: 45000, netWorth: 920000 },
    { month: '2026-07', income: 67400, expense: 15000, netWorth: 972400 },
  ],
  totalIncome: 197400,
  totalExpense: 100000,
  spendingByCategory: [
    { categoryId: 'home', name: 'Home, Rent', icon: null, color: '#8b5cf6', amount: 75000 },
    { categoryId: 'food', name: 'Food', icon: null, color: '#f59e0b', amount: 25000 },
  ],
}

describe('reportToCsv', () => {
  it('writes the monthly table then the category breakdown, quoting commas', () => {
    expect(api.reportToCsv(report).split('\n')).toEqual([
      'Month,Income (THB),Expense (THB),Net (THB),Net worth (THB)',
      '2026-05,65000,40000,25000,900000',
      '2026-06,65000,45000,20000,920000',
      '2026-07,67400,15000,52400,972400',
      '',
      'Category,Spent (THB)',
      '"Home, Rent",75000',
      'Food,25000',
    ])
  })
})

describe('Reports page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows totals, the net-worth change and each category share', async () => {
    vi.mocked(api.getReport).mockResolvedValue(report)
    render(<Reports />)

    expect(await screen.findByText('฿197,400')).toBeInTheDocument() // income
    expect(screen.getByText('฿100,000')).toBeInTheDocument() // expense
    expect(screen.getByText('+฿97,400')).toBeInTheDocument() // net
    expect(screen.getByText('฿972,400')).toBeInTheDocument() // latest net worth
    expect(screen.getByText('+฿72,400')).toBeInTheDocument() // change over the range
    expect(screen.getByText('Home, Rent')).toBeInTheDocument()
    expect(screen.getByText(/· 75%/)).toBeInTheDocument()
    expect(screen.getByText(/· 25%/)).toBeInTheDocument()

    // The chart has a table alternative for assistive tech.
    const table = screen.getByRole('table', { name: /income and expense by month/i })
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    expect(api.getReport).toHaveBeenCalledWith('3M')
  })

  it('reloads when the range changes', async () => {
    vi.mocked(api.getReport).mockResolvedValue(report)
    const user = userEvent.setup()
    render(<Reports />)
    await screen.findByText('฿197,400')

    await user.click(screen.getByRole('button', { name: 'Last 12 months' }))
    await waitFor(() => expect(api.getReport).toHaveBeenLastCalledWith('1Y'))
  })

  it('says so when nothing was recorded in the period', async () => {
    vi.mocked(api.getReport).mockResolvedValue({
      range: '1M',
      months: [{ month: '2026-07', income: 0, expense: 0, netWorth: 50000 }],
      totalIncome: 0,
      totalExpense: 0,
      spendingByCategory: [],
    })
    render(<Reports />)

    expect(await screen.findByText(/no income or spending recorded/i)).toBeInTheDocument()
    expect(screen.getByText('฿50,000')).toBeInTheDocument()
    expect(screen.queryByText(/spending by category/i)).not.toBeInTheDocument()
  })

  it('shows the API error', async () => {
    vi.mocked(api.getReport).mockRejectedValue(new Error('boom'))
    render(<Reports />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the report/i)
  })
})
