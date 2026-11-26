import { beforeEach, describe, expect, it } from 'vitest'
import type { Account } from './accounts'
import type { Category } from './categories'
import type { Transaction } from './transactions'
import {
  defaultAccountId,
  entryToInput,
  formatKeypadAmount,
  frequentEntries,
  loadQuickAddPrefs,
  pressKey,
  rankAccounts,
  rankCategories,
  saveQuickAddPrefs,
  type KeypadKey,
} from './quickAdd'

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36),
    type: 'expense',
    amount: 65,
    currency: 'THB',
    categoryId: 'coffee',
    subCategoryId: null,
    category: { id: 'coffee', name: 'Coffee', kind: 'expense', icon: 'Coffee', color: '#a16207' },
    subCategory: null,
    accountId: 'kbank',
    account: { id: 'kbank', name: 'KBank', type: 'bank' },
    note: 'Latte',
    date: '2026-11-20T02:00:00.000Z',
    timezone: 'Asia/Bangkok',
    createdAt: '2026-11-20T02:00:00.000Z',
    labels: [],
    ...over,
  }
}

const type = (keys: string) =>
  [...keys].reduce((a, k) => pressKey(a, (k === '<' ? 'back' : k) as KeypadKey), '')

describe('pressKey', () => {
  it('builds amounts digit by digit', () => {
    expect(type('1250')).toBe('1250')
    expect(type('12.5')).toBe('12.5')
  })
  it('caps decimals at two and ignores a second dot', () => {
    expect(type('9.999')).toBe('9.99')
    expect(type('1.2.3')).toBe('1.23')
  })
  it('drops leading zeros and starts "." as "0."', () => {
    expect(type('007')).toBe('7')
    expect(type('.5')).toBe('0.5')
  })
  it('backspace removes the last character', () => {
    expect(type('123<')).toBe('12')
    expect(type('<')).toBe('')
  })
  it('stops at ten whole digits', () => {
    expect(type('123456789012')).toBe('1234567890')
  })
})

describe('formatKeypadAmount', () => {
  it('groups thousands and keeps a trailing dot', () => {
    expect(formatKeypadAmount('')).toBe('0')
    expect(formatKeypadAmount('12345')).toBe('12,345')
    expect(formatKeypadAmount('1000.')).toBe('1,000.')
    expect(formatKeypadAmount('1000.5')).toBe('1,000.5')
  })
})

describe('frequentEntries', () => {
  it('offers entries that repeat, most repeated first', () => {
    const history = [
      tx({ amount: 47, note: 'BTS' }),
      tx({}),
      tx({ amount: 47, note: 'BTS' }),
      tx({}),
      tx({ note: ' latte ' }), // same entry, different spacing / case
      tx({ amount: 999, note: 'One-off' }),
    ]
    const result = frequentEntries(history)
    expect(result.map((e) => [e.note, e.count])).toEqual([
      ['Latte', 3],
      ['BTS', 2],
    ])
  })

  it('skips uncategorised income/expense and non-THB/USD currencies', () => {
    const history = [
      tx({ categoryId: null }),
      tx({ categoryId: null }),
      tx({ currency: 'EUR' }),
      tx({ currency: 'EUR' }),
    ]
    expect(frequentEntries(history)).toEqual([])
  })

  it('keeps transfers', () => {
    const t1 = { type: 'transfer' as const, categoryId: null, category: null, toAccountId: 'cash', note: null }
    expect(frequentEntries([tx(t1), tx(t1)])).toHaveLength(1)
  })
})

describe('entryToInput', () => {
  it('repeats the entry at the given time', () => {
    const [entry] = frequentEntries([
      tx({ labels: [{ id: 'l1', name: 'Work', color: null }] }),
      tx({ labels: [{ id: 'l1', name: 'Work', color: null }] }),
    ])
    const input = entryToInput(entry, new Date('2026-11-26T05:00:00Z'), 'Asia/Bangkok')
    expect(input).toEqual({
      type: 'expense',
      amount: 65,
      currency: 'THB',
      note: 'Latte',
      date: '2026-11-26T05:00:00.000Z',
      timezone: 'Asia/Bangkok',
      labelIds: ['l1'],
      categoryId: 'coffee',
      subCategoryId: undefined,
      accountId: 'kbank',
    })
  })
})

const cat = (id: string, name: string, over: Partial<Category> = {}): Category => ({
  id,
  name,
  kind: 'expense',
  parentId: null,
  icon: null,
  color: null,
  isDefault: true,
  ...over,
})

describe('rankCategories', () => {
  it('puts the most used first, then by name, top-level of the kind only', () => {
    const cats = [
      cat('a', 'Alpha'),
      cat('b', 'Beta'),
      cat('c', 'Coffee'),
      cat('sub', 'Sub', { parentId: 'c' }),
      cat('i', 'Salary', { kind: 'income' }),
    ]
    const history = [tx({ categoryId: 'c' }), tx({ categoryId: 'c' }), tx({ categoryId: 'b' })]
    expect(rankCategories(cats, history, 'expense').map((c) => c.id)).toEqual(['c', 'b', 'a'])
  })
})

const acct = (id: string): Account => ({
  id,
  name: id,
  institution: null,
  type: 'bank',
  currency: 'THB',
  balance: 0,
  currentBalance: 0,
  createdAt: '',
})

describe('accounts', () => {
  it('ranks by use for the type and defaults to the last one used', () => {
    const ranked = rankAccounts([acct('cash'), acct('kbank')], [tx({}), tx({})], 'expense')
    expect(ranked.map((a) => a.id)).toEqual(['kbank', 'cash'])
    expect(defaultAccountId({ type: 'expense', account: {} }, 'expense', ranked)).toBe('kbank')
    expect(defaultAccountId({ type: 'expense', account: { expense: 'cash' } }, 'expense', ranked)).toBe('cash')
    expect(defaultAccountId({ type: 'expense', account: { expense: '' } }, 'expense', ranked)).toBe('')
    // A deleted account falls back to the most used one.
    expect(defaultAccountId({ type: 'expense', account: { expense: 'gone' } }, 'expense', ranked)).toBe('kbank')
  })
})

describe('prefs', () => {
  beforeEach(() => localStorage.clear())
  it('round-trips and survives junk', () => {
    expect(loadQuickAddPrefs()).toEqual({ type: 'expense', account: {} })
    saveQuickAddPrefs({ type: 'income', account: { income: 'kbank' }, toAccount: 'cash' })
    expect(loadQuickAddPrefs()).toEqual({ type: 'income', account: { income: 'kbank' }, toAccount: 'cash' })
    localStorage.setItem('bw.quickAdd', '{not json')
    expect(loadQuickAddPrefs().type).toBe('expense')
  })
})
