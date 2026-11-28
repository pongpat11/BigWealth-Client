import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { HoldingDetail } from './HoldingDetail'
import * as api from '@/lib/portfolio'
import * as accountsApi from '@/lib/accounts'
import { ApiError } from '@/lib/api'
import type { Account } from '@/lib/accounts'
import type { HoldingDetail as HoldingDetailData } from '@/lib/portfolio'

vi.mock('@/lib/portfolio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/portfolio')>()),
  getHolding: vi.fn(),
  updateHolding: vi.fn(),
  createDividend: vi.fn(),
  updateDividend: vi.fn(),
  deleteDividend: vi.fn(),
}))
vi.mock('@/lib/accounts', () => ({ listAccounts: vi.fn() }))

const settrade: Account = {
  id: 'settrade',
  name: 'Settrade',
  institution: null,
  type: 'investment',
  currency: 'THB',
  balance: 0,
  currentBalance: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const ptt: HoldingDetailData = {
  id: 'ptt',
  accountId: 'settrade',
  symbol: 'PTT',
  name: 'PTT PCL',
  assetClass: 'set',
  currency: 'THB',
  quantity: 5000,
  avgCost: 34.5,
  price: 38.25,
  priceUpdatedAt: '2026-11-01T00:00:00.000Z',
  marketValue: 191250,
  costBasis: 172500,
  marketValueTHB: 191250,
  costBasisTHB: 172500,
  gainPct: 10.87,
  fx: { usdThb: 34, date: '2026-11-13' },
  gainTHB: 18750,
  dividends: [
    { id: 'd1', accountId: 'settrade', symbol: 'PTT', payDate: '2026-05-10', currency: 'THB', gross: 2400, withholdingTax: 240, net: 2160, netTHB: 2160 },
  ],
  dividendsNetTHB: 2160,
  dividendsUnconverted: 0,
  totalReturnTHB: 20910,
  totalReturnPct: 12.12,
}

/** Shows where the page navigated to, and with what state. */
function Where() {
  const location = useLocation()
  return (
    <p data-testid="where">
      {location.pathname + location.search} {JSON.stringify(location.state)}
    </p>
  )
}

function renderPage(from?: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/portfolio/ptt', state: from ? { from } : null }]}>
      <Routes>
        <Route path="/portfolio/:id" element={<HoldingDetail />} />
        <Route path="/portfolio" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Holding page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getHolding).mockResolvedValue(ptt)
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([settrade])
  })

  it('shows the value, the details and the total return including dividends', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'PTT' })).toBeInTheDocument()
    expect(screen.getByText('PTT PCL · Thai Stocks')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Settrade' })).toHaveAttribute('href', '/accounts/settrade')

    const value = screen.getByRole('region', { name: 'Value' })
    expect(within(value).getByText('฿191,250')).toBeInTheDocument()
    expect(within(value).getByText('▲ +฿18,750 · +10.9%')).toBeInTheDocument()
    expect(within(value).getByText('฿34.50')).toBeInTheDocument()

    expect(screen.getByText('Dividends received').nextSibling).toHaveTextContent('+฿2,160')
    expect(screen.getByText('+฿20,910 · +12.1%')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /PTT/ })).toHaveTextContent('฿2,160.00')
  })

  it('says so when the holding no longer exists', async () => {
    vi.mocked(api.getHolding).mockRejectedValue(new ApiError(404, 'Holding not found'))
    renderPage()
    expect(await screen.findByText(/doesn't exist anymore/i)).toBeInTheDocument()
  })

  it('goes back to the list the user came from', async () => {
    renderPage('/portfolio?account=settrade')
    expect(await screen.findByRole('link', { name: 'Portfolio' })).toHaveAttribute(
      'href',
      '/portfolio?account=settrade',
    )
  })

  it('updates a price from the edit form and reloads', async () => {
    vi.mocked(api.updateHolding).mockResolvedValue(ptt)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const price = screen.getByLabelText(/current price/i)
    await user.clear(price)
    await user.type(price, '40')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(api.updateHolding).toHaveBeenCalledWith('ptt', expect.objectContaining({ price: 40, accountId: 'settrade' })),
    )
    await waitFor(() => expect(api.getHolding).toHaveBeenCalledTimes(2))
  })

  it('never assigns an unassigned holding to the only account on its own', async () => {
    vi.mocked(api.getHolding).mockResolvedValue({ ...ptt, accountId: null })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('No account')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Account')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/choose the account that holds it/i)
    expect(api.updateHolding).not.toHaveBeenCalled()
  })

  it('still saves edits when accounts fail to load', async () => {
    vi.mocked(accountsApi.listAccounts).mockRejectedValue(new Error('offline'))
    vi.mocked(api.updateHolding).mockResolvedValue(ptt)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(api.updateHolding).toHaveBeenCalled())
    expect(vi.mocked(api.updateHolding).mock.calls[0][1]).not.toHaveProperty('accountId')
  })

  it('converts the amounts when an edit switches the gold unit', async () => {
    const bar: HoldingDetailData = { ...ptt, id: 'bar', symbol: 'GOLD', assetClass: 'gold', goldUnit: 'baht', quantity: 2, avgCost: 41000, price: 44000, dividends: [] }
    vi.mocked(api.getHolding).mockResolvedValue(bar)
    vi.mocked(api.updateHolding).mockResolvedValue(bar)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Troy ounce' }))
    expect(screen.getByText(/converted to troy ounce/i)).toBeInTheDocument()
    const oz = api.GOLD_OZ_PER_BAHT
    expect(screen.getByLabelText('Quantity (troy oz)')).toHaveValue(String(Math.round(2 * oz * 1e8) / 1e8))
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(api.updateHolding).toHaveBeenCalled())
    const sent = vi.mocked(api.updateHolding).mock.calls[0][1]
    expect(sent.goldUnit).toBe('oz')
    expect(sent.quantity! * sent.price!).toBeCloseTo(2 * 44000, -1)
  })

  it('hands a deleted holding back to the list, which offers undo', async () => {
    const user = userEvent.setup()
    renderPage('/portfolio?account=settrade')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: /delete holding/i }))
    const where = await screen.findByTestId('where')
    expect(where).toHaveTextContent('/portfolio?account=settrade')
    expect(where).toHaveTextContent('"deletedHolding":{"id":"ptt"')
  })

  it('adds a dividend for this holding, starting from its symbol and account', async () => {
    vi.mocked(api.createDividend).mockResolvedValue(ptt.dividends[0])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'New dividend' }))
    expect(screen.getByLabelText('Symbol')).toHaveValue('PTT')
    await waitFor(() => expect(screen.getByLabelText('Account')).toHaveValue('settrade'))
    await user.type(screen.getByLabelText('Gross amount'), '1000')
    await user.click(screen.getByRole('button', { name: 'Use 10% (฿100.00)' }))
    await user.click(screen.getByRole('button', { name: /add dividend/i }))
    await waitFor(() =>
      expect(api.createDividend).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'PTT', accountId: 'settrade', gross: 1000, withholdingTax: 100 }),
      ),
    )
    await waitFor(() => expect(api.getHolding).toHaveBeenCalledTimes(2))
  })

  it('edits and deletes its dividends', async () => {
    vi.mocked(api.updateDividend).mockResolvedValue(ptt.dividends[0])
    vi.mocked(api.deleteDividend).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Edit PTT dividend' }))
    await user.clear(screen.getByLabelText('Withholding tax'))
    await user.type(screen.getByLabelText('Withholding tax'), '200')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(api.updateDividend).toHaveBeenCalledWith('d1', expect.objectContaining({ withholdingTax: 200 })))

    await user.click(await screen.findByRole('button', { name: 'Delete PTT dividend' }))
    expect(screen.queryByRole('button', { name: 'Delete PTT dividend' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    await waitFor(() => expect(api.deleteDividend).toHaveBeenCalledWith('d1'))
  })
})
