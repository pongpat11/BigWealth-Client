import { Link } from 'react-router-dom'
import {
  BarChart3,
  ChevronRight,
  CreditCard,
  Landmark,
  LogIn,
  Settings,
  Target,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'

const items = [
  { to: '/goals', label: 'Savings Goals', icon: Target },
  { to: '/debts', label: 'Debts', icon: CreditCard },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/accounts', label: 'Accounts', icon: Landmark },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/login', label: 'Login screen', icon: LogIn },
] as const

/** Mobile hub for secondary screens (desktop shows them in the sidebar). */
export function More() {
  return (
    <div className="space-y-4">
      <PageHeader title="More" />
      <Card>
        <CardBody className="divide-y divide-[var(--color-line)] p-0 px-4">
          {items.map(({ to, label, icon: IconCmp }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 py-3.5 text-sm font-medium text-[var(--color-ink)]"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-[var(--color-canvas)] text-[var(--color-muted)]">
                <IconCmp size={16} aria-hidden />
              </span>
              <span className="flex-1">{label}</span>
              <ChevronRight
                size={16}
                className="text-[var(--color-muted)]"
                aria-hidden
              />
            </Link>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
