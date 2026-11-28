import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { ApiError } from '@/lib/api'
import { listAccounts, type Account } from '@/lib/accounts'
import { formatDateTime, formatPercent } from '@/lib/format'
import { deleteHolding, getPortfolio, holdingQuantityText, type Holding } from '@/lib/portfolio'
import { useDeletedHolding } from '@/lib/holdingHandoff'
import { useUndoableDelete } from '@/lib/useUndoableDelete'
import {
  listTransactionPage,
  transferRoute,
  TRANSFER_COLOR,
  TRANSFER_ICON,
  type Transaction,
} from '@/lib/transactions'
import { ACCOUNT_TYPES, formatMoney } from '@/lib/accountMeta'
import { t } from '@/lib/i18n'
import { AccountForm } from './Accounts'

const FALLBACK_COLOR = '#94a3b8'
const PAGE_SIZE = 30

function TxRow({ tx, accountId }: { tx: Transaction; accountId: string }) {
  const cat = tx.category
  const isTransfer = tx.type === 'transfer'
  // A transfer is money in on its destination account, money out on its source.
  const income = tx.type === 'income' || (isTransfer && tx.toAccountId === accountId)
  const color = isTransfer ? TRANSFER_COLOR : cat?.color
  const label = isTransfer ? t('Transfer') : (cat?.name ?? t('Uncategorized'))
  return (
    <div className="flex items-center gap-3 py-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: (color ?? FALLBACK_COLOR) + '20',
          color: color ?? '#64748b',
        }}
      >
        <Icon name={isTransfer ? TRANSFER_ICON : (cat?.icon ?? 'Circle')} size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
          {tx.note || label}
        </p>
        <p className="truncate text-xs text-[var(--color-muted)]">
          {isTransfer ? `${label} · ${transferRoute(tx)}` : label} ·{' '}
          {formatDateTime(tx.date, tx.timezone)}
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

