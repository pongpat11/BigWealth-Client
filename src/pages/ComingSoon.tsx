import { Link } from 'react-router-dom'
import { Hammer } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'

/** Placeholder for screens whose issues haven't been implemented yet. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-canvas)] text-[var(--color-muted)]">
          <Hammer size={22} aria-hidden />
        </span>
        <p className="text-sm font-semibold text-[var(--color-ink)]">
          This screen is on the way
        </p>
        <p className="max-w-xs text-xs text-[var(--color-muted)]">
          {title} is planned in the project backlog and will be built from the
          Figma design.
        </p>
        <Link
          to="/"
          className="mt-1 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}
