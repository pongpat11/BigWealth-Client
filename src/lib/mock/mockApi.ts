// Dev-only in-memory API mock. Enabled when VITE_MOCK is set (see lib/api.ts).
// Lets the frontend run standalone — no backend / Postgres required. State lives
// in module memory: create/edit/delete persist until the page is reloaded.
import { ApiError } from '../api'
import type { Account } from '../accounts'
import type { Budget, BudgetOverview } from '../budgets'
import type { Category } from '../categories'
import type { DashboardSummary, MonthCashFlow } from '../dashboard'
import type { Goal } from '../goals'
import type { Label } from '../labels'
import type { Report, ReportRange } from '../reports'
import type { Transaction, TransactionAccount, TransactionCategory } from '../transactions'

const now = () => new Date().toISOString()
const id = () => Math.random().toString(36).slice(2, 10)
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

// --- Seed data (API DTO shapes) --------------------------------------------

let categories: Category[] = [
  { id: 'salary', name: 'Salary', kind: 'income', parentId: null, icon: 'Wallet', color: '#059669', isDefault: true },
  { id: 'dividend', name: 'Dividend', kind: 'income', parentId: null, icon: 'TrendingUp', color: '#0ea5e9', isDefault: true },
  { id: 'food', name: 'Food & Dining', kind: 'expense', parentId: null, icon: 'UtensilsCrossed', color: '#f59e0b', isDefault: true },
  { id: 'food-restaurants', name: 'Restaurants', kind: 'expense', parentId: 'food', icon: null, color: null, isDefault: true },
  { id: 'transport', name: 'Transport', kind: 'expense', parentId: null, icon: 'Car', color: '#6366f1', isDefault: true },
  { id: 'bills', name: 'Bills & Utilities', kind: 'expense', parentId: null, icon: 'ReceiptText', color: '#ef4444', isDefault: true },
  { id: 'home', name: 'Home / Rent', kind: 'expense', parentId: null, icon: 'Home', color: '#8b5cf6', isDefault: true },
  { id: 'side-hustle', name: 'Side Hustle', kind: 'income', parentId: null, icon: null, color: null, isDefault: false },
]

let labels: Label[] = [
  { id: 'recurring', name: 'Recurring', color: '#6366f1', isDefault: true },
  { id: 'tax', name: 'Tax-deductible', color: '#059669', isDefault: true },
  { id: 'reimburse', name: 'Reimbursable', color: '#f59e0b', isDefault: false },
]

// Stored form holds the starting balance; currentBalance is derived on read.
type StoredAccount = Omit<Account, 'currentBalance'>

let accounts: StoredAccount[] = [
  { id: 'kbank', name: 'KBank Savings', institution: 'Kasikornbank', type: 'bank', currency: 'THB', balance: 285_400, createdAt: daysAgo(120) },
  { id: 'scb', name: 'SCB Current', institution: 'Siam Commercial', type: 'bank', currency: 'THB', balance: 64_200, createdAt: daysAgo(118) },
  { id: 'cash', name: 'Cash Wallet', institution: null, type: 'cash', currency: 'THB', balance: 5_800, createdAt: daysAgo(110) },
  { id: 'settrade', name: 'SET Brokerage', institution: 'Settrade', type: 'investment', currency: 'THB', balance: 612_000, createdAt: daysAgo(90) },
  { id: 'ibkr', name: 'IBKR (US)', institution: 'Interactive Brokers', type: 'investment', currency: 'USD', balance: 14_850, createdAt: daysAgo(60) },
  // Debt balance is stored positive (amount owed); the UI renders it negative.
  { id: 'card', name: 'KBank Credit Card', institution: 'Kasikornbank', type: 'debt', currency: 'THB', balance: 32_500, interestRate: 16, minPayment: 3_250, originalAmount: null, createdAt: daysAgo(100) },
  { id: 'car', name: 'Car Loan', institution: 'TTB', type: 'debt', currency: 'THB', balance: 285_000, interestRate: 3.2, minPayment: 8_900, originalAmount: 480_000, createdAt: daysAgo(95) },
  { id: 'student', name: 'Student Loan (กยศ.)', institution: null, type: 'debt', currency: 'THB', balance: 84_000, interestRate: 1, minPayment: 1_500, originalAmount: 120_000, createdAt: daysAgo(94) },
]

