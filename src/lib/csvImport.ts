// CSV import: parse a file, guess which column is which, turn each row into a
// TransactionInput (names → ids), then send the good rows in one request.
// Everything but importTransactions() is pure so it can be unit tested.
import { apiFetch } from './api'
import { getAccessToken } from './auth'
import { t } from './i18n'
import type { Account } from './accounts'
import type { Category } from './categories'
import type { Currency, TransactionInput, TransactionKind } from './transactions'

/** Rows the server takes in one import (all or nothing). */
export const MAX_IMPORT_ROWS = 1000

/** Largest amount the server stores (Decimal(14, 2)). */
export const MAX_AMOUNT = 999_999_999_999.99

// ---------------------------------------------------------------------------
// Parsing

/**
 * File bytes → text. UTF-8 when the bytes are valid UTF-8; otherwise
 * Windows-874 (Thai), which Excel on Thai Windows and many Thai banks use.
 */
export function decodeCsv(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-874').decode(bytes)
  }
}

export interface CsvRow {
  cells: string[]
  /** 1-based line in the file where the row starts. */
  line: number
}

/** Split CSV text into rows of cells. See parseCsvRows. */
export function parseCsv(text: string): string[][] {
  return parseCsvRows(text).map((r) => r.cells)
}

/**
 * Split CSV text into rows of cells (RFC 4180 quoting), keeping the file line
 * each row starts on. Strips a BOM, picks the delimiter (comma, semicolon or
 * tab) from the first line, and drops blank lines.
 */
export function parseCsvRows(text: string): CsvRow[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [',', ';', '\t'].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  )
  const rows: CsvRow[] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let line = 1 // file line we are on
  let rowLine = 1 // file line the current row started on
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else {
        if (ch === '\n' || (ch === '\r' && src[i + 1] !== '\n')) line++
        cell += ch
      }
    } else if (ch === '"' && cell.trim() === '') {
      // An opening quote, possibly after spaces: `a, "1,000"`.
      quoted = true
      cell = ''
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push({ cells: row, line: rowLine })
      row = []
      cell = ''
      line++
      rowLine = line
    } else cell += ch
  }
  row.push(cell)
  rows.push({ cells: row, line: rowLine })
  return rows
    .map((r) => ({ ...r, cells: r.cells.map((c) => c.trim()) }))
    .filter((r) => r.cells.some((c) => c !== ''))
}

// ---------------------------------------------------------------------------
// Column mapping

export type ImportField =
  | 'date'
  | 'type'
  | 'amount'
  | 'currency'
  | 'category'
  | 'subCategory'
  | 'account'
  | 'toAccount'
  | 'note'

export const IMPORT_FIELDS: ImportField[] = [
  'date',
  'type',
  'amount',
  'currency',
  'category',
  'subCategory',
  'account',
  'toAccount',
  'note',
]

/** Column index per field; -1 = not in the file. */
export type ColumnMap = Record<ImportField, number>

// Header names we recognise (lower-case, English and Thai).
const HEADER_ALIASES: Record<ImportField, string[]> = {
  date: ['date', 'datetime', 'time', 'transaction date', 'วันที่', 'วันเวลา'],
  type: ['type', 'kind', 'ประเภท'],
  amount: ['amount', 'value', 'จำนวน', 'จำนวนเงิน', 'ยอด', 'ยอดเงิน'],
  currency: ['currency', 'สกุลเงิน'],
  category: ['category', 'หมวด', 'หมวดหมู่'],
  subCategory: ['sub-category', 'subcategory', 'sub category', 'หมวดย่อย', 'หมวดหมู่ย่อย'],
  account: ['account', 'from account', 'from', 'บัญชี', 'จากบัญชี'],
  toAccount: ['to account', 'to', 'ไปบัญชี', 'เข้าบัญชี', 'ไปยังบัญชี'],
  note: ['note', 'notes', 'memo', 'description', 'details', 'บันทึก', 'หมายเหตุ', 'รายละเอียด'],
}

/** Guess the column for each field from the header row. */
export function guessColumns(header: string[]): ColumnMap {
  const norm = header.map((h) => h.trim().toLowerCase())
  const map = {} as ColumnMap
  for (const field of IMPORT_FIELDS) {
    map[field] = norm.findIndex((h) => HEADER_ALIASES[field].includes(h))
  }
  return map
}

// ---------------------------------------------------------------------------
// Values

/**
 * "1,234.50", "1.234,50", "12,5", "฿80", "(500)", "-500" → number; NaN when
 * unreadable. With both `.` and `,` the last one is the decimal mark; a lone
 * `,` is a thousands separator only when groups of 3 digits follow it.
 */
