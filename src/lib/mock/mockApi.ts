// Dev-only in-memory API mock. Enabled when VITE_MOCK is set (see lib/api.ts).
// Lets the frontend run standalone — no backend / Postgres required. State lives
// in module memory: create/edit/delete persist until the page is reloaded.
import { ApiError } from '../api'
import type { Account } from '../accounts'
import type { Category } from '../categories'
import type { Label } from '../labels'
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
  { id: 'card', name: 'KBank Credit Card', institution: 'Kasikornbank', type: 'debt', currency: 'THB', balance: 32_500, createdAt: daysAgo(100) },
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
      }
      accounts = accounts.map((x) => (x.id === param ? updated : x))
      return withCurrentBalance(updated) as T
    }
    if (method === 'DELETE') {
      accounts = accounts.filter((x) => x.id !== param)
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
    if (method === 'GET')
      return {
        items: [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
      } as T
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
