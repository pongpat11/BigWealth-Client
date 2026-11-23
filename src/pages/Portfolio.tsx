import { useEffect, useState, type FormEvent } from 'react'
import { PieChart as PieIcon, Plus, TriangleAlert } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Sheet } from '@/components/ui/Sheet'
import { reinsert, useUndoableDelete } from '@/lib/useUndoableDelete'
import { ApiError } from '@/lib/api'
import { formatDate, formatPercent, formatSignedTHB, formatTHB } from '@/lib/format'
import {
  ASSET_CLASSES,
  AUTO_PRICE_CLASSES,
  ASSET_CLASS_META,
  createDividend,
  createHolding,
  deleteDividend,
  deleteHolding,
  getPortfolio,
  listDividends,
  updateHolding,
  type AssetClass,
  type Dividend,
  type DividendList,
  type Fx,
  type Holding,
  type Portfolio as PortfolioData,
} from '@/lib/portfolio'
import type { Currency } from '@/types'

const CURRENCIES: Currency[] = ['THB', 'USD']
const selectClass =
  'h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500'
const labelClass = 'text-[13px] font-medium text-[var(--color-muted)]'

/** An amount in its own currency, e.g. "฿38.25" or "$498.00". */
function native(amount: number, currency: Currency, digits = 2): string {
  const text = amount.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return currency === 'THB' ? `฿${text}` : `$${text}`
}

function quantityText(quantity: number): string {
  return quantity.toLocaleString('en-US', { maximumFractionDigits: 8 })
}

function gainTone(value: number | null): string {
  if (value === null || value === 0) return 'text-[var(--color-muted)]'
  return value > 0 ? 'text-[var(--color-gain)]' : 'text-[var(--color-loss)]'
}

/** ▲ / ▼ plus a signed percentage, so gains never rely on colour alone. */
function gainText(pct: number | null): string {
  if (pct === null) return '—'
  return `${pct > 0 ? '▲' : pct < 0 ? '▼' : ''} ${formatPercent(pct)}`.trim()
}

function FxNote({ fx, unconverted }: { fx: Fx; unconverted: number }) {
  if (fx.usdThb === null) {
    if (unconverted === 0) return null
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-600">
        <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          No USD exchange rate is available right now, so {unconverted} USD{' '}
          {unconverted === 1 ? 'item is' : 'items are'} left out of the baht totals.
        </span>
      </p>
    )
  }
  return (
    <p className="tnum px-1 text-xs text-[var(--color-muted)]">
      USD converted at ฿{fx.usdThb.toFixed(2)} (reference rate
      {fx.date ? `, ${formatDate(fx.date)}` : ''}).
    </p>
  )
}

function Message({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]">
      {children}
    </p>
  )
}

