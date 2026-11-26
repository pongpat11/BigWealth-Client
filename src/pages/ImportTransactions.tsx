import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Download, FileUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ApiError } from '@/lib/api'
import { listAccounts, type Account } from '@/lib/accounts'
import { listCategories, type Category } from '@/lib/categories'
import {
  CSV_TEMPLATE,
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  decodeCsv,
  guessColumns,
  importTransactions,
  parseCsvRows,
  prepareRows,
  type ColumnMap,
  type CsvRow,
  type ImportField,
  type ImportRowError,
} from '@/lib/csvImport'
import { browserTimezone, formatDateTime, formatTHB } from '@/lib/format'
import { t } from '@/lib/i18n'

const selectClass =
  'h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500'
const labelClass = 'text-[13px] font-medium text-[var(--color-muted)]'

const FIELD_LABELS: Record<ImportField, string> = {
  date: t('Date'),
  type: t('Type'),
  amount: t('Amount'),
  currency: t('Currency'),
  category: t('Category'),
  subCategory: t('Sub-category'),
  account: t('Account'),
  toAccount: t('To account'),
  note: t('Note'),
}

const TYPE_LABELS = { income: t('Income'), expense: t('Expense'), transfer: t('Transfer') }

// Rows shown in the preview / problem lists (the import itself takes all).
const PREVIEW_ROWS = 50

