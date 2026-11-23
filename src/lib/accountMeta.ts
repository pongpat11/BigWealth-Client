// Presentation helpers shared by the Accounts list and the account detail screen.
import { CreditCard, Landmark, TrendingUp, Wallet } from 'lucide-react'
import type { AccountType } from './accounts'
import { formatTHB } from './format'
import type { Currency } from '@/types'

// Display order + presentation for each account type.
export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: typeof Wallet }[] = [
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'bank', label: 'Bank', icon: Landmark },
  { value: 'investment', label: 'Investment', icon: TrendingUp },
  { value: 'debt', label: 'Debt', icon: CreditCard },
]

export function formatMoney(amount: number, currency: Currency) {
  if (currency === 'THB') return formatTHB(amount)
  return `${amount.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
