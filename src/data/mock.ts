import type {
  Account,
  Budget,
  Category,
  Debt,
  Dividend,
  Goal,
  Holding,
  Transaction,
} from '@/types'

// ---------------------------------------------------------------------------
// Categories (Thai defaults)
// ---------------------------------------------------------------------------
export const categories: Category[] = [
  { id: 'salary', name: 'Salary', nameTh: 'เงินเดือน', icon: 'Wallet', color: '#059669', kind: 'income' },
  { id: 'bonus', name: 'Bonus', nameTh: 'โบนัส', icon: 'Gift', color: '#10b981', kind: 'income' },
  { id: 'dividend', name: 'Dividend', nameTh: 'เงินปันผล', icon: 'TrendingUp', color: '#0ea5e9', kind: 'income' },
  { id: 'food', name: 'Food & Dining', nameTh: 'อาหาร', icon: 'UtensilsCrossed', color: '#f59e0b', kind: 'expense' },
  { id: 'transport', name: 'Transport', nameTh: 'เดินทาง', icon: 'Car', color: '#6366f1', kind: 'expense' },
  { id: 'shopping', name: 'Shopping', nameTh: 'ช้อปปิ้ง', icon: 'ShoppingBag', color: '#ec4899', kind: 'expense' },
  { id: 'bills', name: 'Bills & Utilities', nameTh: 'ค่าน้ำค่าไฟ', icon: 'ReceiptText', color: '#ef4444', kind: 'expense' },
  { id: 'home', name: 'Home / Rent', nameTh: 'ที่อยู่อาศัย', icon: 'Home', color: '#8b5cf6', kind: 'expense' },
  { id: 'health', name: 'Health', nameTh: 'สุขภาพ', icon: 'HeartPulse', color: '#14b8a6', kind: 'expense' },
  { id: 'entertain', name: 'Entertainment', nameTh: 'บันเทิง', icon: 'Clapperboard', color: '#f43f5e', kind: 'expense' },
]

export const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]))

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
export const accounts: Account[] = [
  { id: 'kbank', name: 'KBank Savings', type: 'bank', institution: 'Kasikornbank', balance: 285_400, currency: 'THB', balanceTHB: 285_400 },
  { id: 'scb', name: 'SCB Current', type: 'bank', institution: 'Siam Commercial', balance: 64_200, currency: 'THB', balanceTHB: 64_200 },
  { id: 'cash', name: 'Cash Wallet', type: 'cash', balance: 5_800, currency: 'THB', balanceTHB: 5_800 },
  { id: 'settrade', name: 'SET Brokerage', type: 'investment', institution: 'Settrade', balance: 612_000, currency: 'THB', balanceTHB: 612_000 },
  { id: 'ibkr', name: 'IBKR (US)', type: 'investment', institution: 'Interactive Brokers', balance: 14_850, currency: 'USD', balanceTHB: 538_560 },
  { id: 'binance', name: 'Crypto Wallet', type: 'investment', institution: 'Binance', balance: 6_120, currency: 'USD', balanceTHB: 221_990 },
  { id: 'card', name: 'KBank Credit Card', type: 'debt', institution: 'Kasikornbank', balance: -32_500, currency: 'THB', balanceTHB: -32_500 },
]

// ---------------------------------------------------------------------------
// Transactions (recent)
// ---------------------------------------------------------------------------
const d = (offsetDays: number) =>
  new Date(Date.now() - offsetDays * 86_400_000).toISOString()

export const transactions: Transaction[] = [
  { id: 't1', date: d(0), type: 'expense', amount: 185, categoryId: 'food', accountId: 'cash', note: 'Lunch — som tam' },
  { id: 't2', date: d(0), type: 'expense', amount: 1_290, categoryId: 'shopping', accountId: 'card', note: 'Uniqlo' },
  { id: 't3', date: d(1), type: 'expense', amount: 60, categoryId: 'transport', accountId: 'cash', note: 'BTS' },
  { id: 't4', date: d(1), type: 'income', amount: 2_400, categoryId: 'dividend', accountId: 'settrade', note: 'PTT dividend (net)' },
  { id: 't5', date: d(2), type: 'expense', amount: 3_200, categoryId: 'bills', accountId: 'kbank', note: 'Electricity', recurring: true },
  { id: 't6', date: d(3), type: 'expense', amount: 459, categoryId: 'entertain', accountId: 'card', note: 'Netflix + Spotify', recurring: true },
  { id: 't7', date: d(4), type: 'expense', amount: 890, categoryId: 'food', accountId: 'scb', note: 'Groceries — Big C' },
  { id: 't8', date: d(5), type: 'income', amount: 65_000, categoryId: 'salary', accountId: 'kbank', note: 'Monthly salary', recurring: true },
  { id: 't9', date: d(6), type: 'expense', amount: 15_000, categoryId: 'home', accountId: 'kbank', note: 'Condo rent', recurring: true },
  { id: 't10', date: d(7), type: 'expense', amount: 540, categoryId: 'health', accountId: 'card', note: 'Pharmacy' },
  { id: 't11', date: d(8), type: 'expense', amount: 320, categoryId: 'transport', accountId: 'cash', note: 'Grab' },
  { id: 't12', date: d(9), type: 'expense', amount: 2_100, categoryId: 'food', accountId: 'card', note: 'Dinner — Japanese' },
]

