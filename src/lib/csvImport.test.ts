import { describe, expect, it } from 'vitest'
import type { Account } from './accounts'
import type { Category } from './categories'
import {
  CSV_TEMPLATE,
  guessColumns,
  parseAmount,
  parseCsv,
  parseDate,
  prepareRows,
} from './csvImport'

const cat = (id: string, name: string, kind: 'income' | 'expense', parentId: string | null = null) =>
  ({ id, name, kind, parentId, icon: null, color: null, isDefault: true }) as Category
const acc = (id: string, name: string) => ({ id, name, currency: 'THB' }) as Account

const categories = [
  cat('food', 'Food', 'expense'),
  cat('lunch', 'Lunch', 'expense', 'food'),
  cat('salary', 'Salary', 'income'),
]
const accounts = [acc('kbank', 'KBank'), acc('cash', 'Cash')]
const defaults = { expenseCategoryId: '', incomeCategoryId: '', accountId: '', timezone: 'Asia/Bangkok' }

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, CRLF, BOM and blank lines', () => {
    const text = '﻿date,note\r\n2026-07-05,"Lunch, with ""Bo"""\r\n\r\n2026-07-06,"two\nlines"\n'
    expect(parseCsv(text)).toEqual([
      ['date', 'note'],
      ['2026-07-05', 'Lunch, with "Bo"'],
      ['2026-07-06', 'two\nlines'],
    ])
  })

  it('detects semicolon and tab delimiters', () => {
    expect(parseCsv('a;b\n1,5;2')).toEqual([['a', 'b'], ['1,5', '2']])
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('guessColumns', () => {
  it('maps English and Thai headers, -1 when missing', () => {
    const map = guessColumns(['วันที่', 'Amount', 'หมวดหมู่', 'Memo'])
    expect(map).toMatchObject({ date: 0, amount: 1, category: 2, note: 3, type: -1, account: -1 })
  })
})

describe('parseAmount', () => {
  it.each([
    ['1,234.50', 1234.5],
    ['฿80', 80],
    ['-500', -500],
    ['(500)', -500],
    ['+12', 12],
    ['abc', NaN],
    ['', NaN],
  ])('%s → %s', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected)
  })
})

describe('parseDate', () => {
  const local = (y: number, m: number, d: number, h = 12, mi = 0) =>
    new Date(y, m - 1, d, h, mi).toISOString()

  it('reads common formats as local time', () => {
    expect(parseDate('2026-07-05')).toBe(local(2026, 7, 5))
    expect(parseDate('2026-07-05 08:30')).toBe(local(2026, 7, 5, 8, 30))
    expect(parseDate('05/07/2026')).toBe(local(2026, 7, 5))
    expect(parseDate('5/7/2569')).toBe(local(2026, 7, 5)) // Buddhist year
    expect(parseDate('05/07/26 23:59:10')).toBe(local(2026, 7, 5, 23, 59))
  })

  it('trusts an explicit zone', () => {
    expect(parseDate('2026-07-05T12:30:00+07:00')).toBe('2026-07-05T05:30:00.000Z')
  })

  it('rejects impossible or unreadable dates', () => {
    expect(parseDate('31/02/2026')).toBeNull()
    expect(parseDate('yesterday')).toBeNull()
    expect(parseDate('2026-07-05 25:00')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})

describe('prepareRows', () => {
  it('turns the template into valid inputs', () => {
    const [header, ...rows] = parseCsv(CSV_TEMPLATE)
    const out = prepareRows(rows, guessColumns(header), categories, accounts, defaults)
    expect(out.every((r) => r.ok)).toBe(true)
    const inputs = out.map((r) => (r.ok ? r.input : null))
    expect(inputs[0]).toMatchObject({ type: 'expense', amount: 80, categoryId: 'food', accountId: 'cash', note: 'Lunch' })
    expect(inputs[1]).toMatchObject({ type: 'income', amount: 30000, categoryId: 'salary', accountId: 'kbank' })
    expect(inputs[2]).toMatchObject({ type: 'transfer', accountId: 'kbank', toAccountId: 'cash' })
    expect(inputs[2]).not.toHaveProperty('categoryId')
  })

  it('uses the amount sign without a type column, and "Parent > Sub" categories', () => {
    const header = ['date', 'amount', 'category']
    const out = prepareRows(
      [
        ['2026-07-05', '-80', 'food > lunch'],
        ['2026-07-25', '30,000', 'Salary'],
      ],
      guessColumns(header),
      categories,
      accounts,
      defaults,
    )
    expect(out[0]).toMatchObject({ ok: true, input: { type: 'expense', amount: 80, categoryId: 'food', subCategoryId: 'lunch' } })
    expect(out[1]).toMatchObject({ ok: true, input: { type: 'income', amount: 30000 } })
  })

  it('reports bad rows by file line, and falls back to the default category/account', () => {
    const header = ['date', 'amount', 'category', 'account']
    const rows = [
      ['nope', '10', 'Food', ''],
      ['2026-07-05', 'x', 'Food', ''],
      ['2026-07-05', '-10', 'Travel', ''],
      ['2026-07-05', '-10', 'Food', 'SCB'],
      ['2026-07-05', '-10', 'Salary', ''], // income category on an expense
    ]
    const strict = prepareRows(rows, guessColumns(header), categories, accounts, defaults)
    expect(strict.map((r) => (r.ok ? 'ok' : `${r.line}: ${r.error}`))).toEqual([
      '2: Unreadable date "nope"',
      '3: Unreadable amount "x"',
      '4: Unknown category "Travel"',
      '5: Unknown account "SCB"',
      '6: Unknown category "Salary"',
    ])

    const lenient = prepareRows(rows.slice(2), guessColumns(header), categories, accounts, {
      ...defaults,
      expenseCategoryId: 'food',
      accountId: 'cash',
    })
    expect(lenient[0]).toMatchObject({ ok: true, input: { categoryId: 'food', accountId: 'cash' } })
    expect(lenient[1].ok).toBe(false) // a named account that doesn't exist is still an error
  })
})
