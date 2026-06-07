// Domain types for the BigWealth client. These mirror the planned
// Prisma schema closely enough to swap mock data for the API later.

export type Currency = 'THB' | 'USD'

export type AccountType = 'cash' | 'bank' | 'investment' | 'debt'

export interface Account {
  id: string
  name: string
  type: AccountType
  institution?: string
  /** Balance in the account's own currency. */
  balance: number
  currency: Currency
  /** Balance converted to THB (by the FX layer). */
  balanceTHB: number
}

export type TxnType = 'income' | 'expense' | 'transfer'

export interface Category {
  id: string
  name: string
  nameTh: string
  icon: string // lucide icon name
  color: string // hex
  kind: 'income' | 'expense'
}

export interface Transaction {
  id: string
  date: string // ISO
  type: TxnType
  /** Positive number; sign is implied by `type`. Stored in THB. */
  amount: number
  categoryId: string
  accountId: string
  note?: string
  recurring?: boolean
}

export interface Budget {
  id: string
  categoryId: string
  limit: number // THB / month
  spent: number // THB this month
}

export interface Goal {
  id: string
  name: string
  target: number
  saved: number
  deadline: string // ISO
}

export interface Debt {
  id: string
  name: string
  lender: string
  balance: number // remaining principal, THB
  originalAmount: number
  interestRate: number // annual %
  minPayment: number // THB / month
}

export type AssetClass = 'set' | 'us' | 'fund' | 'crypto' | 'gold' | 'cash'

export interface Holding {
  id: string
  symbol: string
  name: string
  assetClass: AssetClass
  quantity: number
  avgCost: number // per unit, in nativeCurrency
  price: number // current, per unit, in nativeCurrency
  nativeCurrency: Currency
  /** Current market value converted to THB. */
  marketValueTHB: number
  /** Cost basis converted to THB. */
  costBasisTHB: number
}

export interface Dividend {
  id: string
  symbol: string
  assetClass: AssetClass
  payDate: string // ISO
  gross: number // THB
  withholdingTax: number // THB
  net: number // THB
  currency: Currency
}