// ---------------------------------------------------------------------------
// Budgets (this month)
// ---------------------------------------------------------------------------
export const budgets: Budget[] = [
  { id: 'b1', categoryId: 'food', limit: 12_000, spent: 9_480 },
  { id: 'b2', categoryId: 'transport', limit: 3_000, spent: 2_640 },
  { id: 'b3', categoryId: 'shopping', limit: 5_000, spent: 5_390 },
  { id: 'b4', categoryId: 'entertain', limit: 2_000, spent: 1_180 },
  { id: 'b5', categoryId: 'bills', limit: 4_000, spent: 3_200 },
  { id: 'b6', categoryId: 'health', limit: 2_500, spent: 540 },
]

// ---------------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------------
const future = (months: number) => {
  const dt = new Date()
  dt.setMonth(dt.getMonth() + months)
  return dt.toISOString()
}

export const goals: Goal[] = [
  { id: 'g1', name: 'Emergency Fund', target: 300_000, saved: 210_000, deadline: future(8) },
  { id: 'g2', name: 'Japan Trip 2026', target: 120_000, saved: 48_000, deadline: future(5) },
  { id: 'g3', name: 'New MacBook', target: 75_000, saved: 71_000, deadline: future(2) },
  { id: 'g4', name: 'House Down Payment', target: 1_500_000, saved: 340_000, deadline: future(36) },
]

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------
export const debts: Debt[] = [
  { id: 'd1', name: 'Credit Card', lender: 'Kasikornbank', balance: 32_500, originalAmount: 32_500, interestRate: 16, minPayment: 3_250 },
  { id: 'd2', name: 'Car Loan', lender: 'TTB Drive', balance: 285_000, originalAmount: 480_000, interestRate: 3.2, minPayment: 8_900 },
  { id: 'd3', name: 'Student Loan (กยศ.)', lender: 'Student Loan Fund', balance: 84_000, originalAmount: 180_000, interestRate: 1, minPayment: 1_500 },
]

// ---------------------------------------------------------------------------
// Portfolio holdings (mixed asset classes, all valued to THB)
// FX assumptions baked into mock: USD≈36.2, BTC≈฿2.4M, gold per baht≈฿42,500
// ---------------------------------------------------------------------------
export const holdings: Holding[] = [
  { id: 'h1', symbol: 'PTT', name: 'PTT PCL', assetClass: 'set', quantity: 5_000, avgCost: 34.5, price: 38.25, nativeCurrency: 'THB', marketValueTHB: 191_250, costBasisTHB: 172_500 },
  { id: 'h2', symbol: 'CPALL', name: 'CP All', assetClass: 'set', quantity: 4_000, avgCost: 62, price: 58.5, nativeCurrency: 'THB', marketValueTHB: 234_000, costBasisTHB: 248_000 },
  { id: 'h3', symbol: 'AOT', name: 'Airports of Thailand', assetClass: 'set', quantity: 3_000, avgCost: 58, price: 62.25, nativeCurrency: 'THB', marketValueTHB: 186_750, costBasisTHB: 174_000 },
  { id: 'h4', symbol: 'VOO', name: 'Vanguard S&P 500', assetClass: 'us', quantity: 12, avgCost: 410, price: 498, nativeCurrency: 'USD', marketValueTHB: 216_331, costBasisTHB: 178_104 },
  { id: 'h5', symbol: 'AAPL', name: 'Apple Inc.', assetClass: 'us', quantity: 20, avgCost: 165, price: 228, nativeCurrency: 'USD', marketValueTHB: 165_072, costBasisTHB: 119_460 },
  { id: 'h6', symbol: 'NVDA', name: 'NVIDIA Corp.', assetClass: 'us', quantity: 10, avgCost: 95, price: 132, nativeCurrency: 'USD', marketValueTHB: 47_784, costBasisTHB: 34_390 },
  { id: 'h7', symbol: 'K-USA', name: 'K US Equity Fund', assetClass: 'fund', quantity: 8_500, avgCost: 14.2, price: 16.8, nativeCurrency: 'THB', marketValueTHB: 142_800, costBasisTHB: 120_700 },
  { id: 'h8', symbol: 'BTC', name: 'Bitcoin', assetClass: 'crypto', quantity: 0.065, avgCost: 1_800_000, price: 2_410_000, nativeCurrency: 'THB', marketValueTHB: 156_650, costBasisTHB: 117_000 },
  { id: 'h9', symbol: 'ETH', name: 'Ethereum', assetClass: 'crypto', quantity: 0.9, avgCost: 92_000, price: 88_000, nativeCurrency: 'THB', marketValueTHB: 79_200, costBasisTHB: 82_800 },
  { id: 'h10', symbol: 'GOLD', name: 'Gold (3 baht weight)', assetClass: 'gold', quantity: 3, avgCost: 38_000, price: 42_500, nativeCurrency: 'THB', marketValueTHB: 127_500, costBasisTHB: 114_000 },
]

