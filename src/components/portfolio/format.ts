// Formatting and form helpers shared by the portfolio screens.
import type { Account } from '@/lib/accounts'
import { formatDate, formatPercent, formatSignedTHB } from '@/lib/format'
import { t } from '@/lib/i18n'
import { holdingGain, type Holding } from '@/lib/portfolio'
import type { Currency } from '@/types'

export const CURRENCIES: Currency[] = ['THB', 'USD']

export const selectClass =
  'h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500'

export const labelClass = 'text-[13px] font-medium text-[var(--color-muted)]'

/** An amount in its own currency, e.g. "฿38.25" or "$498.00". */
export function native(amount: number, currency: Currency, digits = 2): string {
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
export function convertAmount(value: string, factor: number, digits: number): string {
  const n = Number(value)
  if (value.trim() === '' || !Number.isFinite(n)) return value
  return String(Math.round(n * factor * 10 ** digits) / 10 ** digits)
}

export function gainTone(value: number | null): string {
  if (value === null || value === 0) return 'text-[var(--color-muted)]'
  return value > 0 ? 'text-[var(--color-gain)]' : 'text-[var(--color-loss)]'
}

/** A signed amount in its own currency, e.g. "+฿1,250" or "-$12.40". */
export function signedNative(amount: number, currency: Currency): string {
  if (currency === 'THB') return formatSignedTHB(amount)
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${sign}${native(Math.abs(amount), currency)}`
}

/**
 * ▲ / ▼, the gain as money and as a percentage, so gains never rely on
 * colour alone: "▲ +฿18,750 · +10.9%".
 */
export function gainText(holding: Holding): string {
  if (holding.gainPct === null) return '—'
  const { amount, currency } = holdingGain(holding)
  const pct = holding.gainPct
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : ''
  return `${arrow} ${signedNative(amount, currency)} · ${formatPercent(pct)}`.trim()
}

/** A form's validation error, shown under `field` or, without one, above the form. */
export type FormError = { field?: string; message: string } | null

/** "Settrade · KS Securities": how an account reads in selects and chips. */
export function accountLabel(a: Account): string {
  return a.institution ? `${a.name} · ${a.institution}` : a.name
}

/**
 * The account a holding or dividend goes into before the user picks one.
 * `onlyAccount` falls back to the single account when there is no preference.
 */
export function startingAccount(
  accounts: Account[] | null,
  preferred?: string | null,
  onlyAccount = true,
): string {
  if (!accounts) return ''
  if (preferred && accounts.some((a) => a.id === preferred)) return preferred
  return onlyAccount && accounts.length === 1 ? accounts[0].id : ''
}

/** "live" for a price from the last hour, otherwise when it was set. */
export function priceAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60 * 60 * 1000) return t('live')
  return t('as of {date}', { date: formatDate(iso) })
}
