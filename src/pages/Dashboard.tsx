import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Landmark, Plus } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ApiError } from '@/lib/api'
import { me } from '@/lib/auth'
import { listAccounts, type Account, type AccountType } from '@/lib/accounts'
import { getDashboardSummary, type DashboardSummary } from '@/lib/dashboard'
import { listTransactions, type Transaction } from '@/lib/transactions'
import {
  formatDate,
  formatSignedTHB,
  formatTHB,
  formatTHBCompact,
} from '@/lib/format'

const FALLBACK_COLOR = '#94a3b8'

// Allocation is by account type until a Portfolio/holdings API exists.
const ALLOCATION_TYPES: { key: Exclude<AccountType, 'debt'>; label: string; color: string }[] = [
  { key: 'cash', label: 'Cash', color: '#94a3b8' },
  { key: 'bank', label: 'Bank', color: '#059669' },
  { key: 'investment', label: 'Investments', color: '#6366f1' },
]

function greetingForNow(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** 'YYYY-MM' → short month label, e.g. '2026-07' → 'Jul'. */
function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'short',
    timeZone: 'UTC',
  })
}

function RecentRow({ tx }: { tx: Transaction }) {
  const cat = tx.category
  const isIncome = tx.type === 'income'
  return (
    <div className="flex items-center gap-3 py-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `${cat?.color ?? FALLBACK_COLOR}1f`,
          color: cat?.color ?? FALLBACK_COLOR,
        }}
      >
        <Icon name={cat?.icon ?? 'Circle'} size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
          {tx.note || cat?.name || 'Uncategorized'}
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          {cat?.name ?? 'Uncategorized'} · {formatDate(tx.date)}
        </p>
      </div>
      <span
        className={
          'tnum text-sm font-semibold ' +
          (isIncome ? 'text-[var(--color-gain)]' : 'text-[var(--color-ink)]')
        }
      >
        {formatSignedTHB(isIncome ? tx.amount : -tx.amount)}
      </span>
    </div>
  )
}

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [recent, setRecent] = useState<Transaction[]>([])
  const [userName, setUserName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([getDashboardSummary(), listAccounts(), listTransactions()])
      .then(([s, accs, txs]) => {
        if (!active) return
        setSummary(s)
        setAccounts(accs)
        setRecent(txs.slice(0, 4))
      })
      .catch(
        (err) =>
          active &&
          setError(err instanceof ApiError ? err.message : 'Could not load your overview.'),
      )
    // Greeting is best-effort; ignore failures.
    me()
      .then((u) => active && setUserName(u.name))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const allocation = useMemo(() => {
    const slices = ALLOCATION_TYPES.map((t) => ({
      ...t,
      value: (accounts ?? [])
        .filter((a) => a.type === t.key)
        .reduce((s, a) => s + a.currentBalance, 0),
    })).filter((s) => s.value > 0)
    const total = slices.reduce((s, x) => s + x.value, 0)
    return { slices, total }
  }, [accounts])

  const loaded = summary !== null && accounts !== null
  const isEmpty = loaded && accounts.length === 0
  const currentMonth = summary ? summary.cashFlow[summary.cashFlow.length - 1] : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          {greetingForNow()}
          {userName ? `, ${userName}` : ''}
        </h1>
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

      {!error && !loaded && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">Loading…</p>
          </CardBody>
        </Card>
      )}

      {isEmpty && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-canvas)] text-[var(--color-muted)]">
              <Landmark size={22} aria-hidden />
            </span>
            <p className="text-sm text-[var(--color-muted)]">
              Track your money by adding your first account.
            </p>
            <Link to="/accounts">
              <Button size="sm">
                <Plus size={16} aria-hidden />
                Add your first account
              </Button>
            </Link>
          </CardBody>
        </Card>
      )}

      {loaded && !isEmpty && summary && (
        <>
          {/* Net worth hero */}
          <section
            aria-label="Net worth"
            className="rounded-2xl bg-brand-600 p-5 text-white shadow-[var(--shadow-card)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-100">
              Net worth
            </p>
            <p className="tnum mt-1 text-[34px] font-bold leading-tight">
              {formatTHB(summary.netWorth)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="tnum rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
                {summary.monthDelta >= 0 ? '▲' : '▼'} {formatSignedTHB(summary.monthDelta)}
              </span>
              <span className="text-xs text-brand-100">this month</span>
            </div>
          </section>

          {/* Assets / Debts stat cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardBody className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                  Assets
                </p>
                <p className="tnum text-[22px] font-bold text-[var(--color-ink)]">
                  {formatTHBCompact(summary.totalAssets)}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                  Debts
                </p>
                <p className="tnum text-[22px] font-bold text-[var(--color-loss)]">
                  {formatTHBCompact(summary.totalDebt)}
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Cash flow */}
          <Card>
            <CardHeader
              title={
                currentMonth ? `Cash flow — ${monthLabel(currentMonth.month)}` : 'Cash flow'
              }
              action={
                <span
                  className={
                    'tnum text-sm font-bold ' +
                    (summary.monthDelta >= 0
                      ? 'text-[var(--color-gain)]'
                      : 'text-[var(--color-loss)]')
                  }
                >
                  {formatSignedTHB(summary.monthDelta)}
                </span>
              }
            />
            <CardBody>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.cashFlow.map((m) => ({ ...m, label: monthLabel(m.month) }))}
                    barGap={2}
                  >
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <Tooltip
                      formatter={(value) => formatTHB(Number(value))}
                      cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                    />
                    {/* token colors: gain / loss */}
                    <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="#e11d48" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          {/* Allocation by account type (asset classes land with Portfolio) */}
          {allocation.slices.length > 0 && (
            <Card>
              <CardHeader title="Allocation" />
              <CardBody className="flex items-center gap-4">
                <div className="h-36 w-36 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocation.slices}
                        dataKey="value"
                        nameKey="label"
                        innerRadius="62%"
                        outerRadius="100%"
                        startAngle={90}
                        endAngle={-270}
                        strokeWidth={0}
                      >
                        {allocation.slices.map((slice) => (
                          <Cell key={slice.key} fill={slice.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 space-y-1.5">
                  {allocation.slices.map((slice) => (
                    <li
                      key={slice.key}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="flex items-center gap-1.5 text-[var(--color-muted)]">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: slice.color }}
                          aria-hidden
                        />
                        {slice.label}
                      </span>
                      <span className="tnum font-semibold text-[var(--color-ink)]">
                        {((slice.value / allocation.total) * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          {/* Recent transactions */}
          <Card>
            <CardHeader
              title="Recent"
              action={
                <Link
                  to="/transactions"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  See all →
                </Link>
              }
            />
            <CardBody className="divide-y divide-[var(--color-line)] p-0 px-4">
              {recent.length === 0 ? (
                <p className="py-3 text-sm text-[var(--color-muted)]">
                  No transactions yet.
                </p>
              ) : (
                recent.map((tx) => <RecentRow key={tx.id} tx={tx} />)
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
