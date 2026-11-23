import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Snackbar above the mobile tab bar (bottom-right on desktop). Used by
 * `useUndoableDelete`; the countdown bar shows how long Undo stays available.
 */
export function UndoToast({
  message,
  tone = 'neutral',
  onUndo,
  onDismiss,
}: {
  message: string
  tone?: 'neutral' | 'error'
  onUndo?: () => void
  onDismiss: () => void
}) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-6 lg:justify-end lg:px-8">
      <div
        role={tone === 'error' ? 'alert' : 'status'}
        className={cn(
          'toast-in pointer-events-auto relative flex w-full max-w-sm items-center gap-2 overflow-hidden rounded-2xl py-2 pl-4 pr-2 text-sm shadow-lg',
          tone === 'error'
            ? 'bg-[var(--color-loss)] text-white'
            : 'bg-[var(--color-ink)] text-[var(--color-surface)]',
        )}
      >
        <p className="min-w-0 flex-1 py-1">{message}</p>
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="h-9 shrink-0 rounded-xl px-3 text-sm font-semibold text-[var(--color-toast-action)] hover:bg-current/10"
          >
            {t('Undo')}
          </button>
        )}
        <button
          type="button"
          aria-label={t('Dismiss')}
          onClick={onDismiss}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl opacity-70 hover:opacity-100"
        >
          <X size={16} aria-hidden />
        </button>
        {onUndo && <span aria-hidden className="toast-countdown absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-toast-action)]" />}
      </div>
    </div>,
    document.body,
  )
}
