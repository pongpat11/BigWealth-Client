import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { GripVertical, Lock, Minus, MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { t } from '@/lib/i18n'
import {
  DEFAULT_LAYOUT,
  MAX_TABS,
  MIN_TABS,
  getNavLayout,
  navItem,
  setNavLayout,
  type NavLayout,
} from '@/lib/nav'
import { cn } from '@/lib/utils'

// The sheet edits one flat list: tab-bar paths, then the locked "More" row,
// then the More-page paths. Where an item sits relative to the More row says
// which group it is in, so dragging across it moves an item between groups.
const MORE = '#more'

function toOrder(layout: NavLayout): string[] {
  return [...layout.tabs, MORE, ...layout.more]
}

function toLayout(order: string[]): NavLayout {
  const split = order.indexOf(MORE)
  return { tabs: order.slice(0, split), more: order.slice(split + 1) }
}

function moveItem(order: string[], from: number, to: number): string[] {
  const next = [...order]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Why an order can't be used, or null when it's fine. */
function problem(order: string[]): string | null {
  const tabs = order.indexOf(MORE)
  if (tabs > MAX_TABS) return t('Tab bar is full. Remove one first.')
  if (tabs < MIN_TABS) return t('Keep at least 2 tabs.')
  return null
}

interface Drag {
  path: string
  /** Pointer distance from the row's top edge when it was picked up. */
  grabOffset: number
  clientY: number
}

export function NavCustomizerSheet({ onClose }: { onClose: () => void }) {
  const [order, setOrder] = useState(() => toOrder(getNavLayout()))
  const [drag, setDrag] = useState<Drag | null>(null)
  const [grabbed, setGrabbed] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const list = useRef<HTMLUListElement>(null)

  // Keep the dragged row under the pointer: measure where the row would sit
  // untransformed (it moves as the order changes) and offset it from there.
  useLayoutEffect(() => {
    if (!drag) return
    const row = list.current?.querySelector<HTMLElement>(`[data-path="${drag.path}"]`)
    if (!row) return
    row.style.transform = ''
    const natural = row.getBoundingClientRect().top
    row.style.transform = `translateY(${drag.clientY - drag.grabOffset - natural}px)`
    return () => {
      row.style.transform = ''
    }
  })

  const tabCount = order.indexOf(MORE)

  function showHint(message: string) {
    setHint(message)
    clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(null), 2000)
  }

  function describe(next: string[], path: string): string {
    const index = next.indexOf(path)
    const split = next.indexOf(MORE)
    const label = navItem(path).label
    return index < split
      ? t('{label}: tab bar, position {n} of {total}', { label, n: index + 1, total: split })
      : t('{label}: More page, position {n}', { label, n: index - split })
  }

  /** Apply a reorder if it's allowed; returns whether it was. */
  function tryOrder(next: string[], path: string): boolean {
    const why = problem(next)
    if (why) {
      showHint(why)
      return false
    }
    setOrder(next)
    setAnnounce(describe(next, path))
    return true
  }

  function toggleGroup(path: string) {
    const from = order.indexOf(path)
    const split = order.indexOf(MORE)
    // Removed tabs go to the top of the More list; added ones to the end of the bar.
    // Moving to the More row's index does both: a tab lands just after it, a
    // More item just before it.
    tryOrder(moveItem(order, from, split), path)
  }

  // --- Pointer drag (mouse, touch, pen) ---

  function onPointerDown(e: PointerEvent<HTMLButtonElement>, path: string) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const row = e.currentTarget.closest<HTMLElement>('[data-path]')
    const top = row?.getBoundingClientRect().top ?? e.clientY
    setDrag({ path, grabOffset: e.clientY - top, clientY: e.clientY })
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!drag) return
    const box = e.currentTarget.closest<HTMLElement>('[role=dialog]')
    // Near the sheet's top or bottom edge, scroll it so far rows can be reached.
    if (box) {
      const { top, bottom } = box.getBoundingClientRect()
      if (e.clientY < top + 48) box.scrollTop -= 8
      else if (e.clientY > bottom - 48) box.scrollTop += 8
    }
    // The new index is how many of the other rows have their middle above the
    // pointer. Rows differ in height (the More row carries headings), so
    // measure them rather than assume a row height.
    const others = [...(list.current?.querySelectorAll<HTMLElement>('[data-slot]') ?? [])].filter(
      (el) => el.dataset.slot !== drag.path,
    )
    const target = others.filter((el) => {
      const r = el.getBoundingClientRect()
      return r.top + r.height / 2 < e.clientY
    }).length
    const from = order.indexOf(drag.path)
    if (target !== from) {
      const next = moveItem(order, from, target)
      const why = problem(next)
      if (why) showHint(why)
      else setOrder(next)
    }
    setDrag({ ...drag, clientY: e.clientY })
  }

  function onPointerUp() {
    if (!drag) return
    setAnnounce(describe(order, drag.path))
    setDrag(null)
  }

  // --- Keyboard: Space picks up / drops, arrows move, Escape drops ---

  function onHandleKey(e: KeyboardEvent<HTMLButtonElement>, path: string) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (grabbed === path) {
        setGrabbed(null)
        setAnnounce(t('Dropped. {where}', { where: describe(order, path) }))
      } else {
        setGrabbed(path)
        setAnnounce(t('Picked up. {where}. Use the arrow keys to move.', { where: describe(order, path) }))
      }
    } else if (grabbed === path && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const from = order.indexOf(path)
      const to = from + (e.key === 'ArrowUp' ? -1 : 1)
      if (to >= 0 && to < order.length) tryOrder(moveItem(order, from, to), path)
    } else if (e.key === 'Escape' && grabbed) {
      e.stopPropagation()
      setGrabbed(null)
    }
  }

  function save() {
    setNavLayout(toLayout(order))
    onClose()
  }

  const preview = order.slice(0, tabCount).map(navItem)

  return (
    <Sheet label={t('Customize tab bar')} onClose={onClose}>
      {/* overflow-clip, not hidden: hidden would stop the header and preview sticking. */}
      <Card className="overflow-clip">
        <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 pb-3 pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            {t('Customize tab bar')}
          </h2>
          <Button size="sm" onClick={save}>
            {t('Save')}
          </Button>
        </div>

        <div className="flex justify-between px-4 pb-1.5 pt-3 text-xs font-medium text-[var(--color-muted)]">
          <span>{t('In the tab bar')}</span>
          <span>
            {tabCount} / {MAX_TABS}
          </span>
        </div>

        <ul ref={list} aria-label={t('Menu order')} className="select-none">
          {order.map((path, index) => {
            if (path === MORE) {
              return (
                <li key={MORE} data-path={MORE}>
                  <div data-slot={MORE} className="flex h-[52px] items-center gap-3 border-y border-[var(--color-line)] bg-[var(--color-canvas)] pl-14 pr-4 text-sm font-medium text-[var(--color-muted)]">
                    <span className="flex size-8 items-center justify-center rounded-full bg-[var(--color-surface)]">
                      <MoreHorizontal size={16} aria-hidden />
                    </span>
                    <span className="flex-1">{t('More')}</span>
                    <Lock size={14} aria-label={t('Always last')} />
                  </div>
                  <p
                    role="status"
                    className="min-h-6 px-4 pt-1.5 text-xs text-[var(--color-loss)]"
                  >
                    {hint}
                  </p>
                  <div className="flex justify-between px-4 pb-1.5 pt-2 text-xs font-medium text-[var(--color-muted)]">
                    <span>{t('On the More page')}</span>
                    <span>{t('Drag to reorder')}</span>
                  </div>
                </li>
              )
            }
            const item = navItem(path)
            const inBar = index < tabCount
            const dragging = drag?.path === path
            const IconCmp = item.icon
            return (
              <li
                key={path}
                data-path={path}
                data-slot={path}
                className={cn(
                  'relative flex h-[52px] items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] pr-4 text-sm font-medium text-[var(--color-ink)] last:border-b-0',
                  dragging && 'z-10 shadow-lg',
                  grabbed === path && 'ring-2 ring-inset ring-brand-500',
                )}
              >
                <button
                  type="button"
                  aria-label={t('Move {label}', { label: item.label })}
                  aria-pressed={grabbed === path}
                  onPointerDown={(e) => onPointerDown(e, path)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={(e) => onHandleKey(e, path)}
                  onBlur={() => grabbed === path && setGrabbed(null)}
                  className={cn(
                    'flex h-full w-11 shrink-0 touch-none items-center justify-center text-[var(--color-muted)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                    dragging ? 'cursor-grabbing' : 'cursor-grab',
                  )}
                >
                  <GripVertical size={18} aria-hidden />
                </button>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-canvas)] text-[var(--color-muted)]">
                  <IconCmp size={16} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.longLabel}</span>
                <button
                  type="button"
                  onClick={() => toggleGroup(path)}
                  aria-label={
                    inBar
                      ? t('Remove {label} from the tab bar', { label: item.label })
                      : t('Add {label} to the tab bar', { label: item.label })
                  }
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full',
                    inBar
                      ? 'bg-rose-500/10 text-[var(--color-loss)]'
                      : 'bg-brand-500/15 text-brand-700 dark:text-brand-300',
                  )}
                >
                  {inBar ? <Minus size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="px-4 py-3 text-center">
          <button
            type="button"
            onClick={() => {
              setOrder(toOrder(DEFAULT_LAYOUT))
              setAnnounce(t('Default menu restored. Save to keep it.'))
            }}
            className="text-xs font-medium text-[var(--color-muted)] underline underline-offset-2"
          >
            {t('Reset to default')}
          </button>
        </div>

        <div
          aria-hidden
          className="sticky bottom-0 z-20 border-t border-[var(--color-line)] bg-[var(--color-canvas)] px-3 pb-3 pt-2"
        >
          <p className="pb-1.5 text-center text-[11px] text-[var(--color-muted)]">{t('Preview')}</p>
          <div className="flex rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-1 py-1.5">
            {[...preview, { to: MORE, label: t('More'), icon: MoreHorizontal }].map(
              ({ to, label, icon: IconCmp }, i) => (
                <div
                  key={to}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col items-center gap-0.5 text-[10px] font-medium',
                    i === 0 ? 'text-brand-600' : 'text-[var(--color-muted)]',
                  )}
                >
                  <IconCmp size={20} />
                  <span className="max-w-full truncate">{label}</span>
                </div>
              ),
            )}
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
      </Card>
    </Sheet>
  )
}

const NavCustomizerContext = createContext<(() => void) | null>(null)

/** Opens the "Customize tab bar" sheet, or null outside the app shell. */
// eslint-disable-next-line react-refresh/only-export-components
export function useNavCustomizer(): (() => void) | null {
  return useContext(NavCustomizerContext)
}

export function NavCustomizerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false)
  const [open] = useState(() => () => setOpen(true))
  return (
    <NavCustomizerContext.Provider value={open}>
      {children}
      {isOpen && <NavCustomizerSheet onClose={() => setOpen(false)} />}
    </NavCustomizerContext.Provider>
  )
}
