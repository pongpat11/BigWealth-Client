import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PieChart as PieIcon, Plus, RefreshCw } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { Sheet } from '@/components/ui/Sheet'
import { DividendForm } from '@/components/portfolio/DividendForm'
import { DividendTable } from '@/components/portfolio/DividendTable'
import { HoldingForm } from '@/components/portfolio/HoldingForm'
import { FxNote, Message } from '@/components/portfolio/shared'
import {
  accountLabel,
  gainText,
  gainTone,
  native,
  priceAge,
  selectClass,
} from '@/components/portfolio/format'
import { reinsert, useUndoableDelete } from '@/lib/useUndoableDelete'
import { ApiError } from '@/lib/api'
import { listAccounts, type Account } from '@/lib/accounts'
import { formatPercent, formatSignedTHB, formatTHB } from '@/lib/format'
import { getLanguage, t } from '@/lib/i18n'
import {
  ASSET_CLASSES,
  ASSET_CLASS_META,
  deleteDividend,
  deleteHolding,
  getPortfolio,
  GOLD_UNITS,
  GOLD_UNIT_META,
  goldUnitOf,
  holdingQuantityText,
  listDividends,
  NO_ACCOUNT,
  roundPercents,
  sortHoldings,
  totalValueTHB,
  type HoldingSort,
  type Dividend,
  type DividendList,
  type Holding,
  type Portfolio as PortfolioData,
} from '@/lib/portfolio'

/** Navigation state the holding page leaves when it deletes a holding, so the undo toast shows here. */
export interface PortfolioLocationState {
  deletedHolding?: Holding
}

function HoldingRow({
  holding,
  account,
  search,
}: {
  holding: Holding
  /**
   * Account name to show; null flags a holding with no account; undefined or
   * '' (name not loaded) shows nothing.
   */
  account?: string | null
  /** The page's query string, kept so "back" returns to the same filter. */
  search: string
}) {
  return (
    <Link
      to={`/portfolio/${holding.id}`}
      state={{ from: `/portfolio${search}` }}
      aria-label={t('Open holding {name}', { name: holding.symbol })}
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
          {gainText(holding)}
        </p>
      </div>
    </Link>
  )
}

/**
 * Holdings grouped for the list: one section per asset class, except gold,
 * which gets a section per unit (baht-weight and troy ounces don't add up).
 */
