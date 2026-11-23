import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { listAccounts, type Account } from '@/lib/accounts'
import { formatDate, formatPercent, formatSignedTHB, formatTHB } from '@/lib/format'
import { getLanguage, t } from '@/lib/i18n'
import {
  ASSET_CLASSES,
  AUTO_PRICE_CLASSES,
  ASSET_CLASS_META,
  createDividend,
  createHolding,
  deleteDividend,
  deleteHolding,
  defaultGoldUnit,
  getPortfolio,
  GOLD_OZ_PER_BAHT,
  GOLD_UNITS,
  GOLD_UNIT_META,
  goldUnitOf,
  holdingQuantityText,
  listDividends,
  NO_ACCOUNT,
  sortHoldings,
  updateHolding,
  type HoldingSort,
  type AssetClass,
  type Dividend,
  type DividendList,
  type Fx,
  type GoldUnit,
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

/**
 * A form amount re-expressed in another gold unit (`factor` = new units per
 * old unit), so the holding keeps its value. Blank or invalid input stays.
 */
function convertAmount(value: string, factor: number, digits: number): string {
  const n = Number(value)
  if (value.trim() === '' || !Number.isFinite(n)) return value
  return String(Math.round(n * factor * 10 ** digits) / 10 ** digits)
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
          {unconverted === 1
            ? t('No USD exchange rate is available right now, so 1 USD item is left out of the baht totals.')
            : t('No USD exchange rate is available right now, so {n} USD items are left out of the baht totals.', {
                n: unconverted,
              })}
        </span>
      </p>
    )
  }
  return (
    <p className="tnum px-1 text-xs text-[var(--color-muted)]">
      {fx.date
        ? t('USD converted at ฿{rate} (reference rate, {date}).', {
            rate: fx.usdThb.toFixed(2),
            date: formatDate(fx.date),
          })
        : t('USD converted at ฿{rate} (reference rate).', { rate: fx.usdThb.toFixed(2) })}
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

/** "Settrade · KS Securities": how an account reads in selects and chips. */
function accountLabel(a: Account): string {
  return a.institution ? `${a.name} · ${a.institution}` : a.name
}

/**
 * The account a holding or dividend goes into before the user picks one.
 * `onlyAccount` falls back to the single account when there is no preference.
 */
function startingAccount(
  accounts: Account[] | null,
  preferred?: string | null,
  onlyAccount = true,
): string {
  if (!accounts) return ''
  if (preferred && accounts.some((a) => a.id === preferred)) return preferred
  return onlyAccount && accounts.length === 1 ? accounts[0].id : ''
}

/** Required investment-account select, or a link to create one when there is none. */
function AccountField({
  id,
  accounts,
  failed,
  value,
  onChange,
}: {
  id: string
  /** null while loading or when loading failed. */
  accounts: Account[] | null
  failed: boolean
  value: string
  onChange: (id: string) => void
}) {
  if (accounts === null) {
    return (
      <p className="rounded-xl bg-[var(--color-canvas)] px-3 py-2.5 text-sm text-[var(--color-muted)]">
        {failed ? t('Could not load accounts.') : t('Loading…')}
      </p>
    )
  }
  if (accounts.length === 0) {
    return (
      <p className="rounded-xl bg-[var(--color-canvas)] px-3 py-2.5 text-sm text-[var(--color-muted)]">
        {t('Holdings belong to an investment account.')}{' '}
        <Link to="/accounts" className="font-semibold text-brand-600 hover:underline">
          {t('Create an investment account first')}
        </Link>
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {t('Account')}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {value === '' && <option value="">{t('Choose an account')}</option>}
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {accountLabel(a)}
          </option>
        ))}
      </select>
    </div>
  )
}