export function parseAmount(raw: string): number {
  let s = raw.replace(/[\s\u00a0฿$]|THB|USD|บาท/gi, '')
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  } else if (s.startsWith('+')) s = s.slice(1)

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  const commaIsDecimal =
    lastComma >= 0 && (lastDot >= 0 ? lastComma > lastDot : !/^\d{1,3}(,\d{3})+$/.test(s))
  s = commaIsDecimal ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')

  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return NaN
  const n = Number(s)
  return negative ? -n : n
}

/** Currency named in an amount cell ("$12", "12 USD", "฿80"), if any. */
export function amountCurrency(raw: string): Currency | null {
  if (/\$|usd/i.test(raw)) return 'USD'
  if (/฿|thb|บาท/i.test(raw)) return 'THB'
  return null
}

const SLASH_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(.*)$/

/**
 * Whether the slash dates in a column are day-first (05/07 = 5 July). A first
 * part above 12 means day-first, a second part above 12 means month-first;
 * with neither it defaults to day-first (the Thai way).
 */
export function detectDayFirst(values: string[]): boolean {
  for (const v of values) {
    const m = SLASH_DATE.exec(v.trim())
    if (!m) continue
    if (Number(m[1]) > 12) return true
    if (Number(m[2]) > 12) return false
  }
  return true
}

/**
 * Read a date the way people write them: 2026-07-05, 2026-07-05 12:30,
 * 05/07/2026 (day first unless `dayFirst` is false), 5/7/2569 (Buddhist
 * year), or a full ISO timestamp. Times without a zone are local. Returns an
 * ISO instant, or null.
 */
