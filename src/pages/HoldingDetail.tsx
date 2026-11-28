import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { DividendForm } from '@/components/portfolio/DividendForm'
import { DividendTable } from '@/components/portfolio/DividendTable'
import { HoldingForm } from '@/components/portfolio/HoldingForm'
import { FxNote } from '@/components/portfolio/shared'
import { accountLabel, gainText, gainTone, native, priceAge, signedNative } from '@/components/portfolio/format'
import { ApiError } from '@/lib/api'
import { listAccounts, type Account } from '@/lib/accounts'
import { formatPercent, formatSignedTHB, formatTHB } from '@/lib/format'
import { t } from '@/lib/i18n'
import {
  ASSET_CLASS_META,
  deleteDividend,
  getHolding,
  holdingQuantityText,
  type Dividend,
  type HoldingDetail as HoldingDetailData,
} from '@/lib/portfolio'
import { reinsert, useUndoableDelete } from '@/lib/useUndoableDelete'
import type { PortfolioLocationState } from './Portfolio'

/** Where "back" goes: the Portfolio list the user came from (with its filter), else the plain list. */
function useBackTo(): string {
  const state = useLocation().state as { from?: string } | null
  return state?.from?.startsWith('/portfolio') ? state.from : '/portfolio'
}

export function HoldingDetail() {
  const { id = '' } = useParams()
  // A new id means a new page: remount so nothing from the last holding lingers.
  return <HoldingDetailView key={id} id={id} />
}

