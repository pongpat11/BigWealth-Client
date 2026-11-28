// Components shared by the Portfolio page, the holding detail page and their forms.
import { Link } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { FieldError } from '@/components/ui/Input'
import type { Account } from '@/lib/accounts'
import { formatDate } from '@/lib/format'
import { t } from '@/lib/i18n'
import type { Fx } from '@/lib/portfolio'
import { accountLabel, selectClass, labelClass } from './format'

export function FxNote({ fx, unconverted }: { fx: Fx; unconverted: number }) {
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

export function Message({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]">
      {children}
    </p>
  )
}

/** Required investment-account select, or a link to create one when there is none. */
export function AccountField({
  id,
  accounts,
  failed,
  value,
  onChange,
  error,
}: {
  id: string
  /** null while loading or when loading failed. */
  accounts: Account[] | null
  failed: boolean
  value: string
  onChange: (id: string) => void
  error?: string
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
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={selectClass + (error ? ' border-[var(--color-loss)]' : '')}
      >
        {value === '' && <option value="">{t('Choose an account')}</option>}
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {accountLabel(a)}
          </option>
        ))}
      </select>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}
