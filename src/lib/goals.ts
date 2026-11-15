// Savings Goals API client. Amounts are THB; `saved` is updated by the user.
import { apiFetch } from './api'
import { getAccessToken } from './auth'

export interface Goal {
  id: string
  name: string
  target: number
  saved: number
  /** 'YYYY-MM-DD', or null when the goal has no deadline. */
  deadline: string | null
  createdAt: string
}

export interface GoalInput {
  name: string
  target: number
  saved: number
  deadline: string | null
}

function auth() {
  return { token: getAccessToken() ?? undefined }
}

export async function listGoals(): Promise<Goal[]> {
  const { items } = await apiFetch<{ items: Goal[] }>('/goals', auth())
  return items
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  return apiFetch<Goal>('/goals', { method: 'POST', body: input, ...auth() })
}

export async function updateGoal(id: string, input: Partial<GoalInput>): Promise<Goal> {
  return apiFetch<Goal>(`/goals/${id}`, { method: 'PATCH', body: input, ...auth() })
}

export async function deleteGoal(id: string): Promise<void> {
  await apiFetch<void>(`/goals/${id}`, { method: 'DELETE', ...auth() })
}

/**
 * What it takes to reach a goal on time. `monthsLeft` counts the months
 * remaining until the deadline (at least 1 while it's still ahead), and
 * `perMonth` is the even contribution needed over them.
 */
export function goalPlan(
  goal: Pick<Goal, 'target' | 'saved' | 'deadline'>,
  today: Date = new Date(),
): { remaining: number; monthsLeft: number | null; perMonth: number | null; overdue: boolean } {
  const remaining = Math.max(goal.target - goal.saved, 0)
  if (!goal.deadline || remaining === 0) {
    return { remaining, monthsLeft: null, perMonth: null, overdue: false }
  }
  const [y, m, d] = goal.deadline.split('-').map(Number)
  const end = new Date(y, m - 1, d)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (end < start) return { remaining, monthsLeft: 0, perMonth: null, overdue: true }
  const whole =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    (end.getDate() > start.getDate() ? 1 : 0)
  const monthsLeft = Math.max(whole, 1)
  return { remaining, monthsLeft, perMonth: Math.ceil(remaining / monthsLeft), overdue: false }
}
