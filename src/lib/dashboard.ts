// Dashboard summary API client — aggregated overview for the home screen.
import { apiFetch } from './api'
import { getAccessToken } from './auth'

export interface MonthCashFlow {
  month: string // 'YYYY-MM'
  income: number
  expense: number
}

export interface DashboardSummary {
  /** Σ account currentBalance (debt negative). Raw-summed across currencies. */
  netWorth: number
  totalAssets: number
  /** Positive figure. */
  totalDebt: number
  /** Current month income − expense (proxy for the monthly net-worth delta). */
  monthDelta: number
  /** Last 6 calendar months, oldest first, zero-filled. */
  cashFlow: MonthCashFlow[]
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>('/dashboard/summary', {
    token: getAccessToken() ?? undefined,
  })
}
