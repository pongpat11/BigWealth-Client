import { describe, expect, it } from 'vitest'
import { buildAlerts } from './alerts'
import type { Budget } from './budgets'
import type { Goal } from './goals'
import type { RecurringRule } from './recurring'

const today = new Date(2026, 10, 22) // 22 Nov 2026: 9 days left in the month

const budget = (id: string, spent: number, limit = 10_000): Budget => ({
  id,
  categoryId: id,
  category: { id, name: id[0].toUpperCase() + id.slice(1), icon: null, color: null },
  limit,
  spent,
})

const rule = (over: Partial<RecurringRule>): RecurringRule => ({
  id: 'r1',
  type: 'expense',
  amount: 419,
  currency: 'THB',
  categoryId: 'bills',
  subCategoryId: null,
  category: { id: 'bills', name: 'Bills', kind: 'expense', icon: null, color: null },
  subCategory: null,
  accountId: null,
  account: null,
  note: 'Netflix',
  labelIds: [],
  frequency: 'monthly',
  interval: 1,
  startDate: '2026-01-23',
  endDate: null,
  timezone: 'Asia/Bangkok',
  active: true,
  nextDate: '2026-11-23',
  createdAt: '',
  ...over,
})

const goal = (over: Partial<Goal>): Goal => ({
  id: 'g1',
  name: 'MacBook',
  target: 75_000,
  saved: 71_000,
  deadline: '2026-12-04',
  createdAt: '',
  ...over,
})

describe('buildAlerts', () => {
  it('flags budgets over the limit and from 80% up', () => {
    const alerts = buildAlerts(
      { budgets: [budget('food', 12_500), budget('transport', 8_500), budget('fun', 7_900)] },
      today,
    )
    expect(alerts.map((a) => [a.tone, a.title, a.detail])).toEqual([
      ['danger', 'Food is over budget', '฿12,500 of ฿10,000 · ฿2,500 over'],
      ['warn', 'Transport at 85% of budget', '฿1,500 left for 9 days'],
    ])
  })

  it('announces recurring entries in the next three days only', () => {
    const alerts = buildAlerts(
      {
        recurring: [
          rule({}),
          rule({ id: 'r2', type: 'income', note: 'Salary', amount: 60_000, nextDate: '2026-11-25' }),
          rule({ id: 'r3', note: 'Rent', nextDate: '2026-12-01' }),
          rule({ id: 'r4', note: 'Gym', nextDate: null }),
        ],
      },
      today,
    )
    expect(alerts.map((a) => [a.title, a.detail])).toEqual([
      ['Netflix due tomorrow', '−฿419'],
      ['Salary arrives in 3 days', '+฿60,000'],
    ])
  })

  it('flags close and missed goal deadlines, not reached or distant ones', () => {
    const alerts = buildAlerts(
      {
        goals: [
          goal({}),
          goal({ id: 'g2', name: 'Trip', deadline: '2026-11-01' }),
          goal({ id: 'g3', name: 'Done', saved: 75_000 }),
          goal({ id: 'g4', name: 'Later', deadline: '2027-06-01' }),
        ],
      },
      today,
    )
    expect(alerts.map((a) => [a.tone, a.title])).toEqual([
      ['warn', 'Trip is past its deadline'],
      ['info', 'MacBook due in 12 days'],
    ])
  })

  it('puts the most urgent alerts first', () => {
    const alerts = buildAlerts(
      { recurring: [rule({})], budgets: [budget('food', 9_000), budget('bills', 20_000)] },
      today,
    )
    expect(alerts.map((a) => a.tone)).toEqual(['danger', 'warn', 'info'])
  })
})
