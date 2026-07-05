import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  CreditCard,
  Home,
  Landmark,
  LogOut,
  MoreHorizontal,
  PieChart,
  Settings,
  Tag,
  Target,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/lib/auth'

// Primary tabs — shown in the mobile bottom bar and at the top of the sidebar.
const primaryNav = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/portfolio', label: 'Portfolio', icon: PieChart },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
] as const

// Secondary screens — behind "More" on mobile, listed directly on desktop.
const secondaryNav = [
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/debts', label: 'Debts', icon: CreditCard },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/accounts', label: 'Accounts', icon: Landmark },
  { to: '/categories', label: 'Categories', icon: Tag },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

function SidebarLink({
  to,
  label,
  icon: IconCmp,
  end,
}: {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-700'
            : 'text-[var(--color-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]',
        )
      }
    >
      <IconCmp size={18} aria-hidden />
      {label}
    </NavLink>
  )
}

function TabLink({
  to,
  label,
  icon: IconCmp,
  end,
}: {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium',
          isActive ? 'text-brand-600' : 'text-[var(--color-muted)]',
        )
      }
    >
      <IconCmp size={20} aria-hidden />
      {label}
    </NavLink>
  )
}

/**
 * Authenticated app layout: desktop sidebar (lg+) and mobile bottom tab bar,
 * per docs/DESIGN_SPEC.md §6 "Navigation". Content renders via <Outlet/>.
 */
export function AppShell() {
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-full lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-5 lg:flex">
        <div className="flex items-center gap-2.5 px-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            ฿
          </div>
          <span className="text-lg font-bold tracking-tight text-[var(--color-ink)]">
            BigWealth
          </span>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Primary">
          {primaryNav.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
          <div className="mx-3 my-2 h-px bg-[var(--color-line)]" />
          {secondaryNav.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-loss)]"
        >
          <LogOut size={18} aria-hidden />
          Log out
        </button>
      </aside>

      {/* Content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4 lg:px-8 lg:pb-8 lg:pt-6">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--color-line)] bg-[var(--color-surface)] px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 lg:hidden"
      >
        {primaryNav.map((item) => (
          <TabLink key={item.to} {...item} />
        ))}
        <TabLink to="/more" label="More" icon={MoreHorizontal} />
      </nav>
    </div>
  )
}