function txCategory(catId: string | null): TransactionCategory | null {
  const c = categories.find((x) => x.id === catId)
  return c ? { id: c.id, name: c.name, kind: c.kind, icon: c.icon, color: c.color } : null
}

function txAccount(accId: string | null): TransactionAccount | null {
  const a = accounts.find((x) => x.id === accId)
  return a ? { id: a.id, name: a.name, type: a.type } : null
}

/** Derive currentBalance = starting balance ± this account's transactions. */
function withCurrentBalance(a: StoredAccount): Account {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (t.accountId !== a.id || t.currency !== a.currency) continue
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  const delta = a.type === 'debt' ? expense - income : income - expense
  return { ...a, currentBalance: a.balance + delta }
}

interface TxSeed {
  id: string
  type: 'income' | 'expense'
  amount: number
  categoryId: string
  accountId: string
  note: string
  date: string
  labelIds?: string[]
}
const txSeeds: TxSeed[] = [
  { id: 't1', type: 'expense', amount: 185, categoryId: 'food', accountId: 'cash', note: 'Lunch — som tam', date: daysAgo(0) },
  { id: 't2', type: 'expense', amount: 1_290, categoryId: 'food-restaurants', accountId: 'card', note: 'Dinner — Japanese', date: daysAgo(1) },
  { id: 't3', type: 'expense', amount: 60, categoryId: 'transport', accountId: 'cash', note: 'BTS', date: daysAgo(1) },
  { id: 't4', type: 'income', amount: 2_400, categoryId: 'dividend', accountId: 'settrade', note: 'PTT dividend', date: daysAgo(2), labelIds: ['tax'] },
  { id: 't5', type: 'expense', amount: 3_200, categoryId: 'bills', accountId: 'kbank', note: 'Electricity', date: daysAgo(3), labelIds: ['recurring'] },
  { id: 't6', type: 'income', amount: 65_000, categoryId: 'salary', accountId: 'kbank', note: 'Monthly salary', date: daysAgo(5), labelIds: ['recurring'] },
  { id: 't7', type: 'expense', amount: 15_000, categoryId: 'home', accountId: 'kbank', note: 'Condo rent', date: daysAgo(6), labelIds: ['recurring'] },
]
let transactions: Transaction[] = txSeeds.map((s) => ({
  id: s.id,
  type: s.type,
  amount: s.amount,
  currency: 'THB',
  categoryId: s.categoryId,
  subCategoryId: null,
  category: txCategory(s.categoryId),
  subCategory: null,
  accountId: s.accountId,
  account: txAccount(s.accountId),
  note: s.note,
  date: s.date,
  timezone: 'Asia/Bangkok',
  createdAt: s.date,
  labels: (s.labelIds ?? []).map((lid) => {
    const l = labels.find((x) => x.id === lid)!
    return { id: l.id, name: l.name, color: l.color }
  }),
}))

// Budgets store only the limit; `spent` is derived from transactions on read.
let budgets: { id: string; categoryId: string; limit: number }[] = [
  { id: 'b-food', categoryId: 'food', limit: 12_000 },
  { id: 'b-transport', categoryId: 'transport', limit: 3_000 },
  { id: 'b-bills', categoryId: 'bills', limit: 3_000 },
]

/** Top-level category a transaction counts against (sub-categories roll up). */
function rootCategoryId(catId: string | null): string | null {
  const c = categories.find((x) => x.id === catId)
  return c ? (c.parentId ?? c.id) : null
}