function downloadTemplate() {
  const blob = new Blob([String.fromCharCode(0xfeff) + CSV_TEMPLATE], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'bigwealth-import-template.csv'
  a.click()
  // Let the browser start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Import transactions from a CSV file: pick, map columns, check, import. */
export function ImportTransactions() {
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [fileName, setFileName] = useState('')
  const [header, setHeader] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<CsvRow[]>([])
  const [columns, setColumns] = useState<ColumnMap | null>(null)
  const [expenseCategoryId, setExpenseCategoryId] = useState('')
  const [incomeCategoryId, setIncomeCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  // '' = detect from the file; otherwise the order of slash dates.
  const [dateOrder, setDateOrder] = useState<'' | 'dmy' | 'mdy'>('')

  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([listCategories(), listAccounts()])
      .then(([cats, accs]) => {
        setCategories(cats)
        setAccounts(accs)
      })
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : t('Could not load data.')),
      )
  }, [])

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // picking the same file again re-reads it
    if (!file) return
    setError(null)
    setImported(null)
    const rows = parseCsvRows(decodeCsv(await file.arrayBuffer()))
    if (rows.length < 2) {
      setError(t('The file has no rows to import.'))
      return
    }
    setFileName(file.name)
    setHeader(rows[0].cells)
    setDataRows(rows.slice(1))
    setColumns(guessColumns(rows[0].cells))
    setDateOrder('')
  }

  const prepared = useMemo(
    () =>
      columns
        ? prepareRows(
            dataRows,
            columns,
            categories,
            accounts,
            {
              expenseCategoryId,
              incomeCategoryId,
              accountId,
              timezone: browserTimezone(),
              dayFirst: dateOrder === '' ? undefined : dateOrder === 'dmy',
            },
          )
        : [],
    [
      columns,
      dataRows,
      categories,
      accounts,
      expenseCategoryId,
      incomeCategoryId,
      accountId,
      dateOrder,
    ],
  )
  const ready = prepared.filter((r) => r.ok)
  const problems = prepared.filter((r) => !r.ok)
  const tooMany = ready.length > MAX_IMPORT_ROWS

  const categoryName = (id?: string) => categories.find((c) => c.id === id)?.name ?? ''
  const accountName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? t('Nowhere')

  async function handleImport() {
    setError(null)
    setImporting(true)
    try {
      const count = await importTransactions(ready.map((r) => r.input))
      setImported(count)
      setColumns(null)
      setDataRows([])
    } catch (err) {
      const rows = (err instanceof ApiError &&
        (err.details as { rows?: ImportRowError[] } | undefined)?.rows) || []
      if (rows.length) {
        const first = rows[0]
        setError(
          t('Nothing was imported. Line {line}: {error}', {
            line: String(ready[first.index]?.line ?? '?'),
            error: first.error,
          }),
        )
      } else {
        setError(err instanceof ApiError ? err.message : t('Could not import. Try again.'))
      }
    } finally {
      setImporting(false)
    }
  }

  const expenseCats = categories.filter((c) => !c.parentId && c.kind === 'expense')
  const incomeCats = categories.filter((c) => !c.parentId && c.kind === 'income')

  return (
    <div className="space-y-4">
      <Link
        to="/transactions"
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-muted)]"
      >
        <ArrowLeft size={16} aria-hidden />
        {t('Transactions')}
      </Link>
      <PageHeader
        title={t('Import CSV')}
        subtitle={t('Add many transactions at once from a spreadsheet.')}
      />

      {(loadError || error) && (
        <p
          role="alert"
          className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]"
        >
          {loadError ?? error}
        </p>
      )}

      {imported !== null && (
        <Card>
          <CardBody className="flex items-center gap-3">
            <CheckCircle2 size={20} className="shrink-0 text-[var(--color-gain)]" aria-hidden />
            <p className="flex-1 text-sm text-[var(--color-ink)]">
              {t('Imported {count} transactions.', { count: String(imported) })}
            </p>
            <Link to="/transactions" className="text-sm font-medium text-brand-600">
              {t('View')}
            </Link>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm text-[var(--color-muted)]">
            {t(
              'The first row must be column names. Dates like 2026-07-05 or 05/07/2569 work; without a type column, negative amounts are expenses.',
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-500">
              <FileUp size={16} aria-hidden />
              {fileName ? t('Choose another file') : t('Choose CSV file')}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={handleFile}
                aria-label={t('CSV file')}
              />
            </label>
            <Button variant="secondary" onClick={downloadTemplate}>
              <Download size={16} aria-hidden />
              {t('Download template')}
            </Button>
          </div>
          {fileName && <p className="text-sm text-[var(--color-ink)]">{fileName}</p>}
        </CardBody>
      </Card>

      {columns && (
        <>
          <Card>
            <CardBody className="space-y-3">
              <p className="text-sm font-semibold text-[var(--color-ink)]">{t('Columns')}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {IMPORT_FIELDS.map((field) => (
                  <div key={field}>
                    <label htmlFor={`col-${field}`} className={labelClass}>
                      {FIELD_LABELS[field]}
                    </label>
                    <select
                      id={`col-${field}`}
                      value={columns[field]}
                      onChange={(e) =>
                        setColumns({ ...columns, [field]: Number(e.target.value) })
                      }
                      className={selectClass + ' mt-1.5'}
                    >
                      <option value={-1}>{t('— Not in file —')}</option>
                      {header.map((h, i) => (
                        <option key={i} value={i}>
                          {h || t('Column {n}', { n: String(i + 1) })}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <div>
                  <label htmlFor="date-order" className={labelClass}>
                    {t('Date order')}
                  </label>
                  <select
                    id="date-order"
                    value={dateOrder}
                    onChange={(e) => setDateOrder(e.target.value as '' | 'dmy' | 'mdy')}
                    className={selectClass + ' mt-1.5'}
                  >
                    <option value="">{t('Detect')}</option>
                    <option value="dmy">{t('Day/Month/Year')}</option>
                    <option value="mdy">{t('Month/Day/Year')}</option>
                  </select>
                </div>
              </div>

              <p className="pt-2 text-sm font-semibold text-[var(--color-ink)]">
                {t('When a row has no match')}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="def-expense" className={labelClass}>
                    {t('Expense category')}
                  </label>
                  <select
                    id="def-expense"
                    value={expenseCategoryId}
                    onChange={(e) => setExpenseCategoryId(e.target.value)}
                    className={selectClass + ' mt-1.5'}
                  >
                    <option value="">{t('— Skip the row —')}</option>
                    {expenseCats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="def-income" className={labelClass}>
                    {t('Income category')}
                  </label>
                  <select
                    id="def-income"
                    value={incomeCategoryId}
                    onChange={(e) => setIncomeCategoryId(e.target.value)}
                    className={selectClass + ' mt-1.5'}
                  >
                    <option value="">{t('— Skip the row —')}</option>
                    {incomeCats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="def-account" className={labelClass}>
                    {t('Account')}
                  </label>
                  <select
                    id="def-account"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className={selectClass + ' mt-1.5'}
                  >
                    <option value="">{t('— No account —')}</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[var(--color-ink)]">
                  {t('{ready} ready', { ready: String(ready.length) })}
                  {problems.length > 0 && (
                    <span className="text-[var(--color-loss)]">
                      {' · '}
                      {t('{count} will be skipped', { count: String(problems.length) })}
                    </span>
                  )}
                </p>
                <Button
                  onClick={handleImport}
                  disabled={importing || ready.length === 0 || tooMany || !!loadError}
                >
                  {importing
                    ? t('Importing…')
                    : t('Import {count} transactions', { count: String(ready.length) })}
                </Button>
              </div>
              {tooMany && (
                <p className="text-sm text-[var(--color-loss)]">
                  {t('Up to {max} rows per import. Split the file and try again.', {
                    max: String(MAX_IMPORT_ROWS),
                  })}
                </p>
              )}

              {problems.length > 0 && (
                <div>
                  <p className={labelClass}>{t('Problems')}</p>
                  <ul className="mt-1 space-y-1 text-sm text-[var(--color-loss)]">
                    {problems.slice(0, PREVIEW_ROWS).map((r) => (
                      <li key={r.line}>
                        {t('Line {line}', { line: String(r.line) })}: {!r.ok && r.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {ready.length > 0 && (
                <div>
                  <p className={labelClass}>{t('Preview')}</p>
                  <ul className="mt-1 divide-y divide-[var(--color-line)]">
                    {ready.slice(0, PREVIEW_ROWS).map((r) =>
                      r.ok ? (
                        <li key={r.line} className="flex items-center gap-3 py-2 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-[var(--color-ink)]">
                              {r.input.type === 'transfer'
                                ? `${accountName(r.input.accountId)} → ${accountName(r.input.toAccountId)}`
                                : [
                                    categoryName(r.input.categoryId),
                                    categoryName(r.input.subCategoryId),
                                  ]
                                    .filter(Boolean)
                                    .join(' › ')}
                              {r.input.note && (
                                <span className="font-normal text-[var(--color-muted)]">
                                  {' · '}
                                  {r.input.note}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-[var(--color-muted)]">
                              {formatDateTime(r.input.date)} · {TYPE_LABELS[r.input.type]}
                            </p>
                          </div>
                          <span
                            className={
                              r.input.type === 'income'
                                ? 'tabular-nums text-[var(--color-gain)]'
                                : 'tabular-nums text-[var(--color-ink)]'
                            }
                          >
                            {r.input.currency === 'USD'
                              ? `$${r.input.amount.toLocaleString()}`
                              : formatTHB(r.input.amount)}
                          </span>
                        </li>
                      ) : null,
                    )}
                  </ul>
                  {ready.length > PREVIEW_ROWS && (
                    <p className="pt-2 text-xs text-[var(--color-muted)]">
                      {t('…and {count} more', { count: String(ready.length - PREVIEW_ROWS) })}
                    </p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
