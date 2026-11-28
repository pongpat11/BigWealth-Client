import { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { ApiError } from '@/lib/api'
import {
  fetchCsv,
  getTaxSummary,
  presetRange,
  saveTextFile,
  type CsvKind,
  type RangePreset,
  type TaxCategory,
  type TaxSummary,
} from '@/lib/exports'
import { formatDateTime, formatTHBPrecise } from '@/lib/format'
import { t } from '@/lib/i18n'

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'thisMonth', label: t('This month') },
  { value: 'lastMonth', label: t('Last month') },
  { value: 'thisYear', label: t('This year') },
  { value: 'lastYear', label: t('Last year') },
]

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

function CsvCard() {
  const [range, setRange] = useState(() => presetRange('thisYear'))
  const [busy, setBusy] = useState<CsvKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const invalid = !range.from || !range.to || range.from > range.to

  async function download(kind: CsvKind) {
    setBusy(kind)
    setError(null)
    try {
      const csv = await fetchCsv(kind, range.from, range.to)
      saveTextFile(`bigwealth-${kind}-${range.from}-to-${range.to}.csv`, csv)
    } catch (err) {
      setError(errorText(err, t('Could not export. Try again.')))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="print:hidden">
      <CardHeader title={t('Download CSV')} />
      <CardBody className="space-y-4">
        <p className="text-sm text-[var(--color-muted)]">
          {t('Opens in Excel, Numbers or Google Sheets.')}
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('Date range')}>
          {PRESETS.map((p) => {
            const r = presetRange(p.value)
            const active = r.from === range.from && r.to === range.to
            return (
              <button
                key={p.value}
                type="button"
                aria-pressed={active}
                onClick={() => setRange(r)}
                className={
                  'rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ' +
                  (active
                    ? 'bg-brand-600 text-white'
                    : 'border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]')
                }
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="export-from"
            type="date"
            label={t('From')}
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
          <Input
            id="export-to"
            type="date"
            label={t('To')}
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
        {invalid && (
          <p className="text-sm text-[var(--color-loss)]">{t('Pick a start date on or before the end date.')}</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-[var(--color-loss)]">
            {error}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => download('transactions')} disabled={invalid || busy !== null}>
            <Download size={16} aria-hidden />
            {busy === 'transactions' ? t('Exporting…') : t('Transactions CSV')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => download('dividends')}
            disabled={invalid || busy !== null}
          >
            <Download size={16} aria-hidden />
            {busy === 'dividends' ? t('Exporting…') : t('Dividends CSV')}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function CategoryTable({ caption, rows, total }: { caption: string; rows: TaxCategory[]; total: number }) {
  return (
    <table className="w-full text-sm">
      <caption className="mb-1 text-left text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
        {caption}
      </caption>
      <tbody className="divide-y divide-[var(--color-line)]">
        {rows.length === 0 && (
          <tr>
            <td className="py-2 text-[var(--color-muted)]" colSpan={2}>
              {t('None')}
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.categoryId ?? 'none'}>
            <td className="py-2 text-[var(--color-ink)]">{r.categoryId ? r.name : t('Uncategorized')}</td>
            <td className="tnum py-2 text-right text-[var(--color-ink)]">{formatTHBPrecise(r.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-[var(--color-line)] font-semibold">
          <td className="py-2 text-[var(--color-ink)]">{t('Total')}</td>
          <td className="tnum py-2 text-right text-[var(--color-ink)]">{formatTHBPrecise(total)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

function TaxReport({ summary }: { summary: TaxSummary }) {
  const d = summary.dividends
  const money = (amount: number, currency: string) =>
    currency === 'THB'
      ? formatTHBPrecise(amount)
      : `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
  const thb = (v: number | null) => (v === null ? '—' : formatTHBPrecise(v))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-ink)]">
          {t('Tax summary {year}', { year: summary.year })}
        </h2>
        <p className="text-xs text-[var(--color-muted)]">
          {t('Generated {date} · BigWealth', { date: formatDateTime(summary.generatedAt) })}
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">{t('Dividends')}</h3>
        {d.bySymbol.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">{t('No dividends this year.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-muted)]">
                  <th className="py-1.5 font-medium">{t('Symbol')}</th>
                  <th className="py-1.5 text-right font-medium">{t('Gross')}</th>
                  <th className="py-1.5 text-right font-medium">{t('Tax withheld')}</th>
                  <th className="py-1.5 text-right font-medium">{t('Net (THB)')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {d.bySymbol.map((r) => (
                  <tr key={`${r.symbol}-${r.currency}`}>
                    <td className="py-2 font-medium text-[var(--color-ink)]">
                      {r.symbol}
                      {r.count > 1 && (
                        <span className="ml-1 text-xs font-normal text-[var(--color-muted)]">×{r.count}</span>
                      )}
                    </td>
                    <td className="tnum py-2 text-right text-[var(--color-ink)]">{money(r.gross, r.currency)}</td>
                    <td className="tnum py-2 text-right text-[var(--color-ink)]">
                      {money(r.withholdingTax, r.currency)}
                    </td>
                    <td className="tnum py-2 text-right text-[var(--color-ink)]">{thb(r.netTHB)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--color-line)] font-semibold">
                  <td className="py-2 text-[var(--color-ink)]">{t('Total (THB)')}</td>
                  <td className="tnum py-2 text-right text-[var(--color-ink)]">{formatTHBPrecise(d.totalGrossTHB)}</td>
                  <td className="tnum py-2 text-right text-[var(--color-ink)]">{formatTHBPrecise(d.totalTaxTHB)}</td>
                  <td className="tnum py-2 text-right text-[var(--color-ink)]">{formatTHBPrecise(d.totalNetTHB)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {d.fxRate !== null && (
          <p className="text-xs text-[var(--color-muted)]">
            {t('USD converted at ฿{rate} per $1 ({date} reference rate).', {
              rate: d.fxRate.toFixed(2),
              date: d.fxDate ?? '',
            })}
          </p>
        )}
        {d.unconvertedCount > 0 && (
          <p className="text-xs text-[var(--color-loss)]">
            {t('{count} dividends could not be converted to THB and are left out of the totals.', {
              count: d.unconvertedCount,
            })}
          </p>
        )}
      </section>

      <section className="grid items-start gap-6 sm:grid-cols-2 print:grid-cols-2">
        <CategoryTable caption={t('Income (THB)')} rows={summary.income.byCategory} total={summary.income.total} />
        <CategoryTable caption={t('Expenses (THB)')} rows={summary.expense.byCategory} total={summary.expense.total} />
      </section>
      {summary.nonThbTransactionCount > 0 && (
        <p className="text-xs text-[var(--color-muted)]">
          {t('{count} transactions in other currencies are not included.', {
            count: summary.nonThbTransactionCount,
          })}
        </p>
      )}
      <p className="text-xs text-[var(--color-muted)]">
        {t('For your own records. Check the figures against your broker and bank statements before filing.')}
      </p>
    </div>
  )
}

function TaxCard() {
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => thisYear - i)
  // Before April most people are filing for last year.
  const [year, setYear] = useState(() => (new Date().getMonth() < 3 ? thisYear - 1 : thisYear))
  const [summary, setSummary] = useState<TaxSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getTaxSummary(year)
      .then((s) => {
        if (!active) return
        setSummary(s)
        setError(null)
      })
      .catch((err) => active && setError(errorText(err, t('Could not load the tax summary.'))))
    return () => {
      active = false
    }
  }, [year])

  function changeYear(next: number) {
    if (next === year) return
    setSummary(null)
    setError(null)
    setYear(next)
  }

  return (
    <Card className="print:border-0 print:shadow-none">
      <div className="print:hidden">
        <CardHeader title={t('Tax report')} />
      </div>
      <CardBody className="space-y-4 print:p-0">
        <div className="space-y-3 print:hidden">
          <p className="text-sm text-[var(--color-muted)]">
            {t('Dividends with tax withheld, and income and expenses by category, for one calendar year.')}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('Tax year')}>
            {years.map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={y === year}
                onClick={() => changeYear(y)}
                className={
                  'tnum rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ' +
                  (y === year
                    ? 'bg-brand-600 text-white'
                    : 'border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]')
                }
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-[var(--color-loss)]">
            {error}
          </p>
        )}
        {!error && !summary && <p className="text-sm text-[var(--color-muted)]">{t('Loading…')}</p>}
        {summary && (
          <>
            <TaxReport summary={summary} />
            <Button className="w-full print:hidden" onClick={() => window.print()}>
              <Printer size={16} aria-hidden />
              {t('Print or save as PDF')}
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  )
}

/** CSV downloads and a printable yearly tax report. */
export function Export() {
  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <PageHeader title={t('Export')} subtitle={t('Your data as CSV, and a tax report to print')} />
      </div>
      <CsvCard />
      <TaxCard />
    </div>
  )
}