function withSpent(b: (typeof budgets)[number], month: string): Budget {
  const c = categories.find((x) => x.id === b.categoryId)
  const spent = transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.currency === 'THB' &&
        rootCategoryId(t.categoryId) === b.categoryId &&
        t.date.slice(0, 7) === month,
    )
    .reduce((s, t) => s + t.amount, 0)
  return {
    id: b.id,
    categoryId: b.categoryId,
    category: {
      id: b.categoryId,
      name: c?.name ?? 'Unknown',
      icon: c?.icon ?? null,
      color: c?.color ?? null,
    },
    limit: b.limit,
    spent,
  }
}

const dateIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

let goals: Goal[] = [
  { id: 'g-macbook', name: 'New MacBook', target: 75_000, saved: 71_000, deadline: dateIn(60), createdAt: daysAgo(200) },
  { id: 'g-emergency', name: 'Emergency Fund', target: 300_000, saved: 210_000, deadline: null, createdAt: daysAgo(400) },
  { id: 'g-japan', name: 'Japan Trip', target: 60_000, saved: 60_000, deadline: dateIn(-20), createdAt: daysAgo(300) },
]

// --- Request helpers --------------------------------------------------------

type Body = Record<string, unknown> | undefined
const tokens = () => ({ accessToken: `mock.${id()}`, refreshToken: `mock.${id()}` })

function notFound(what: string): never {
  throw new ApiError(404, `${what} not found`)
}

// --- Router -----------------------------------------------------------------

