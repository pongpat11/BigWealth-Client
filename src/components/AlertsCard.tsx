import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight, TriangleAlert } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { buildAlerts, type Alert, type AlertTone } from '@/lib/alerts'
import { getBudgets } from '@/lib/budgets'
import { listGoals } from '@/lib/goals'
import { listRecurring } from '@/lib/recurring'
import { monthKey } from '@/lib/format'
import { t } from '@/lib/i18n'

const TONE_STYLE: Record<AlertTone, string> = {
  danger: 'bg-rose-500/10 text-[var(--color-loss)]',
  warn: 'bg-amber-500/10 text-amber-600',
  info: 'bg-brand-500/10 text-brand-600',
}

/**
 * Dashboard "Heads up" list. Each source loads on its own and a failure only
 * drops that source's alerts; with nothing to say the card isn't shown.
 */
export function AlertsCard() {
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    let live = true
    Promise.allSettled([getBudgets(monthKey()), listRecurring(), listGoals()]).then(
      ([budgets, recurring, goals]) => {
        if (!live) return
        setAlerts(
          buildAlerts({
            budgets: budgets.status === 'fulfilled' ? budgets.value.items : [],
            recurring: recurring.status === 'fulfilled' ? recurring.value : [],
            goals: goals.status === 'fulfilled' ? goals.value : [],
          }),
        )
      },
    )
    return () => {
      live = false
    }
  }, [])

  if (alerts.length === 0) return null

  return (
    <Card>
      <CardHeader title={t('Heads up')} />
      <CardBody className="divide-y divide-[var(--color-line)] p-0 px-4">
        {alerts.map((a) => {
          const IconCmp = a.tone === 'info' ? CalendarClock : TriangleAlert
          return (
            <Link key={a.id} to={a.to} className="flex items-center gap-3 py-3">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${TONE_STYLE[a.tone]}`}
              >
                <IconCmp size={16} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{a.title}</p>
                <p className="tnum truncate text-xs text-[var(--color-muted)]">{a.detail}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-[var(--color-muted)]" aria-hidden />
            </Link>
          )
        })}
      </CardBody>
    </Card>
  )
}
