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
  listTransactions,
  type Transaction,
} from '@/lib/transactions'

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function AddTransactionForm({
  onAdded,
  onClose,
}: {
  onAdded: (t: Transaction) => void
  onClose: () => void
}) {
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(todayInputValue())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const options = useMemo(
    () => categories.filter((c) => c.kind === type),
    [type],
  )

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
    try {
      const created = await createTransaction({
        type,
        amount: value,
        category,
        note: note.trim() || undefined,
        date: new Date(date).toISOString(),
      })
      onAdded(created)
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
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-[var(--color-loss)]">
              {error}
            </p>
          )}

          {/* Type toggle */}
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

          <Input
            id="amount"
            label="Amount (฿)"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className="text-[13px] font-medium text-[var(--color-muted)]">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500"
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
              {saving ? 'Saving…' : 'Add transaction'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const cat = categoryById[tx.category]
  const positive = tx.type === 'income'
  return (
    <div className="flex items-center gap-3 py-3">
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
        {formatTHB(tx.amount)}
      </span>
    </div>
  )
}

export function Transactions() {
  const [items, setItems] = useState<Transaction[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    let active = true
    listTransactions()
      .then((rows) => active && setItems(rows))
      .catch((err) =>
        active &&
        setError(err instanceof ApiError ? err.message : 'Could not load transactions.'),
      )
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transactions"
        action={
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} aria-hidden />
            Add
          </Button>
        }
      />

      {showForm && (
        <AddTransactionForm
          onAdded={(t) => {
            setItems((prev) => [t, ...(prev ?? [])])
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
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
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
