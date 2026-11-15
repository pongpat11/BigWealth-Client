// Budgets API client. A budget is a standing monthly THB limit on one
// top-level expense category; `spent` is measured for the requested month.
import { apiFetch } from './api'
import { getAccessToken } from './auth'
import { browserTimezone } from './format'

export interface BudgetCategory {
  id: string
  name: string
  icon: string | null
  color: string | null
}

export interface Budget {
  id: string
  categoryId: string
  category: BudgetCategory
  /** Monthly limit in THB. */
  limit: number
  /** THB spent in the category (incl. sub-categories) for the month. */
  spent: number
}

export interface BudgetOverview {
  month: string // 'YYYY-MM'
  totalLimit: number
  totalSpent: number
  items: Budget[]
}

function auth() {
  return { token: getAccessToken() ?? undefined }
}

/** Month boundaries follow the browser's timezone, not UTC. */
function period(month: string): string {
  return '?' + new URLSearchParams({ month, timezone: browserTimezone() }).toString()
}

export async function getBudgets(month: string): Promise<BudgetOverview> {
  return apiFetch<BudgetOverview>(`/budgets${period(month)}`, auth())
}

export async function createBudget(
  input: { categoryId: string; limit: number },
  month: string,
): Promise<Budget> {
  return apiFetch<Budget>(`/budgets${period(month)}`, {
    method: 'POST',
    body: input,
    ...auth(),
  })
}

export async function updateBudget(id: string, limit: number, month: string): Promise<Budget> {
  return apiFetch<Budget>(`/budgets/${id}${period(month)}`, {
    method: 'PATCH',
    body: { limit },
    ...auth(),
  })
}

export async function deleteBudget(id: string): Promise<void> {
  await apiFetch<void>(`/budgets/${id}`, { method: 'DELETE', ...auth() })
}
