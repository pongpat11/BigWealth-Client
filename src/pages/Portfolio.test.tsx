import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Portfolio } from './Portfolio'
import * as api from '@/lib/portfolio'
import * as accountsApi from '@/lib/accounts'
import type { Account } from '@/lib/accounts'
import type { DividendList, Holding, Portfolio as PortfolioData } from '@/lib/portfolio'

vi.mock('@/lib/portfolio', async (importOriginal) => ({
  // Keep the asset-class constants; stub only the network calls.
  ...(await importOriginal<typeof import('@/lib/portfolio')>()),
  getPortfolio: vi.fn(),
  createHolding: vi.fn(),
  updateHolding: vi.fn(),
  deleteHolding: vi.fn(),
  listDividends: vi.fn(),
  createDividend: vi.fn(),
  deleteDividend: vi.fn(),
}))
vi.mock('@/lib/accounts', () => ({ listAccounts: vi.fn() }))

const account = (id: string, name: string, type: Account['type'] = 'investment'): Account => ({
  id,
  name,
  institution: null,
  type,
  currency: 'THB',
  balance: 0,
  currentBalance: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
})
const settrade = account('settrade', 'Settrade')
const ibkr = account('ibkr', 'IBKR')
const bank = account('bank', 'KBank', 'bank')

function renderPage(path = '/portfolio') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Portfolio />
    </MemoryRouter>,
  )
}

const ptt: Holding = {
  id: 'ptt',
  symbol: 'PTT',
  name: null,
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
}
const voo: Holding = {
  ...ptt,
  id: 'voo',
  symbol: 'VOO',
  assetClass: 'us',
  currency: 'USD',
  quantity: 12,
  avgCost: 520,
  price: 500,
  marketValue: 6000,
  costBasis: 6240,
  marketValueTHB: 204000,
  costBasisTHB: 212160,
  gainPct: -3.85,
}

const portfolio: PortfolioData = {
  fx: { usdThb: 34, date: '2026-11-13' },
  totalValueTHB: 395250,
  totalCostTHB: 384660,
  totalGainTHB: 10590,
  totalGainPct: 2.75,
  unconvertedCount: 0,
  holdings: [ptt, voo],
  allocation: [
    { assetClass: 'us', valueTHB: 204000, pct: 51.61 },
    { assetClass: 'set', valueTHB: 191250, pct: 48.39 },
  ],
}

const dividends: DividendList = {
  fx: { usdThb: 34, date: '2026-11-13' },
  totalGrossTHB: 3080,
  totalTaxTHB: 342,
  totalNetTHB: 2738,
  unconvertedCount: 0,
  items: [
    { id: 'd1', symbol: 'PTT', payDate: '2026-05-10', currency: 'THB', gross: 2400, withholdingTax: 240, net: 2160, netTHB: 2160 },
    { id: 'd2', symbol: 'VOO', payDate: '2026-03-28', currency: 'USD', gross: 20, withholdingTax: 3, net: 17, netTHB: 578 },
  ],
}

