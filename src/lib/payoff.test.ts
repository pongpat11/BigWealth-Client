import { describe, expect, it } from 'vitest'
import { monthsFromNow, simulatePayoff } from './payoff'

describe('simulatePayoff', () => {
  it('pays an interest-free debt off in balance / payment months', () => {
    const plan = simulatePayoff([{ id: 'a', balance: 10_000, rate: 0, minPayment: 1_000 }])
    expect(plan).toEqual({ months: 10, totalInterest: 0, paidOffMonth: { a: 10 } })
  })

  it('charges monthly interest on the balance', () => {
    // 12% APR = 1% a month on 1,000 owed, paid 1,010 in month one.
    const plan = simulatePayoff([{ id: 'a', balance: 1_000, rate: 12, minPayment: 1_010 }])
    expect(plan.months).toBe(1)
    expect(plan.totalInterest).toBe(10)
  })

  it('rolls freed minimums and the extra into the next debt in order', () => {
    const debts = [
      { id: 'small', balance: 1_000, rate: 0, minPayment: 500 },
      { id: 'big', balance: 3_000, rate: 0, minPayment: 500 },
    ]
    const plan = simulatePayoff(debts, 500)
    // Month 1: small 1000-500-500 = 0; big 3000-500 = 2500. Then 1500/mo on big.
    expect(plan.paidOffMonth).toEqual({ small: 1, big: 3 })
    expect(plan.months).toBe(3)
  })

  it('costs less interest when the expensive debt goes first (avalanche)', () => {
    const card = { id: 'card', balance: 30_000, rate: 18, minPayment: 1_000 }
    const car = { id: 'car', balance: 20_000, rate: 3, minPayment: 1_000 }
    const avalanche = simulatePayoff([card, car], 3_000)
    const snowball = simulatePayoff([car, card], 3_000)
    expect(avalanche.totalInterest).toBeLessThan(snowball.totalInterest)
    expect(snowball.paidOffMonth.car).toBeLessThan(avalanche.paidOffMonth.car)
  })

  it('reports never when payments do not cover the interest', () => {
    const plan = simulatePayoff([{ id: 'a', balance: 100_000, rate: 24, minPayment: 1_000 }])
    expect(plan.months).toBeNull()
  })

  it('ignores debts already at zero', () => {
    expect(simulatePayoff([{ id: 'a', balance: 0, rate: 5, minPayment: 100 }]).months).toBe(0)
  })
})

describe('monthsFromNow', () => {
  it('names the month the plan finishes', () => {
    expect(monthsFromNow(3, new Date(2026, 10, 22))).toBe('Feb 2027')
  })
})
