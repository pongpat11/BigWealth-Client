import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Input } from '@/components/ui/Input'
import { ApiError } from '@/lib/api'
import type { Account } from '@/lib/accounts'
import { getLanguage, t } from '@/lib/i18n'
import {
  ASSET_CLASSES,
  ASSET_CLASS_META,
  AUTO_PRICE_CLASSES,
  createHolding,
  defaultGoldUnit,
  GOLD_OZ_PER_BAHT,
  GOLD_UNITS,
  GOLD_UNIT_META,
  goldUnitOf,
  updateHolding,
  type AssetClass,
  type GoldUnit,
  type Holding,
} from '@/lib/portfolio'
import type { Currency } from '@/types'
import { AccountField, Message } from './shared'
import {
  convertAmount,
  CURRENCIES,
  labelClass,
  selectClass,
  startingAccount,
  type FormError,
} from './format'

/** Add or edit a holding. */
export function HoldingForm({
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
  /** Shown as a delete button when editing. */
  onDelete?: () => void
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
  const [error, setError] = useState<FormError>(null)
  const fieldError = (field: string) => (error?.field === field ? error.message : undefined)
  const fail = (field: string, message: string) => setError({ field, message })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const qty = Number(quantity)
    const cost = Number(avgCost)
    const current = Number(price)
    // Edits still save when accounts can't be loaded; the account is then left as it is.
    if (!accountId && !(initial && accounts === null)) {
      return fail('account', t('Choose the account that holds it.'))
    }
    if (!symbol.trim()) return fail('symbol', t('Enter a symbol.'))
    if (!Number.isFinite(qty) || qty <= 0) return fail('quantity', t('Enter a quantity greater than 0.'))
    if (avgCost.trim() === '' || !Number.isFinite(cost) || cost < 0) {
      return fail('avgCost', t('Enter the average cost per unit.'))
    }
    const priceGiven = price.trim() !== ''
    if (priceGiven ? !Number.isFinite(current) || current < 0 : !followsMarket) {
      return fail('price', t('Enter the current price per unit.'))
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
      setError({ message: err instanceof ApiError ? err.message : t('Could not save. Try again.') })
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
          {error && !error.field && <Message>{error.message}</Message>}
          <AccountField
            id="holding-account"
            accounts={accounts}
            failed={accountsFailed}
            value={accountId}
            onChange={setPickedAccount}
            error={fieldError('account')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="holding-symbol"
              label={t('Symbol')}
              placeholder={t('e.g. PTT')}
              error={fieldError('symbol')}
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
            error={fieldError('quantity')}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="holding-cost"
              label={t('Average cost / unit')}
              inputMode="decimal"
              placeholder="0"
              error={fieldError('avgCost')}
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
            />
            <Input
              id="holding-price"
              label={followsMarket ? t('Price / unit (optional)') : t('Current price / unit')}
              inputMode="decimal"
              placeholder={followsMarket ? t('Looked up') : '0'}
              error={fieldError('price')}
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
          {initial && onDelete && (
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
