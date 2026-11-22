// "Heads up" alerts for the Dashboard, derived on the client from data the app
// already loads: budgets near or over their limit, recurring entries coming
// up, and savings goals with a close deadline.
import type { Budget } from './budgets'
import type { Goal } from './goals'
import type { RecurringRule } from './recurring'
import { formatTHB } from './format'

export type AlertTone = 'danger' | 'warn' | 'info'

export interface Alert {
  id: string
  tone: AlertTone
  title: string
  detail: string
  /** Screen that deals with it. */
  to: string
}

/** Share of a budget used before it's flagged. */
export const BUDGET_WARN_AT = 0.8
/** How far ahead recurring entries are announced, in days. */
export const RECURRING_DAYS_AHEAD = 3
/** How close a goal deadline must be to be flagged, in days. */
export const GOAL_DAYS_AHEAD = 30

const DAY = 86_400_000
const TONE_ORDER: Record<AlertTone, number> = { danger: 0, warn: 1, info: 2 }

/** Whole days from `today` to a 'YYYY-MM-DD' date (local calendar). */
function daysFrom(today: Date, date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((Date.UTC(y, m - 1, d) - start) / DAY)
}

function whenText(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

export function buildAlerts(
  {
    budgets = [],
    recurring = [],
    goals = [],
  }: { budgets?: Budget[]; recurring?: RecurringRule[]; goals?: Goal[] },
  today: Date = new Date(),
): Alert[] {
  const alerts: Alert[] = []
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysLeft = daysInMonth - today.getDate() + 1

  for (const b of budgets) {
    if (b.limit <= 0) continue
    const name = b.category.name
    if (b.spent > b.limit) {
      alerts.push({
        id: `budget-${b.id}`,
        tone: 'danger',
        title: `${name} is over budget`,
        detail: `${formatTHB(b.spent)} of ${formatTHB(b.limit)} · ${formatTHB(b.spent - b.limit)} over`,
        to: '/budgets',
      })
    } else if (b.spent >= b.limit * BUDGET_WARN_AT) {
      const pct = Math.round((b.spent / b.limit) * 100)
      const left = b.limit - b.spent
      alerts.push({
        id: `budget-${b.id}`,
        tone: 'warn',
        title: `${name} at ${pct}% of budget`,
        detail: `${formatTHB(left)} left for ${daysLeft === 1 ? 'today' : `${daysLeft} days`}`,
        to: '/budgets',
      })
    }
  }

  for (const r of recurring) {
    if (!r.nextDate) continue
    const days = daysFrom(today, r.nextDate)
    if (days < 0 || days > RECURRING_DAYS_AHEAD) continue
    const name = r.note || r.category?.name || 'Recurring entry'
    const amount = r.currency === 'THB' ? formatTHB(r.amount) : `${r.amount} ${r.currency}`
    alerts.push({
      id: `recurring-${r.id}`,
      tone: 'info',
      title: r.type === 'income' ? `${name} arrives ${whenText(days)}` : `${name} due ${whenText(days)}`,
      detail: `${r.type === 'income' ? '+' : '−'}${amount}${r.account ? ` · ${r.account.name}` : ''}`,
      to: '/recurring',
    })
  }

  for (const g of goals) {
    if (!g.deadline || g.saved >= g.target) continue
    const days = daysFrom(today, g.deadline)
    if (days > GOAL_DAYS_AHEAD) continue
    const toGo = `${formatTHB(g.target - g.saved)} to go`
    alerts.push({
      id: `goal-${g.id}`,
      tone: days < 0 ? 'warn' : 'info',
      title: days < 0 ? `${g.name} is past its deadline` : `${g.name} due ${whenText(days)}`,
      detail: toGo,
      to: '/goals',
    })
  }

  return alerts.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
}
