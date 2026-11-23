import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Sheet } from '@/components/ui/Sheet'
import { reinsert, useUndoableDelete } from '@/lib/useUndoableDelete'
import { ApiError } from '@/lib/api'
import { listAccounts, type Account } from '@/lib/accounts'
import { listCategories, type Category } from '@/lib/categories'
import { listLabels, type Label } from '@/lib/labels'
import { browserTimezone, formatDate, formatTHB } from '@/lib/format'
import { t } from '@/lib/i18n'
import type { Currency } from '@/lib/transactions'
import {
  createRecurring,
  deleteRecurring,
  describeSchedule,
  listRecurring,
  nextOccurrenceOnOrAfter,
  todayKey,
  updateRecurring,
  type Frequency,
  type RecurringRule,
} from '@/lib/recurring'

const FALLBACK_COLOR = '#94a3b8'
const FREQUENCIES: { value: Frequency; label: string; unit: string }[] = [
  { value: 'weekly', label: t('Weekly'), unit: t('weeks') },
  { value: 'monthly', label: t('Monthly'), unit: t('months') },
  { value: 'yearly', label: t('Yearly'), unit: t('years') },
]

const selectClass =
  'h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500'
const labelClass = 'text-[13px] font-medium text-[var(--color-muted)]'

function formatMoney(amount: number, currency: string) {
  if (currency === 'USD') return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return formatTHB(amount)
}

/** Approximate THB per month, for the summary line. USD rules are left out. */
function monthlyEquivalent(r: RecurringRule): number {
  if (r.currency !== 'THB') return 0
  const perYear = { weekly: 52, monthly: 12, yearly: 1 }[r.frequency] / r.interval
  return (r.amount * perYear) / 12
}

