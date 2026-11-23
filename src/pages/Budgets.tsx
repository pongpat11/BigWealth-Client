import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Sheet } from '@/components/ui/Sheet'
import { reinsert, useUndoableDelete } from '@/lib/useUndoableDelete'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ApiError } from '@/lib/api'
import {
  createBudget,
  deleteBudget,
  getBudgets,
  updateBudget,
  type Budget,
  type BudgetOverview,
} from '@/lib/budgets'
import { listCategories, type Category } from '@/lib/categories'
import { formatMonth, formatTHB, monthKey, shiftMonth } from '@/lib/format'
import { t } from '@/lib/i18n'

const FALLBACK_COLOR = '#94a3b8'
const selectClass =
  'h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500'

function pctOf(spent: number, limit: number): number {
  return limit > 0 ? Math.round((spent / limit) * 100) : 0
}

/** "฿6,070 left" or "฿390 over". */
function remainingLabel(spent: number, limit: number): string {
  const left = limit - spent
  return left >= 0 ? `${formatTHB(left)} left` : `${formatTHB(-left)} over`
}

function BudgetForm({
  initial,
  categories,
  month,
  onSaved,
  onDelete,
  onClose,
}: {
  initial?: Budget
  /** Expense categories that don't have a budget yet (new budgets only). */
  categories: Category[]
  month: string
  onSaved: (b: Budget) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [limit, setLimit] = useState(initial ? String(initial.limit) : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = Number(limit)
    if (!initial && !categoryId) {
      setError(t('Pick a category.'))
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('Enter a limit greater than 0.'))
      return
    }
    setError(null)
    setSaving(true)
    try {
      const saved = initial
        ? await updateBudget(initial.id, value, month)
        : await createBudget({ categoryId, limit: value }, month)
      onSaved(saved)
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
            {initial ? t('Edit budget — {name}', { name: initial.category.name }) : t('New budget')}
          </p>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]">
              {error}
            </p>
          )}

          {!initial && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="budget-category"
                className="text-[13px] font-medium text-[var(--color-muted)]"
              >
                {t('Category')}
              </label>
              <select
                id="budget-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={selectClass}
              >
                <option value="">{t('Select…')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            id="budget-limit"
            label={t('Monthly limit (฿)')}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? t('Saving…') : initial ? t('Save changes') : t('Add budget')}
            </Button>
          </div>

          {initial && (
            <DeleteButton
              variant="block"
              label={t('Remove budget')}
              onClick={onDelete}
              disabled={saving}
            />
          )}
        </form>
      </CardBody>
    </Card>
  )
}

function BudgetRow({ budget, onEdit }: { budget: Budget; onEdit: (b: Budget) => void }) {
  const color = budget.category.color ?? FALLBACK_COLOR
  const pct = pctOf(budget.spent, budget.limit)
  const over = budget.spent > budget.limit
  return (
    <button
      type="button"
      onClick={() => onEdit(budget)}
      aria-label={t('Edit {name} budget', { name: budget.category.name })}
      className="flex w-full items-center gap-3 py-3.5 text-left transition-colors hover:bg-[var(--color-canvas)]"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: color + '20', color }}
      >
        <Icon name={budget.category.icon ?? 'Circle'} size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
            {budget.category.name}
          </p>
          <p className="tnum shrink-0 text-xs text-[var(--color-muted)]">
            <span className="font-semibold text-[var(--color-ink)]">
              {formatTHB(budget.spent)}
            </span>{' '}
            / {formatTHB(budget.limit)}
          </p>
        </div>
        <ProgressBar value={budget.spent} max={budget.limit} />
        <p
          className={
            'tnum flex items-center gap-1 text-xs ' +
            (over ? 'font-medium text-[var(--color-loss)]' : 'text-[var(--color-muted)]')
          }
        >
          {over && <AlertTriangle size={12} aria-hidden />}
          {pct}% · {remainingLabel(budget.spent, budget.limit)}
        </p>
      </div>
    </button>
  )
}

