import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Modal container for add/edit forms: a bottom sheet on phones, a centred
 * dialog on larger screens. Opening a row's editor no longer jumps you to the
 * top of a long list — the form comes to you, and closing it leaves the list
 * where it was. Escape or a tap on the backdrop closes it.
 *
 * The child is the form itself (usually a `<Card>`).
 */
export function Sheet({
  label,
  onClose,
  children,
}: {
  /** Accessible name, e.g. "Edit transaction". */
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    // Focus the first field so typing starts straight away (no keyboard pop on
    // iOS until the user taps, which is fine).
    const first = panel.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]), select, textarea, button',
    )
    first?.focus({ preventScroll: true })

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden
        className="sheet-backdrop absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        onClick={() => close.current()}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="sheet-panel relative max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:px-0 sm:pb-0"
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