export async function mockFetch<T>(path: string, method: string, body: Body): Promise<T> {
  await new Promise((r) => setTimeout(r, 120)) // feel like a real request
  const p = path.split('?')[0]
  const seg = p.split('/').filter(Boolean) // e.g. ['accounts','abc']
  const [resource, param] = seg

  // Auth --------------------------------------------------------------------
  if (resource === 'auth') {
    if (param === 'login')
      return {
        ...tokens(),
        user: { id: 'demo-user', email: String(body?.email ?? 'demo@bigwealth.app'), name: 'Demo', createdAt: now() },
      } as T
    if (param === 'refresh') return tokens() as T
    if (param === 'logout') return undefined as T
    if (param === 'me')
      return {
        user: { id: 'demo-user', email: 'demo@bigwealth.app', name: 'Demo', createdAt: now() },
      } as T
    notFound('Endpoint')
  }

  // Accounts ----------------------------------------------------------------
  if (resource === 'accounts') {
    if (method === 'GET') return { items: accounts.map(withCurrentBalance) } as T
    if (method === 'POST') {
      const a: StoredAccount = {
        id: id(),
        name: String(body?.name ?? ''),
        institution: (body?.institution as string)?.trim() ? String(body?.institution) : null,
        type: body?.type as Account['type'],
        currency: (body?.currency as Account['currency']) ?? 'THB',
        balance: Number(body?.balance ?? 0),
        interestRate: (body?.interestRate as number | null) ?? null,
        minPayment: (body?.minPayment as number | null) ?? null,
        originalAmount: (body?.originalAmount as number | null) ?? null,
        createdAt: now(),
      }
      accounts = [...accounts, a]
      return withCurrentBalance(a) as T
    }
    const acc = accounts.find((x) => x.id === param)
    if (!acc) notFound('Account')
    if (method === 'PATCH') {
      const updated: StoredAccount = {
        ...acc,
        ...(body?.name !== undefined && { name: String(body.name) }),
        ...(body?.institution !== undefined && {
          institution: String(body.institution).trim() ? String(body.institution) : null,
        }),
        ...(body?.type !== undefined && { type: body.type as Account['type'] }),
        ...(body?.currency !== undefined && { currency: body.currency as Account['currency'] }),
        ...(body?.balance !== undefined && { balance: Number(body.balance) }),
        ...(body?.interestRate !== undefined && { interestRate: body.interestRate as number | null }),
        ...(body?.minPayment !== undefined && { minPayment: body.minPayment as number | null }),
        ...(body?.originalAmount !== undefined && {
          originalAmount: body.originalAmount as number | null,
        }),
      }
      accounts = accounts.map((x) => (x.id === param ? updated : x))
      return withCurrentBalance(updated) as T
    }
    if (method === 'DELETE') {
      accounts = accounts.filter((x) => x.id !== param)
      return undefined as T
    }
  }

  // Dashboard ----------------------------------------------------------------
  if (resource === 'dashboard' && param === 'summary' && method === 'GET') {
    let totalAssets = 0
    let totalDebt = 0
    for (const a of accounts.map(withCurrentBalance)) {
      if (a.type === 'debt') totalDebt += a.currentBalance
      else totalAssets += a.currentBalance
    }
    // Last 6 calendar months (UTC), oldest first, zero-filled — mirrors the server.
    const months = 6
    const start = (back: number) => {
      const d = new Date()
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1))
    }
    const cashFlow: MonthCashFlow[] = Array.from({ length: months }, (_, i) => ({
      month: start(months - 1 - i).toISOString().slice(0, 7),
      income: 0,
      expense: 0,
    }))
    const byMonth = new Map(cashFlow.map((m) => [m.month, m]))
    for (const t of transactions) {
      const bucket = byMonth.get(t.date.slice(0, 7))
      if (!bucket) continue
      if (t.type === 'income') bucket.income += t.amount
      else bucket.expense += t.amount
    }
    const current = cashFlow[cashFlow.length - 1]
    const summary: DashboardSummary = {
      netWorth: totalAssets - totalDebt,
      totalAssets,
      totalDebt,
      monthDelta: current.income - current.expense,
      cashFlow,
    }
    return summary as T
  }

  // Budgets -----------------------------------------------------------------
  if (resource === 'budgets') {
    const month =
      new URLSearchParams(path.split('?')[1] ?? '').get('month') ?? now().slice(0, 7)
    if (method === 'GET') {
      const items = budgets.map((b) => withSpent(b, month))
      const overview: BudgetOverview = {
        month,
        totalLimit: items.reduce((s, b) => s + b.limit, 0),
        totalSpent: items.reduce((s, b) => s + b.spent, 0),
        items,
      }
      return overview as T
    }
    if (method === 'POST') {
      const categoryId = String(body?.categoryId ?? '')
      if (budgets.some((b) => b.categoryId === categoryId))
        throw new ApiError(409, 'This category already has a budget')
      const b = { id: id(), categoryId, limit: Number(body?.limit ?? 0) }
      budgets = [...budgets, b]
      return withSpent(b, month) as T
    }
    const existing = budgets.find((x) => x.id === param)
    if (!existing) notFound('Budget')
    if (method === 'PATCH') {
      const updated = { ...existing, limit: Number(body?.limit ?? existing.limit) }
      budgets = budgets.map((x) => (x.id === param ? updated : x))
      return withSpent(updated, month) as T
    }
    if (method === 'DELETE') {
      budgets = budgets.filter((x) => x.id !== param)
      return undefined as T
    }
  }

  // Reports -----------------------------------------------------------------
  if (resource === 'reports' && param === 'summary' && method === 'GET') {
    const range = (new URLSearchParams(path.split('?')[1] ?? '').get('range') ?? '3M') as ReportRange
    const today = new Date()
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const count = range === '1M' ? 1 : range === '3M' ? 3 : range === '1Y' ? 12 : today.getMonth() + 1
    const keys = Array.from({ length: count }, (_, i) =>
      key(new Date(today.getFullYear(), today.getMonth() - (count - 1 - i), 1)),
    )
    const months = keys.map((month) => ({ month, income: 0, expense: 0, netWorth: 0 }))
    const byKey = new Map(months.map((m) => [m.month, m]))
    const flow = new Map<string, number>()
    const spend = new Map<string | null, number>()
    for (const t of transactions) {
      const k = key(new Date(t.date))
      const signed = t.type === 'income' ? t.amount : -t.amount
      const acc = accounts.find((a) => a.id === t.accountId)
      if (acc && acc.currency === t.currency) flow.set(k, (flow.get(k) ?? 0) + signed)
      const bucket = byKey.get(k)
      if (!bucket || t.currency !== 'THB') continue
      if (t.type === 'income') bucket.income += t.amount
      else {
        bucket.expense += t.amount
        const root = rootCategoryId(t.categoryId)
        spend.set(root, (spend.get(root) ?? 0) + t.amount)
      }
    }
    // Walk back from today's net worth, as the server does.
    let netWorth = accounts
      .map(withCurrentBalance)
      .reduce((s, a) => s + (a.type === 'debt' ? -a.currentBalance : a.currentBalance), 0)
    for (const m of [...months].reverse()) {
      m.netWorth = netWorth
      netWorth -= flow.get(m.month) ?? 0
    }
    const report: Report = {
      range,
      months,
      totalIncome: months.reduce((s, m) => s + m.income, 0),
      totalExpense: months.reduce((s, m) => s + m.expense, 0),
      spendingByCategory: [...spend.entries()]
        .map(([categoryId, amount]) => {
          const c = categories.find((x) => x.id === categoryId)
          return {
            categoryId: c?.id ?? null,
            name: c?.name ?? 'Uncategorized',
            icon: c?.icon ?? null,
            color: c?.color ?? null,
            amount,
          }
        })
        .sort((a, b) => b.amount - a.amount),
    }
    return report as T
  }

  // Goals -------------------------------------------------------------------
  if (resource === 'goals') {
    if (method === 'GET') return { items: goals } as T
    const fromBody = (base: Goal): Goal => ({
      ...base,
      ...(body?.name !== undefined && { name: String(body.name) }),
      ...(body?.target !== undefined && { target: Number(body.target) }),
      ...(body?.saved !== undefined && { saved: Number(body.saved) }),
      ...(body?.deadline !== undefined && { deadline: (body.deadline as string | null) ?? null }),
    })
    if (method === 'POST') {
      const g = fromBody({ id: id(), name: '', target: 0, saved: 0, deadline: null, createdAt: now() })
      goals = [...goals, g]
      return g as T
    }
    const goal = goals.find((x) => x.id === param)
    if (!goal) notFound('Goal')
    if (method === 'PATCH') {
      const updated = fromBody(goal)
      goals = goals.map((x) => (x.id === param ? updated : x))
      return updated as T
    }
    if (method === 'DELETE') {
      goals = goals.filter((x) => x.id !== param)
      return undefined as T
    }
  }

  // Categories --------------------------------------------------------------
  if (resource === 'categories') {
    if (method === 'GET') return { items: categories } as T
    if (method === 'POST') {
      const c: Category = {
        id: id(),
        name: String(body?.name ?? ''),
        kind: body?.kind as Category['kind'],
        parentId: (body?.parentId as string) ?? null,
        icon: (body?.icon as string) ?? null,
        color: (body?.color as string) ?? null,
        isDefault: false,
      }
      categories = [...categories, c]
      return c as T
    }
    const cat = categories.find((x) => x.id === param)
    if (!cat) notFound('Category')
    if (cat.isDefault) throw new ApiError(403, 'Built-in categories cannot be modified')
    if (method === 'PATCH') {
      const updated: Category = {
        ...cat,
        ...(body?.name !== undefined && { name: String(body.name) }),
        ...(body?.icon !== undefined && { icon: String(body.icon) }),
        ...(body?.color !== undefined && { color: String(body.color) }),
      }
      categories = categories.map((x) => (x.id === param ? updated : x))
      return updated as T
    }
    if (method === 'DELETE') {
      categories = categories.filter((x) => x.id !== param && x.parentId !== param)
      return undefined as T
    }
  }

  // Labels ------------------------------------------------------------------
  if (resource === 'labels') {
    if (method === 'GET') return { items: labels } as T
    if (method === 'POST') {
      const l: Label = {
        id: id(),
        name: String(body?.name ?? ''),
        color: (body?.color as string) ?? null,
        isDefault: false,
      }
      labels = [...labels, l]
      return l as T
    }
    const lbl = labels.find((x) => x.id === param)
    if (!lbl) notFound('Label')
    if (lbl.isDefault) throw new ApiError(403, 'Built-in labels cannot be modified')
    if (method === 'PATCH') {
      const updated: Label = {
        ...lbl,
        ...(body?.name !== undefined && { name: String(body.name) }),
        ...(body?.color !== undefined && { color: String(body.color) }),
      }
      labels = labels.map((x) => (x.id === param ? updated : x))
      return updated as T
    }
    if (method === 'DELETE') {
      labels = labels.filter((x) => x.id !== param)
      return undefined as T
    }
  }

  // Transactions ------------------------------------------------------------
  if (resource === 'transactions') {
    if (method === 'GET') {
      const qs = new URLSearchParams(path.split('?')[1] ?? '')
      const f = (k: string) => qs.get(k)
      const rows = [...transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .filter(
          (t) =>
            (!f('type') || t.type === f('type')) &&
            (!f('accountId') || t.accountId === f('accountId')) &&
            (!f('categoryId') ||
              t.categoryId === f('categoryId') ||
              t.subCategoryId === f('categoryId')) &&
            (!f('labelId') || t.labels.some((l) => l.id === f('labelId'))) &&
            (!f('from') || t.date >= new Date(f('from')!).toISOString()) &&
            (!f('to') || t.date < new Date(f('to')!).toISOString()) &&
            (!f('q') || (t.note ?? '').toLowerCase().includes(f('q')!.toLowerCase())),
        )
      const limit = Number(f('limit') ?? 50)
      const start = f('cursor') ? rows.findIndex((t) => t.id === f('cursor')) + 1 : 0
      const items = rows.slice(start, start + limit)
      return {
        items,
        nextCursor: start + limit < rows.length ? items[items.length - 1].id : null,
      } as T
    }
    const buildTx = (base: Partial<Transaction>): Transaction => {
      const catId = (body?.categoryId as string) ?? null
      const subId = (body?.subCategoryId as string) ?? null
      const accId = (body?.accountId as string) ?? null
      const labelIds = (body?.labelIds as string[]) ?? []
      return {
        id: base.id ?? id(),
        type: body?.type as Transaction['type'],
        amount: Number(body?.amount ?? 0),
        currency: String(body?.currency ?? 'THB'),
        categoryId: catId,
        subCategoryId: subId,
        category: txCategory(catId),
        subCategory: txCategory(subId),
        accountId: accId,
        account: txAccount(accId),
        note: (body?.note as string) ?? null,
        date: String(body?.date ?? now()),
        timezone: (body?.timezone as string) ?? null,
        createdAt: base.createdAt ?? now(),
        labels: labelIds
          .map((lid) => labels.find((x) => x.id === lid))
          .filter((l): l is Label => Boolean(l))
          .map((l) => ({ id: l.id, name: l.name, color: l.color })),
      }
    }
    if (method === 'POST') {
      const t = buildTx({})
      transactions = [...transactions, t]
      return t as T
    }
    const existing = transactions.find((x) => x.id === param)
    if (!existing) notFound('Transaction')
    if (method === 'PUT') {
      const t = buildTx({ id: existing.id, createdAt: existing.createdAt })
      transactions = transactions.map((x) => (x.id === param ? t : x))
      return t as T
    }
    if (method === 'DELETE') {
      transactions = transactions.filter((x) => x.id !== param)
      return undefined as T
    }
  }

  throw new ApiError(404, `No mock handler for ${method} ${path}`)
}
