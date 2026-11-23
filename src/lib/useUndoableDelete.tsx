import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '@/lib/api'
import { UndoToast } from '@/components/ui/UndoToast'
import { t } from '@/lib/i18n'

/** How long a deleted item can still be brought back. */
export const UNDO_MS = 5000
const ERROR_MS = 6000

export interface UndoableDelete {
  /** Toast text, e.g. "Transaction deleted". */
  message: string
  /** Take the item out of the UI right away. */
  hide: () => void
  /** Put it back (Undo, or the server refused). */
  restore: () => void
  /** The real API call, sent once the undo window closes. */
  commit: () => Promise<unknown>
  /** Runs after the server confirmed the delete (e.g. refetch totals). */
  onCommitted?: () => void
}

interface Pending extends UndoableDelete {
  timer: ReturnType<typeof setTimeout>
}

type Toast =
  | { kind: 'undo'; id: number; message: string }
  | { kind: 'error'; id: number; message: string }

/**
 * One-tap delete with Undo — the pattern every list in the app uses instead of
 * "tap twice to confirm". The item disappears at once, a toast offers Undo for
 * {@link UNDO_MS}, and only then is the API called. Navigating away, closing
 * the app or deleting a second item sends the pending delete straight away.
 *
 * Render the returned `toast` anywhere in the page.
 */
export function useUndoableDelete(): {
  remove: (d: UndoableDelete) => void
  toast: ReactNode
} {
  const pending = useRef<Pending | null>(null)
  const mounted = useRef(true)
  const nextId = useRef(0)
  const [toast, setToast] = useState<Toast | null>(null)

  const send = useCallback((p: Pending) => {
    clearTimeout(p.timer)
    if (pending.current === p) pending.current = null
    p.commit().then(
      () => mounted.current && p.onCommitted?.(),
      (err: unknown) => {
        if (!mounted.current) return
        p.restore()
        const reason = err instanceof ApiError ? err.message : t('Try again.')
        setToast({ kind: 'error', id: ++nextId.current, message: `Couldn't delete. ${reason}` })
      },
    )
  }, [])

  /** Send whatever is waiting (used before a new delete and on leave). */
  const flush = useCallback(() => {
    if (pending.current) send(pending.current)
  }, [send])

  const remove = useCallback(
    (d: UndoableDelete) => {
      flush()
      d.hide()
      const id = ++nextId.current
      const p: Pending = {
        ...d,
        timer: setTimeout(() => {
          send(p)
          if (mounted.current) setToast((t) => (t?.id === id ? null : t))
        }, UNDO_MS),
      }
      pending.current = p
      setToast({ kind: 'undo', id, message: d.message })
    },
    [flush, send],
  )

  function undo() {
    const p = pending.current
    if (!p) return
    clearTimeout(p.timer)
    pending.current = null
    p.restore()
    setToast(null)
  }

  function dismiss() {
    if (toast?.kind === 'undo') flush()
    setToast(null)
  }

  // Error toasts clear themselves.
  useEffect(() => {
    if (toast?.kind !== 'error') return
    const timer = setTimeout(() => setToast(null), ERROR_MS)
    return () => clearTimeout(timer)
  }, [toast])

  // Leaving the screen or the app commits the delete instead of losing it.
  useEffect(() => {
    mounted.current = true
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      mounted.current = false
      flush()
    }
  }, [flush])

  return {
    remove,
    toast: toast && (
      <UndoToast
        key={toast.id}
        message={toast.message}
        tone={toast.kind === 'error' ? 'error' : 'neutral'}
        onUndo={toast.kind === 'undo' ? undo : undefined}
        onDismiss={dismiss}
      />
    ),
  }
}

/** Put `item` back at `index` (clamped), unless it is already there. */
export function reinsert<T extends { id: string }>(list: T[], item: T, index: number): T[] {
  if (list.some((x) => x.id === item.id)) return list
  const at = Math.max(0, Math.min(index, list.length))
  return [...list.slice(0, at), item, ...list.slice(at)]
}
