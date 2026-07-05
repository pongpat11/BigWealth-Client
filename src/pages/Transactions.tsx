import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { categories, categoryById } from '@/data/mock'
import { formatDate, formatTHB } from '@/lib/format'
import { ApiError } from '@/lib/api'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
  type Currency,
  type Transaction,
} from '@/lib/transactions'

const CURRENCIES: Currency[] = ['THB', 'USD']

function formatMoney(amount: number, currency: string) {
  if (currency === 'THB') return formatTHB(amount)
  if (currency === 'USD')
    return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `${amount.toLocaleString()} ${currency}`
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

const selectClass =
  'h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500'

function TransactionForm({
  initial,
  onSaved,
  onDeleted,
  onClose,
}: {
  initial?: Transaction
  onSaved: (t: Transaction, isEdit: boolean) => void
  onDeleted: (id: string) => void
  onClose: () => void
}) {
  const isEdit = Boolean(initial)
  const [type, setType] = useState<'income' | 'expense'>(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [currency, setCurrency] = useState<Currency>(
    (initial?.currency as Currency) ?? 'THB',
  )
  const [category, setCategory] = useState(initial?.category ?? '')
  const [date, setDate] = useState(initial ? initial.date.slice(0, 10) : todayInputValue())
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [armed, setArmed] = useState(false) // two-tap delete confirm

  const options = useMemo(() => categories.filter((c) => c.kind === type), [type])

  async function handleDelete() {
    if (!initial) return
    if (!armed) {
      setArmed(true)
      return
    }
    setError(null)
    setSaving(true)
    try {
      await deleteTransaction(initial.id)
      onDeleted(initial.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete. Try again.')
      setSaving(false)
      setArmed(false)
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than 0.')
      return
    }
    if (!category) {
      setError('Pick a category.')
      return
    }
    setSaving(true)
    const input = {
      type,
      amount: value,
      currency,
      category,
      note: note.trim() || undefined,
      date: new Date(date).toISOString(),
    }
    try {
      const saved = initial
        ? await updateTransaction(initial.id, input)
        : await createTransaction(input)
      onSaved(saved, isEdit)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {isEdit ? 'Edit transaction' : 'New transaction'}
          </p>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-[var(--color-loss)]">
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
                  setCategory('')
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
                label="Amount"
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
                Currency
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
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={selectClass}
            >
              <option value="">Select…</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="date"
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            id="note"
            label="Note (optional)"
            type="text"
            placeholder="e.g. Lunch with team"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add transaction'}
            </Button>
          </div>

          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="w-full rounded-xl py-2 text-sm font-semibold text-[var(--color-loss)] transition-colors hover:bg-rose-50 disabled:opacity-50"
            >
              {armed ? 'Tap again to delete' : 'Delete transaction'}
            </button>
          )}
        </form>
      </CardBody>
    </Card>
  )
}

function TransactionRow({ tx, onEdit }: { tx: Transaction; onEdit: (t: Transaction) => void }) {
  const cat = categoryById[tx.category]
  const positive = tx.type === 'income'
  return (
    <button
      type="button"
      onClick={() => onEdit(tx)}
      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[var(--color-canvas)]"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: (cat?.color ?? '#94a3b8') + '20', color: cat?.color ?? '#64748b' }}
      >
        <Icon name={cat?.icon ?? 'Circle'} size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
          {tx.note || cat?.name || tx.category}
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          {cat?.name ?? tx.category} · {formatDate(tx.date)}
        </p>
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

export function Transactions() {
  const [items, setItems] = useState<Transaction[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  useEffect(() => {
    let active = true
    listTransactions()
      .then((rows) => active && setItems(rows))
      .catch(
        (err) =>
          active &&
          setError(err instanceof ApiError ? err.message : 'Could not load transactions.'),
      )
    return () => {
      active = false
    }
  }, [])

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  function handleSaved(saved: Transaction, isEdit: boolean) {
    setItems((prev) => {
      const list = prev ?? []
      return isEdit ? list.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...list]
    })
    closeForm()
  }

  function handleDeleted(id: string) {
    setItems((prev) => (prev ?? []).filter((t) => t.id !== id))
    closeForm()
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transactions"
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
            Add
          </Button>
        }
      />

      {formOpen && (
        <TransactionForm
          key={editing?.id ?? 'new'}
          initial={editing ?? undefined}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onClose={closeForm}
        />
      )}

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
            <p className="text-sm text-[var(--color-muted)]">Loading…</p>
          </CardBody>
        </Card>
      )}

      {items !== null && items.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">
              No transactions yet. Add your first one.
            </p>
          </CardBody>
        </Card>
      )}

      {items !== null && items.length > 0 && (
        <Card>
          <CardBody className="divide-y divide-[var(--color-line)] py-0">
            {items.map((tx) => (
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
      )}
    </div>
  )
}