describe('Portfolio page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getPortfolio).mockResolvedValue(portfolio)
    vi.mocked(api.listDividends).mockResolvedValue(dividends)
    // One investment account: new holdings default to it. Bank accounts never show.
    vi.mocked(accountsApi.listAccounts).mockResolvedValue([settrade, bank])
  })

  it('shows the total, gain vs cost, and holdings grouped by asset class', async () => {
    renderPage()

    expect(await screen.findByText('฿395,250')).toBeInTheDocument()
    expect(screen.getByText('▲ +฿10,590 (+2.8%)')).toBeInTheDocument()
    expect(screen.getByText(/USD converted at ฿34\.00/)).toBeInTheDocument()

    const thai = screen.getByRole('region', { name: 'Thai Stocks' })
    expect(within(thai).getByText('5,000 · ฿38.25')).toBeInTheDocument()
    expect(within(thai).getByText('▲ +10.9%')).toBeInTheDocument()

    // A USD holding shows its price in dollars and its value in baht.
    const us = screen.getByRole('region', { name: 'US Stocks' })
    expect(within(us).getByText('12 · $500.00')).toBeInTheDocument()
    expect(within(us).getByText('฿204,000')).toBeInTheDocument()
    expect(within(us).getByText('▼ -3.9%')).toBeInTheDocument()
  })

  it('warns when USD holdings could not be converted', async () => {
    vi.mocked(api.getPortfolio).mockResolvedValue({
      ...portfolio,
      fx: { usdThb: null, date: null },
      unconvertedCount: 1,
      holdings: [ptt, { ...voo, marketValueTHB: null, costBasisTHB: null }],
    })
    renderPage()

    expect(await screen.findByRole('status')).toHaveTextContent(/1 USD item is left out/i)
    // Falls back to the dollar value rather than showing a made-up baht figure.
    expect(screen.getByText('$6,000.00')).toBeInTheDocument()
  })

  it('shows an empty state with no holdings', async () => {
    vi.mocked(api.getPortfolio).mockResolvedValue({
      ...portfolio,
      holdings: [],
      allocation: [],
      totalValueTHB: 0,
      totalGainTHB: 0,
      totalGainPct: null,
    })
    renderPage()
    expect(await screen.findByText(/no holdings yet/i)).toBeInTheDocument()
  })

  it('adds a stock that follows the market without entering a price', async () => {
    vi.mocked(api.createHolding).mockResolvedValue(ptt)
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('฿395,250')

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText('Symbol'), 'cpall')
    await user.type(screen.getByLabelText('Quantity'), '4000')
    await user.type(screen.getByLabelText(/average cost/i), '62')
    expect(screen.getByRole('checkbox', { name: /update price automatically/i })).toBeChecked()
    await user.click(screen.getByRole('button', { name: /add holding/i }))

    await waitFor(() =>
      expect(api.createHolding).toHaveBeenCalledWith({
        symbol: 'CPALL',
        name: null,
        assetClass: 'set',
        currency: 'THB',
        quantity: 4000,
        avgCost: 62,
        autoPrice: true,
        accountId: 'settrade',
      }),
    )
    await waitFor(() => expect(api.getPortfolio).toHaveBeenCalledTimes(2))
  })

  it('requires a price when automatic prices are off or unavailable', async () => {
    vi.mocked(api.createHolding).mockResolvedValue(ptt)
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('฿395,250')

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText('Symbol'), 'kfsdiv')
    await user.selectOptions(screen.getByLabelText(/asset class/i), 'fund')
    expect(screen.queryByRole('checkbox', { name: /update price automatically/i })).toBeNull()
    await user.type(screen.getByLabelText('Quantity'), '2')
    await user.type(screen.getByLabelText(/average cost/i), '41000')
    await user.click(screen.getByRole('button', { name: /add holding/i }))
    expect(await screen.findByText(/enter the current price/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/current price/i), '44200')
    await user.click(screen.getByRole('button', { name: /add holding/i }))
    await waitFor(() =>
      expect(api.createHolding).toHaveBeenCalledWith(
        expect.objectContaining({ assetClass: 'fund', price: 44200, autoPrice: false }),
      ),
    )
  })

  it('offers an estimated gold price per baht-weight', async () => {
    vi.mocked(api.createHolding).mockResolvedValue(ptt)
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('฿395,250')

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText('Symbol'), 'gold')
    await user.selectOptions(screen.getByLabelText(/asset class/i), 'gold')
    expect(screen.getByRole('checkbox', { name: /update price automatically/i })).toBeChecked()
    expect(screen.getByText(/per baht-weight of 96.5% gold/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Quantity (baht-weight)'), '2')
    await user.type(screen.getByLabelText(/average cost/i), '41000')
    await user.click(screen.getByRole('button', { name: /add holding/i }))
    await waitFor(() =>
      expect(api.createHolding).toHaveBeenCalledWith(
        expect.objectContaining({
          assetClass: 'gold',
          goldUnit: 'baht',
          currency: 'THB',
          quantity: 2,
          autoPrice: true,
        }),
      ),
    )
  })

  it('adds gold in troy ounces, in dollars by default', async () => {
    vi.mocked(api.createHolding).mockResolvedValue(ptt)
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('฿395,250')

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText('Symbol'), 'xau')
    await user.selectOptions(screen.getByLabelText(/asset class/i), 'gold')
    expect(screen.getByRole('radio', { name: /baht-weight/i })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Troy ounce' }))
    expect(screen.getByLabelText('Currency')).toHaveValue('USD')
    expect(screen.getByText(/per troy ounce/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Quantity (troy oz)'), '1.5')
    await user.type(screen.getByLabelText(/average cost/i), '2950')
    await user.click(screen.getByRole('button', { name: /add holding/i }))
    await waitFor(() =>
      expect(api.createHolding).toHaveBeenCalledWith(
        expect.objectContaining({ assetClass: 'gold', goldUnit: 'oz', currency: 'USD', quantity: 1.5 }),
      ),
    )
  })

  it('lists baht-weight and ounce gold apart, each with its total', async () => {
    const gold = (id: string, goldUnit: Holding['goldUnit'], quantity: number, currency: Holding['currency']): Holding => ({
      ...ptt,
      id,
      symbol: 'GOLD',
      assetClass: 'gold',
      goldUnit,
      currency,
      quantity,
    })
    vi.mocked(api.getPortfolio).mockResolvedValue({
      ...portfolio,
      // A row saved before units existed (no goldUnit) counts baht-weight.
      holdings: [gold('g1', 'baht', 2, 'THB'), gold('g2', undefined, 1, 'THB'), gold('g3', 'oz', 1.5, 'USD')],
    })
    renderPage()

    const baht = await screen.findByRole('region', { name: 'Gold · Baht-weight (96.5%)' })
    expect(within(baht).getByText('3 baht total')).toBeInTheDocument()
    expect(within(baht).getByText('2 baht · ฿38.25')).toBeInTheDocument()
    expect(within(baht).getByText('1 baht · ฿38.25')).toBeInTheDocument()
    const oz = screen.getByRole('region', { name: 'Gold · Troy ounce' })
    expect(within(oz).getByText('1.5 oz total')).toBeInTheDocument()
    expect(within(oz).getByText('1.5 oz · $38.25')).toBeInTheDocument()
  })

  it('picks dollars for US stocks and crypto', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('฿395,250')

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.selectOptions(screen.getByLabelText(/asset class/i), 'crypto')
    expect(screen.getByLabelText('Currency')).toHaveValue('USD')
  })

  it('updates a price from the edit form', async () => {
    vi.mocked(api.getPortfolio).mockResolvedValue({
      ...portfolio,
      holdings: [{ ...ptt, accountId: 'settrade' }, voo],
    })
    vi.mocked(api.updateHolding).mockResolvedValue(ptt)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /edit holding ptt/i }))
    const price = screen.getByLabelText(/current price/i)
    await user.clear(price)
    await user.type(price, '40')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(api.updateHolding).toHaveBeenCalledWith('ptt', expect.objectContaining({ price: 40 })),
    )
  })

  it('never assigns an unassigned holding to the only account on its own', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /edit holding ptt/i }))
    expect(screen.getByLabelText('Account')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/choose the account that holds it/i)
    expect(api.updateHolding).not.toHaveBeenCalled()
  })

  it('still saves edits when accounts fail to load, and offers a retry', async () => {
    vi.mocked(accountsApi.listAccounts).mockRejectedValue(new Error('offline'))
    vi.mocked(api.getPortfolio).mockResolvedValue({
      ...portfolio,
      holdings: [{ ...ptt, accountId: 'settrade' }, voo],
    })
    vi.mocked(api.updateHolding).mockResolvedValue(ptt)
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
    // The account name isn't known, but it isn't flagged as missing either.
    const thai = screen.getByRole('region', { name: 'Thai Stocks' })
    expect(within(thai).queryByText('No account')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /edit holding ptt/i }))
    const price = screen.getByLabelText(/current price/i)
    await user.clear(price)
    await user.type(price, '40')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(api.updateHolding).toHaveBeenCalled())
    expect(vi.mocked(api.updateHolding).mock.calls[0][1]).not.toHaveProperty('accountId')
  })

  it('keeps the holdings sort when switching tabs', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('฿395,250')

    await user.click(screen.getByRole('button', { name: 'Gain' }))
    await user.click(screen.getByRole('tab', { name: /dividends/i }))
    await user.click(screen.getByRole('tab', { name: /holdings/i }))
    expect(await screen.findByRole('button', { name: 'Gain' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('lists dividends with gross, tax and net, and totals in baht', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('฿395,250')

    await user.click(screen.getByRole('tab', { name: /dividends/i }))

    expect(await screen.findByText('฿2,738')).toBeInTheDocument() // net received
    expect(screen.getByText('฿342')).toBeInTheDocument() // tax withheld
    const row = screen.getByRole('row', { name: /VOO/ })
    expect(within(row).getByText('$20.00')).toBeInTheDocument()
    expect(within(row).getByText('−$3.00')).toBeInTheDocument()
    expect(within(row).getByText('$17.00')).toBeInTheDocument()
    expect(api.listDividends).toHaveBeenCalledWith(new Date().getFullYear(), undefined)

    await user.click(screen.getByRole('button', { name: /all years/i }))
    await waitFor(() => expect(api.listDividends).toHaveBeenLastCalledWith(undefined, undefined))
  })

  it('refuses withholding tax larger than the dividend', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('฿395,250')
    await user.click(screen.getByRole('tab', { name: /dividends/i }))
    await screen.findByText('฿2,738')

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.type(screen.getByLabelText('Symbol'), 'PTT')
    await user.type(screen.getByLabelText('Gross amount'), '100')
    await user.type(screen.getByLabelText('Withholding tax'), '150')
    await user.click(screen.getByRole('button', { name: /add dividend/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/between 0 and the gross/i)
    expect(api.createDividend).not.toHaveBeenCalled()
  })

  describe('accounts', () => {
    const linked = {
      ...portfolio,
      holdings: [{ ...ptt, accountId: 'settrade' }, { ...voo, accountId: null }],
    }

    it('labels each holding with its account and flags unassigned ones', async () => {
      vi.mocked(api.getPortfolio).mockResolvedValue(linked)
      renderPage()

      const thai = await screen.findByRole('region', { name: 'Thai Stocks' })
      expect(within(thai).getByText('Settrade')).toBeInTheDocument()
      const us = screen.getByRole('region', { name: 'US Stocks' })
      expect(within(us).getByText('No account')).toBeInTheDocument()

      const filter = screen.getByLabelText('Filter by account')
      const options = within(filter).getAllByRole('option').map((o) => o.textContent)
      expect(options).toEqual(['All accounts', 'Settrade', 'No account'])
    })

    it('narrows the page to the account in ?account=', async () => {
      const user = userEvent.setup()
      renderPage('/portfolio?account=settrade')
      await screen.findByText('฿395,250')
      expect(api.getPortfolio).toHaveBeenCalledWith('settrade')
      // Every row is in that account, so the chips are left out.
      expect(screen.queryByText('Settrade', { selector: 'span' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: /dividends/i }))
      await waitFor(() =>
        expect(api.listDividends).toHaveBeenCalledWith(new Date().getFullYear(), 'settrade'),
      )

      await user.selectOptions(screen.getByLabelText('Filter by account'), '')
      await waitFor(() => expect(api.getPortfolio).toHaveBeenLastCalledWith(undefined))
    })

    it('requires an account for a new holding when there are several', async () => {
      vi.mocked(accountsApi.listAccounts).mockResolvedValue([settrade, ibkr])
      vi.mocked(api.createHolding).mockResolvedValue(ptt)
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('฿395,250')

      await user.click(screen.getByRole('button', { name: /^add$/i }))
      await user.type(screen.getByLabelText('Symbol'), 'voo')
      await user.type(screen.getByLabelText('Quantity'), '1')
      await user.type(screen.getByLabelText(/average cost/i), '500')
      await user.click(screen.getByRole('button', { name: /add holding/i }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/choose the account that holds it/i)
      expect(api.createHolding).not.toHaveBeenCalled()

      await user.selectOptions(screen.getByLabelText('Account'), 'ibkr')
      await user.click(screen.getByRole('button', { name: /add holding/i }))
      await waitFor(() =>
        expect(api.createHolding).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'ibkr' })),
      )
    })

    it('starts a new holding in the filtered account', async () => {
      vi.mocked(accountsApi.listAccounts).mockResolvedValue([settrade, ibkr])
      const user = userEvent.setup()
      renderPage('/portfolio?account=ibkr')
      await screen.findByText('฿395,250')

      await user.click(screen.getByRole('button', { name: /^add$/i }))
      expect(screen.getByLabelText('Account')).toHaveValue('ibkr')
    })

    it('links to creating an investment account when there is none', async () => {
      vi.mocked(accountsApi.listAccounts).mockResolvedValue([bank])
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('฿395,250')

      await user.click(screen.getByRole('button', { name: /^add$/i }))
      expect(screen.getByRole('link', { name: /create an investment account first/i })).toHaveAttribute(
        'href',
        '/accounts',
      )
    })

    it('fills a dividend\'s account from the holding with that symbol', async () => {
      vi.mocked(accountsApi.listAccounts).mockResolvedValue([settrade, ibkr])
      vi.mocked(api.getPortfolio).mockResolvedValue({
        ...portfolio,
        holdings: [{ ...ptt, accountId: 'settrade' }, { ...voo, accountId: 'ibkr' }],
      })
      vi.mocked(api.createDividend).mockResolvedValue(dividends.items[1])
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('฿395,250')
      await user.click(screen.getByRole('tab', { name: /dividends/i }))
      await screen.findByText('฿2,738')

      await user.click(screen.getByRole('button', { name: /^add$/i }))
      await user.type(screen.getByLabelText('Symbol'), 'voo')
      expect(screen.getByLabelText('Account')).toHaveValue('ibkr')
      await user.type(screen.getByLabelText('Gross amount'), '20')
      await user.click(screen.getByRole('button', { name: /add dividend/i }))
      await waitFor(() =>
        expect(api.createDividend).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'VOO', accountId: 'ibkr' })),
      )
    })
  })

  it('deletes a dividend in one tap with an undo window', async () => {
    vi.mocked(api.deleteDividend).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('฿395,250')
    await user.click(screen.getByRole('tab', { name: /dividends/i }))

    await user.click(await screen.findByRole('button', { name: 'Delete PTT dividend' }))
    expect(screen.queryByRole('button', { name: 'Delete PTT dividend' })).not.toBeInTheDocument()
    expect(api.deleteDividend).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    await waitFor(() => expect(api.deleteDividend).toHaveBeenCalledWith('d1'))
  })
})
