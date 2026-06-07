import { cn } from '@/lib/utils'
import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

/** Presentational labeled text input. Validation is handled by callers. */
export function Input({ label, id, className, ...props }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-[13px] font-medium text-[var(--color-muted)]"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500',
          className,
        )}
        {...props}
      />
    </div>
  )
}
