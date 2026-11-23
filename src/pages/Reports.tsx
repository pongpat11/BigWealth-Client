import { useEffect, useState } from 'react'
import { BarChart3, Download } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ApiError } from '@/lib/api'
import { formatSignedTHB, formatTHB } from '@/lib/format'
import { dateLocale, t } from '@/lib/i18n'
import {
  getReport,
  REPORT_RANGES,
  reportToCsv,
  type Report,
  type ReportRange,
} from '@/lib/reports'

const FALLBACK_COLOR = '#94a3b8'
const RANGE_LABELS: Record<ReportRange, string> = {
  '1M': t('This month'),
  '3M': t('Last 3 months'),
  YTD: t('Year to date'),
  '1Y': t('Last 12 months'),
}
const RANGE_CHIPS: Record<ReportRange, string> = {
  '1M': t('1M'),
  '3M': t('3M'),
  YTD: t('YTD'),
  '1Y': t('1Y'),
}

/** 'YYYY-MM' → 'Jul' (or "Jul '25" when the range spans years). */
function monthLabel(month: string, withYear: boolean): string {
  const [year, m] = month.split('-').map(Number)
  const name = new Date(year, m - 1, 1).toLocaleDateString(dateLocale(), { month: 'short' })
  return withYear ? `${name} '${String(year).slice(2)}` : name
}

function downloadCsv(report: Report) {
  // The BOM makes Excel read the file as UTF-8, so Thai headers aren't garbled.
  const blob = new Blob(['\ufeff' + reportToCsv(report)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `bigwealth-report-${report.range.toLowerCase()}.csv`
  // Safari needs the link in the document, and fetches the blob after click()
  // returns, so the URL must outlive this call.
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  const color =
    tone === 'gain'
      ? 'text-[var(--color-gain)]'
      : tone === 'loss'
        ? 'text-[var(--color-loss)]'
        : 'text-[var(--color-ink)]'
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
        {label}
      </p>
      <p className={`tnum mt-0.5 truncate text-base font-bold ${color}`}>{value}</p>
    </div>
  )
}

export function Reports() {
  const [range, setRange] = useState<ReportRange>('3M')
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getReport(range)
      .then((data) => {
        if (!active) return
        setReport(data)
        setError(null)
      })
      .catch(
        (err) =>
          active && setError(err instanceof ApiError ? err.message : t('Could not load the report.')),
      )
    return () => {
      active = false
    }
  }, [range])

  function changeRange(next: ReportRange) {
    if (next === range) return
    setReport(null)
    setRange(next)
  }

  const months = report?.months ?? []
  const spansYears = new Set(months.map((m) => m.month.slice(0, 4))).size > 1
  const chartData = months.map((m) => ({ ...m, label: monthLabel(m.month, spansYears) }))
  const net = report ? report.totalIncome - report.totalExpense : 0
  const netWorthChange =
    months.length > 1 ? months[months.length - 1].netWorth - months[0].netWorth : null
  const hasActivity = report !== null && (report.totalIncome > 0 || report.totalExpense > 0)
  const topSpend = report?.spendingByCategory[0]?.amount ?? 0

  return (
    <div className="space-y-4">
      <PageHeader title={t('Reports')} subtitle={RANGE_LABELS[range]} />

      <div className="flex gap-2" role="group" aria-label={t('Report range')}>
        {REPORT_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={range === r}
            aria-label={RANGE_LABELS[r]}
            onClick={() => changeRange(r)}
            className={
              'flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ' +
              (range === r
                ? 'bg-brand-600 text-white'
                : 'border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]')
            }
          >
            {RANGE_CHIPS[r]}
          </button>
        ))}
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

      {!error && report === null && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">{t('Loading…')}</p>
          </CardBody>
        </Card>
      )}

      {report !== null && (
        <>
          <Card>
            <CardBody className="grid grid-cols-3 gap-3">
              <Stat label={t('Income')} value={formatTHB(report.totalIncome)} tone="gain" />
              <Stat label={t('Expense')} value={formatTHB(report.totalExpense)} tone="loss" />
              <Stat label={t('Net')} value={formatSignedTHB(net)} tone={net >= 0 ? 'gain' : 'loss'} />
            </CardBody>
          </Card>

          {/* Net worth trend */}
          <Card>
            <CardHeader
              title={t('Net worth')}
              action={
                netWorthChange !== null && (
                  <span
                    className={
                      'tnum text-sm font-bold ' +
                      (netWorthChange >= 0
                        ? 'text-[var(--color-gain)]'
                        : 'text-[var(--color-loss)]')
                    }
                  >
                    {formatSignedTHB(netWorthChange)}
                  </span>
                )
              }
            />
            <CardBody className="space-y-2">
              <p className="tnum text-[22px] font-bold text-[var(--color-ink)]">
                {formatTHB(months[months.length - 1]?.netWorth ?? 0)}
              </p>
              {months.length > 1 && (
                <div className="h-40" aria-hidden>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                      />
                      {/* Fit the axis to the data so small changes stay visible. */}
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip formatter={(value) => formatTHB(Number(value))} />
                      <Area
                        type="monotone"
                        dataKey="netWorth"
                        name="Net worth"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#netWorthFill)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-xs text-[var(--color-muted)]">
                {t("Month-end figures, worked back from today's balances using your recorded transactions.")}
              </p>
            </CardBody>
          </Card>

          {!hasActivity && (
            <Card>
              <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-canvas)] text-[var(--color-muted)]">
                  <BarChart3 size={22} aria-hidden />
                </span>
                <p className="text-sm text-[var(--color-muted)]">
                  {t('No income or spending recorded in this period.')}
                </p>
              </CardBody>
            </Card>
          )}

          {/* Spending by category */}
          {report.spendingByCategory.length > 0 && (
            <Card>
              <CardHeader title={t('Spending by category')} />
              <CardBody>
                <ul className="space-y-3">
                  {report.spendingByCategory.map((c) => {
                    const share =
                      report.totalExpense > 0 ? (c.amount / report.totalExpense) * 100 : 0
                    return (
                      <li key={c.categoryId ?? 'none'} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-medium text-[var(--color-ink)]">
                            {c.name}
                          </span>
                          <span className="tnum shrink-0 text-xs text-[var(--color-muted)]">
                            <span className="font-semibold text-[var(--color-ink)]">
                              {formatTHB(c.amount)}
                            </span>{' '}
                            · {Math.round(share)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-canvas)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${topSpend > 0 ? (c.amount / topSpend) * 100 : 0}%`,
                              backgroundColor: c.color ?? FALLBACK_COLOR,
                            }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </CardBody>
            </Card>
          )}

          {/* Income vs expense per month */}
          {hasActivity && (
            <Card>
              <CardHeader title={t('Income vs expense')} />
              <CardBody>
                <div className="h-44" aria-hidden>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={2}>
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
                      <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Expense" fill="#e11d48" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Text alternative to the chart. */}
                <table className="sr-only">
                  <caption>{t('Income and expense by month')}</caption>
                  <thead>
                    <tr>
                      <th>{t('Month')}</th>
                      <th>{t('Income')}</th>
                      <th>{t('Expense')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((m) => (
                      <tr key={m.month}>
                        <td>{m.label}</td>
                        <td>{formatTHB(m.income)}</td>
                        <td>{formatTHB(m.expense)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )}

          <Button variant="secondary" className="w-full" onClick={() => downloadCsv(report)}>
            <Download size={16} aria-hidden />
            {t('Export CSV')}
          </Button>
        </>
      )}
    </div>
  )
}
