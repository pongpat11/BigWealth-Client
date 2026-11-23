import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { ApiError } from '@/lib/api'
import { deleteAccount, listAccounts, type Account } from '@/lib/accounts'
import { formatDateTime } from '@/lib/format'
import { listTransactionPage, type Transaction } from '@/lib/transactions'
import { ACCOUNT_TYPES, formatMoney } from '@/lib/accountMeta'
import { AccountForm } from './Accounts'

const FALLBACK_COLOR = '#94a3b8'
const PAGE_SIZE = 30

function TxRow({ tx }: { tx: Transaction }) {
  const cat = tx.category
  const income = tx.type === 'income'
  return (
    <div className="flex items-center gap-3 py-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: (cat?.color ?? FALLBACK_COLOR) + '20',
          color: cat?.color ?? '#64748b',
        }}
      >
        <Icon name={cat?.icon ?? 'Circle'} size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
          {tx.note || cat?.name || 'Uncategorized'}
        </p>
        <p className="truncate text-xs text-[var(--color-muted)]">
          {cat?.name ?? 'Uncategorized'} · {formatDateTime(tx.date, tx.timezone)}
        </p>
      </div>
      <span
        className={
          'tnum shrink-0 text-sm font-semibold ' +
          (income ? 'text-[var(--color-gain)]' : 'text-[var(--color-ink)]')
        }
      >
        {income ? '+' : '−'}
        {formatMoney(tx.amount, tx.currency === 'USD' ? 'USD' : 'THB')}
      </span>
    </div>
  )
}

/** One account: balance, details and its transactions, newest first. */
export function AccountDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [account, setAccount] = useState<Account | null | undefined>(undefined)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let live = true
    Promise.all([listAccounts(), listTransactionPage({ accountId: id }, undefined, PAGE_SIZE)])
      .then(([accounts, page]) => {
        if (!live) return
        setAccount(accounts.find((a) => a.id === id) ?? null)
        setTxs(page.items)
        setCursor(page.nextCursor)
      })
      .catch(
        (err) =>
          live && setError(err instanceof ApiError ? err.message : 'Could not load this account.'),
      )
    return () => {
      live = false
    }
  }, [id])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const page = await listTransactionPage({ accountId: id }, cursor, PAGE_SIZE)
      setTxs((prev) => [...prev, ...page.items])
      setCursor(page.nextCursor)
    } catch {
      setError('Could not load more transactions.')
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleDelete() {
    if (!account) return
    try {
      await deleteAccount(account.id)
      navigate('/accounts', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this account.')
    }
  }

  const back = (
    <Link
      to="/accounts"
      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
    >
      <ArrowLeft size={16} aria-hidden />
      Accounts
    </Link>
  )

  if (error && account === undefined) {
    return (
      <div className="space-y-4 pt-2">
        {back}
        <Card>
          <CardBody>
            <p role="alert" className="text-sm text-[var(--color-loss)]">
              {error}
            </p>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (account === undefined) {
    return (
      <div className="space-y-4 pt-2">
        {back}
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">Loading…</p>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (account === null) {
    return (
      <div className="space-y-4 pt-2">
        {back}
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">This account doesn't exist anymore.</p>
          </CardBody>
        </Card>
      </div>
    )
  }

  const isDebt = account.type === 'debt'
  const typeLabel = ACCOUNT_TYPES.find((t) => t.value === account.type)?.label ?? account.type
  const details: [string, string][] = [
    ['Type', typeLabel],
    ['Currency', account.currency],
    [isDebt ? 'Owed at setup' : 'Starting balance', formatMoney(account.balance, account.currency)],
    ...(account.interestRate != null ? [['Interest', `${account.interestRate}% a year`] as [string, string]] : []),
    ...(account.minPayment != null
      ? [['Minimum payment', `${formatMoney(account.minPayment, account.currency)}/mo`] as [string, string]]
      : []),
  ]

  return (
    <div className="space-y-4 pt-2">
      {back}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            {account.name}
          </h1>
          {account.institution && (
            <p className="truncate text-sm text-[var(--color-muted)]">{account.institution}</p>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          <Pencil size={14} aria-hidden />
          Edit
        </Button>
      </div>

      {editing && (
        <Sheet label="Edit account" onClose={() => setEditing(false)}>
          <AccountForm
            initial={account}
            onSaved={(a) => {
              setAccount(a)
              setEditing(false)
            }}
            onDelete={handleDelete}
            onClose={() => setEditing(false)}
          />
        </Sheet>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]">
          {error}
        </p>
      )}

      <section
        aria-label="Balance"
        className="rounded-2xl bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]"
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
          {isDebt ? 'Owed' : 'Balance'}
        </p>
        <p
          className={
            'tnum mt-1 text-[30px] font-bold leading-tight ' +
            (isDebt ? 'text-[var(--color-loss)]' : 'text-[var(--color-ink)]')
          }
        >
          {formatMoney(isDebt ? -account.currentBalance : account.currentBalance, account.currency)}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {details.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-[var(--color-muted)]">{k}</dt>
              <dd className="tnum font-medium text-[var(--color-ink)]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Card>
        <CardHeader title="Transactions" />
        <CardBody className="divide-y divide-[var(--color-line)] p-0 px-4">
          {txs.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-muted)]">
              No transactions in this account yet.
            </p>
          ) : (
            txs.map((tx) => <TxRow key={tx.id} tx={tx} />)
          )}
        </CardBody>
      </Card>
      {cursor && (
        <Button variant="secondary" className="w-full" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