export function parseDate(raw: string, dayFirst = true): string | null {
  const s = raw.trim()
  if (!s) return null
  // Full ISO with a zone: trust it.
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  let y: number, mo: number, d: number
  let rest: string
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/.exec(s)
  if (m) {
    ;[y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    rest = m[4]
  } else {
    m = SLASH_DATE.exec(s)
    if (!m) return null
    ;[d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (!dayFirst) [d, mo] = [mo, d]
    if (m[3].length === 2) y += 2000
    rest = m[4]
  }
  if (y > 2400) y -= 543 // Buddhist era
  let h = 12 // date only → midday, so the day can't shift across timezones
  let mi = 0
  const time = rest.trim().replace(/^T/, '')
  if (time) {
    const tm = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(time)
    if (!tm) return null
    h = Number(tm[1])
    mi = Number(tm[2])
  }
  const date = new Date(y, mo - 1, d, h, mi)
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d ||
    h > 23 ||
    mi > 59
  ) {
    return null
  }
  return date.toISOString()
}

const TYPE_ALIASES: Record<TransactionKind, string[]> = {
  income: ['income', 'in', 'รายรับ', 'รับ'],
  expense: ['expense', 'out', 'spending', 'รายจ่าย', 'จ่าย'],
  transfer: ['transfer', 'โอน', 'โอนเงิน'],
}

function parseType(raw: string): TransactionKind | null {
  const s = raw.trim().toLowerCase()
  for (const kind of Object.keys(TYPE_ALIASES) as TransactionKind[]) {
    if (TYPE_ALIASES[kind].includes(s)) return kind
  }
  return null
}

// ---------------------------------------------------------------------------
// Rows → inputs

export interface ImportDefaults {
  /** Used when a row's category is blank or not found. '' = none. */
  expenseCategoryId: string
  incomeCategoryId: string
  /** Used when a row has no account column / value. '' = none. */
  accountId: string
  timezone: string
  /** Order of slash dates; undefined = detect it from the date column. */
  dayFirst?: boolean
}

export type PreparedRow =
  | { line: number; ok: true; input: TransactionInput; cells: string[] }
  | { line: number; ok: false; error: string; cells: string[] }

/** A data row: parsed with its file line, or plain cells (line = index + 2). */
export type DataRow = CsvRow | string[]

const key = (s: string) => s.trim().toLowerCase()

/**
 * Turn data rows into transactions. Without a type column, the amount's sign
 * decides: negative = expense, positive = income. A row the server would
 * reject fails here, so one bad row can't sink the whole (all-or-nothing)
 * import.
 */
export function prepareRows(
  rows: DataRow[],
  columns: ColumnMap,
  categories: Category[],
  accounts: Account[],
  defaults: ImportDefaults,
): PreparedRow[] {
  const accountByName = new Map(accounts.map((a) => [key(a.name), a]))
  const topLevel = categories.filter((c) => !c.parentId)
  const findCategory = (name: string, kind: 'income' | 'expense') =>
    topLevel.find((c) => c.kind === kind && key(c.name) === key(name))
  const findSub = (parentId: string, name: string) =>
    categories.find((c) => c.parentId === parentId && key(c.name) === key(name))
  const cell = (r: string[], f: ImportField) => (columns[f] >= 0 ? (r[columns[f]] ?? '') : '')
  const lookupAccount = (name: string): Account | null | undefined =>
    name ? (accountByName.get(key(name)) ?? null) : undefined

  const all = rows.map((r, i) => (Array.isArray(r) ? { cells: r, line: i + 2 } : r))
  const dayFirst = defaults.dayFirst ?? detectDayFirst(all.map((r) => cell(r.cells, 'date')))

  return all.map(({ cells, line }): PreparedRow => {
    const fail = (error: string): PreparedRow => ({ line, ok: false, error, cells })

    const date = parseDate(cell(cells, 'date'), dayFirst)
    if (!date) return fail(t('Unreadable date "{value}"', { value: cell(cells, 'date') }))

    const rawAmount = cell(cells, 'amount')
    const signed = parseAmount(rawAmount)
    const amount = Math.round(Math.abs(signed) * 100) / 100
    if (Number.isNaN(signed) || amount === 0 || amount > MAX_AMOUNT) {
      return fail(t('Unreadable amount "{value}"', { value: rawAmount }))
    }
    let type: TransactionKind
    if (columns.type >= 0 && cell(cells, 'type')) {
      const parsed = parseType(cell(cells, 'type'))
      if (!parsed) return fail(t('Unknown type "{value}"', { value: cell(cells, 'type') }))
      type = parsed
    } else {
      type = signed < 0 ? 'expense' : 'income'
    }

    const rawCurrency =
      cell(cells, 'currency').toUpperCase() || amountCurrency(rawAmount) || 'THB'
    if (rawCurrency !== 'THB' && rawCurrency !== 'USD') {
      return fail(t('Unsupported currency "{value}"', { value: rawCurrency }))
    }
    const currency = rawCurrency as Currency

    const accountName = cell(cells, 'account')
    const from = lookupAccount(accountName)
    if (from === null) return fail(t('Unknown account "{value}"', { value: accountName }))

    const input: TransactionInput = { type, amount, currency, date, timezone: defaults.timezone }
    const note = cell(cells, 'note')
    if (note) input.note = note.slice(0, 280)

    if (type === 'transfer') {
      const toName = cell(cells, 'toAccount')
      const to = lookupAccount(toName)
      if (to === null) return fail(t('Unknown account "{value}"', { value: toName }))
      if (!from && !to) return fail(t('A transfer needs a from or a to account'))
      if (from && to && from.id === to.id) return fail(t('Cannot transfer to the same account'))
      // Same rule as the server: balances don't convert currencies.
      if ((from && from.currency !== currency) || (to && to.currency !== currency)) {
        return fail(t('Accounts must be in the transfer currency'))
      }
      if (from) input.accountId = from.id
      if (to) input.toAccountId = to.id
      return { line, ok: true, input, cells }
    }

    const accountId = from?.id ?? (defaults.accountId || undefined)
    if (accountId) input.accountId = accountId

    // "Food > Lunch" in one column works too.
    let catName = cell(cells, 'category')
    let subName = cell(cells, 'subCategory')
    if (!subName && catName.includes('>')) {
      ;[catName, subName] = catName.split('>').map((s) => s.trim())
    }
    const fallback = type === 'expense' ? defaults.expenseCategoryId : defaults.incomeCategoryId
    const category = catName ? findCategory(catName, type) : undefined
    if (category) {
      input.categoryId = category.id
      if (subName) {
        const sub = findSub(category.id, subName)
        if (!sub) return fail(t('Unknown sub-category "{value}"', { value: subName }))
        input.subCategoryId = sub.id
      }
    } else if (fallback) {
      input.categoryId = fallback
    } else {
      return fail(
        catName ? t('Unknown category "{value}"', { value: catName }) : t('No category'),
      )
    }
    return { line, ok: true, input, cells }
  })
}

// ---------------------------------------------------------------------------
// API

export interface ImportRowError {
  index: number
  error: string
}

/** Send prepared inputs (≤ MAX_IMPORT_ROWS). All or nothing on the server. */
export async function importTransactions(items: TransactionInput[]): Promise<number> {
  const body = {
    // Imports carry no labels (JSON drops the undefined key).
    items: items.map((it) => ({ ...it, labelIds: undefined })),
  }
  const res = await apiFetch<{ imported: number }>('/transactions/import', {
    method: 'POST',
    body,
    token: getAccessToken() ?? undefined,
  })
  return res.imported
}

/** A template users can fill in, with the headers guessColumns() knows. */
export const CSV_TEMPLATE = [
  'date,type,amount,currency,category,sub-category,account,to account,note',
  '2026-07-05 12:30,expense,80,THB,Food,,Cash,,Lunch',
  '2026-07-25,income,30000,THB,Salary,,KBank,,',
  '2026-07-26,transfer,5000,THB,,,KBank,Cash,ATM',
].join('\n')
