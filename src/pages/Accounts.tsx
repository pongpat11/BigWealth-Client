import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CreditCard, Landmark, Plus, TrendingUp, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatTHB } from '@/lib/format'
import { ApiError } from '@/lib/api'
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
  type Account,
  type AccountType,
} from '@/lib/accounts'
import type { Currency } from '@/types'

const CURRENCIES: Currency[] = ['THB', 'USD']

// Display order + presentation for each account type.
const TYPES: { value: AccountType; label: string; icon: typeof Wallet }[] = [
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'bank', label: 'Bank', icon: Landmark },
  { value: 'investment', label: 'Investment', icon: TrendingUp },
  { value: 'debt', label: 'Debt', icon: CreditCard },
]
const selectClass =
  'h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500'

function formatMoney(amount: number, currency: Currency) {
  if (currency === 'THB') return formatTHB(amount)
  return `${amount.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** A debt balance counts against net worth; everything else adds to it. */
function signedBalance(a: Account): number {
  return a.type === 'debt' ? -a.currentBalance : a.currentBalance
}

function AccountForm({
  initial,
  onSaved,
  onClose,
}: {
  initial?: Account
  onSaved: (a: Account, isEdit: boolean) => void
  onClose: () => void
}) {
  const isEdit = Boolean(initial)
  const [name, setName] = useState(initial?.name ?? '')
  const [institution, setInstitution] = useState(initial?.institution ?? '')
  const [type, setType] = useState<AccountType>(initial?.type ?? 'bank')
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'THB')
  const [balance, setBalance] = useState(
    initial ? String(initial.balance) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Enter a name.')
      return
    }
    const parsed = balance.trim() === '' ? 0 : Number(balance)
    if (!Number.isFinite(parsed)) {
      setError('Enter a valid balance.')
      return
    }
    setError(null)
    setSaving(true)
    const payload = {
      name: name.trim(),
      type,
      institution: institution.trim(),
      currency,
      balance: parsed,
    }
    try {
      const saved = initial
        ? await updateAccount(initial.id, payload)
        : await createAccount(payload)
      onSaved(saved, isEdit)
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
            {isEdit ? 'Edit account' : 'New account'}
          </p>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-[var(--color-loss)]">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {TYPES.map(({ value, label, icon: IconCmp }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={
                  'flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors ' +
                  (type === value
                    ? 'bg-brand-600 text-white'
                    : 'bg-[var(--color-canvas)] text-[var(--color-muted)]')
                }
              >
                <IconCmp size={15} aria-hidden />
                {label}
              </button>
            ))}
          </div>

          <Input
            id="account-name"
            label="Name"
            placeholder="e.g. SCB Savings"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <Input
            id="account-institution"
            label="Institution (optional)"
            placeholder="e.g. SCB"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />

          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                id="account-balance"
                label={type === 'debt' ? 'Starting amount owed' : 'Starting balance'}
                inputMode="decimal"
                placeholder="0"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </div>
            <div className="w-28">
              <label htmlFor="account-currency" className="text-[13px] font-medium text-[var(--color-muted)]">
                Currency
              </label>
              <select
                id="account-currency"
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

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add account'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function AccountRow({
  account,
  onEdit,
  onDelete,
}: {
  account: Account
  onEdit: () => void
  onDelete: () => void
}) {
  const [armed, setArmed] = useState(false)
  const isDebt = account.type === 'debt'
  const shown = isDebt ? -account.currentBalance : account.currentBalance

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
          {account.name}
        </p>
        {account.institution && (
          <p className="truncate text-xs text-[var(--color-muted)]">
            {account.institution}
          </p>
        )}
      </button>
      <div className="flex items-center gap-3">
        <span
          className={
            'tnum text-sm font-semibold ' +
            (isDebt ? 'text-[var(--color-loss)]' : 'text-[var(--color-ink)]')
          }
        >
          {formatMoney(shown, account.currency)}
        </span>
        <button
          type="button"
          onClick={() => (armed ? onDelete() : setArmed(true))}
          onBlur={() => setArmed(false)}
          className={
            'shrink-0 text-xs font-medium transition-colors ' +
            (armed
              ? 'text-[var(--color-loss)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-loss)]')
          }
        >
          {armed ? 'Confirm?' : '×'}
        </button>
      </div>
    </div>
  )
}

export function Accounts() {
  const [items, setItems] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listAccounts()
      .then((rows) => active && setItems(rows))
      .catch(
        (err) =>
          active &&
          setError(err instanceof ApiError ? err.message : 'Could not load accounts.'),
      )
    return () => {
      active = false
    }
  }, [])

  const netWorth = useMemo(
    () => (items ?? []).reduce((sum, a) => sum + signedBalance(a), 0),
    [items],
  )

  const grouped = useMemo(() => {
    const all = items ?? []
    return TYPES.map((t) => ({
      ...t,
      accounts: all.filter((a) => a.type === t.value),
    })).filter((g) => g.accounts.length > 0)
  }, [items])

  function upsert(saved: Account) {
    setItems((prev) => {
      const list = prev ?? []
      return list.some((a) => a.id === saved.id)
        ? list.map((a) => (a.id === saved.id ? saved : a))
        : [...list, saved]
    })
  }

  async function handleDelete(id: string) {
    const prev = items
    setItems((list) => (list ?? []).filter((a) => a.id !== id))
    try {
      await deleteAccount(id)
    } catch (err) {
      setItems(prev) // roll back on failure
      setError(err instanceof ApiError ? err.message : 'Could not delete account.')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounts"
        subtitle="Cash, bank, investments & debts"
        action={
          <Button
            size="sm"
            onClick={() => {
              setAdding((v) => !v)
              setEditingId(null)
            }}
          >
            <Plus size={16} aria-hidden />
            New
          </Button>
        }
      />

      {items !== null && items.length > 0 && (
        <Card>
          <CardBody className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--color-muted)]">Net worth</span>
            <span
              className={
                'tnum text-xl font-bold ' +
                (netWorth < 0 ? 'text-[var(--color-loss)]' : 'text-[var(--color-ink)]')
              }
            >
              {formatTHB(netWorth)}
            </span>
          </CardBody>
        </Card>
      )}

      {adding && (
        <AccountForm
          onSaved={(a) => {
            upsert(a)
            setAdding(false)
          }}
          onClose={() => setAdding(false)}
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

      {items !== null && items.length === 0 && !adding && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-canvas)] text-[var(--color-muted)]">
              <Landmark size={22} aria-hidden />
            </span>
            <p className="text-sm text-[var(--color-muted)]">No accounts yet.</p>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden />
              Add your first account
            </Button>
          </CardBody>
        </Card>
      )}

      {grouped.map((group) => {
        const GroupIcon = group.icon
        return (
          <div key={group.value} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <GroupIcon size={14} className="text-[var(--color-muted)]" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {group.label}
              </p>
            </div>
            <Card>
              <CardBody className="divide-y divide-[var(--color-line)] p-0 px-4">
                {group.accounts.map((account) =>
                  editingId === account.id ? (
                    <div key={account.id} className="py-3">
                      <AccountForm
                        initial={account}
                        onSaved={(a) => {
                          upsert(a)
                          setEditingId(null)
                        }}
                        onClose={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <AccountRow
                      key={account.id}
                      account={account}
                      onEdit={() => {
                        setEditingId(account.id)
                        setAdding(false)
                      }}
                      onDelete={() => handleDelete(account.id)}
                    />
                  ),
                )}
              </CardBody>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
