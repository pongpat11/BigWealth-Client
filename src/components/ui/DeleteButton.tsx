import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Delete trigger. One tap — pair it with `useUndoableDelete` so a mistake is
 * undone from the toast rather than guarded by a second tap.
 *
 * - `variant="icon"` (default): a 40px trash icon for list rows. `label` is
 *   its accessible name, e.g. "Delete KBank Savings".
 * - `variant="block"`: full-width text button at the foot of an edit form.
 */
export function DeleteButton({
  label,
  onClick,
  variant = 'icon',
  disabled,
  className,
}: {
  label: string
  onClick: () => void
  variant?: 'icon' | 'block'
  disabled?: boolean
  className?: string
}) {
  if (variant === 'block') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[var(--color-loss)] transition-colors hover:bg-rose-500/10 disabled:opacity-50',
          className,
        )}
      >
        <Trash2 size={16} aria-hidden />
        {label}
      </button>
    )
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        '-my-1 flex size-10 shrink-0 items-center justify-center rounded-xl text-[var(--color-muted)] transition-colors hover:bg-rose-500/10 hover:text-[var(--color-loss)] focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50',
        className,
      )}
    >
      <Trash2 size={16} aria-hidden />
    </button>
  )
}
