import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Landmark, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { Sheet } from '@/components/ui/Sheet'
import { reinsert, useUndoableDelete } from '@/lib/useUndoableDelete'
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

import { ACCOUNT_TYPES, formatMoney } from '@/lib/accountMeta'

const CURRENCIES: Currency[] = ['THB', 'USD']

const selectClass =
  'h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500'


/** A debt balance counts against net worth; everything else adds to it. */
function signedBalance(a: Account): number {
  return a.type === 'debt' ? -a.currentBalance : a.currentBalance
}

export function AccountForm({
  initial,
  onSaved,
  onDelete,
  onClose,
}: {
  initial?: Account
  onSaved: (a: Account, isEdit: boolean) => void
  onDelete?: () => void
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
            <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {ACCOUNT_TYPES.map(({ value, label, icon: IconCmp }) => (
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

          {isEdit && onDelete && (
            <DeleteButton
              variant="block"
              label="Delete account"
              onClick={onDelete}
              disabled={saving}
            />
          )}
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
  const isDebt = account.type === 'debt'
  const shown = isDebt ? -account.currentBalance : account.currentBalance

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <Link to={`/accounts/${account.id}`} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
          {account.name}
        </p>
        {account.institution && (
          <p className="truncate text-xs text-[var(--color-muted)]">
            {account.institution}
          </p>
        )}
      </Link>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${account.name}`}
        className="-mx-1 rounded-lg p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        <Pencil size={16} aria-hidden />
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
        <DeleteButton label={`Delete ${account.name}`} onClick={onDelete} className="-mr-2" />
      </div>
    </div>
  )
}

export function Accounts() {
  const [items, setItems] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const undoable = useUndoableDelete()

  // The detail screen deletes by coming back here with the account id in
  // router state, so the delete gets the same Undo window as one made here.
  const location = useLocation()
  const navigate = useNavigate()
  const handedOverId = useRef(
    (location.state as { deleteAccountId?: string } | null)?.deleteAccountId,
  )

  useEffect(() => {
    let active = true
    listAccounts()
      .then((rows) => {
        if (!active) return
        setItems(rows)
        const toDelete = handedOverId.current
        if (!toDelete) return
        handedOverId.current = undefined
        // Drop the state so a reload or back/forward doesn't delete again.
        navigate('.', { replace: true, state: null })
        const index = rows.findIndex((a) => a.id === toDelete)
        if (index >= 0) handleDelete(rows[index], index)
      })
      .catch(
        (err) =>
          active &&
          setError(err instanceof ApiError ? err.message : 'Could not load accounts.'),
      )
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [])

  const netWorth = useMemo(
    () => (items ?? []).reduce((sum, a) => sum + signedBalance(a), 0),
    [items],
  )

  const grouped = useMemo(() => {
    const all = items ?? []
    return ACCOUNT_TYPES.map((t) => ({
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

  function handleDelete(
    account: Account,
    index = (items ?? []).findIndex((a) => a.id === account.id),
  ) {
    setEditingId(null)
    undoable.remove({
      message: `Deleted “${account.name}”`,
      hide: () => setItems((list) => (list ?? []).filter((a) => a.id !== account.id)),
      restore: () => setItems((list) => reinsert(list ?? [], account, index)),
      commit: () => deleteAccount(account.id),
    })
  }

  const editingAccount = items?.find((a) => a.id === editingId)

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
        <Sheet label="New account" onClose={() => setAdding(false)}>
          <AccountForm
            onSaved={(a) => {
              upsert(a)
              setAdding(false)
            }}
            onClose={() => setAdding(false)}
          />
        </Sheet>
      )}
      {editingAccount && (
        <Sheet label="Edit account" onClose={() => setEditingId(null)}>
          <AccountForm
            key={editingAccount.id}
            initial={editingAccount}
            onSaved={(a) => {
              upsert(a)
              setEditingId(null)
            }}
            onDelete={() => handleDelete(editingAccount)}
            onClose={() => setEditingId(null)}
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
                {group.accounts.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    onEdit={() => {
                      setEditingId(account.id)
                      setAdding(false)
                    }}
                    onDelete={() => handleDelete(account)}
                  />
                ))}
              </CardBody>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