export function Budgets() {
  const [month, setMonth] = useState(() => monthKey())
  const [overview, setOverview] = useState<BudgetOverview | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    getBudgets(month)
      .then((data) => {
        if (!active) return
        setOverview(data)
        setError(null)
      })
      .catch(
        (err) =>
          active &&
          setError(err instanceof ApiError ? err.message : t('Could not load budgets.')),
      )
    return () => {
      active = false
    }
  }, [month, reloadKey])

  useEffect(() => {
    let active = true
    listCategories()
      .then((rows) => active && setCategories(rows))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  // Only top-level expense categories that aren't budgeted yet can be added.
  const available = useMemo(() => {
    const taken = new Set((overview?.items ?? []).map((b) => b.categoryId))
    return categories.filter((c) => c.kind === 'expense' && !c.parentId && !taken.has(c.id))
  }, [categories, overview])

  function changeMonth(delta: number) {
    setOverview(null)
    setMonth((m) => shiftMonth(m, delta))
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  // Totals come from the server, so refetch after any change.
  function handleChanged() {
    closeForm()
    setReloadKey((k) => k + 1)
  }

  const undoable = useUndoableDelete()

  function handleDelete(budget: Budget) {
    closeForm()
    const index = (overview?.items ?? []).findIndex((b) => b.id === budget.id)
    const setItems = (fn: (items: Budget[]) => Budget[]) =>
      setOverview((o) => (o ? { ...o, items: fn(o.items) } : o))
    undoable.remove({
      message: t('Removed {name} budget', { name: budget.category.name }),
      hide: () => setItems((items) => items.filter((b) => b.id !== budget.id)),
      restore: () => setItems((items) => reinsert(items, budget, index)),
      commit: () => deleteBudget(budget.id),
      onCommitted: () => setReloadKey((k) => k + 1),
    })
  }

  const items = overview?.items ?? []
  const totalPct = overview ? pctOf(overview.totalSpent, overview.totalLimit) : 0

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Budgets')}
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

      {/* Month picker */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5">
        <button
          type="button"
          aria-label={t('Previous month')}
          onClick={() => changeMonth(-1)}
          className="flex size-9 items-center justify-center rounded-xl text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <p className="text-sm font-semibold text-[var(--color-ink)]" aria-live="polite">
          {formatMonth(month)}
        </p>
        <button
          type="button"
          aria-label={t('Next month')}
          onClick={() => changeMonth(1)}
          className="flex size-9 items-center justify-center rounded-xl text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      {formOpen && (
        <Sheet label={editing ? t('Edit budget') : t('New budget')} onClose={closeForm}>
          <BudgetForm
            key={editing?.id ?? 'new'}
            initial={editing ?? undefined}
            categories={available}
            month={month}
            onSaved={handleChanged}
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

      {!error && overview === null && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">{t('Loading…')}</p>
          </CardBody>
        </Card>
      )}

      {overview !== null && items.length === 0 && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-canvas)] text-[var(--color-muted)]">
              <Wallet size={22} aria-hidden />
            </span>
            <p className="text-sm text-[var(--color-muted)]">
              {t('No budgets yet. Set a monthly limit for a category to track your spending.')}
            </p>
          </CardBody>
        </Card>
      )}

      {overview !== null && items.length > 0 && (
        <>
          <Card>
            <CardBody className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                {t('Spent this month')}
              </p>
              <p className="tnum text-[22px] font-bold text-[var(--color-ink)]">
                {formatTHB(overview.totalSpent)}{' '}
                <span className="text-sm font-medium text-[var(--color-muted)]">
                  / {formatTHB(overview.totalLimit)}
                </span>
              </p>
              <ProgressBar value={overview.totalSpent} max={overview.totalLimit} />
              <p className="tnum text-xs text-[var(--color-muted)]">
                {totalPct}% · {remainingLabel(overview.totalSpent, overview.totalLimit)}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="divide-y divide-[var(--color-line)] py-0">
              {items.map((b) => (
                <BudgetRow
                  key={b.id}
                  budget={b}
                  onEdit={(budget) => {
                    setEditing(budget)
                    setFormOpen(true)
                  }}
                />
              ))}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
