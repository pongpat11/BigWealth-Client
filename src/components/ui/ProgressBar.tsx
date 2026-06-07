import { cn } from '@/lib/utils'

/**
 * Accessible progress bar. `tone` auto-derives from pct when omitted:
 * green under 80%, amber 80–100%, red over 100% (overspend).
 */
export function ProgressBar({
  value,
  max,
  tone,
  className,
}: {
  value: number
  max: number
  tone?: 'gain' | 'warn' | 'loss' | 'brand'
  className?: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const clamped = Math.min(pct, 100)
  const resolved =
    tone ?? (pct >= 100 ? 'loss' : pct >= 80 ? 'warn' : 'gain')

  const colors = {
    gain: 'bg-brand-500',
    warn: 'bg-amber-500',
    loss: 'bg-rose-500',
    brand: 'bg-brand-600',
  }

  return (
    <div
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-[var(--color-canvas)]',
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all', colors[resolved])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
