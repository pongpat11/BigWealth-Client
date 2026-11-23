// Month-by-month debt payoff simulation for the snowball / avalanche plans.
// Each month every debt accrues interest (APR / 12) and gets its minimum;
// the extra budget, plus the minimums of debts already cleared, goes to the
// first unpaid debt in plan order.

export interface PayoffDebt {
  id: string
  balance: number
  /** Annual rate in percent, e.g. 16 for 16%. */
  rate: number
  minPayment: number
}

export interface PayoffPlan {
  /** Months until the last debt is cleared; null when it never is. */
  months: number | null
  totalInterest: number
  /** Month number (1 = next month) each debt is cleared in. */
  paidOffMonth: Record<string, number>
}

// 50 years: anything slower is effectively "never".
const MAX_MONTHS = 600

/** Simulates paying `debts` off in the given order (first = target first). */
export function simulatePayoff(debts: PayoffDebt[], extraPerMonth = 0): PayoffPlan {
  const live = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ ...d, owed: d.balance }))
  const budget = live.reduce((s, d) => s + d.minPayment, 0) + Math.max(extraPerMonth, 0)
  const paidOffMonth: Record<string, number> = {}
  let totalInterest = 0

  for (let month = 1; month <= MAX_MONTHS; month++) {
    const open = live.filter((d) => d.owed > 0.005)
    if (open.length === 0) return { months: month - 1, totalInterest: round2(totalInterest), paidOffMonth }

    for (const d of open) {
      const interest = (d.owed * d.rate) / 100 / 12
      d.owed += interest
      totalInterest += interest
    }

    // Minimums first, then everything left over down the plan order.
    let available = budget
    for (const d of open) {
      const pay = Math.min(d.minPayment, d.owed, available)
      d.owed -= pay
      available -= pay
    }
    for (const d of open) {
      if (available <= 0) break
      const pay = Math.min(d.owed, available)
      d.owed -= pay
      available -= pay
    }

    for (const d of open) {
      if (d.owed <= 0.005 && paidOffMonth[d.id] === undefined) paidOffMonth[d.id] = month
    }
  }
  return { months: null, totalInterest: round2(totalInterest), paidOffMonth }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** "Mar 2027" for `months` from `from`. */
export function monthsFromNow(months: number, from: Date = new Date()): string {
  return new Date(from.getFullYear(), from.getMonth() + months, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  })
}