function HoldingForm({
  initial,
  onDone,
  onDelete,
  onClose,
}: {
  initial?: Holding
  onDone: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const [symbol, setSymbol] = useState(initial?.symbol ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [assetClass, setAssetClass] = useState<AssetClass>(initial?.assetClass ?? 'set')
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'THB')
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '')
  const [avgCost, setAvgCost] = useState(initial ? String(initial.avgCost) : '')
  const [price, setPrice] = useState(initial ? String(initial.price) : '')
  // New SET / US / crypto holdings follow the market unless switched off.
  const [autoPrice, setAutoPrice] = useState(initial ? Boolean(initial.autoPrice) : true)
  const canAutoPrice = AUTO_PRICE_CLASSES.includes(assetClass)
  const followsMarket = canAutoPrice && autoPrice
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const qty = Number(quantity)
    const cost = Number(avgCost)
    const current = Number(price)
    if (!symbol.trim()) return setError('Enter a symbol.')
    if (!Number.isFinite(qty) || qty <= 0) return setError('Enter a quantity greater than 0.')
    if (avgCost.trim() === '' || !Number.isFinite(cost) || cost < 0) {
      return setError('Enter the average cost per unit.')
    }
    const priceGiven = price.trim() !== ''
    if (priceGiven ? !Number.isFinite(current) || current < 0 : !followsMarket) {
      return setError('Enter the current price per unit.')
    }
    setError(null)
    setSaving(true)
    const input = {
      symbol: symbol.trim().toUpperCase(),
      name: name.trim() || null,
      assetClass,
      currency,
      quantity: qty,
      avgCost: cost,
      ...(priceGiven && { price: current }),
      autoPrice: followsMarket,
    }
    try {
      if (initial) await updateHolding(initial.id, input)
      else await createHolding(input)
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {initial ? `Edit ${initial.symbol}` : 'New holding'}
          </p>
          {error && <Message>{error}</Message>}
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="holding-symbol"
              label="Symbol"
              placeholder="e.g. PTT"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
            <Input
              id="holding-name"
              label="Name (optional)"
              placeholder="e.g. PTT PCL"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="holding-class" className={labelClass}>
                Asset class
              </label>
              <select
                id="holding-class"
                value={assetClass}
                onChange={(e) => {
                  const next = e.target.value as AssetClass
                  setAssetClass(next)
                  // US stocks and crypto are quoted in dollars.
                  if (!initial) setCurrency(next === 'us' || next === 'crypto' ? 'USD' : 'THB')
                }}
                className={selectClass}
              >
                {ASSET_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {ASSET_CLASS_META[c].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="holding-currency" className={labelClass}>
                Currency
              </label>
              <select
                id="holding-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className={selectClass}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Input
            id="holding-quantity"
            label={assetClass === 'gold' ? 'Quantity (baht-weight)' : 'Quantity'}
            inputMode="decimal"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="holding-cost"
              label="Average cost / unit"
              inputMode="decimal"
              placeholder="0"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
            />
            <Input
              id="holding-price"
              label={followsMarket ? 'Price / unit (optional)' : 'Current price / unit'}
              inputMode="decimal"
              placeholder={followsMarket ? 'Looked up' : '0'}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          {canAutoPrice ? (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-canvas)] px-3 py-2.5">
              <span className="text-sm text-[var(--color-ink)]">
                Update price automatically
                <span className="block text-xs text-[var(--color-muted)]">
                  {assetClass === 'gold'
                    ? 'Estimated per baht-weight of 96.5% gold (in THB) from the world price; the shop price is a little higher. Enter the quantity in baht-weight, not grams.'
                    : 'From the market each time you open Portfolio (delayed up to 15 min).'}
                </span>
              </span>
              <input
                type="checkbox"
                checked={autoPrice}
                onChange={(e) => setAutoPrice(e.target.checked)}
                className="size-5 accent-brand-600"
              />
            </label>
          ) : (
            <p className="text-xs text-[var(--color-muted)]">
              Prices for {ASSET_CLASS_META[assetClass].label.toLowerCase()} aren't fetched
              automatically. Update the current price here when you want a fresh valuation.
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Add holding'}
            </Button>
          </div>
          {initial && (
            <DeleteButton
              variant="block"
              label="Delete holding"
              onClick={onDelete}
              disabled={saving}
            />
          )}
        </form>
      </CardBody>
    </Card>
  )
}

/** "live" for a price from the last hour, otherwise when it was set. */
function priceAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60 * 60 * 1000) return 'live'
  return `as of ${formatDate(iso)}`
}

