import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Export } from './Export'
import * as api from '@/lib/exports'
import type { TaxSummary } from '@/lib/exports'

vi.mock('@/lib/exports', async (importOriginal) => ({
  // Keep the pure date helpers; stub the network calls and the file save.
  ...(await importOriginal<typeof import('@/lib/exports')>()),
  fetchCsv: vi.fn(),
  getTaxSummary: vi.fn(),
  saveTextFile: vi.fn(),
}))

const summary: TaxSummary = {
  year: 2026,
  timezone: 'Asia/Bangkok',
  generatedAt: '2026-11-28T03:00:00.000Z',
  income: { total: 780000, byCategory: [{ categoryId: 'salary', name: 'Salary', amount: 780000 }] },
  expense: {
    total: 1500,
    byCategory: [
      { categoryId: 'food', name: 'Food', amount: 1000 },
      { categoryId: null, name: 'Uncategorized', amount: 500 },
    ],
  },
  nonThbTransactionCount: 2,
  dividends: {
    bySymbol: [
      { symbol: 'PTT', currency: 'THB', count: 2, gross: 2400, withholdingTax: 240, net: 2160, grossTHB: 2400, withholdingTaxTHB: 240, netTHB: 2160 },
      { symbol: 'VOO', currency: 'USD', count: 1, gross: 20, withholdingTax: 3, net: 17, grossTHB: 680, withholdingTaxTHB: 102, netTHB: 578 },
    ],
    totalGrossTHB: 3080,
    totalTaxTHB: 342,
    totalNetTHB: 2738,
    unconvertedCount: 0,
    fxRate: 34,
    fxDate: '2026-11-27',
  },
}

describe('presetRange', () => {
  const today = new Date(2026, 1, 15) // 15 Feb 2026
  it('covers calendar months and years, ending today for the current ones', () => {
    expect(api.presetRange('thisMonth', today)).toEqual({ from: '2026-02-01', to: '2026-02-15' })
    expect(api.presetRange('lastMonth', today)).toEqual({ from: '2026-01-01', to: '2026-01-31' })
    expect(api.presetRange('thisYear', today)).toEqual({ from: '2026-01-01', to: '2026-02-15' })
    expect(api.presetRange('lastYear', today)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })
})

describe('Export page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    vi.mocked(api.getTaxSummary).mockResolvedValue(summary)
  })

  it('shows the tax summary with dividend totals and category tables', async () => {
    render(<Export />)
    expect(await screen.findByText('Tax summary 2026')).toBeInTheDocument()
    expect(screen.getByText('PTT')).toBeInTheDocument()
    expect(screen.getByText('20.00 USD')).toBeInTheDocument()
    expect(screen.getByText('฿342.00')).toBeInTheDocument() // tax withheld, THB
    expect(screen.getByText('฿2,738.00')).toBeInTheDocument()
    expect(screen.getByText(/USD converted at ฿34.00/)).toBeInTheDocument()
    expect(screen.getByText('Salary')).toBeInTheDocument()
    expect(screen.getByText('Uncategorized')).toBeInTheDocument()
    expect(screen.getByText('2 transactions in other currencies are not included.')).toBeInTheDocument()
  })

  it('loads another year when picked', async () => {
    render(<Export />)
    await screen.findByText('Tax summary 2026')
    // Never the default (that's this year or, before April, last year).
    const older = new Date().getFullYear() - 2
    await userEvent.click(screen.getByRole('button', { name: String(older) }))
    await waitFor(() => expect(api.getTaxSummary).toHaveBeenLastCalledWith(older))
  })

  it('downloads the transactions CSV for the chosen range', async () => {
    vi.mocked(api.fetchCsv).mockResolvedValue('date,type\r\n')
    render(<Export />)
    await userEvent.click(screen.getByRole('button', { name: 'Last year' }))
    await userEvent.click(screen.getByRole('button', { name: 'Transactions CSV' }))
    const y = new Date().getFullYear() - 1
    await waitFor(() =>
      expect(api.saveTextFile).toHaveBeenCalledWith(
        `bigwealth-transactions-${y}-01-01-to-${y}-12-31.csv`,
        'date,type\r\n',
      ),
    )
    expect(api.fetchCsv).toHaveBeenCalledWith('transactions', `${y}-01-01`, `${y}-12-31`)
  })

  it('blocks a reversed range', async () => {
    render(<Export />)
    const from = screen.getByLabelText('From')
    await userEvent.clear(from)
    await userEvent.type(from, '2099-01-01')
    expect(screen.getByText('Pick a start date on or before the end date.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dividends CSV' })).toBeDisabled()
  })

  it('keeps the chosen range and year when the screen remounts', async () => {
    const { unmount } = render(<Export />)
    await screen.findByText('Tax summary 2026')
    await userEvent.click(screen.getByRole('button', { name: 'Last month' }))
    const older = new Date().getFullYear() - 2
    await userEvent.click(screen.getByRole('button', { name: String(older) }))
    unmount()
    render(<Export />)
    expect(screen.getByRole('button', { name: 'Last month' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: String(older) })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(api.getTaxSummary).toHaveBeenLastCalledWith(older))
  })

  it('warns that dividends recorded as income would be counted twice', async () => {
    render(<Export />)
    expect(await screen.findByText(/Count them once/)).toBeInTheDocument()
  })

  it('shows the server error when a download fails', async () => {
    const { ApiError } = await import('@/lib/api')
    vi.mocked(api.fetchCsv).mockRejectedValue(new ApiError(400, 'Range is too long'))
    render(<Export />)
    await userEvent.click(screen.getByRole('button', { name: 'Dividends CSV' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Range is too long')
  })
})