/** A holding in this account: symbol, quantity, value in its currency, return. */
function HoldingLine({ holding, accountId }: { holding: Holding; accountId: string }) {
  const gain = holding.gainPct
  return (
    <Link
      to={`/portfolio/${holding.id}`}
      // The holding page goes back here rather than to Portfolio.
      state={{ from: `/accounts/${accountId}` }}
      className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-[var(--color-canvas)]"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{holding.symbol}</p>
        <p className="tnum text-xs text-[var(--color-muted)]">
          {holdingQuantityText(holding)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="tnum text-sm font-semibold text-[var(--color-ink)]">
          {formatMoney(holding.marketValue, holding.currency === 'USD' ? 'USD' : 'THB')}
        </p>
        <p
          className={
            'tnum text-xs font-medium ' +
            (gain === null || gain === 0
              ? 'text-[var(--color-muted)]'
              : gain > 0
                ? 'text-[var(--color-gain)]'
                : 'text-[var(--color-loss)]')
          }
        >
          {gain === null ? '—' : `${gain > 0 ? '▲' : gain < 0 ? '▼' : ''} ${formatPercent(gain)}`.trim()}
        </p>
      </div>
    </Link>
  )
}

/** Holdings linked to an investment account, loaded on their own so a slow price feed never holds up the page. */
function AccountHoldings({
  accountId,
  onLoaded,
}: {
  accountId: string
  /** Called once the holdings (and their refreshed prices) are in. */
  onLoaded: () => void
}) {
  const [holdings, setHoldings] = useState<Holding[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // Holdings deleted but still inside their undo window.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    let live = true
    getPortfolio(accountId)
      .then((p) => {
        if (!live) return
        setHoldings(p.holdings)
        onLoaded()
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [accountId, onLoaded, reloadKey])

  // A holding deleted on its own page: hidden here, with the undo toast.
  const undoable = useUndoableDelete()
  useDeletedHolding((holding) => {
    undoable.remove({
      message: t('Deleted {name}', { name: holding.symbol }),
      hide: () => setHidden((s) => new Set(s).add(holding.id)),
      restore: () =>
        setHidden((s) => {
          const next = new Set(s)
          next.delete(holding.id)
          return next
        }),
      commit: () => deleteHolding(holding.id),
      // Reloads the list, and through onLoaded the account's balance.
      onCommitted: () => setReloadKey((k) => k + 1),
    })
  })
  const shown = holdings?.filter((h) => !hidden.has(h.id)) ?? null

  return (
    <Card>
      {undoable.toast}
      <CardHeader
        title={t('Holdings')}
        action={
          <Link
            to={`/portfolio?account=${encodeURIComponent(accountId)}`}
            className="text-sm font-semibold text-brand-600 hover:underline"
          >
            {t('Open in Portfolio')}
          </Link>
        }
      />
      <CardBody className="divide-y divide-[var(--color-line)] p-0 px-4">
        {failed ? (
          <p role="alert" className="py-6 text-center text-sm text-[var(--color-loss)]">
            {t('Could not load holdings.')}
          </p>
        ) : shown === null ? (
          <p className="py-6 text-center text-sm text-[var(--color-muted)]">{t('Loading…')}</p>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-muted)]">
            {t('No holdings in this account yet.')}
          </p>
        ) : (
          shown.map((h) => <HoldingLine key={h.id} holding={h} accountId={accountId} />)
        )}
      </CardBody>
    </Card>
  )
}

/** One account: balance, details and its transactions, newest first. */
export function AccountDetail() {
  const { id = '' } = useParams()
  return <AccountDetailView key={id} id={id} />
}

function AccountDetailView({ id }: { id: string }) {
  const navigate = useNavigate()
  const [account, setAccount] = useState<Account | null | undefined>(undefined)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  // Loading holdings refreshes their prices; reload the account so its
  // holdings value in the balance card matches the list below.
  const reloadAccount = useCallback(() => {
    listAccounts()
      .then((rows) => {
        const a = rows.find((x) => x.id === id)
        if (a) setAccount(a)
      })
      .catch(() => {})
  }, [id])

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
          live && setError(err instanceof ApiError ? err.message : t('Could not load this account.')),
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
      setError(t('Could not load more transactions.'))
    } finally {
      setLoadingMore(false)
    }
  }

  // The list does the delete, with its Undo window and error toast.
  function handleDelete() {
    if (!account) return
    navigate('/accounts', { replace: true, state: { deleteAccountId: account.id } })
  }

  const back = (
    <Link
      to="/accounts"
      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
    >
      <ArrowLeft size={16} aria-hidden />
      {t('Accounts')}
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
            <p className="text-sm text-[var(--color-muted)]">{t('Loading…')}</p>
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
            <p className="text-sm text-[var(--color-muted)]">{t("This account doesn't exist anymore.")}</p>
          </CardBody>
        </Card>
      </div>
    )
  }

  const isDebt = account.type === 'debt'
  const isInvestment = account.type === 'investment'
  const typeLabel = ACCOUNT_TYPES.find((t) => t.value === account.type)?.label ?? account.type
  const details: [string, string][] = [
    [t('Type'), typeLabel],
    [t('Currency'), account.currency],
    [isDebt ? t('Owed at setup') : t('Starting balance'), formatMoney(account.balance, account.currency)],
    ...(account.interestRate != null ? [[t('Interest'), t('{rate}% a year', { rate: account.interestRate })] as [string, string]] : []),
    ...(account.minPayment != null
      ? [[t('Minimum payment'), t('{amount}/mo', { amount: formatMoney(account.minPayment, account.currency) })] as [string, string]]
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
          {t('Edit')}
        </Button>
      </div>

      {editing && (
        <Sheet label={t('Edit account')} onClose={() => setEditing(false)}>
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
        aria-label={t('Balance')}
        className="rounded-2xl bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]"
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
          {isDebt ? t('Owed') : t('Balance')}
        </p>
        <p
          className={
            'tnum mt-1 text-[30px] font-bold leading-tight ' +
            (isDebt ? 'text-[var(--color-loss)]' : 'text-[var(--color-ink)]')
          }
        >
          {formatMoney(account.currentBalance, account.currency)}
        </p>
        {isInvestment && account.cashBalance !== undefined && (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-[var(--color-canvas)] px-3 py-2.5 text-sm">
            <div>
              <dt className="text-xs text-[var(--color-muted)]">{t('Cash')}</dt>
              <dd className="tnum font-medium text-[var(--color-ink)]">
                {formatMoney(account.cashBalance, account.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-muted)]">{t('Holdings')}</dt>
              <dd className="tnum font-medium text-[var(--color-ink)]">
                {formatMoney(account.holdingsValue ?? 0, account.currency)}
              </dd>
            </div>
          </dl>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {details.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-[var(--color-muted)]">{k}</dt>
              <dd className="tnum font-medium text-[var(--color-ink)]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {isInvestment && <AccountHoldings accountId={account.id} onLoaded={reloadAccount} />}

      <Card>
        <CardHeader title={t('Transactions')} />
        <CardBody className="divide-y divide-[var(--color-line)] p-0 px-4">
          {txs.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-muted)]">
              {t('No transactions in this account yet.')}
            </p>
          ) : (
            txs.map((tx) => <TxRow key={tx.id} tx={tx} accountId={id} />)
          )}
        </CardBody>
      </Card>
      {cursor && (
        <Button variant="secondary" className="w-full" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? t('Loading…') : t('Load more')}
        </Button>
      )}
    </div>
  )
}
