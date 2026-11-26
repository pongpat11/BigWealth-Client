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
import { nextOccurrenceOnOrAfter, todayKey, type RecurringRule } from '../recurring'
import { goldUnitOf, type Dividend, type DividendList, type Holding, type Portfolio } from '../portfolio'
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

// Stored form holds the starting balance; cash, holdings and currentBalance are derived on read.
type StoredAccount = Omit<Account, 'currentBalance' | 'cashBalance' | 'holdingsValue'>

let accounts: StoredAccount[] = [
  { id: 'kbank', name: 'KBank Savings', institution: 'Kasikornbank', type: 'bank', currency: 'THB', balance: 285_400, createdAt: daysAgo(120) },
  { id: 'scb', name: 'SCB Current', institution: 'Siam Commercial', type: 'bank', currency: 'THB', balance: 64_200, createdAt: daysAgo(118) },
  { id: 'cash', name: 'Cash Wallet', institution: null, type: 'cash', currency: 'THB', balance: 5_800, createdAt: daysAgo(110) },
  // Investment balances are uninvested cash; linked holdings add to the value.
  { id: 'settrade', name: 'SET Brokerage', institution: 'Settrade', type: 'investment', currency: 'THB', balance: 48_500, createdAt: daysAgo(90) },
  { id: 'ibkr', name: 'IBKR (US)', institution: 'Interactive Brokers', type: 'investment', currency: 'USD', balance: 8_900, createdAt: daysAgo(60) },
  { id: 'binance', name: 'Binance', institution: null, type: 'investment', currency: 'USD', balance: 150, createdAt: daysAgo(58) },
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
/** Linked holdings' market value in the account's currency (mock rate). */
function holdingsValueOf(a: StoredAccount): number {
  let total = 0
  for (const h of holdings) {
    if (h.accountId !== a.id) continue
    const value = h.quantity * h.price
    total += h.currency === a.currency ? value : h.currency === 'USD' ? value * MOCK_USD_THB : value / MOCK_USD_THB
  }
  return Math.round(total * 100) / 100
}

/** 400 unless `accountId` is one of the investment accounts, like the server. */
function assertInvestmentAccount(accountId: unknown): void {
  if (accountId === undefined) return
  const a = accounts.find((x) => x.id === accountId)
  if (!a || a.type !== 'investment') throw new ApiError(400, 'Invalid account')
}

function withCurrentBalance(a: StoredAccount): Account {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (t.currency !== a.currency) continue
    // A transfer is an outflow from `accountId` and an inflow to `toAccountId`.
    if (t.type === 'transfer' && t.toAccountId === a.id) income += t.amount
    if (t.accountId !== a.id) continue
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  const delta = a.type === 'debt' ? expense - income : income - expense
  const cashBalance = a.balance + delta
  const holdingsValue = holdingsValueOf(a)
  return { ...a, cashBalance, holdingsValue, currentBalance: cashBalance + holdingsValue }
}

interface TxSeed {
  id: string
  type: Transaction['type']
  amount: number
  categoryId: string | null
  accountId: string
  toAccountId?: string
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
  { id: 't8', type: 'transfer', amount: 2_000, categoryId: null, accountId: 'kbank', toAccountId: 'cash', note: 'ATM withdrawal', date: daysAgo(4) },
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
  toAccountId: s.toAccountId ?? null,
  toAccount: txAccount(s.toAccountId ?? null),
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

// Portfolio: stored rows hold only what the user enters; values are derived.
const MOCK_USD_THB = 34
type StoredHolding = Pick<
  Holding,
  'id' | 'accountId' | 'symbol' | 'name' | 'assetClass' | 'goldUnit' | 'currency' | 'quantity' | 'avgCost' | 'price' | 'priceUpdatedAt' | 'autoPrice'
>
let holdings: StoredHolding[] = [
  { id: 'h-ptt', accountId: 'settrade', symbol: 'PTT', name: 'PTT PCL', assetClass: 'set', currency: 'THB', quantity: 5000, avgCost: 34.5, price: 38.25, priceUpdatedAt: daysAgo(2), autoPrice: true },
  { id: 'h-cpall', accountId: 'settrade', symbol: 'CPALL', name: 'CP All', assetClass: 'set', currency: 'THB', quantity: 4000, avgCost: 62, price: 58.5, priceUpdatedAt: daysAgo(2) },
  { id: 'h-voo', accountId: 'ibkr', symbol: 'VOO', name: 'Vanguard S&P 500', assetClass: 'us', currency: 'USD', quantity: 12, avgCost: 412, price: 498, priceUpdatedAt: daysAgo(1), autoPrice: true },
  { id: 'h-kfsdiv', accountId: 'settrade', symbol: 'KFSDIV', name: 'Krungsri Dividend', assetClass: 'fund', currency: 'THB', quantity: 8200, avgCost: 18.2, price: 19.05, priceUpdatedAt: daysAgo(5) },
  { id: 'h-btc', accountId: 'binance', symbol: 'BTC', name: 'Bitcoin', assetClass: 'crypto', currency: 'USD', quantity: 0.045, avgCost: 61000, price: 68500, priceUpdatedAt: daysAgo(1), autoPrice: true },
  { id: 'h-gold', accountId: null, symbol: 'GOLD', name: 'Gold bar 96.5%', assetClass: 'gold', goldUnit: 'baht', currency: 'THB', quantity: 2, avgCost: 41000, price: 44200, priceUpdatedAt: daysAgo(3) },
  { id: 'h-gold-oz', accountId: 'ibkr', symbol: 'XAU', name: 'Gold spot', assetClass: 'gold', goldUnit: 'oz', currency: 'USD', quantity: 1.5, avgCost: 2950, price: 3480, priceUpdatedAt: daysAgo(1), autoPrice: true },
]
type StoredDividend = Omit<Dividend, 'net' | 'netTHB'>
let dividendRows: StoredDividend[] = [
  { id: 'd-ptt', accountId: 'settrade', symbol: 'PTT', payDate: dateIn(-40), currency: 'THB', gross: 2400, withholdingTax: 240 },
  { id: 'd-voo', accountId: 'ibkr', symbol: 'VOO', payDate: dateIn(-75), currency: 'USD', gross: 20.4, withholdingTax: 3.06 },
  { id: 'd-cpall', accountId: 'settrade', symbol: 'CPALL', payDate: dateIn(-190), currency: 'THB', gross: 4000, withholdingTax: 400 },
]
const thbFactor = (currency: string) => (currency === 'USD' ? MOCK_USD_THB : 1)
function valued(h: StoredHolding): Holding {
  const marketValue = h.quantity * h.price
  const costBasis = h.quantity * h.avgCost
  return {
    ...h,
    goldUnit: goldUnitOf(h),
    marketValue,
    costBasis,
    marketValueTHB: marketValue * thbFactor(h.currency),
    costBasisTHB: costBasis * thbFactor(h.currency),
    gainPct: costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : null,
  }
}
function withNet(d: StoredDividend): Dividend {
  const net = d.gross - d.withholdingTax
  return { ...d, net, netTHB: net * thbFactor(d.currency) }
}

// Stored without derived fields; nextDate / category / account are added on read.
type StoredRule = Omit<RecurringRule, 'nextDate' | 'category' | 'subCategory' | 'account'>
const monthDay = (day: number) => {
  const d = new Date()
  return `${d.getFullYear() - 1}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
let recurringRules: StoredRule[] = [
  { id: 'r-salary', type: 'income', amount: 65_000, currency: 'THB', categoryId: 'salary', subCategoryId: null, accountId: 'kbank', note: 'Monthly salary', labelIds: ['recurring'], frequency: 'monthly', interval: 1, startDate: monthDay(25), endDate: null, timezone: 'Asia/Bangkok', active: true, createdAt: daysAgo(300) },
  { id: 'r-rent', type: 'expense', amount: 15_000, currency: 'THB', categoryId: 'home', subCategoryId: null, accountId: 'kbank', note: 'Condo rent', labelIds: ['recurring'], frequency: 'monthly', interval: 1, startDate: monthDay(1), endDate: null, timezone: 'Asia/Bangkok', active: true, createdAt: daysAgo(300) },
  { id: 'r-netflix', type: 'expense', amount: 419, currency: 'THB', categoryId: 'bills', subCategoryId: null, accountId: 'card', note: 'Netflix', labelIds: [], frequency: 'monthly', interval: 1, startDate: monthDay(12), endDate: null, timezone: 'Asia/Bangkok', active: true, createdAt: daysAgo(200) },
  { id: 'r-insurance', type: 'expense', amount: 18_500, currency: 'THB', categoryId: 'bills', subCategoryId: null, accountId: 'kbank', note: 'Car insurance', labelIds: [], frequency: 'yearly', interval: 1, startDate: monthDay(5), endDate: null, timezone: 'Asia/Bangkok', active: false, createdAt: daysAgo(200) },
]

function withNext(r: StoredRule): RecurringRule {
  let nextDate: string | null = r.active ? nextOccurrenceOnOrAfter(r, todayKey()) : null
  if (nextDate && r.endDate && nextDate > r.endDate) nextDate = null
  return {
    ...r,
    category: txCategory(r.categoryId),
    subCategory: txCategory(r.subCategoryId),
    account: txAccount(r.accountId),
    nextDate,
  }
}

let mockUserName: string | null = 'Demo'

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
    if (param === 'me') {
      if (method === 'PATCH') mockUserName = (body?.name as string | null) ?? null
      return {
        user: { id: 'demo-user', email: 'demo@bigwealth.app', name: mockUserName, createdAt: now() },
      } as T
    }
    if (param === 'change-password') return tokens() as T
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
      if (
        body?.type !== undefined &&
        body.type !== 'investment' &&
        acc.type === 'investment' &&
        holdings.some((h) => h.accountId === acc.id)
      ) {
        throw new ApiError(400, 'Move or delete the holdings in this account before changing its type')
      }
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
      // As on the server: a transfer left with no account at all goes too; other
      // transactions just lose the account.
      transactions = transactions
        .filter(
          (t) =>
            !(
              t.type === 'transfer' &&
              ((t.accountId === param && !t.toAccountId) ||
                (t.toAccountId === param && !t.accountId))
            ),
        )
        .map((t) => ({
          ...t,
          ...(t.accountId === param && { accountId: null, account: null }),
          ...(t.toAccountId === param && { toAccountId: null, toAccount: null }),
        }))
      // ON DELETE SET NULL, as on the server.
      holdings = holdings.map((h) => (h.accountId === param ? { ...h, accountId: null } : h))
      dividendRows = dividendRows.map((d) => (d.accountId === param ? { ...d, accountId: null } : d))
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
      if (!bucket || t.type === 'transfer') continue
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

  // Portfolio ---------------------------------------------------------------
  const mockFx = { usdThb: MOCK_USD_THB, date: now().slice(0, 10) }
  // `?accountId=<id>` keeps one account's rows; `none` keeps unassigned ones.
  const accountQuery = new URLSearchParams(path.split('?')[1] ?? '').get('accountId')
  const inAccount = (row: { accountId?: string | null }) =>
    accountQuery === null || (row.accountId ?? null) === (accountQuery === 'none' ? null : accountQuery)
  if (resource === 'portfolio' && method === 'GET') {
    const rows = holdings.filter(inAccount).map(valued)
    const totalValueTHB = rows.reduce((s, h) => s + (h.marketValueTHB ?? 0), 0)
    const totalCostTHB = rows.reduce((s, h) => s + (h.costBasisTHB ?? 0), 0)
    const byClass = new Map<Holding['assetClass'], number>()
    for (const h of rows) {
      byClass.set(h.assetClass, (byClass.get(h.assetClass) ?? 0) + (h.marketValueTHB ?? 0))
    }
    const portfolio: Portfolio = {
      fx: mockFx,
      totalValueTHB,
      totalCostTHB,
      totalGainTHB: totalValueTHB - totalCostTHB,
      totalGainPct: totalCostTHB > 0 ? ((totalValueTHB - totalCostTHB) / totalCostTHB) * 100 : null,
      unconvertedCount: 0,
      holdings: rows,
      allocation: [...byClass.entries()]
        .map(([assetClass, valueTHB]) => ({
          assetClass,
          valueTHB,
          pct: totalValueTHB > 0 ? (valueTHB / totalValueTHB) * 100 : 0,
        }))
        .sort((a, b) => b.valueTHB - a.valueTHB),
    }
    return portfolio as T
  }
  if (resource === 'holdings') {
    if (method === 'POST') {
      const input = body as unknown as Omit<StoredHolding, 'id' | 'priceUpdatedAt' | 'price'> & { price?: number }
      assertInvestmentAccount(input.accountId)
      // No market feed in the mock: an auto-priced holding without a price gets its cost.
      const h = { ...input, accountId: input.accountId ?? null, price: input.price ?? input.avgCost, id: id(), priceUpdatedAt: now() }
      holdings = [...holdings, h]
      return valued(h) as T
    }
    const existing = holdings.find((x) => x.id === param)
    if (!existing) notFound('Holding')
    if (method === 'PATCH') {
      assertInvestmentAccount(body?.accountId)
      const patch = body as Partial<StoredHolding>
      // Like the server: a gold edit without a unit keeps the one it counts now.
      const updated = { ...existing, goldUnit: goldUnitOf(existing), ...patch, priceUpdatedAt: now() }
      holdings = holdings.map((x) => (x.id === param ? updated : x))
      return valued(updated) as T
    }
    if (method === 'DELETE') {
      holdings = holdings.filter((x) => x.id !== param)
      return undefined as T
    }
  }
  if (resource === 'dividends') {
    if (method === 'GET') {
      const year = new URLSearchParams(path.split('?')[1] ?? '').get('year')
      const items = dividendRows
        .filter((d) => (!year || d.payDate.startsWith(year)) && inAccount(d))
        .sort((a, b) => b.payDate.localeCompare(a.payDate))
        .map(withNet)
      const totalGrossTHB = items.reduce((s, d) => s + d.gross * thbFactor(d.currency), 0)
      const totalTaxTHB = items.reduce((s, d) => s + d.withholdingTax * thbFactor(d.currency), 0)
      const list: DividendList = {
        fx: mockFx,
        totalGrossTHB,
        totalTaxTHB,
        totalNetTHB: totalGrossTHB - totalTaxTHB,
        unconvertedCount: 0,
        items,
      }
      return list as T
    }
    if (method === 'POST') {
      assertInvestmentAccount(body?.accountId)
      const input = body as unknown as Omit<StoredDividend, 'id'>
      const d = { ...input, accountId: input.accountId ?? null, id: id() }
      dividendRows = [...dividendRows, d]
      return withNet(d) as T
    }
    if (method === 'DELETE') {
      dividendRows = dividendRows.filter((x) => x.id !== param)
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
      if (t.type === 'transfer') {
        // Each side on its own, as balances do: nets to zero between own
        // accounts; to/from nowhere it moves net worth.
        const from = accounts.find((a) => a.id === t.accountId)
        const to = accounts.find((a) => a.id === t.toAccountId)
        let f = 0
        if (from && from.currency === t.currency) f -= t.amount
        if (to && to.currency === t.currency) f += t.amount
        if (f !== 0) flow.set(k, (flow.get(k) ?? 0) + f)
        continue
      }
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

  // Recurring ---------------------------------------------------------------
  if (resource === 'recurring') {
    if (param === 'run' && method === 'POST') return { created: 0 } as T
    if (method === 'GET') return { items: recurringRules.map(withNext) } as T
    const fromBody = (base: Pick<StoredRule, 'id' | 'createdAt'>): StoredRule => ({
      ...base,
      type: body?.type as StoredRule['type'],
      amount: Number(body?.amount ?? 0),
      currency: String(body?.currency ?? 'THB'),
      categoryId: String(body?.categoryId ?? ''),
      subCategoryId: (body?.subCategoryId as string) ?? null,
      accountId: (body?.accountId as string) ?? null,
      note: (body?.note as string) ?? null,
      labelIds: (body?.labelIds as string[]) ?? [],
      frequency: body?.frequency as StoredRule['frequency'],
      interval: Number(body?.interval ?? 1),
      startDate: String(body?.startDate),
      endDate: (body?.endDate as string | null) ?? null,
      timezone: String(body?.timezone ?? 'Asia/Bangkok'),
      active: body?.active !== false,
    })
    if (method === 'POST') {
      const r = fromBody({ id: id(), createdAt: now() })
      recurringRules = [...recurringRules, r]
      return withNext(r) as T
    }
    const rule = recurringRules.find((x) => x.id === param)
    if (!rule) notFound('Recurring rule')
    if (method === 'PUT') {
      const r = fromBody({ id: rule.id, createdAt: rule.createdAt })
      recurringRules = recurringRules.map((x) => (x.id === param ? r : x))
      return withNext(r) as T
    }
    if (method === 'DELETE') {
      recurringRules = recurringRules.filter((x) => x.id !== param)
      return undefined as T
    }
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
            (!f('accountId') ||
              t.accountId === f('accountId') ||
              t.toAccountId === f('accountId')) &&
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
      const transfer = body?.type === 'transfer'
      const catId = transfer ? null : ((body?.categoryId as string) ?? null)
      const subId = transfer ? null : ((body?.subCategoryId as string) ?? null)
      const accId = (body?.accountId as string) ?? null
      const toId = transfer ? ((body?.toAccountId as string) ?? null) : null
      if (transfer && ((!accId && !toId) || accId === toId)) {
        throw new ApiError(400, 'A transfer needs one account, or two different ones')
      }
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
        toAccountId: toId,
        toAccount: txAccount(toId),
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
