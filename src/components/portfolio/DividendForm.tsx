import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Input } from '@/components/ui/Input'
import { ApiError } from '@/lib/api'
import type { Account } from '@/lib/accounts'
import { t } from '@/lib/i18n'
import {
  createDividend,
  updateDividend,
  usualWithholdingPct,
  type Dividend,
  type Holding,
} from '@/lib/portfolio'
import type { Currency } from '@/types'
import { AccountField, Message } from './shared'
import {
  CURRENCIES,
  labelClass,
  native,
  selectClass,
  startingAccount,
  type FormError,
} from './format'

/** Record a dividend, or edit one (`initial`). */
export function DividendForm({
  initial,
  accounts,
  accountsFailed,
  holdings,
  defaultAccountId,
  defaultSymbol,
  onDone,
  onDelete,
  onClose,
}: {
  /** The dividend being edited; omitted for a new one. */
  initial?: Dividend
  accounts: Account[] | null
  accountsFailed: boolean
  /** Used to prefill the account from a holding with the same symbol. */
  holdings: Holding[]
  defaultAccountId?: string
  /** Symbol a new dividend starts with (e.g. from the holding's page). */
  defaultSymbol?: string
  onDone: () => void
  /** Shown as a delete button when editing. */
  onDelete?: () => void
  onClose: () => void
}) {
  const [symbol, setSymbol] = useState(initial?.symbol ?? defaultSymbol ?? '')
  // Until the user picks one, the account follows the symbol (the account of a
  // holding with that symbol), else the page filter or the only account. An
  // edit keeps the dividend's own account and never assigns one silently.
  const [pickedAccount, setPickedAccount] = useState<string | null>(null)
  const matches = holdings.filter((h) => h.symbol === symbol.trim().toUpperCase())
  const heldIn = matches.find(
    (h) => h.accountId && accounts?.some((a) => a.id === h.accountId),
  )?.accountId
  const accountId =
    pickedAccount ??
    (initial
      ? startingAccount(accounts, initial.accountId, false)
      : (heldIn ?? startingAccount(accounts, defaultAccountId)))
  // The holding it was paid on, preferring the one in the chosen account.
  const held = matches.find((h) => h.accountId === accountId) ?? matches[0]
  const [payDate, setPayDate] = useState(() => initial?.payDate ?? new Date().toLocaleDateString('en-CA'))
  // Like the account, the currency follows the holding until the user picks one.
  const [pickedCurrency, setPickedCurrency] = useState<Currency | null>(initial?.currency ?? null)
  const currency = pickedCurrency ?? held?.currency ?? 'THB'
  const [gross, setGross] = useState(initial ? String(initial.gross) : '')
  const [tax, setTax] = useState(initial && initial.withholdingTax > 0 ? String(initial.withholdingTax) : '')
  const [error, setError] = useState<FormError>(null)
  const fieldError = (field: string) => (error?.field === field ? error.message : undefined)
  const fail = (field: string, message: string) => setError({ field, message })
  const [saving, setSaving] = useState(false)
  // Symbols the user holds, for the symbol field's suggestions.
  const symbols = useMemo(() => [...new Set(holdings.map((h) => h.symbol))].sort(), [holdings])
  // One tap fills the usual withholding (10% Thai, 15% US) while tax is empty.
  const usualPct = usualWithholdingPct(held?.assetClass)
  const grossNumber = Number(gross)
  const suggestedTax =
    usualPct !== null && tax.trim() === '' && gross.trim() !== '' && Number.isFinite(grossNumber) && grossNumber > 0
      ? Math.round(grossNumber * usualPct) / 100
      : null

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const grossValue = Number(gross)
    const taxValue = tax.trim() === '' ? 0 : Number(tax)
    // Edits still save when accounts can't be loaded; the account is then left as it is.
    if (!accountId && !(initial && accounts === null)) {
      return fail('account', t('Choose the account it was paid into.'))
    }
    if (!symbol.trim()) return fail('symbol', t('Enter a symbol.'))
    if (!payDate) return fail('payDate', t('Pick the pay date.'))
    if (!Number.isFinite(grossValue) || grossValue <= 0) {
      return fail('gross', t('Enter a gross amount greater than 0.'))
    }
    if (!Number.isFinite(taxValue) || taxValue < 0 || taxValue > grossValue) {
      return fail('tax', t('Withholding tax must be between 0 and the gross amount.'))
    }
    setError(null)
    setSaving(true)
    const input = {
      symbol: symbol.trim().toUpperCase(),
      payDate,
      currency,
      gross: grossValue,
      withholdingTax: taxValue,
      ...(accountId && { accountId }),
    }
    try {
      if (initial) await updateDividend(initial.id, input)
      else await createDividend(input)
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
            {initial ? t('Edit {name} dividend', { name: initial.symbol }) : t('New dividend')}
          </p>
          {error && !error.field && <Message>{error.message}</Message>}
          <AccountField
            id="dividend-account"
            accounts={accounts}
            failed={accountsFailed}
            value={accountId}
            onChange={setPickedAccount}
            error={fieldError('account')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="dividend-symbol"
              label={t('Symbol')}
              placeholder={t('e.g. PTT')}
              list={symbols.length > 0 ? 'dividend-symbols' : undefined}
              autoComplete="off"
              error={fieldError('symbol')}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
            {symbols.length > 0 && (
              <datalist id="dividend-symbols">
                {symbols.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
            <Input
              id="dividend-date"
              label={t('Pay date')}
              type="date"
              error={fieldError('payDate')}
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
            <Input
              id="dividend-gross"
              label={t('Gross amount')}
              inputMode="decimal"
              placeholder="0"
              error={fieldError('gross')}
              value={gross}
              onChange={(e) => setGross(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <Input
                id="dividend-tax"
                label={t('Withholding tax')}
                inputMode="decimal"
                placeholder="0"
                error={fieldError('tax')}
                value={tax}
                onChange={(e) => setTax(e.target.value)}
              />
              {suggestedTax !== null && (
                <button
                  type="button"
                  onClick={() => setTax(String(suggestedTax))}
                  className="tnum self-start rounded-full bg-brand-600/10 px-2.5 py-1 text-xs font-semibold text-brand-600"
                >
                  {t('Use {pct}% ({amount})', { pct: usualPct!, amount: native(suggestedTax, currency) })}
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dividend-currency" className={labelClass}>
              {t('Currency')}
            </label>
            <select
              id="dividend-currency"
              value={currency}
              onChange={(e) => setPickedCurrency(e.target.value as Currency)}
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
              {saving ? t('Saving…') : initial ? t('Save changes') : t('Add dividend')}
            </Button>
          </div>
          {initial && onDelete && (
            <DeleteButton variant="block" label={t('Delete dividend')} onClick={onDelete} disabled={saving} />
          )}
        </form>
      </CardBody>
    </Card>
  )
}