function HoldingForm({
  initial,
  accounts,
  accountsFailed,
  defaultAccountId,
  onDone,
  onDelete,
  onClose,
}: {
  initial?: Holding
  /** The user's investment accounts; null while loading or after a failed load. */
  accounts: Account[] | null
  accountsFailed: boolean
  /** Account picked in the page filter, used for new holdings. */
  defaultAccountId?: string
  onDone: () => void
  onDelete: () => void
  onClose: () => void
}) {
  // Derived until the user picks, so it follows accounts that load later.
  // An existing holding without an account is never assigned silently.
  const [pickedAccount, setPickedAccount] = useState<string | null>(null)
  const accountId =
    pickedAccount ??
    (initial
      ? startingAccount(accounts, initial.accountId, false)
      : startingAccount(accounts, defaultAccountId))
  const [symbol, setSymbol] = useState(initial?.symbol ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [assetClass, setAssetClass] = useState<AssetClass>(initial?.assetClass ?? 'set')
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'THB')
  const initialUnit = initial ? goldUnitOf(initial) : null
  const [goldUnit, setGoldUnit] = useState<GoldUnit>(initialUnit ?? 'baht')
  // Set when an edit switched the unit and the amounts were converted.
  const [converted, setConverted] = useState(false)
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
    // Edits still save when accounts can't be loaded; the account is then left as it is.
    if (!accountId && !(initial && accounts === null)) {
      return setError(t('Choose the account that holds it.'))
    }
    if (!symbol.trim()) return setError(t('Enter a symbol.'))
    if (!Number.isFinite(qty) || qty <= 0) return setError(t('Enter a quantity greater than 0.'))
    if (avgCost.trim() === '' || !Number.isFinite(cost) || cost < 0) {
      return setError(t('Enter the average cost per unit.'))
    }
    const priceGiven = price.trim() !== ''
    if (priceGiven ? !Number.isFinite(current) || current < 0 : !followsMarket) {
      return setError(t('Enter the current price per unit.'))
    }
    setError(null)
    setSaving(true)
    const input = {
      symbol: symbol.trim().toUpperCase(),
      name: name.trim() || null,
      assetClass,
      // Only when it differs from what the server would assume (the currency's
      // default for a new holding, the current unit for an edit).
      ...(assetClass === 'gold' &&
        goldUnit !== (initialUnit ?? defaultGoldUnit(currency)) && { goldUnit }),
      currency,
      quantity: qty,
      avgCost: cost,
      ...(priceGiven && { price: current }),
      autoPrice: followsMarket,
      ...(accountId && { accountId }),
    }
    try {
      if (initial) await updateHolding(initial.id, input)
      else await createHolding(input)
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Could not save. Try again.'))
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {initial ? t('Edit {name}', { name: initial.symbol }) : t('New holding')}
          </p>
          {error && <Message>{error}</Message>}
          <AccountField
            id="holding-account"
            accounts={accounts}
            failed={accountsFailed}
            value={accountId}
            onChange={setPickedAccount}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="holding-symbol"
              label={t('Symbol')}
              placeholder={t('e.g. PTT')}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
            <Input
              id="holding-name"
              label={t('Name (optional)')}
              placeholder={t('e.g. PTT PCL')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="holding-class" className={labelClass}>
                {t('Asset class')}
              </label>
              <select
                id="holding-class"
                value={assetClass}
                onChange={(e) => {
                  const next = e.target.value as AssetClass
                  setAssetClass(next)
                  // US stocks, crypto and ounce gold are quoted in dollars.
                  if (!initial) {
                    const usd = next === 'us' || next === 'crypto' || (next === 'gold' && goldUnit === 'oz')
                    setCurrency(usd ? 'USD' : 'THB')
                  }
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
                {t('Currency')}
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
          {assetClass === 'gold' && (
            <div className="flex flex-col gap-1.5">
              <span id="holding-unit-label" className={labelClass}>
                {t('Gold unit')}
              </span>
              <div className="flex gap-2" role="group" aria-labelledby="holding-unit-label">
                {GOLD_UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={goldUnit === u}
                    onClick={() => {
                      if (goldUnit === u) return
                      setGoldUnit(u)
                      if (initial && initial.assetClass === 'gold') {
                        // Same gold, other unit: convert the amounts so the value holds.
                        const perOld = u === 'oz' ? GOLD_OZ_PER_BAHT : 1 / GOLD_OZ_PER_BAHT
                        setQuantity((q) => convertAmount(q, perOld, 8))
                        setAvgCost((c) => convertAmount(c, 1 / perOld, 2))
                        setPrice((p) => convertAmount(p, 1 / perOld, 2))
                        setConverted(u !== initialUnit)
                      }
                      // Ounces are usually held in dollars, baht-weight in baht.
                      if (!initial) setCurrency(u === 'oz' ? 'USD' : 'THB')
                    }}
                    className={
                      'flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ' +
                      (goldUnit === u
                        ? 'bg-brand-600 text-white'
                        : 'border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]')
                    }
                  >
                    {GOLD_UNIT_META[u].label}
                  </button>
                ))}
              </div>
              {converted && (
                <p role="status" className="text-xs text-[var(--color-muted)]">
                  {t('Quantity and prices converted to {unit}. Check them before saving.', {
                    unit: GOLD_UNIT_META[goldUnit].label,
                  })}
                </p>
              )}
            </div>
          )}
          <Input
            id="holding-quantity"
            label={
              assetClass !== 'gold'
                ? t('Quantity')
                : goldUnit === 'oz'
                  ? t('Quantity (troy oz)')
                  : t('Quantity (baht-weight)')
            }
            inputMode="decimal"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="holding-cost"
              label={t('Average cost / unit')}
              inputMode="decimal"
              placeholder="0"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
            />
            <Input
              id="holding-price"
              label={followsMarket ? t('Price / unit (optional)') : t('Current price / unit')}
              inputMode="decimal"
              placeholder={followsMarket ? t('Looked up') : '0'}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          {canAutoPrice ? (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-canvas)] px-3 py-2.5">
              <span className="text-sm text-[var(--color-ink)]">
                {t('Update price automatically')}
                <span className="block text-xs text-[var(--color-muted)]">
                  {assetClass !== 'gold'
                    ? t('From the market each time you open Portfolio (delayed up to 15 min).')
                    : goldUnit === 'oz'
                      ? t('World gold price per troy ounce (gold futures, delayed up to 15 min).')
                      : t('Estimated per baht-weight of 96.5% gold from the world price; the shop price is a little higher. Enter the quantity in baht-weight, not grams.')}
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
              {t("Prices for {assetClass} aren't fetched automatically. Update the current price here when you want a fresh valuation.", {
                assetClass: getLanguage() === 'th' ? ASSET_CLASS_META[assetClass].label : ASSET_CLASS_META[assetClass].label.toLowerCase(),
              })}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? t('Saving…') : initial ? t('Save changes') : t('Add holding')}
            </Button>
          </div>
          {initial && (
            <DeleteButton
              variant="block"
              label={t('Delete holding')}
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
  if (ms < 60 * 60 * 1000) return t('live')
  return t('as of {date}', { date: formatDate(iso) })
}

function HoldingRow({
  holding,
  account,
  onEdit,
}: {
  holding: Holding
  /**
   * Account name to show; null flags a holding with no account; undefined or
   * '' (name not loaded) shows nothing.
   */
  account?: string | null
  onEdit: (h: Holding) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onEdit(holding)}
      aria-label={t('Edit holding {name}', { name: holding.symbol })}
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
          {holdingQuantityText(holding)} · {native(holding.price, holding.currency)}
          {holding.autoPrice && ` · ${priceAge(holding.priceUpdatedAt)}`}
        </p>
        {account ? (
          <span className="mt-1 inline-block max-w-full truncate rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)]">
            {account}
          </span>
        ) : (
          account === null && (
            <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">
              {t('No account')}
            </span>
          )
        )}
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

/**
 * Holdings grouped for the list: one section per asset class, except gold,
 * which gets a section per unit (baht-weight and troy ounces don't add up).
 */
function holdingGroups(holdings: Holding[]) {
  const groups: { key: string; title: string; total?: string; rows: Holding[] }[] = []
  for (const assetClass of ASSET_CLASSES) {
    const rows = holdings.filter((h) => h.assetClass === assetClass)
    if (rows.length === 0) continue
    if (assetClass !== 'gold') {
      groups.push({ key: assetClass, title: ASSET_CLASS_META[assetClass].label, rows })
      continue
    }
    for (const unit of GOLD_UNITS) {
      const unitRows = rows.filter((h) => goldUnitOf(h) === unit)
      if (unitRows.length === 0) continue
      const quantity = unitRows.reduce((sum, h) => sum + h.quantity, 0)
      groups.push({
        key: `gold-${unit}`,
        title: `${ASSET_CLASS_META.gold.label} · ${GOLD_UNIT_META[unit].label}`,
        total: t('{qty} total', {
          qty: holdingQuantityText({ assetClass: 'gold', goldUnit: unit, currency: 'THB', quantity }),
        }),
        rows: unitRows,
      })
    }
  }
  return groups
}

function HoldingsTab({
  portfolio,
  accountNames,
  sortBy,
  onSortChange,
  onEdit,
}: {
  portfolio: PortfolioData
  /** Account id -> name for row chips; undefined hides them. */
  accountNames?: Map<string, string>
  sortBy: HoldingSort
  onSortChange: (s: HoldingSort) => void
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
            {t('No holdings yet. Add a stock, fund, crypto or gold position to see your portfolio.')}
          </p>
        </CardBody>
      </Card>
    )
  }

  return (
    <>
      {portfolio.allocation.length > 0 && (
        <Card>
          <CardHeader title={t('Allocation')} />
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

      {portfolio.holdings.length > 1 && (
        <div className="flex items-center justify-end gap-1" role="group" aria-label={t('Sort holdings')}>
          <span className="mr-1 text-xs text-[var(--color-muted)]">{t('Sort')}</span>
          {(
            [
              ['value', t('Value')],
              ['gain', t('Gain')],
              ['symbol', t('A–Z')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={sortBy === value}
              onClick={() => onSortChange(value)}
              className={
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors ' +
                (sortBy === value
                  ? 'bg-brand-600 text-white'
                  : 'bg-[var(--color-canvas)] text-[var(--color-muted)]')
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {holdingGroups(portfolio.holdings).map(({ key, title, total, rows: groupRows }) => {
        const rows = sortHoldings(groupRows, sortBy)
        return (
          <section key={key} aria-label={title} className="space-y-1.5">
            <h2 className="flex items-baseline justify-between gap-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              <span>{title}</span>
              {total && <span className="tnum normal-case tracking-normal">{total}</span>}
            </h2>
            <Card>
              <CardBody className="divide-y divide-[var(--color-line)] py-0">
                {rows.map((h) => (
                  <HoldingRow
                    key={h.id}
                    holding={h}
                    account={accountNames && (h.accountId ? (accountNames.get(h.accountId) ?? '') : null)}
                    onEdit={onEdit}
                  />
                ))}
              </CardBody>
            </Card>
          </section>
        )
      })}
    </>
  )
}

function DividendForm({
  accounts,
  accountsFailed,
  holdings,
  defaultAccountId,
  onDone,
  onClose,
}: {
  accounts: Account[] | null
  accountsFailed: boolean
  /** Used to prefill the account from a holding with the same symbol. */
  holdings: Holding[]
  defaultAccountId?: string
  onDone: () => void
  onClose: () => void
}) {
  const [symbol, setSymbol] = useState('')
  // Until the user picks one, the account follows the symbol (the account of a
  // holding with that symbol), else the page filter or the only account.
  const [pickedAccount, setPickedAccount] = useState<string | null>(null)
  const heldIn = holdings.find(
    (h) =>
      h.symbol === symbol.trim().toUpperCase() &&
      h.accountId &&
      accounts?.some((a) => a.id === h.accountId),
  )?.accountId
  const accountId = pickedAccount ?? heldIn ?? startingAccount(accounts, defaultAccountId)
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
    if (!accountId) return setError(t('Choose the account it was paid into.'))
    if (!symbol.trim()) return setError(t('Enter a symbol.'))
    if (!payDate) return setError(t('Pick the pay date.'))
    if (!Number.isFinite(grossValue) || grossValue <= 0) {
      return setError(t('Enter a gross amount greater than 0.'))
    }
    if (!Number.isFinite(taxValue) || taxValue < 0 || taxValue > grossValue) {
      return setError(t('Withholding tax must be between 0 and the gross amount.'))
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
        accountId,
      })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Could not save. Try again.'))
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-[var(--color-ink)]">{t('New dividend')}</p>
          {error && <Message>{error}</Message>}
          <AccountField
            id="dividend-account"
            accounts={accounts}
            failed={accountsFailed}
            value={accountId}
            onChange={setPickedAccount}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="dividend-symbol"
              label={t('Symbol')}
              placeholder={t('e.g. PTT')}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
            <Input
              id="dividend-date"
              label={t('Pay date')}
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
            <Input
              id="dividend-gross"
              label={t('Gross amount')}
              inputMode="decimal"
              placeholder="0"
              value={gross}
              onChange={(e) => setGross(e.target.value)}
            />
            <Input
              id="dividend-tax"
              label={t('Withholding tax')}
              inputMode="decimal"
              placeholder="0"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dividend-currency" className={labelClass}>
              {t('Currency')}
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
            {t("Thai stocks usually withhold 10%; US stocks 15–30% depending on your broker's tax form.")}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? t('Saving…') : t('Add dividend')}
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
        <DeleteButton label={t('Delete {name} dividend', { name: dividend.symbol })} onClick={onDelete} className="ml-auto" />
      </td>
    </tr>
  )
}

function DividendsTab({
  accountId,
  reloadKey,
  onChanged,
}: {
  accountId?: string
  reloadKey: number
  onChanged: () => void
}) {
  const thisYear = new Date().getFullYear()
  const [allYears, setAllYears] = useState(false)
  const [data, setData] = useState<DividendList | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listDividends(allYears ? undefined : thisYear, accountId)
      .then((list) => {
        if (!active) return
        setData(list)
        setError(null)
      })
      .catch(
        (err) =>
          active && setError(err instanceof ApiError ? err.message : t('Could not load dividends.')),
      )
    return () => {
      active = false
    }
  }, [allYears, thisYear, accountId, reloadKey])

  const undoable = useUndoableDelete()

  function handleDelete(dividend: Dividend) {
    const index = (data?.items ?? []).findIndex((d) => d.id === dividend.id)
    const setItems = (fn: (items: Dividend[]) => Dividend[]) =>
      setData((list) => (list ? { ...list, items: fn(list.items) } : list))
    undoable.remove({
      message: t('Deleted {name} dividend', { name: dividend.symbol }),
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
      <div className="flex gap-2" role="group" aria-label={t('Dividend period')}>
        {[
          { all: false, label: String(thisYear) },
          { all: true, label: t('All years') },
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
            <p className="text-sm text-[var(--color-muted)]">{t('Loading…')}</p>
          </CardBody>
        </Card>
      )}

      {data !== null && (
        <>
          <Card>
            <CardBody className="grid grid-cols-3 gap-3">
              {[
                { label: t('Gross'), value: formatTHB(data.totalGrossTHB), tone: 'text-[var(--color-ink)]' },
                { label: t('Tax withheld'), value: formatTHB(data.totalTaxTHB), tone: 'text-[var(--color-loss)]' },
                { label: t('Net received'), value: formatTHB(data.totalNetTHB), tone: 'text-[var(--color-gain)]' },
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
                  {allYears
                    ? t('No dividends recorded yet.')
                    : t('No dividends recorded in {year}.', { year: thisYear })}
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
                        {t('Dividend')}
                      </th>
                      <th scope="col" className="px-2 text-right font-semibold">
                        {t('Gross')}
                      </th>
                      <th scope="col" className="px-2 text-right font-semibold">
                        {t('Tax')}
                      </th>
                      <th scope="col" className="pl-2 text-right font-semibold">
                        {t('Net')}
                      </th>
                      <th scope="col">
                        <span className="sr-only">{t('Actions')}</span>
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
const TABS: { value: Tab; label: string }[] = [
  { value: 'holdings', label: t('Holdings') },
  { value: 'dividends', label: t('Dividends') },
]

export function Portfolio() {
  const [tab, setTab] = useState<Tab>('holdings')
  // Lives here so the choice survives switching to Dividends and back.
  const [sortBy, setSortBy] = useState<HoldingSort>('value')
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<'closed' | 'new' | Holding>('closed')
  const [reloadKey, setReloadKey] = useState(0)
  // `?account=<id>` (or `none`) narrows the page to one account.
  const [params, setParams] = useSearchParams()
  const accountFilter = params.get('account') ?? ''
  // Investment accounts; null until loaded (or when loading failed).
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [accountsFailed, setAccountsFailed] = useState(false)
  // Whether some holdings have no account yet.
  const [hasUnassigned, setHasUnassigned] = useState(false)

  useEffect(() => {
    let active = true
    listAccounts()
      .then((rows) => {
        if (!active) return
        setAccounts(rows.filter((a) => a.type === 'investment'))
        setAccountsFailed(false)
      })
      .catch(() => active && setAccountsFailed(true))
    return () => {
      active = false
    }
  }, [reloadKey])

  useEffect(() => {
    let active = true
    getPortfolio(accountFilter || undefined)
      .then((data) => {
        if (!active) return
        setPortfolio(data)
        if (!accountFilter || accountFilter === NO_ACCOUNT) {
          setHasUnassigned(data.holdings.some((h) => !h.accountId))
        }
        setError(null)
      })
      .catch(
        (err) =>
          active &&
          setError(err instanceof ApiError ? err.message : t('Could not load your portfolio.')),
      )
    return () => {
      active = false
    }
  }, [reloadKey, accountFilter])

  // Filtered to one account, the main load can't tell whether others have no
  // account, so ask for the unassigned ones on their own.
  useEffect(() => {
    if (!accountFilter || accountFilter === NO_ACCOUNT) return
    let active = true
    getPortfolio(NO_ACCOUNT)
      .then((data) => active && setHasUnassigned(data.holdings.length > 0))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [reloadKey, accountFilter])

  const accountNames = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.id, accountLabel(a)])),
    [accounts],
  )
  const filteredAccount = accountFilter && accountFilter !== NO_ACCOUNT ? accountFilter : undefined
  // A filter for an account that no longer exists (e.g. an old bookmark).
  const unknownFilter =
    filteredAccount !== undefined && accounts !== null && !accounts.some((a) => a.id === filteredAccount)

  function changeFilter(next: string) {
    setForm('closed')
    setPortfolio(null)
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next) p.set('account', next)
        else p.delete('account')
        return p
      },
      { replace: true },
    )
  }

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
      message: t('Deleted {name}', { name: holding.symbol }),
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
        title={t('Portfolio')}
        action={
          <Button size="sm" onClick={() => setForm(form === 'new' ? 'closed' : 'new')}>
            <Plus size={16} aria-hidden />
            {t('Add')}
          </Button>
        }
      />

      {accountsFailed && accounts === null && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]"
        >
          {t('Could not load accounts.')}
          <Button size="sm" variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
            {t('Try again')}
          </Button>
        </div>
      )}

      {((accounts?.length ?? 0) > 0 || hasUnassigned || accountFilter) && (
        <div>
          <label htmlFor="portfolio-account" className="sr-only">
            {t('Filter by account')}
          </label>
          <select
            id="portfolio-account"
            value={accountFilter}
            onChange={(e) => changeFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">{t('All accounts')}</option>
            {/* Keeps the select honest while accounts load or for a deleted account. */}
            {filteredAccount !== undefined && (accounts === null || unknownFilter) && (
              <option value={filteredAccount}>
                {unknownFilter ? t('Deleted account') : t('Loading…')}
              </option>
            )}
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {accountLabel(a)}
              </option>
            ))}
            {(hasUnassigned || accountFilter === NO_ACCOUNT) && (
              <option value={NO_ACCOUNT}>{t('No account')}</option>
            )}
          </select>
        </div>
      )}

      {error && <Message>{error}</Message>}

      {!error && portfolio === null && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">{t('Loading…')}</p>
          </CardBody>
        </Card>
      )}

      {portfolio !== null && (
        <section
          aria-label={t('Total value')}
          className="rounded-2xl bg-brand-600 p-5 text-white shadow-[var(--shadow-card)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-100">
            {t('Total value')}
          </p>
          <p className="tnum mt-1 text-[34px] font-bold leading-tight">
            {formatTHB(portfolio.totalValueTHB)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="tnum rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
              {portfolio.totalGainTHB >= 0 ? '▲' : '▼'} {formatSignedTHB(portfolio.totalGainTHB)}
              {portfolio.totalGainPct !== null && ` (${formatPercent(portfolio.totalGainPct)})`}
            </span>
            <span className="text-xs text-brand-100">{t('vs cost')}</span>
          </div>
        </section>
      )}

      <div className="flex gap-2" role="tablist" aria-label={t('Portfolio sections')}>
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => switchTab(value)}
            className={
              'flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ' +
              (tab === value
                ? 'bg-[var(--color-ink)] text-[var(--color-surface)]'
                : 'border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {form !== 'closed' && tab === 'holdings' && (
        <Sheet label={form === 'new' ? t('New holding') : t('Edit holding')} onClose={() => setForm('closed')}>
          <HoldingForm
            key={form === 'new' ? 'new' : form.id}
            initial={form === 'new' ? undefined : form}
            accounts={accounts}
            accountsFailed={accountsFailed}
            defaultAccountId={filteredAccount}
            onDone={handleChanged}
            onDelete={() => form !== 'new' && handleDeleteHolding(form)}
            onClose={() => setForm('closed')}
          />
        </Sheet>
      )}
      {form === 'new' && tab === 'dividends' && (
        <Sheet label={t('New dividend')} onClose={() => setForm('closed')}>
          <DividendForm
            accounts={accounts}
            accountsFailed={accountsFailed}
            holdings={portfolio?.holdings ?? []}
            defaultAccountId={filteredAccount}
            onDone={handleChanged}
            onClose={() => setForm('closed')}
          />
        </Sheet>
      )}
      {undoable.toast}

      {tab === 'holdings' && portfolio !== null && (
        <>
          <FxNote fx={portfolio.fx} unconverted={portfolio.unconvertedCount} />
          <HoldingsTab
            portfolio={portfolio}
            accountNames={accountFilter ? undefined : accountNames}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onEdit={(h) => setForm(h)}
          />
        </>
      )}
      {tab === 'dividends' && (
        <DividendsTab
          accountId={accountFilter || undefined}
          reloadKey={reloadKey}
          onChanged={handleChanged}
        />
      )}
    </div>
  )
}
