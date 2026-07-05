import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  ChevronRight,
  CreditCard,
  Landmark,
  LogOut,
  Settings,
  Tag,
  Target,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { logout } from '@/lib/auth'

const items = [
  { to: '/goals', label: 'Savings Goals', icon: Target },
  { to: '/debts', label: 'Debts', icon: CreditCard },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/accounts', label: 'Accounts', icon: Landmark },
  { to: '/categories', label: 'Categories', icon: Tag },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

/** Mobile hub for secondary screens (desktop shows them in the sidebar). */
export function More() {
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

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

      <Card>
        <CardBody className="p-0 px-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 py-3.5 text-sm font-medium text-[var(--color-loss)]"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-rose-50 text-[var(--color-loss)]">
              <LogOut size={16} aria-hidden />
            </span>
            <span className="flex-1 text-left">Log out</span>
          </button>
        </CardBody>
      </Card>
    </div>
  )
}