function RecurringForm({
  initial,
  onSaved,
  onDelete,
  onClose,
}: {
  initial?: RecurringRule
  onSaved: (r: RecurringRule, isEdit: boolean) => void
  onDelete: () => void
  onClose: () => void
}) {
  const isEdit = Boolean(initial)
  const [type, setType] = useState<'income' | 'expense'>(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [currency, setCurrency] = useState<Currency>((initial?.currency as Currency) ?? 'THB')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [subCategoryId, setSubCategoryId] = useState(initial?.subCategoryId ?? '')
  const [accountId, setAccountId] = useState(initial?.accountId ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? 'monthly')
  const [interval, setIntervalText] = useState(String(initial?.interval ?? 1))
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayKey())
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(initial?.labelIds ?? [])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    listCategories()
      .then((rows) => live && setCategories(rows))
      .catch(() => undefined)
    listAccounts()
      .then((rows) => live && setAccounts(rows))
      .catch(() => undefined)
    listLabels()
      .then((rows) => live && setLabels(rows))
      .catch(() => undefined)
    return () => {
      live = false
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

  const every = Number(interval)
  const validInterval = Number.isInteger(every) && every >= 1 && every <= 12
  // What the server will do on save: nothing in the past is filled in.
  const firstEntry =
    validInterval && startDate
      ? nextOccurrenceOnOrAfter({ frequency, interval: every, startDate }, todayKey())
      : null
  const unit = FREQUENCIES.find((f) => f.value === frequency)!.unit

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return setError(t('Enter an amount greater than 0.'))
    if (!categoryId) return setError(t('Pick a category.'))
    if (!validInterval) return setError(t('Repeat every 1 to 12.'))
    if (!startDate) return setError(t('Pick a start date.'))
    if (endDate && endDate < startDate) return setError(t('End date is before the start date.'))
    setError(null)
    setSaving(true)
    const input = {
      type,
      amount: value,
      currency,
      categoryId,
      subCategoryId: subCategoryId || undefined,
      accountId: accountId || undefined,
      note: note.trim() || undefined,
      labelIds: selectedLabelIds,
      frequency,
      interval: every,
      startDate,
      endDate: endDate || null,
      timezone: browserTimezone(),
      active,
    }
    try {
      const saved = initial
        ? await updateRecurring(initial.id, input)
        : await createRecurring(input)
      onSaved(saved, isEdit)
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
            {isEdit ? t('Edit recurring') : t('New recurring')}
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
                aria-pressed={type === t}
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
                id="rec-amount"
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
              <label htmlFor="rec-currency" className={labelClass}>
                {t('Currency')}
              </label>
              <select
                id="rec-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className={selectClass + ' mt-1.5'}
              >
                <option value="THB">THB</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rec-category" className={labelClass}>
              {t('Category')}
            </label>
            <select
              id="rec-category"
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
              <label htmlFor="rec-subcategory" className={labelClass}>
                {t('Sub-category (optional)')}
              </label>
              <select
                id="rec-subcategory"
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
              <label htmlFor="rec-account" className={labelClass}>
                {t('Account (optional)')}
              </label>
              <select
                id="rec-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className={selectClass}
              >
                <option value="">{t('None')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="rec-frequency" className={labelClass}>
                {t('Repeats')}
              </label>
              <select
                id="rec-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
                className={selectClass + ' mt-1.5'}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <Input
                id="rec-interval"
                label={t('Every ({unit})', { unit })}
                type="number"
                inputMode="numeric"
                min="1"
                max="12"
                step="1"
                value={interval}
                onChange={(e) => setIntervalText(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              id="rec-start"
              label={t('Starts')}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              id="rec-end"
              label={t('Ends (optional)')}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {firstEntry && active && (
            <p className="-mt-2 text-xs text-[var(--color-muted)]">
              {isEdit
                ? t("Next entry: {date}. Past dates aren't filled in.", { date: formatDate(firstEntry) })
                : t("First entry: {date}. Past dates aren't filled in.", { date: formatDate(firstEntry) })}
            </p>
          )}

          {labels.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>{t('Labels')}</span>
              <div className="flex flex-wrap gap-2">
                {labels.map((l) => {
                  const on = selectedLabelIds.includes(l.id)
                  const color = l.color ?? FALLBACK_COLOR
                  return (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setSelectedLabelIds((prev) =>
                          on ? prev.filter((x) => x !== l.id) : [...prev, l.id],
                        )
                      }
                      style={on ? { backgroundColor: color + '20', color } : undefined}
                      className={
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                        (on ? '' : 'bg-[var(--color-canvas)] text-[var(--color-muted)]')
                      }
                    >
                      {l.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <Input
            id="rec-note"
            label={t('Note (optional)')}
            type="text"
            placeholder={t('e.g. Netflix')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {isEdit && (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-canvas)] px-3 py-2.5">
              <span className="text-sm text-[var(--color-ink)]">
                {t('Active')}
                <span className="block text-xs text-[var(--color-muted)]">
                  {t('Paused rules create nothing. Resuming skips the missed dates.')}
                </span>
              </span>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="size-5 accent-brand-600"
              />
            </label>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? t('Saving…') : isEdit ? t('Save changes') : t('Add recurring')}
            </Button>
          </div>

          {isEdit && (
            <DeleteButton variant="block" label={t('Delete recurring')} onClick={onDelete} disabled={saving} />
          )}
        </form>
      </CardBody>
    </Card>
  )
}

function RuleRow({ rule, onEdit }: { rule: RecurringRule; onEdit: (r: RecurringRule) => void }) {
  const cat = rule.category
  const income = rule.type === 'income'
  const title = rule.note || cat?.name || t('Recurring')
  const when = !rule.active
    ? t('Paused')
    : rule.nextDate
      ? t('Next {date}', { date: formatDate(rule.nextDate) })
      : t('Finished')
  return (
    <button
      type="button"
      onClick={() => onEdit(rule)}
      aria-label={t('Edit {name}', { name: title })}
      className={
        'flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[var(--color-canvas)] ' +
        (rule.nextDate ? '' : 'opacity-60')
      }
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: (cat?.color ?? FALLBACK_COLOR) + '20',
          color: cat?.color ?? '#64748b',
        }}
      >
        <Icon name={cat?.icon ?? 'Repeat'} size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{title}</p>
        <p className="truncate text-xs text-[var(--color-muted)]">
          {describeSchedule(rule)}
          {rule.account ? ` · ${rule.account.name}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={
            'tnum text-sm font-semibold ' +
            (income ? 'text-[var(--color-gain)]' : 'text-[var(--color-ink)]')
          }
        >
          {income ? '+' : '−'}
          {formatMoney(rule.amount, rule.currency)}
        </p>
        <p className="text-xs text-[var(--color-muted)]">{when}</p>
      </div>
    </button>
  )
}

export function Recurring() {
  const [items, setItems] = useState<RecurringRule[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringRule | null>(null)
  const undoable = useUndoableDelete()

  useEffect(() => {
    let live = true
    listRecurring()
      .then((rows) => live && setItems(rows))
      .catch(
        (err) =>
          live &&
          setError(err instanceof ApiError ? err.message : t('Could not load recurring items.')),
      )
    return () => {
      live = false
    }
  }, [])

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  function handleSaved(saved: RecurringRule, isEdit: boolean) {
    setItems((prev) => {
      const list = prev ?? []
      return isEdit ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved]
    })
    closeForm()
  }

  function handleDelete(rule: RecurringRule) {
    closeForm()
    const index = (items ?? []).findIndex((r) => r.id === rule.id)
    undoable.remove({
      message: t('Deleted “{name}”', { name: rule.note || rule.category?.name || t('recurring') }),
      hide: () => setItems((prev) => (prev ?? []).filter((r) => r.id !== rule.id)),
      restore: () => setItems((prev) => reinsert(prev ?? [], rule, index)),
      commit: () => deleteRecurring(rule.id),
    })
  }

  // Soonest first; paused / finished rules sink to the bottom.
  const sorted = [...(items ?? [])].sort((a, b) =>
    (a.nextDate ?? '9999').localeCompare(b.nextDate ?? '9999'),
  )
  const running = sorted.filter((r) => r.nextDate)
  const monthlyIn = running
    .filter((r) => r.type === 'income')
    .reduce((s, r) => s + monthlyEquivalent(r), 0)
  const monthlyOut = running
    .filter((r) => r.type === 'expense')
    .reduce((s, r) => s + monthlyEquivalent(r), 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Recurring')}
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus size={16} aria-hidden />
            {t('Add')}
          </Button>
        }
      />

      {formOpen && (
        <Sheet label={editing ? t('Edit recurring') : t('New recurring')} onClose={closeForm}>
          <RecurringForm
            key={editing?.id ?? 'new'}
            initial={editing ?? undefined}
            onSaved={handleSaved}
            onDelete={() => editing && handleDelete(editing)}
            onClose={closeForm}
          />
        </Sheet>
      )}
      {undoable.toast}

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
          <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-canvas)] text-[var(--color-muted)]">
              <Repeat size={22} aria-hidden />
            </span>
            <p className="max-w-xs text-sm text-[var(--color-muted)]">
              {t("Nothing recurring yet. Add your salary, rent or subscriptions and they'll be entered for you on each due date.")}
            </p>
          </CardBody>
        </Card>
      )}

      {running.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardBody>
              <p className="text-xs text-[var(--color-muted)]">{t('In per month')}</p>
              <p className="tnum mt-1 text-lg font-bold text-[var(--color-gain)]">
                {formatTHB(monthlyIn)}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs text-[var(--color-muted)]">{t('Out per month')}</p>
              <p className="tnum mt-1 text-lg font-bold text-[var(--color-ink)]">
                {formatTHB(monthlyOut)}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {sorted.length > 0 && (
        <Card>
          <CardBody className="divide-y divide-[var(--color-line)] p-0 px-4">
            {sorted.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onEdit={(r) => {
                  setEditing(r)
                  setFormOpen(true)
                }}
              />
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
