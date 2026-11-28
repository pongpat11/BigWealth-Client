import { cn } from '@/lib/utils'
import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  /** Message shown under the field; marks it invalid. Validation is the caller's. */
  error?: string | null
}

/** Presentational labeled text input. Validation is handled by callers. */
export function Input({ label, id, className, error, ...props }: Props) {
  const errorId = error && id ? `${id}-error` : undefined
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
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500',
          error && 'border-[var(--color-loss)]',
          className,
        )}
        {...props}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}

/** Error line under a form field. */
export function FieldError({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} role="alert" className="text-xs font-medium text-[var(--color-loss)]">
      {children}
    </p>
  )
}
