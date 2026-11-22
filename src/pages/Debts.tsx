import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, CreditCard, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Sheet } from '@/components/ui/Sheet'
import { reinsert, useUndoableDelete } from '@/lib/useUndoableDelete'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ApiError } from '@/lib/api'
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
  type Account,
} from '@/lib/accounts'
import { formatTHB } from '@/lib/format'

/** Annual rate at or above which a debt is flagged as expensive. */
const HIGH_RATE = 15

type Strategy = 'snowball' | 'avalanche'
const STRATEGIES: { value: Strategy; label: string; hint: string }[] = [
  { value: 'snowball', label: 'Snowball', hint: 'Smallest balance first — quick wins.' },
  { value: 'avalanche', label: 'Avalanche', hint: 'Highest interest first — costs the least.' },
]

function money(amount: number, currency: string): string {
  return currency === 'THB'
    ? formatTHB(amount)
    : `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
}

/** Payoff order: snowball = smallest balance, avalanche = highest rate. */
function sortDebts(debts: Account[], strategy: Strategy): Account[] {
  return [...debts].sort((a, b) =>
    strategy === 'snowball'
      ? a.currentBalance - b.currentBalance
      : (b.interestRate ?? 0) - (a.interestRate ?? 0) || a.currentBalance - b.currentBalance,
  )
}

/** '' → null (clear); otherwise the parsed number, or NaN when invalid. */
function optionalNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value)
}

function DebtForm({
  initial,
  onSaved,
  onDelete,
  onClose,
}: {
  initial?: Account
  onSaved: (a: Account) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [lender, setLender] = useState(initial?.institution ?? '')
  const [balance, setBalance] = useState(initial ? String(initial.balance) : '')
  const [original, setOriginal] = useState(
    initial?.originalAmount != null ? String(initial.originalAmount) : '',
  )
  const [rate, setRate] = useState(
    initial?.interestRate != null ? String(initial.interestRate) : '',
  )
  const [minPayment, setMinPayment] = useState(
    initial?.minPayment != null ? String(initial.minPayment) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const owed = balance.trim() === '' ? 0 : Number(balance)
    const loan = {
      interestRate: optionalNumber(rate),
      minPayment: optionalNumber(minPayment),
      originalAmount: optionalNumber(original),
    }
    if (!name.trim()) {
      setError('Enter a name.')
      return
    }
    if (!Number.isFinite(owed) || owed < 0) {
      setError('Enter a valid amount owed.')
      return
    }
    if (loan.interestRate !== null && !(loan.interestRate >= 0 && loan.interestRate <= 100)) {
      setError('Interest rate must be between 0 and 100.')
      return
    }
    if (
      (loan.minPayment !== null && !(loan.minPayment >= 0)) ||
      (loan.originalAmount !== null && !(loan.originalAmount >= 0))
    ) {
      setError('Amounts cannot be negative.')
      return
    }
    setError(null)
    setSaving(true)
    const payload = { name: name.trim(), institution: lender.trim(), balance: owed, ...loan }
    try {
      const saved = initial
        ? await updateAccount(initial.id, payload)
        : await createAccount({ ...payload, type: 'debt', currency: 'THB' })
      onSaved(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {initial ? 'Edit debt' : 'New debt'}
          </p>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]">
              {error}
            </p>
          )}
          <Input
            id="debt-name"
            label="Name"
            placeholder="e.g. Car loan"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            id="debt-lender"
            label="Lender (optional)"
            placeholder="e.g. TTB"
            value={lender}
            onChange={(e) => setLender(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="debt-balance"
              label={initial ? 'Starting amount owed' : 'Amount owed'}
              inputMode="decimal"
              placeholder="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
            <Input
              id="debt-original"
              label="Originally borrowed"
              inputMode="decimal"
              placeholder="Optional"
              value={original}
              onChange={(e) => setOriginal(e.target.value)}
            />
            <Input
              id="debt-rate"
              label="Interest rate (% / year)"
              inputMode="decimal"
              placeholder="Optional"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <Input
              id="debt-min"
              label="Minimum payment / month"
              inputMode="decimal"
              placeholder="Optional"
              value={minPayment}
              onChange={(e) => setMinPayment(e.target.value)}
            />
          </div>
          {initial && (
            <p className="text-xs text-[var(--color-muted)]">
              Payments recorded as transactions on this account lower what you owe
              automatically.
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Add debt'}
            </Button>
          </div>

          {initial && (
            <DeleteButton
              variant="block"
              label="Delete debt"
              onClick={onDelete}
              disabled={saving}
            />
          )}
        </form>
      </CardBody>
    </Card>
  )
}

function DebtRow({
  debt,
  order,
  onEdit,
}: {
  debt: Account
  order: number
  onEdit: (a: Account) => void
}) {
  const owed = debt.currentBalance
  const original = debt.originalAmount ?? null
  const paidPct =
    original && original > 0 ? Math.min(Math.max(((original - owed) / original) * 100, 0), 100) : null
  const highRate = (debt.interestRate ?? 0) >= HIGH_RATE
  const terms = [
    debt.interestRate != null ? `${debt.interestRate}%` : null,
    debt.minPayment != null ? `${money(debt.minPayment, debt.currency)}/mo` : null,
  ].filter(Boolean)

  return (
    <button
      type="button"
      onClick={() => onEdit(debt)}
      aria-label={`Edit debt ${debt.name}`}
      className="flex w-full items-start gap-3 py-3.5 text-left transition-colors hover:bg-[var(--color-canvas)]"
    >
      <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-canvas)] text-xs font-semibold text-[var(--color-muted)]">
        {order}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
            {debt.name}
            {debt.institution && (
              <span className="font-normal text-[var(--color-muted)]"> · {debt.institution}</span>
            )}
          </p>
          <span className="tnum shrink-0 text-sm font-semibold text-[var(--color-loss)]">
            {money(owed, debt.currency)}
          </span>
        </div>
        {paidPct !== null && original !== null && (
          <>
            <ProgressBar value={paidPct} max={100} tone="brand" />
            <p className="tnum text-xs text-[var(--color-muted)]">
              {Math.round(paidPct)}% paid off · {money(original, debt.currency)} borrowed
            </p>
          </>
        )}
        {(terms.length > 0 || highRate) && (
          <p className="tnum flex flex-wrap items-center gap-x-2 text-xs text-[var(--color-muted)]">
            {terms.join(' · ')}
            {highRate && (
              <span className="flex items-center gap-1 font-medium text-[var(--color-loss)]">
                <AlertTriangle size={12} aria-hidden />
                High interest
              </span>
            )}
          </p>
        )}
      </div>
    </button>
  )
}

export function Debts() {
  const [debts, setDebts] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [strategy, setStrategy] = useState<Strategy>('avalanche')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)

  useEffect(() => {
    let active = true
    listAccounts()
      .then((rows) => active && setDebts(rows.filter((a) => a.type === 'debt')))
      .catch(
        (err) =>
          active && setError(err instanceof ApiError ? err.message : 'Could not load debts.'),
      )
    return () => {
      active = false
    }
  }, [])

  const ordered = useMemo(() => sortDebts(debts ?? [], strategy), [debts, strategy])
  // Totals are THB only — there's no FX conversion yet.
  const thb = ordered.filter((d) => d.currency === 'THB')
  const totalOwed = thb.reduce((s, d) => s + d.currentBalance, 0)
  const totalMin = thb.reduce((s, d) => s + (d.minPayment ?? 0), 0)
  const foreignCount = ordered.length - thb.length

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  function handleSaved(saved: Account) {
    setDebts((prev) => {
      const list = prev ?? []
      return list.some((a) => a.id === saved.id)
        ? list.map((a) => (a.id === saved.id ? saved : a))
        : [...list, saved]
    })
    closeForm()
  }

  const undoable = useUndoableDelete()

  function handleDelete(debt: Account) {
    closeForm()
    const index = (debts ?? []).findIndex((a) => a.id === debt.id)
    undoable.remove({
      message: `Deleted “${debt.name}”`,
      hide: () => setDebts((prev) => (prev ?? []).filter((a) => a.id !== debt.id)),
      restore: () => setDebts((prev) => reinsert(prev ?? [], debt, index)),
      commit: () => deleteAccount(debt.id),
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Debts"
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
        <Sheet label={editing ? 'Edit debt' : 'New debt'} onClose={closeForm}>
          <DebtForm
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

      {!error && debts === null && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">Loading…</p>
          </CardBody>
        </Card>
      )}

      {debts !== null && debts.length === 0 && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-canvas)] text-[var(--color-muted)]">
              <CreditCard size={22} aria-hidden />
            </span>
            <p className="text-sm text-[var(--color-muted)]">
              No debts tracked. Add a loan or credit card to plan paying it off.
            </p>
          </CardBody>
        </Card>
      )}

      {debts !== null && debts.length > 0 && (
        <>
          <Card>
            <CardBody className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Total owed
              </p>
              <p className="tnum text-[22px] font-bold text-[var(--color-loss)]">
                {formatTHB(totalOwed)}
              </p>
              <p className="tnum text-xs text-[var(--color-muted)]">
                {totalMin > 0 && `Minimum payments ${formatTHB(totalMin)}/mo`}
                {totalMin > 0 && foreignCount > 0 && ' · '}
                {foreignCount > 0 &&
                  `Excludes ${foreignCount} non-THB ${foreignCount === 1 ? 'debt' : 'debts'}`}
              </p>
            </CardBody>
          </Card>

          <div className="space-y-1.5">
            <div className="flex gap-2" role="group" aria-label="Payoff strategy">
              {STRATEGIES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={strategy === s.value}
                  onClick={() => setStrategy(s.value)}
                  className={
                    'flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ' +
                    (strategy === s.value
                      ? 'bg-brand-600 text-white'
                      : 'border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]')
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="px-1 text-xs text-[var(--color-muted)]">
              {STRATEGIES.find((s) => s.value === strategy)?.hint} Pay extra toward #1, minimums
              on the rest.
            </p>
          </div>

          <Card>
            <CardBody className="divide-y divide-[var(--color-line)] py-0">
              {ordered.map((debt, i) => (
                <DebtRow
                  key={debt.id}
                  debt={debt}
                  order={i + 1}
                  onEdit={(a) => {
                    setEditing(a)
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
