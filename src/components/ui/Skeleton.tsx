import { cn } from '@/lib/utils'

/** Grey placeholder block shown while content loads. Hidden from screen readers. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block animate-pulse rounded-lg bg-[var(--color-line)] motion-reduce:animate-none', className)}
    />
  )
}
