import { Link } from 'react-router-dom'
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
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import {
  accounts,
  assetClassColors,
  assetClassLabels,
  cashFlowHistory,
  categoryById,
  holdings,
  netWorthHistory,
  totalAssetsTHB,
  totalDebtTHB,
  transactions,
} from '@/data/mock'
import {
  formatDate,
  formatPercent,
  formatSignedTHB,
  formatTHB,
  formatTHBCompact,
} from '@/lib/format'
import type { AssetClass } from '@/types'

// ---- derived view data (mock-backed; API later) ---------------------------

const current = netWorthHistory[netWorthHistory.length - 1]
const previous = netWorthHistory[netWorthHistory.length - 2]
const delta = current.value - previous.value
const deltaPct = (delta / previous.value) * 100

const thisMonth = cashFlowHistory[cashFlowHistory.length - 1]
const netCashFlow = thisMonth.income - thisMonth.expense

// Allocation: holdings by asset class + cash from bank/cash accounts.
const cashTHB = accounts
  .filter((a) => a.type === 'bank' || a.type === 'cash')
  .reduce((s, a) => s + a.balanceTHB, 0)

const classTotals = holdings.reduce<Partial<Record<AssetClass, number>>>(
  (acc, h) => {
    acc[h.assetClass] = (acc[h.assetClass] ?? 0) + h.marketValueTHB
    return acc
  },
  {},
)

const allocation = [
  ...Object.entries(classTotals).map(([k, value]) => ({
    key: k as AssetClass,
    value: value ?? 0,
  })),
  { key: 'cash' as AssetClass, value: cashTHB },
]
const allocationTotal = allocation.reduce((s, a) => s + a.value, 0)

const recent = transactions.slice(0, 4)

// ----------------------------------------------------------------------------

export function Dashboard() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          Good evening, Pong
        </h1>
      </div>

      {/* Net worth hero */}
      <section
        aria-label="Net worth"
        className="rounded-2xl bg-brand-600 p-5 text-white shadow-[var(--shadow-card)]"
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-100">
          Net worth
        </p>
        <p className="tnum mt-1 text-[34px] font-bold leading-tight">
          {formatTHB(current.value)}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="tnum rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
            {delta >= 0 ? '▲' : '▼'} {formatSignedTHB(delta)} (
            {formatPercent(deltaPct)})
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
              {formatTHBCompact(totalAssetsTHB)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              Debts
            </p>
            <p className="tnum text-[22px] font-bold text-[var(--color-loss)]">
              {formatTHBCompact(totalDebtTHB)}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Cash flow */}
      <Card>
        <CardHeader
          title={`Cash flow — ${thisMonth.month}`}
          action={
            <span className="tnum text-sm font-bold text-[var(--color-gain)]">
              {formatSignedTHB(netCashFlow)}
            </span>
          }
        />
        <CardBody>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowHistory} barGap={2}>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  formatter={(value) => formatTHB(Number(value))}
                  cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                />
                {/* token colors: brand-500 / loss */}
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Asset allocation */}
      <Card>
        <CardHeader title="Asset allocation" />
        <CardBody className="flex items-center gap-4">
          <div className="h-36 w-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocation}
                  dataKey="value"
                  nameKey="key"
                  innerRadius="62%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                >
                  {allocation.map((slice) => (
                    <Cell
                      key={slice.key}
                      fill={assetClassColors[slice.key]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {allocation.map((slice) => (
              <li
                key={slice.key}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex items-center gap-1.5 text-[var(--color-muted)]">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: assetClassColors[slice.key] }}
                    aria-hidden
                  />
                  {assetClassLabels[slice.key]}
                </span>
                <span className="tnum font-semibold text-[var(--color-ink)]">
                  {((slice.value / allocationTotal) * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

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
          {recent.map((t) => {
            const cat = categoryById[t.categoryId]
            const isIncome = t.type === 'income'
            return (
              <div key={t.id} className="flex items-center gap-3 py-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${cat.color}1f`, color: cat.color }}
                >
                  <Icon name={cat.icon} size={16} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
                    {t.note ?? cat.name}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {cat.name} · {formatDate(t.date)}
                    {t.recurring && ' · ⟳'}
                  </p>
                </div>
                <span
                  className={
                    'tnum text-sm font-semibold ' +
                    (isIncome
                      ? 'text-[var(--color-gain)]'
                      : 'text-[var(--color-ink)]')
                  }
                >
                  {formatSignedTHB(isIncome ? t.amount : -t.amount)}
                </span>
              </div>
            )
          })}
        </CardBody>
      </Card>

      <div className="pb-2 text-center">
        <Badge tone="neutral">Mock data — API wiring lands later</Badge>
      </div>
    </div>
  )
}