function HoldingDetailView({ id }: { id: string }) {
  const navigate = useNavigate()
  const backTo = useBackTo()
  // undefined while loading, null when it doesn't exist (or isn't the user's).
  const [holding, setHolding] = useState<HoldingDetailData | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [accountsFailed, setAccountsFailed] = useState(false)
  const [sheet, setSheet] = useState<'closed' | 'edit' | 'dividend' | Dividend>('closed')

  useEffect(() => {
    let live = true
    getHolding(id)
      .then((h) => {
        if (!live) return
        setHolding(h)
        setError(null)
      })
      .catch((err) => {
        if (!live) return
        if (err instanceof ApiError && err.status === 404) setHolding(null)
        else setError(err instanceof ApiError ? err.message : t('Could not load this holding.'))
      })
    return () => {
      live = false
    }
  }, [id, reloadKey])

  useEffect(() => {
    let live = true
    listAccounts()
      .then((rows) => live && setAccounts(rows.filter((a) => a.type === 'investment')))
      .catch(() => live && setAccountsFailed(true))
    return () => {
      live = false
    }
  }, [])

  const undoable = useUndoableDelete()

  function handleDeleteDividend(dividend: Dividend) {
    setSheet('closed')
    const index = (holding?.dividends ?? []).findIndex((d) => d.id === dividend.id)
    const setDividends = (fn: (rows: Dividend[]) => Dividend[]) =>
      setHolding((h) => (h ? { ...h, dividends: fn(h.dividends) } : h))
    undoable.remove({
      message: t('Deleted {name} dividend', { name: dividend.symbol }),
      hide: () => setDividends((rows) => rows.filter((d) => d.id !== dividend.id)),
      restore: () => setDividends((rows) => reinsert(rows, dividend, index)),
      commit: () => deleteDividend(dividend.id),
      // Totals come from the server.
      onCommitted: () => setReloadKey((k) => k + 1),
    })
  }

  function handleChanged() {
    setSheet('closed')
    setReloadKey((k) => k + 1)
  }

  // The list does the delete, with its Undo window.
  function handleDeleteHolding() {
    if (!holding) return
    const state: PortfolioLocationState = { deletedHolding: holding }
    navigate(backTo, { replace: true, state })
  }

  const back = (
    <Link
      to={backTo}
      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
    >
      <ArrowLeft size={16} aria-hidden />
      {t('Portfolio')}
    </Link>
  )

  if (holding === undefined) {
    return (
      <div className="space-y-4 pt-2">
        {back}
        {error ? (
          <Card>
            <CardBody className="flex items-center justify-between gap-3">
              <p role="alert" className="text-sm text-[var(--color-loss)]">
                {error}
              </p>
              <Button size="sm" variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
                {t('Try again')}
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4" aria-busy="true">
            <p className="sr-only">{t('Loading…')}</p>
            <Skeleton className="h-8 w-32" />
            <div className="space-y-3 rounded-2xl bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-44" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (holding === null) {
    return (
      <div className="space-y-4 pt-2">
        {back}
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">{t("This holding doesn't exist anymore.")}</p>
          </CardBody>
        </Card>
      </div>
    )
  }

  const account = holding.accountId ? accounts?.find((a) => a.id === holding.accountId) : undefined
  const usd = holding.currency !== 'THB'
  const details: [string, string][] = [
    [t('Quantity'), holdingQuantityText(holding)],
    [t('Average cost / unit'), native(holding.avgCost, holding.currency)],
    [
      t('Price / unit'),
      holding.autoPrice
        ? `${native(holding.price, holding.currency)} · ${priceAge(holding.priceUpdatedAt)}`
        : native(holding.price, holding.currency),
    ],
    [t('Cost'), holding.costBasisTHB !== null ? formatTHB(holding.costBasisTHB) : native(holding.costBasis, holding.currency)],
    ...(usd ? [[t('Value in {currency}', { currency: holding.currency }), native(holding.marketValue, holding.currency)] as [string, string]] : []),
  ]

  const returnRows: { label: string; value: string; tone: string }[] = [
    {
      label: t('Price gain'),
      value:
        holding.gainTHB !== null
          ? formatSignedTHB(holding.gainTHB)
          : signedNative(holding.marketValue - holding.costBasis, holding.currency),
      tone: gainTone(holding.gainTHB ?? holding.marketValue - holding.costBasis),
    },
    {
      label: t('Dividends received'),
      value: formatSignedTHB(holding.dividendsNetTHB),
      tone: gainTone(holding.dividendsNetTHB),
    },
  ]

  return (
    <div className="space-y-4 pt-2">
      {back}
      {undoable.toast}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            {holding.symbol}
          </h1>
          <p className="truncate text-sm text-[var(--color-muted)]">
            {[holding.name, ASSET_CLASS_META[holding.assetClass].label].filter(Boolean).join(' · ')}
          </p>
          {account ? (
            <Link
              to={`/accounts/${account.id}`}
              className="mt-1 inline-block max-w-full truncate rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              {accountLabel(account)}
            </Link>
          ) : (
            !holding.accountId && (
              <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                {t('No account')}
              </span>
            )
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setSheet('edit')}>
          <Pencil size={14} aria-hidden />
          {t('Edit')}
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]">
          {error}
        </p>
      )}

      <section
        aria-label={t('Value')}
        className="rounded-2xl bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]"
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
          {t('Value')}
        </p>
        <p className="tnum mt-1 text-[30px] font-bold leading-tight text-[var(--color-ink)]">
          {holding.marketValueTHB !== null
            ? formatTHB(holding.marketValueTHB)
            : native(holding.marketValue, holding.currency)}
        </p>
        <p className={`tnum mt-1 text-sm font-medium ${gainTone(holding.gainPct)}`}>{gainText(holding)}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {details.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-[var(--color-muted)]">{k}</dt>
              <dd className="tnum truncate font-medium text-[var(--color-ink)]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Card>
        <CardHeader title={t('Total return')} />
        <CardBody className="space-y-2 pt-0">
          <dl className="space-y-2 text-sm">
            {returnRows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3">
                <dt className="text-[var(--color-muted)]">{row.label}</dt>
                <dd className={`tnum font-medium ${row.tone}`}>{row.value}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-line)] pt-2">
              <dt className="font-semibold text-[var(--color-ink)]">{t('Total')}</dt>
              <dd className={`tnum font-bold ${gainTone(holding.totalReturnTHB)}`}>
                {holding.totalReturnTHB === null
                  ? '—'
                  : `${formatSignedTHB(holding.totalReturnTHB)}${
                      holding.totalReturnPct !== null ? ` · ${formatPercent(holding.totalReturnPct)}` : ''
                    }`}
              </dd>
            </div>
          </dl>
          {holding.dividendsUnconverted > 0 && (
            <p className="text-xs text-[var(--color-muted)]">
              {t('{n} USD dividends are left out until an exchange rate is available.', {
                n: holding.dividendsUnconverted,
              })}
            </p>
          )}
        </CardBody>
      </Card>
      {/* Only a dollar holding (or dollar dividends) depends on the rate. */}
      {(usd || holding.dividends.some((d) => d.currency !== 'THB')) && (
        <FxNote fx={holding.fx} unconverted={holding.marketValueTHB === null ? 1 : 0} />
      )}

      <section aria-label={t('Dividends')} className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
            {t('Dividends')}
          </h2>
          <Button size="sm" variant="secondary" aria-label={t('New dividend')} onClick={() => setSheet('dividend')}>
            <Plus size={14} aria-hidden />
            {t('Dividend')}
          </Button>
        </div>
        {holding.dividends.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--color-muted)]">
                {t('No dividends recorded for {name} in this account.', { name: holding.symbol })}
              </p>
            </CardBody>
          </Card>
        ) : (
          <DividendTable items={holding.dividends} onEdit={setSheet} onDelete={handleDeleteDividend} />
        )}
      </section>

      {sheet === 'edit' && (
        <Sheet label={t('Edit holding')} onClose={() => setSheet('closed')}>
          <HoldingForm
            initial={holding}
            accounts={accounts}
            accountsFailed={accountsFailed}
            onDone={handleChanged}
            onDelete={handleDeleteHolding}
            onClose={() => setSheet('closed')}
          />
        </Sheet>
      )}
      {sheet !== 'closed' && sheet !== 'edit' && (
        <Sheet label={sheet === 'dividend' ? t('New dividend') : t('Edit dividend')} onClose={() => setSheet('closed')}>
          <DividendForm
            key={sheet === 'dividend' ? 'new' : sheet.id}
            initial={sheet === 'dividend' ? undefined : sheet}
            accounts={accounts}
            accountsFailed={accountsFailed}
            holdings={[holding]}
            defaultSymbol={holding.symbol}
            defaultAccountId={holding.accountId ?? undefined}
            onDone={handleChanged}
            onDelete={sheet === 'dividend' ? undefined : () => handleDeleteDividend(sheet)}
            onClose={() => setSheet('closed')}
          />
        </Sheet>
      )}
    </div>
  )
}
