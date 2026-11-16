// Reports API client — trends over a range of whole calendar months.
import { apiFetch } from './api'
import { getAccessToken } from './auth'
import { browserTimezone } from './format'

export const REPORT_RANGES = ['1M', '3M', 'YTD', '1Y'] as const
export type ReportRange = (typeof REPORT_RANGES)[number]

export interface ReportMonth {
  month: string // 'YYYY-MM'
  income: number
  expense: number
  /** Month-end net worth, reconstructed from account transactions. */
  netWorth: number
}

export interface ReportCategory {
  categoryId: string | null
  name: string
  icon: string | null
  color: string | null
  amount: number
}

export interface Report {
  range: ReportRange
  months: ReportMonth[] // oldest first
  totalIncome: number
  totalExpense: number
  spendingByCategory: ReportCategory[] // largest first
}

export async function getReport(range: ReportRange): Promise<Report> {
  const params = new URLSearchParams({ range, timezone: browserTimezone() })
  return apiFetch<Report>(`/reports/summary?${params}`, {
    token: getAccessToken() ?? undefined,
  })
}

/** Quote a CSV field when it contains a comma, quote or line break. */
function csvField(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** The report as CSV: a monthly table, then spending by category. */
export function reportToCsv(report: Report): string {
  const rows: (string | number)[][] = [
    ['Month', 'Income (THB)', 'Expense (THB)', 'Net (THB)', 'Net worth (THB)'],
    ...report.months.map((m) => [m.month, m.income, m.expense, m.income - m.expense, m.netWorth]),
    [],
    ['Category', 'Spent (THB)'],
    ...report.spendingByCategory.map((c) => [c.name, c.amount]),
  ]
  return rows.map((row) => row.map(csvField).join(',')).join('\n')
}
