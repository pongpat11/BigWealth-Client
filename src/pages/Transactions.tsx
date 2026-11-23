import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Repeat, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Sheet } from '@/components/ui/Sheet'
import { useUndoableDelete } from '@/lib/useUndoableDelete'
import {
  browserTimezone,
  formatDayHeading,
  formatDateTime,
  formatTHB,
  nowDateTimeLocalValue,
  toDateTimeLocalValue,
} from '@/lib/format'
import { ApiError } from '@/lib/api'
import { listAccounts, type Account } from '@/lib/accounts'
import { listCategories, type Category } from '@/lib/categories'
import { t } from '@/lib/i18n'
import { listLabels, type Label } from '@/lib/labels'
import {
  createTransaction,
  deleteTransaction,
  listTransactionPage,
  updateTransaction,
  type Currency,
  type Transaction,
  type TransactionFilters,
} from '@/lib/transactions'

const CURRENCIES: Currency[] = ['THB', 'USD']
const FALLBACK_COLOR = '#94a3b8'

function formatMoney(amount: number, currency: string) {
  if (currency === 'THB') return formatTHB(amount)
  if (currency === 'USD')
    return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `${amount.toLocaleString()} ${currency}`
}

const selectClass =
  'h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500'

function TransactionForm({
  initial,
  onSaved,
  onDelete,
  onClose,
}: {
  initial?: Transaction
  onSaved: (t: Transaction, isEdit: boolean) => void
  onDelete: () => void
  onClose: () => void
}) {
  const isEdit = Boolean(initial)
  const [type, setType] = useState<'income' | 'expense'>(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [currency, setCurrency] = useState<Currency>(
    (initial?.currency as Currency) ?? 'THB',
  )
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [subCategoryId, setSubCategoryId] = useState(initial?.subCategoryId ?? '')
  const [accountId, setAccountId] = useState(initial?.accountId ?? '')
  const [dateTime, setDateTime] = useState(
    initial ? toDateTimeLocalValue(initial.date) : nowDateTimeLocalValue(),
  )
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(
    initial?.labels.map((l) => l.id) ?? [],
  )
  const timezone = browserTimezone()

  useEffect(() => {
    let active = true
    listCategories()
      .then((rows) => active && setCategories(rows))
      .catch(() => undefined)
    listAccounts()
      .then((rows) => active && setAccounts(rows))
      .catch(() => undefined)
    listLabels()
      .then((rows) => active && setLabels(rows))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const topLevel = useMemo(
    () => categories.filter((c) => !c.parentId && c.kind === type),
    [categories, type],
  )
  const subOptions = useMemo(
    () => categories.filter((c) => c.parentId === categoryId),
    [categories, categoryId],
  )

  function toggleLabel(id: string) {
    setSelectedLabelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('Enter an amount greater than 0.'))
      return
    }
    if (!categoryId) {
      setError(t('Pick a category.'))
      return
    }
    setSaving(true)
    const input = {
      type,
      amount: value,
      currency,
      categoryId,
      subCategoryId: subCategoryId || undefined,
      accountId: accountId || undefined,
      note: note.trim() || undefined,
      date: new Date(dateTime).toISOString(),
      timezone,
      labelIds: selectedLabelIds,
    }
    try {
      const saved = initial
        ? await updateTransaction(initial.id, input)
        : await createTransaction(input)
      onSaved(saved, isEdit)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Could not save. Try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {isEdit ? t('Edit transaction') : t('New transaction')}
          </p>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t)
                  setCategoryId('')
                  setSubCategoryId('')
                }}
                className={
                  'flex-1 rounded-xl py-2 text-sm font-semibold capitalize transition-colors ' +
                  (type === t
                    ? 'bg-brand-600 text-white'
                    : 'bg-[var(--color-canvas)] text-[var(--color-muted)]')
                }
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                id="amount"
                label={t('Amount')}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="w-28">
              <label htmlFor="currency" className="text-[13px] font-medium text-[var(--color-muted)]">
                {t('Currency')}
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className={selectClass + ' mt-1.5'}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className="text-[13px] font-medium text-[var(--color-muted)]">
              {t('Category')}
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                setSubCategoryId('')
              }}
              className={selectClass}
            >
              <option value="">{t('Select…')}</option>
              {topLevel.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {subOptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="subcategory" className="text-[13px] font-medium text-[var(--color-muted)]">
                {t('Sub-category (optional)')}
              </label>
              <select
                id="subcategory"
                value={subCategoryId}
                onChange={(e) => setSubCategoryId(e.target.value)}
                className={selectClass}
              >
                <option value="">{t('None')}</option>
                {subOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {accounts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account" className="text-[13px] font-medium text-[var(--color-muted)]">
                {t('Account (optional)')}
              </label>
              <select
                id="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className={selectClass}
              >
                <option value="">{t('None')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.institution ? ` · ${a.institution}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {labels.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--color-muted)]">{t('Labels')}</span>
              <div className="flex flex-wrap gap-2">
                {labels.map((l) => {
                  const active = selectedLabelIds.includes(l.id)
                  const color = l.color ?? FALLBACK_COLOR
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLabel(l.id)}
                      style={active ? { backgroundColor: color + '20', color } : undefined}
                      className={
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                        (active ? '' : 'bg-[var(--color-canvas)] text-[var(--color-muted)]')
                      }
                    >
                      {l.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="datetime" className="text-[13px] font-medium text-[var(--color-muted)]">
              {t('Date & time')}
            </label>
            <input
              id="datetime"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className={selectClass}
            />
            <span className="text-xs text-[var(--color-muted)]">
              {t('Saved with your timezone · {timezone}', { timezone })}
            </span>
          </div>

          <Input
            id="note"
            label={t('Note (optional)')}
            type="text"
            placeholder={t('e.g. Lunch with team')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? t('Saving…') : isEdit ? t('Save changes') : t('Add transaction')}
            </Button>
          </div>

          {isEdit && (
            <DeleteButton
              variant="block"
              label={t('Delete transaction')}
              onClick={onDelete}
              disabled={saving}
            />
          )}
        </form>
      </CardBody>
    </Card>
  )
}

function TransactionRow({ tx, onEdit }: { tx: Transaction; onEdit: (t: Transaction) => void }) {
  const cat = tx.category
  const positive = tx.type === 'income'
  const categoryLabel = tx.subCategory
    ? `${cat?.name ?? ''} · ${tx.subCategory.name}`
    : (cat?.name ?? t('Uncategorized'))
  return (
    <button
      type="button"
      onClick={() => onEdit(tx)}
      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[var(--color-canvas)]"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: (cat?.color ?? FALLBACK_COLOR) + '20', color: cat?.color ?? '#64748b' }}
      >
        <Icon name={cat?.icon ?? 'Circle'} size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-sm font-semibold text-[var(--color-ink)]">
          <span className="truncate">{tx.note || categoryLabel}</span>
          {tx.recurringRuleId && (
            <Repeat
              size={12}
              className="shrink-0 text-[var(--color-muted)]"
              aria-label={t('Recurring')}
            />
          )}
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          {categoryLabel}
          {tx.account ? ` · ${tx.account.name}` : ''} · {formatDateTime(tx.date, tx.timezone)}
        </p>
        {tx.labels.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tx.labels.map((l) => (
              <span
                key={l.id}
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: (l.color ?? FALLBACK_COLOR) + '20',
                  color: l.color ?? FALLBACK_COLOR,
                }}
              >
                {l.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <span
        className={
          'tnum shrink-0 text-sm font-semibold ' +
          (positive ? 'text-[var(--color-gain)]' : 'text-[var(--color-ink)]')
        }
      >
        {positive ? '+' : '−'}
        {formatMoney(tx.amount, tx.currency)}
      </span>
    </button>
  )
}

const TYPE_TABS = [
  { value: '', label: t('All') },
  { value: 'income', label: t('Income') },
  { value: 'expense', label: t('Expense') },
] as const

/** Local midnight of a 'YYYY-MM-DD' date, shifted by `addDays`, as an ISO instant. */
function dayStartIso(date: string, addDays = 0): string | undefined {
  const [y, m, d] = date.split('-').map(Number)
  const at = new Date(y, m - 1, d + addDays)
  return Number.isNaN(at.getTime()) ? undefined : at.toISOString()
}

/**
 * Client-side mirror of the API filters, so a row added or edited in place only
 * stays in the list when the server would have returned it for this view.
 */
function matchesFilters(tx: Transaction, f: TransactionFilters): boolean {
  if (f.type && tx.type !== f.type) return false
  if (f.accountId && tx.accountId !== f.accountId) return false
  if (f.categoryId && tx.categoryId !== f.categoryId && tx.subCategoryId !== f.categoryId) {
    return false
  }
  if (f.labelId && !tx.labels.some((l) => l.id === f.labelId)) return false
  const at = new Date(tx.date).getTime()
  if (f.from && at < new Date(f.from).getTime()) return false
  if (f.to && at >= new Date(f.to).getTime()) return false
  if (f.q && !(tx.note ?? '').toLowerCase().includes(f.q.toLowerCase())) return false
  return true
}

/** Group consecutive rows (already newest-first) under a per-day heading. */
function groupByDay(items: Transaction[]): { heading: string; rows: Transaction[] }[] {
  const groups: { heading: string; rows: Transaction[] }[] = []
  for (const tx of items) {
    const heading = formatDayHeading(tx.date)
    const last = groups[groups.length - 1]
    if (last && last.heading === heading) last.rows.push(tx)
    else groups.push({ heading, rows: [tx] })
  }
  return groups
}

export function Transactions() {
  // Filters live in the URL so a filtered view can be bookmarked or shared.
  const [params, setParams] = useSearchParams()
  const type = params.get('type') ?? ''
  const accountId = params.get('account') ?? ''
  const categoryId = params.get('category') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const q = params.get('q') ?? ''

  const [items, setItems] = useState<Transaction[] | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState(q)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const filters = useMemo<TransactionFilters>(
    () => ({
      type: type === 'income' || type === 'expense' ? type : undefined,
      accountId: accountId || undefined,
      categoryId: categoryId || undefined,
      from: from ? dayStartIso(from) : undefined,
      // `to` is inclusive in the UI, exclusive in the API: use the next midnight.
      to: to ? dayStartIso(to, 1) : undefined,
      q: q || undefined,
    }),
    [type, accountId, categoryId, from, to, q],
  )
  const panelFilterCount = [accountId, categoryId, from, to].filter(Boolean).length
  const isFiltered = Boolean(type || q || panelFilterCount)

  function setParam(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  // Debounce typing in the search box before it hits the URL / API.
  useEffect(() => {
    if (search === q) return
    const timer = setTimeout(() => setParam('q', search.trim()), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // The filters the list currently shows; lets an in-flight "Load more" tell
  // that the view changed underneath it.
  const shownFilters = useRef(filters)

  useEffect(() => {
    shownFilters.current = filters
    let active = true
    listTransactionPage(filters)
      .then((page) => {
        if (!active) return
        setItems(page.items)
        setNextCursor(page.nextCursor)
        setError(null)
      })
      .catch(
        (err) =>
          active &&
          setError(err instanceof ApiError ? err.message : t('Could not load transactions.')),
      )
    return () => {
      active = false
    }
  }, [filters])

  // Filter-panel options load only once the panel is opened.
  useEffect(() => {
    if (!filtersOpen) return
    let active = true
    listAccounts()
      .then((rows) => active && setAccounts(rows))
      .catch(() => undefined)
    listCategories()
      .then((rows) => active && setCategories(rows))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [filtersOpen])

  async function loadMore() {
    if (!nextCursor) return
    const requested = filters
    setLoadingMore(true)
    try {
      const page = await listTransactionPage(requested, nextCursor)
      // Filters changed while this page was loading: it belongs to the old view.
      if (shownFilters.current !== requested) return
      setItems((prev) => [...(prev ?? []), ...page.items])
      setNextCursor(page.nextCursor)
    } catch (err) {
      if (shownFilters.current !== requested) return
      setError(err instanceof ApiError ? err.message : t('Could not load more.'))
    } finally {
      setLoadingMore(false)
    }
  }

  function clearFilters() {
    setSearch('')
    setParams({}, { replace: true })
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  function handleSaved(saved: Transaction) {
    const visible = matchesFilters(saved, filters)
    setItems((prev) => {
      const list = (prev ?? []).filter((t) => t.id !== saved.id)
      // A row that no longer fits the active filters drops out of the view.
      const next = visible ? [saved, ...list] : list
      // Keep newest-first so the row lands under the right day.
      return [...next].sort((a, b) => b.date.localeCompare(a.date))
    })
    closeForm()
  }

  const undoable = useUndoableDelete()

  function handleDelete(tx: Transaction) {
    closeForm()
    undoable.remove({
      message: t('Transaction deleted'),
      hide: () => setItems((prev) => (prev ?? []).filter((t) => t.id !== tx.id)),
      restore: () =>
        setItems((prev) =>
          [...(prev ?? []).filter((t) => t.id !== tx.id), tx].sort((a, b) =>
            b.date.localeCompare(a.date),
          ),
        ),
      commit: () => deleteTransaction(tx.id),
    })
  }

  const topLevelCategories = categories.filter((c) => !c.parentId)

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Transactions')}
        action={
          <Button
            size="sm"
            onClick={() => {
              if (formOpen && editing === null) {
                closeForm()
              } else {
                setEditing(null)
                setFormOpen(true)
              }
            }}
          >
            <Plus size={16} aria-hidden />
            {t('Add')}
          </Button>
        }
      />

      {formOpen && (
        <Sheet label={editing ? t('Edit transaction') : t('New transaction')} onClose={closeForm}>
          <TransactionForm
            key={editing?.id ?? 'new'}
            initial={editing ?? undefined}
            onSaved={handleSaved}
            onDelete={() => editing && handleDelete(editing)}
            onClose={closeForm}
          />
        </Sheet>
      )}
      {undoable.toast}

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
            />
            <input
              type="search"
              aria-label={t('Search notes')}
              placeholder={t('Search notes')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={selectClass + ' pl-9'}
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className={
              'flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors ' +
              (filtersOpen || panelFilterCount > 0
                ? 'border-brand-600 bg-brand-500/10 text-brand-700'
                : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]')
            }
          >
            <SlidersHorizontal size={16} aria-hidden />
            {t('Filters')}
            {panelFilterCount > 0 && <span className="tnum">({panelFilterCount})</span>}
          </button>
        </div>

        <div className="flex gap-2" role="group" aria-label={t('Transaction type')}>
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              aria-pressed={type === tab.value}
              onClick={() => setParam('type', tab.value)}
              className={
                'flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ' +
                (type === tab.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-line)]')
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filtersOpen && (
          <Card>
            <CardBody className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                <label htmlFor="filter-account" className="text-[13px] font-medium text-[var(--color-muted)]">
                  {t('In account')}
                </label>
                <select
                  id="filter-account"
                  value={accountId}
                  onChange={(e) => setParam('account', e.target.value)}
                  className={selectClass}
                >
                  <option value="">{t('Any')}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                <label htmlFor="filter-category" className="text-[13px] font-medium text-[var(--color-muted)]">
                  {t('In category')}
                </label>
                <select
                  id="filter-category"
                  value={categoryId}
                  onChange={(e) => setParam('category', e.target.value)}
                  className={selectClass}
                >
                  <option value="">{t('Any')}</option>
                  {topLevelCategories.map((c) => (
                    <optgroup key={c.id} label={c.name}>
                      <option value={c.id}>{t('All {name}', { name: c.name })}</option>
                      {categories
                        .filter((sub) => sub.parentId === c.id)
                        .map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="filter-from" className="text-[13px] font-medium text-[var(--color-muted)]">
                  {t('From')}
                </label>
                <input
                  id="filter-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setParam('from', e.target.value)}
                  className={selectClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="filter-to" className="text-[13px] font-medium text-[var(--color-muted)]">
                  {t('To')}
                </label>
                <input
                  id="filter-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setParam('to', e.target.value)}
                  className={selectClass}
                />
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      {error && (
        <Card>
          <CardBody>
            <p role="alert" className="text-sm text-[var(--color-loss)]">
              {error}
            </p>
          </CardBody>
        </Card>
      )}

      {!error && items === null && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">{t('Loading…')}</p>
          </CardBody>
        </Card>
      )}

      {items !== null && items.length === 0 && (
        <Card>
          <CardBody className="space-y-2">
            <p className="text-sm text-[var(--color-muted)]">
              {isFiltered
                ? t('No transactions match these filters.')
                : t('No transactions yet. Add your first one.')}
            </p>
            {isFiltered && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                {t('Clear filters')}
              </button>
            )}
          </CardBody>
        </Card>
      )}

      {items !== null &&
        items.length > 0 &&
        groupByDay(items).map((group) => (
          <section key={group.heading} aria-label={group.heading} className="space-y-1.5">
            <h2 className="px-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              {group.heading}
            </h2>
            <Card>
              <CardBody className="divide-y divide-[var(--color-line)] py-0">
                {group.rows.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    onEdit={(t) => {
                      setEditing(t)
                      setFormOpen(true)
                    }}
                  />
                ))}
              </CardBody>
            </Card>
          </section>
        ))}

      {items !== null && nextCursor && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? t('Loading…') : t('Load more')}
        </Button>
      )}
    </div>
  )
}
