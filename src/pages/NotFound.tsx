import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { t } from '@/lib/i18n'

/** Shown inside the app shell for any URL that isn't a known screen. */
export function NotFound() {
  return (
    <div className="space-y-6">
      <PageHeader title={t('Page not found')} />
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-canvas)] text-[var(--color-muted)]">
          <Compass size={22} aria-hidden />
        </span>
        <p className="max-w-xs text-sm text-[var(--color-muted)]">
          {t("There's nothing at this address. It may have been moved or mistyped.")}
        </p>
        <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {t('← Back to dashboard')}
        </Link>
      </div>
    </div>
  )
}