function HoldingRow({ holding, onEdit }: { holding: Holding; onEdit: (h: Holding) => void }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(holding)}
      aria-label={`Edit holding ${holding.symbol}`}
      className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-[var(--color-canvas)]"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
          {holding.symbol}
          {holding.name && (
            <span className="font-normal text-[var(--color-muted)]"> · {holding.name}</span>
          )}
        </p>
        <p className="tnum text-xs text-[var(--color-muted)]">
          {quantityText(holding.quantity)} · {native(holding.price, holding.currency)}
          {holding.autoPrice && ` · ${priceAge(holding.priceUpdatedAt)}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="tnum text-sm font-semibold text-[var(--color-ink)]">
          {holding.marketValueTHB !== null
            ? formatTHB(holding.marketValueTHB)
            : native(holding.marketValue, holding.currency)}
        </p>
        <p className={`tnum text-xs font-medium ${gainTone(holding.gainPct)}`}>
          {gainText(holding.gainPct)}
        </p>
      </div>
    </button>
  )
}

function HoldingsTab({
  portfolio,
  onEdit,
}: {
  portfolio: PortfolioData
  onEdit: (h: Holding) => void
}) {
  if (portfolio.holdings.length === 0) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-canvas)] text-[var(--color-muted)]">
            <PieIcon size={22} aria-hidden />
          </span>
          <p className="text-sm text-[var(--color-muted)]">
            No holdings yet. Add a stock, fund, crypto or gold position to see your portfolio.
          </p>
        </CardBody>
      </Card>
    )
  }

  return (
    <>
      {portfolio.allocation.length > 0 && (
        <Card>
          <CardHeader title="Allocation" />
          <CardBody className="flex items-center gap-4">
            <div className="h-32 w-32 shrink-0" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={portfolio.allocation}
                    dataKey="valueTHB"
                    nameKey="assetClass"
                    innerRadius="62%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {portfolio.allocation.map((slice) => (
                      <Cell key={slice.assetClass} fill={ASSET_CLASS_META[slice.assetClass].color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {portfolio.allocation.map((slice) => (
                <li key={slice.assetClass} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-[var(--color-muted)]">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: ASSET_CLASS_META[slice.assetClass].color }}
                      aria-hidden
                    />
                    {ASSET_CLASS_META[slice.assetClass].label}
                  </span>
                  <span className="tnum font-semibold text-[var(--color-ink)]">
                    {Math.round(slice.pct)}%
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {ASSET_CLASSES.map((assetClass) => {
        const rows = portfolio.holdings.filter((h) => h.assetClass === assetClass)
        if (rows.length === 0) return null
        return (
          <section key={assetClass} aria-label={ASSET_CLASS_META[assetClass].label} className="space-y-1.5">
            <h2 className="px-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              {ASSET_CLASS_META[assetClass].label}
            </h2>
            <Card>
              <CardBody className="divide-y divide-[var(--color-line)] py-0">
                {rows.map((h) => (
                  <HoldingRow key={h.id} holding={h} onEdit={onEdit} />
                ))}
              </CardBody>
            </Card>
          </section>
        )
      })}
    </>
  )
}

function DividendForm({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [symbol, setSymbol] = useState('')
  const [payDate, setPayDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [currency, setCurrency] = useState<Currency>('THB')
  const [gross, setGross] = useState('')
  const [tax, setTax] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const grossValue = Number(gross)
    const taxValue = tax.trim() === '' ? 0 : Number(tax)
    if (!symbol.trim()) return setError('Enter a symbol.')
    if (!payDate) return setError('Pick the pay date.')
    if (!Number.isFinite(grossValue) || grossValue <= 0) {
      return setError('Enter a gross amount greater than 0.')
    }
    if (!Number.isFinite(taxValue) || taxValue < 0 || taxValue > grossValue) {
      return setError('Withholding tax must be between 0 and the gross amount.')
    }
    setError(null)
    setSaving(true)
    try {
      await createDividend({
        symbol: symbol.trim().toUpperCase(),
        payDate,
        currency,
        gross: grossValue,
        withholdingTax: taxValue,
      })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-[var(--color-ink)]">New dividend</p>
          {error && <Message>{error}</Message>}
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="dividend-symbol"
              label="Symbol"
              placeholder="e.g. PTT"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
            <Input
              id="dividend-date"
              label="Pay date"
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
            <Input
              id="dividend-gross"
              label="Gross amount"
              inputMode="decimal"
              placeholder="0"
              value={gross}
              onChange={(e) => setGross(e.target.value)}
            />
            <Input
              id="dividend-tax"
              label="Withholding tax"
              inputMode="decimal"
              placeholder="0"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dividend-currency" className={labelClass}>
              Currency
            </label>
            <select
              id="dividend-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className={selectClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Thai stocks usually withhold 10%; US stocks 15–30% depending on your broker's tax
            form.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Add dividend'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function DividendRow({ dividend, onDelete }: { dividend: Dividend; onDelete: () => void }) {
  return (
    <tr className="border-t border-[var(--color-line)]">
      <th scope="row" className="py-3 pr-2 text-left font-normal">
        <span className="block text-sm font-semibold text-[var(--color-ink)]">
          {dividend.symbol}
          {dividend.currency !== 'THB' && (
            <span className="ml-1.5 rounded-full bg-[var(--color-canvas)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
              {dividend.currency}
            </span>
          )}
        </span>
        <span className="text-xs text-[var(--color-muted)]">{formatDate(dividend.payDate)}</span>
      </th>
      <td className="tnum px-2 text-right text-xs text-[var(--color-muted)]">
        {native(dividend.gross, dividend.currency)}
      </td>
      <td className="tnum px-2 text-right text-xs text-[var(--color-loss)]">
        {dividend.withholdingTax > 0 ? `−${native(dividend.withholdingTax, dividend.currency)}` : '—'}
      </td>
      <td className="tnum pl-2 text-right text-sm font-semibold text-[var(--color-gain)]">
        {native(dividend.net, dividend.currency)}
      </td>
      <td className="w-10 pl-1 text-right">
        <DeleteButton label={`Delete ${dividend.symbol} dividend`} onClick={onDelete} className="ml-auto" />
      </td>
    </tr>
  )
}

function DividendsTab({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const thisYear = new Date().getFullYear()
  const [allYears, setAllYears] = useState(false)
  const [data, setData] = useState<DividendList | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listDividends(allYears ? undefined : thisYear)
      .then((list) => {
        if (!active) return
        setData(list)
        setError(null)
      })
      .catch(
        (err) =>
          active && setError(err instanceof ApiError ? err.message : 'Could not load dividends.'),
      )
    return () => {
      active = false
    }
  }, [allYears, thisYear, reloadKey])

  const undoable = useUndoableDelete()

  function handleDelete(dividend: Dividend) {
    const index = (data?.items ?? []).findIndex((d) => d.id === dividend.id)
    const setItems = (fn: (items: Dividend[]) => Dividend[]) =>
      setData((list) => (list ? { ...list, items: fn(list.items) } : list))
    undoable.remove({
      message: `Deleted ${dividend.symbol} dividend`,
      hide: () => setItems((items) => items.filter((d) => d.id !== dividend.id)),
      restore: () => setItems((items) => reinsert(items, dividend, index)),
      commit: () => deleteDividend(dividend.id),
      // Totals come from the server.
      onCommitted: onChanged,
    })
  }

  return (
    <>
      {undoable.toast}
      <div className="flex gap-2" role="group" aria-label="Dividend period">
        {[
          { all: false, label: String(thisYear) },
          { all: true, label: 'All years' },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={allYears === option.all}
            onClick={() => {
              if (allYears === option.all) return
              setData(null)
              setAllYears(option.all)
            }}
            className={
              'flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ' +
              (allYears === option.all
                ? 'bg-brand-600 text-white'
                : 'border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]')
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && <Message>{error}</Message>}

      {!error && data === null && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">Loading…</p>
          </CardBody>
        </Card>
      )}

      {data !== null && (
        <>
          <Card>
            <CardBody className="grid grid-cols-3 gap-3">
              {[
                { label: 'Gross', value: formatTHB(data.totalGrossTHB), tone: 'text-[var(--color-ink)]' },
                { label: 'Tax withheld', value: formatTHB(data.totalTaxTHB), tone: 'text-[var(--color-loss)]' },
                { label: 'Net received', value: formatTHB(data.totalNetTHB), tone: 'text-[var(--color-gain)]' },
              ].map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                    {stat.label}
                  </p>
                  <p className={`tnum mt-0.5 truncate text-base font-bold ${stat.tone}`}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </CardBody>
          </Card>
          <FxNote fx={data.fx} unconverted={data.unconvertedCount} />

          {data.items.length === 0 ? (
            <Card>
              <CardBody>
                <p className="text-sm text-[var(--color-muted)]">
                  No dividends recorded {allYears ? 'yet' : `in ${thisYear}`}.
                </p>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="overflow-x-auto py-1">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                      <th scope="col" className="py-2 pr-2 text-left font-semibold">
                        Dividend
                      </th>
                      <th scope="col" className="px-2 text-right font-semibold">
                        Gross
                      </th>
                      <th scope="col" className="px-2 text-right font-semibold">
                        Tax
                      </th>
                      <th scope="col" className="pl-2 text-right font-semibold">
                        Net
                      </th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((d) => (
                      <DividendRow key={d.id} dividend={d} onDelete={() => handleDelete(d)} />
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </>
  )
}

type Tab = 'holdings' | 'dividends'

export function Portfolio() {
  const [tab, setTab] = useState<Tab>('holdings')
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<'closed' | 'new' | Holding>('closed')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    getPortfolio()
      .then((data) => {
        if (!active) return
        setPortfolio(data)
        setError(null)
      })
      .catch(
        (err) =>
          active &&
          setError(err instanceof ApiError ? err.message : 'Could not load your portfolio.'),
      )
    return () => {
      active = false
    }
  }, [reloadKey])

  // Totals are computed by the server, so refetch after any change.
  function handleChanged() {
    setForm('closed')
    setReloadKey((k) => k + 1)
  }

  const undoable = useUndoableDelete()

  function handleDeleteHolding(holding: Holding) {
    setForm('closed')
    const index = (portfolio?.holdings ?? []).findIndex((h) => h.id === holding.id)
    const setHoldings = (fn: (rows: Holding[]) => Holding[]) =>
      setPortfolio((p) => (p ? { ...p, holdings: fn(p.holdings) } : p))
    undoable.remove({
      message: `Deleted ${holding.symbol}`,
      hide: () => setHoldings((rows) => rows.filter((h) => h.id !== holding.id)),
      restore: () => setHoldings((rows) => reinsert(rows, holding, index)),
      commit: () => deleteHolding(holding.id),
      onCommitted: () => setReloadKey((k) => k + 1),
    })
  }

  function switchTab(next: Tab) {
    setForm('closed')
    setTab(next)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Portfolio"
        action={
          <Button size="sm" onClick={() => setForm(form === 'new' ? 'closed' : 'new')}>
            <Plus size={16} aria-hidden />
            Add
          </Button>
        }
      />

      {error && <Message>{error}</Message>}

      {!error && portfolio === null && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">Loading…</p>
          </CardBody>
        </Card>
      )}

      {portfolio !== null && (
        <section
          aria-label="Total value"
          className="rounded-2xl bg-brand-600 p-5 text-white shadow-[var(--shadow-card)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-100">
            Total value
          </p>
          <p className="tnum mt-1 text-[34px] font-bold leading-tight">
            {formatTHB(portfolio.totalValueTHB)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="tnum rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
              {portfolio.totalGainTHB >= 0 ? '▲' : '▼'} {formatSignedTHB(portfolio.totalGainTHB)}
              {portfolio.totalGainPct !== null && ` (${formatPercent(portfolio.totalGainPct)})`}
            </span>
            <span className="text-xs text-brand-100">vs cost</span>
          </div>
        </section>
      )}

      <div className="flex gap-2" role="tablist" aria-label="Portfolio sections">
        {(['holdings', 'dividends'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => switchTab(value)}
            className={
              'flex-1 rounded-xl py-2 text-sm font-semibold capitalize transition-colors ' +
              (tab === value
                ? 'bg-[var(--color-ink)] text-[var(--color-surface)]'
                : 'border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]')
            }
          >
            {value}
          </button>
        ))}
      </div>

      {form !== 'closed' && tab === 'holdings' && (
        <Sheet label={form === 'new' ? 'New holding' : 'Edit holding'} onClose={() => setForm('closed')}>
          <HoldingForm
            key={form === 'new' ? 'new' : form.id}
            initial={form === 'new' ? undefined : form}
            onDone={handleChanged}
            onDelete={() => form !== 'new' && handleDeleteHolding(form)}
            onClose={() => setForm('closed')}
          />
        </Sheet>
      )}
      {form === 'new' && tab === 'dividends' && (
        <Sheet label="New dividend" onClose={() => setForm('closed')}>
          <DividendForm onDone={handleChanged} onClose={() => setForm('closed')} />
        </Sheet>
      )}
      {undoable.toast}

      {tab === 'holdings' && portfolio !== null && (
        <>
          <FxNote fx={portfolio.fx} unconverted={portfolio.unconvertedCount} />
          <HoldingsTab portfolio={portfolio} onEdit={(h) => setForm(h)} />
        </>
      )}
      {tab === 'dividends' && <DividendsTab reloadKey={reloadKey} onChanged={handleChanged} />}
    </div>
  )
}