function holdingGroups(holdings: Holding[]) {
  const groups: { key: string; title: string; total?: string; value: string | null; rows: Holding[] }[] = []
  // Baht total of a group; left out for a single row (it would repeat the
  // row's value) and when none of it converts (no exchange rate).
  const value = (rows: Holding[]) =>
    rows.length > 1 && rows.some((h) => h.marketValueTHB !== null)
      ? formatTHB(totalValueTHB(rows))
      : null
  for (const assetClass of ASSET_CLASSES) {
    const rows = holdings.filter((h) => h.assetClass === assetClass)
    if (rows.length === 0) continue
    if (assetClass !== 'gold') {
      groups.push({ key: assetClass, title: ASSET_CLASS_META[assetClass].label, value: value(rows), rows })
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
        value: value(unitRows),
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
  search,
}: {
  portfolio: PortfolioData
  /** Account id -> name for row chips; undefined hides them. */
  accountNames?: Map<string, string>
  sortBy: HoldingSort
  onSortChange: (s: HoldingSort) => void
  search: string
}) {
  // Whole percentages that add up to 100.
  const allocationPct = roundPercents(portfolio.allocation.map((s) => s.valueTHB))
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
              {portfolio.allocation.map((slice, i) => (
                <li key={slice.assetClass} className="flex items-start justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-start gap-1.5">
                    <span
                      className="mt-1 size-2 shrink-0 rounded-full"
                      style={{ background: ASSET_CLASS_META[slice.assetClass].color }}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[var(--color-muted)]">
                        {ASSET_CLASS_META[slice.assetClass].label}
                      </span>
                      <span className="tnum block text-[11px] text-[var(--color-muted)] opacity-80">
                        {formatTHB(slice.valueTHB)}
                      </span>
                    </span>
                  </span>
                  <span className="tnum shrink-0 font-semibold text-[var(--color-ink)]">
                    {allocationPct[i]}%
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
      {holdingGroups(portfolio.holdings).map(({ key, title, total, value, rows: groupRows }) => {
        const rows = sortHoldings(groupRows, sortBy)
        return (
          <section key={key} aria-label={title} className="space-y-1.5">
            <h2 className="flex items-baseline justify-between gap-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              <span className="min-w-0 truncate">{title}</span>
              <span className="tnum flex shrink-0 items-baseline gap-1.5 normal-case tracking-normal">
                {total && <span>{total}</span>}
                {total && value && <span aria-hidden>·</span>}
                {value && <span className="text-[var(--color-ink)]">{value}</span>}
              </span>
            </h2>
            <Card>
              <CardBody className="divide-y divide-[var(--color-line)] py-0">
                {rows.map((h) => (
                  <HoldingRow
                    key={h.id}
                    holding={h}
                    account={accountNames && (h.accountId ? (accountNames.get(h.accountId) ?? '') : null)}
                    search={search}
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

function DividendsTab({
  accountId,
  reloadKey,
  onChanged,
  accounts,
  accountsFailed,
  holdings,
}: {
  accountId?: string
  reloadKey: number
  onChanged: () => void
  /** For the edit form. */
  accounts: Account[] | null
  accountsFailed: boolean
  holdings: Holding[]
}) {
  const thisYear = new Date().getFullYear()
  const [allYears, setAllYears] = useState(false)
  const [data, setData] = useState<DividendList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Dividend | null>(null)

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
            <DividendTable items={data.items} onEdit={setEditing} onDelete={handleDelete} />
          )}
        </>
      )}

      {editing && (
        <Sheet label={t('Edit dividend')} onClose={() => setEditing(null)}>
          <DividendForm
            key={editing.id}
            initial={editing}
            accounts={accounts}
            accountsFailed={accountsFailed}
            holdings={holdings}
            onDone={() => {
              setEditing(null)
              onChanged()
            }}
            onDelete={() => {
              setEditing(null)
              handleDelete(editing)
            }}
            onClose={() => setEditing(null)}
          />
        </Sheet>
      )}
    </>
  )
}

type Tab = 'holdings' | 'dividends'
const TABS: { value: Tab; label: string }[] = [
  { value: 'holdings', label: t('Holdings') },
  { value: 'dividends', label: t('Dividends') },
]

/** Placeholder for the total card and the list while the portfolio loads. */
function PortfolioSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <p className="sr-only">{t('Loading…')}</p>
      <div className="space-y-3 rounded-2xl bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Card>
        <CardBody className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="flex flex-col items-end space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}

function isTab(value: string | null): value is Tab {
  return TABS.some((t) => t.value === value)
}

export function Portfolio() {
  // `?account=<id>` (or `none`) narrows the page to one account; `?tab=` keeps
  // the open tab across reloads and shared links.
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: Tab = isTab(tabParam) ? tabParam : 'holdings'
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})
  // Lives here so the choice survives switching to Dividends and back.
  const [sortBy, setSortBy] = useState<HoldingSort>('value')
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  // When the shown figures were loaded, and whether a reload is under way.
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The add form (editing a holding happens on its own page).
  const [form, setForm] = useState<'closed' | 'new'>('closed')
  const [reloadKey, setReloadKey] = useState(0)
  const accountFilter = params.get('account') ?? ''
  const search = params.toString() ? `?${params.toString()}` : ''
  const location = useLocation()
  const navigate = useNavigate()
  // A holding deleted on its own page: removed here, with the undo toast.
  const deleted = useRef((location.state as PortfolioLocationState | null)?.deletedHolding ?? null)
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
        setLoadedAt(new Date())
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
      .finally(() => active && setRefreshing(false))
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

  // Once the list is in, hide the holding deleted on its page and offer undo.
  // The navigation state is cleared so a reload doesn't delete it again.
  useEffect(() => {
    const holding = deleted.current
    if (!holding || portfolio === null) return
    deleted.current = null
    navigate({ search }, { replace: true, state: null })
    handleDeleteHolding(holding)
    // handleDeleteHolding is recreated each render; this runs once per deletion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio])

  function switchTab(next: Tab) {
    setForm('closed')
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'holdings') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )
  }

  // Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern).
  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const i = TABS.findIndex((x) => x.value === tab)
    const next =
      e.key === 'ArrowRight'
        ? TABS[(i + 1) % TABS.length]
        : e.key === 'ArrowLeft'
          ? TABS[(i - 1 + TABS.length) % TABS.length]
          : e.key === 'Home'
            ? TABS[0]
            : e.key === 'End'
              ? TABS[TABS.length - 1]
              : null
    if (!next) return
    e.preventDefault()
    switchTab(next.value)
    tabRefs.current[next.value]?.focus()
  }

  function refresh() {
    setRefreshing(true)
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Portfolio')}
        action={
          <Button
            size="sm"
            aria-label={tab === 'holdings' ? t('New holding') : t('New dividend')}
            onClick={() => setForm(form === 'new' ? 'closed' : 'new')}
          >
            <Plus size={16} aria-hidden />
            {tab === 'holdings' ? t('Holding') : t('Dividend')}
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

      {!error && portfolio === null && <PortfolioSkeleton />}

      {portfolio !== null && (
        <section
          aria-label={t('Total value')}
          className="rounded-2xl bg-brand-600 p-5 text-white shadow-[var(--shadow-card)]"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-100">
              {t('Total value')}
            </p>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              aria-label={t('Refresh prices')}
              className="-m-2 flex items-center gap-1.5 rounded-full p-2 text-[11px] text-brand-100 transition-colors hover:text-white disabled:opacity-70"
            >
              {loadedAt && (
                <span className="tnum">
                  {refreshing
                    ? t('Updating…')
                    : t('Updated {time}', {
                        time: loadedAt.toLocaleTimeString(getLanguage() === 'th' ? 'th-TH' : 'en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      })}
                </span>
              )}
              <RefreshCw
                size={14}
                aria-hidden
                className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''}
              />
            </button>
          </div>
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
          {/* Dividends received count towards the return; older servers don't send them. */}
          {portfolio.totalDividendsTHB !== undefined &&
            portfolio.totalReturnTHB !== undefined &&
            portfolio.totalDividendsTHB > 0 && (
              <p className="tnum mt-2 text-xs text-brand-100">
                {t('+ {dividends} dividends = {total} total return', {
                  dividends: formatTHB(portfolio.totalDividendsTHB),
                  total: formatSignedTHB(portfolio.totalReturnTHB),
                })}
              </p>
            )}
        </section>
      )}

      <div className="flex gap-2" role="tablist" aria-label={t('Portfolio sections')}>
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            ref={(el) => {
              tabRefs.current[value] = el
            }}
            id={`portfolio-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`portfolio-panel-${value}`}
            tabIndex={tab === value ? 0 : -1}
            onKeyDown={onTabKey}
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

      {form === 'new' && tab === 'holdings' && (
        <Sheet label={t('New holding')} onClose={() => setForm('closed')}>
          <HoldingForm
            accounts={accounts}
            accountsFailed={accountsFailed}
            defaultAccountId={filteredAccount}
            onDone={handleChanged}
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

      <div
        id={`portfolio-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`portfolio-tab-${tab}`}
        className="space-y-4"
      >
        {tab === 'holdings' && portfolio !== null && (
          <>
            <FxNote fx={portfolio.fx} unconverted={portfolio.unconvertedCount} />
            <HoldingsTab
              portfolio={portfolio}
              accountNames={accountFilter ? undefined : accountNames}
              sortBy={sortBy}
              onSortChange={setSortBy}
              search={search}
            />
          </>
        )}
        {tab === 'dividends' && (
          <DividendsTab
            accountId={accountFilter || undefined}
            reloadKey={reloadKey}
            onChanged={handleChanged}
            accounts={accounts}
            accountsFailed={accountsFailed}
            holdings={portfolio?.holdings ?? []}
          />
        )}
      </div>
    </div>
  )
}