// ---------------------------------------------------------------------------
// Dividends (with Thai/US withholding tax)
// ---------------------------------------------------------------------------
export const dividends: Dividend[] = [
  { id: 'dv1', symbol: 'PTT', assetClass: 'set', payDate: d(1), gross: 2_667, withholdingTax: 267, net: 2_400, currency: 'THB' },
  { id: 'dv2', symbol: 'AOT', assetClass: 'set', payDate: d(40), gross: 1_500, withholdingTax: 150, net: 1_350, currency: 'THB' },
  { id: 'dv3', symbol: 'VOO', assetClass: 'us', payDate: d(25), gross: 1_086, withholdingTax: 163, net: 923, currency: 'USD' },
  { id: 'dv4', symbol: 'AAPL', assetClass: 'us', payDate: d(55), gross: 543, withholdingTax: 81, net: 462, currency: 'USD' },
]

// ---------------------------------------------------------------------------
// Derived series for charts
// ---------------------------------------------------------------------------
export const netWorthHistory = [
  { month: 'Jul', value: 1_980_000 },
  { month: 'Aug', value: 2_040_000 },
  { month: 'Sep', value: 2_010_000 },
  { month: 'Oct', value: 2_115_000 },
  { month: 'Nov', value: 2_180_000 },
  { month: 'Dec', value: 2_240_000 },
  { month: 'Jan', value: 2_205_000 },
  { month: 'Feb', value: 2_310_000 },
  { month: 'Mar', value: 2_360_000 },
  { month: 'Apr', value: 2_420_000 },
  { month: 'May', value: 2_480_000 },
  { month: 'Jun', value: 2_543_000 },
]

export const cashFlowHistory = [
  { month: 'Jan', income: 67_400, expense: 41_200 },
  { month: 'Feb', income: 65_000, expense: 38_900 },
  { month: 'Mar', income: 71_200, expense: 44_500 },
  { month: 'Apr', income: 65_000, expense: 39_800 },
  { month: 'May', income: 68_900, expense: 42_100 },
  { month: 'Jun', income: 67_400, expense: 37_600 },
]

// ---------------------------------------------------------------------------
// Aggregate helpers (computed once from the mock above)
// ---------------------------------------------------------------------------
export const totalAssetsTHB = accounts
  .filter((a) => a.type !== 'debt')
  .reduce((s, a) => s + a.balanceTHB, 0)

export const totalDebtTHB = debts.reduce((s, x) => s + x.balance, 0)

export const netWorthTHB = totalAssetsTHB - totalDebtTHB

export const assetClassLabels: Record<Holding['assetClass'], string> = {
  set: 'Thai Stocks',
  us: 'US Stocks',
  fund: 'Mutual Funds',
  crypto: 'Crypto',
  gold: 'Gold',
  cash: 'Cash',
}

export const assetClassColors: Record<Holding['assetClass'], string> = {
  set: '#059669',
  us: '#6366f1',
  fund: '#0ea5e9',
  crypto: '#f59e0b',
  gold: '#fbbf24',
  cash: '#94a3b8',
}
