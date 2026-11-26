import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Delete, NotebookPen, Plus, Tags, X } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { UndoToast } from '@/components/ui/UndoToast'
import { ApiError } from '@/lib/api'
import { listAccounts, type Account } from '@/lib/accounts'
import { listCategories, type Category } from '@/lib/categories'
import { browserTimezone, formatTHB, nowDateTimeLocalValue } from '@/lib/format'
import { t } from '@/lib/i18n'
import { listLabels, type Label } from '@/lib/labels'
import {
  defaultAccountId,
  entryToInput,
  formatKeypadAmount,
  frequentEntries,
  HISTORY_SIZE,
  loadQuickAddPrefs,
  pressKey,
  rankAccounts,
  rankCategories,
  saveQuickAddPrefs,
  TOP_CATEGORIES,
  type FrequentEntry,
  type KeypadKey,
} from '@/lib/quickAdd'
import {
  createTransaction,
  deleteTransaction,
  listTransactionPage,
  TRANSFER_COLOR,
  TRANSFER_ICON,
  type Currency,
  type Transaction,
  type TransactionInput,
  type TransactionKind,
} from '@/lib/transactions'
import { announceTransactionChange } from '@/lib/transactionEvents'
import { UNDO_MS } from '@/lib/useUndoableDelete'
import { cn } from '@/lib/utils'

const FALLBACK_COLOR = '#94a3b8'

const TYPES: { value: TransactionKind; label: string }[] = [
  { value: 'expense', label: t('Expense') },
  { value: 'income', label: t('Income') },
  { value: 'transfer', label: t('Transfer') },
]

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back']

type DateChoice = 'today' | 'yesterday' | 'custom'

function money(amount: number, currency: string) {
  if (currency === 'USD') return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return formatTHB(amount)
}

function asCurrency(c: string | undefined): Currency | undefined {
  return c === 'THB' || c === 'USD' ? c : undefined
}

function Chip({
  active,
  onClick,
  children,
  color,
  label,
  compact,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  /** Category / label colour for the active state; brand green otherwise. */
  color?: string | null
  label?: string
  /** Icon-only chip: tighter padding so the date row fits a phone. */
  compact?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border text-[13px] font-medium transition-colors',
        compact ? 'px-2.5' : 'px-3',
        active
          ? 'border-transparent text-white'
          : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)]',
        active && !color && 'bg-brand-600',
      )}
      style={active && color ? { backgroundColor: color } : undefined}
    >
      {children}
    </button>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[12px] font-medium text-[var(--color-muted)]">{children}</p>
}

function entryTitle(e: FrequentEntry): string {
  if (e.note) return e.note
  if (e.type === 'transfer') return t('Transfer')
  return e.sample.subCategory?.name ?? e.sample.category?.name ?? t('Uncategorized')
}

/**
 * The way to add a transaction: an on-screen keypad (no phone keyboard
 * covering the form), category and account chips ordered by how often you use
 * them, the last account remembered, and your most repeated entries as
 * one-tap favorites. Editing an existing entry uses the full form instead.
 */
export function QuickAddSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void
  /** Called with the saved transaction; the sheet is done after this. */
  onCreated: (tx: Transaction) => void
}) {
  const [prefs] = useState(loadQuickAddPrefs)
  const [type, setType] = useState<TransactionKind>(prefs.type)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subCategoryId, setSubCategoryId] = useState('')
  const [accountId, setAccountId] = useState<string | null>(null) // null = not chosen yet
  const [toAccountId, setToAccountId] = useState<string | null>(null)
  // Used only when no account sets the currency.
  const [freeCurrency, setFreeCurrency] = useState<Currency>('THB')
  const [allCategories, setAllCategories] = useState(false)
  const [dateChoice, setDateChoice] = useState<DateChoice>('today')
  const [customDate, setCustomDate] = useState(nowDateTimeLocalValue)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [history, setHistory] = useState<Transaction[]>([])

  useEffect(() => {
    let live = true
    listAccounts()
      .then((rows) => live && setAccounts(rows))
      .catch(() => undefined)
    listCategories()
      .then((rows) => live && setCategories(rows))
      .catch(() => undefined)
    listLabels()
      .then((rows) => live && setLabels(rows))
      .catch(() => undefined)
    listTransactionPage({}, undefined, HISTORY_SIZE)
      .then((page) => live && setHistory(page.items))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  const isTransfer = type === 'transfer'
  const favorites = useMemo(() => frequentEntries(history), [history])
  const rankedCategories = useMemo(
    () => (isTransfer ? [] : rankCategories(categories, history, type)),
    [categories, history, type, isTransfer],
  )
  const rankedAccounts = useMemo(
    () => rankAccounts(accounts, history, type),
    [accounts, history, type],
  )

  // Until you pick one, the account follows your last choice / most used.
  const effectiveAccountId = accountId ?? defaultAccountId(prefs, type, rankedAccounts)
  const fromAccount = accounts.find((a) => a.id === effectiveAccountId)
  // The remembered destination only applies when it still fits the source:
  // another account, in the same currency.
  const rememberedTo = accounts.find((a) => a.id === prefs.toAccount)
  const defaultToAccountId =
    rememberedTo &&
    rememberedTo.id !== effectiveAccountId &&
    (!fromAccount || rememberedTo.currency === fromAccount.currency)
      ? rememberedTo.id
      : ''
  const effectiveToAccountId = toAccountId ?? defaultToAccountId
  const toAccount = isTransfer ? accounts.find((a) => a.id === effectiveToAccountId) : undefined
  const accountCurrency = asCurrency(fromAccount?.currency) ?? asCurrency(toAccount?.currency)
  const currency: Currency = accountCurrency ?? freeCurrency

  const shownCategories =
    allCategories || rankedCategories.length <= TOP_CATEGORIES + 1
      ? rankedCategories
      : rankedCategories.slice(0, TOP_CATEGORIES)
  // Keep the picked category visible even when it sits past the top few.
  const picked = rankedCategories.find((c) => c.id === categoryId)
  if (picked && !shownCategories.includes(picked)) shownCategories.push(picked)
  const subCategories = categories.filter((c) => c.parentId === categoryId)
  const toOptions = accounts.filter(
    (a) => a.id !== effectiveAccountId && (!fromAccount || a.currency === fromAccount.currency),
  )

  // Physical keyboard on desktop: digits, dot and Backspace drive the keypad
  // and Enter saves, unless you're typing in a field. The form takes focus on
  // open (instead of the close button) so Enter can't dismiss the sheet.
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    formRef.current?.focus({ preventScroll: true })
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter') {
        if (target?.closest('button')) return
        e.preventDefault()
        formRef.current?.requestSubmit()
        return
      }
      let key: KeypadKey | null = null
      if (/^[0-9]$/.test(e.key)) key = e.key as KeypadKey
      else if (e.key === '.' || e.key === ',') key = '.'
      else if (e.key === 'Backspace') key = 'back'
      if (!key) return
      e.preventDefault()
      const k = key
      setAmount((a) => pressKey(a, k))
      setError(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function pickType(next: TransactionKind) {
    setType(next)
    setCategoryId('')
    setSubCategoryId('')
    setAccountId(null)
    setToAccountId(null)
    setAllCategories(false)
    setError(null)
  }

  function press(key: KeypadKey) {
    setAmount((a) => pressKey(a, key))
    setError(null)
  }

  function toggleLabel(id: string) {
    setLabelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function chosenDate(): Date {
    if (dateChoice === 'custom') return new Date(customDate)
    const now = new Date()
    if (dateChoice === 'yesterday') now.setDate(now.getDate() - 1)
    return now
  }

  function remember(saved: TransactionInput) {
    saveQuickAddPrefs({
      type: saved.type,
      account: { ...prefs.account, [saved.type]: saved.accountId ?? '' },
      toAccount: saved.type === 'transfer' ? (saved.toAccountId ?? '') : prefs.toAccount,
    })
  }

  // A ref, not just state: two taps before the next render both see
  // `saving === false`, and would save the entry twice.
  const savingRef = useRef(false)

  async function send(input: TransactionInput) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const saved = await createTransaction(input)
      remember(input)
      onCreated(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Could not save. Try again.'))
      savingRef.current = false
      setSaving(false)
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (savingRef.current) return
    const value = Number(amount)
    if (!amount || !(value > 0)) {
      setError(t('Enter an amount greater than 0.'))
      return
    }
    const date = chosenDate()
    if (Number.isNaN(date.getTime())) {
      setError(t('Pick a date.'))
      return
    }
    const common = {
      type,
      amount: value,
      currency,
      note: note.trim() || undefined,
      date: date.toISOString(),
      timezone: browserTimezone(),
      labelIds,
    }
    if (isTransfer) {
      if (!effectiveAccountId && !effectiveToAccountId) {
        setError(t('Pick an account on at least one side.'))
        return
      }
      if (effectiveAccountId && effectiveAccountId === effectiveToAccountId) {
        setError(t('Pick two different accounts.'))
        return
      }
      if (fromAccount && toAccount && fromAccount.currency !== toAccount.currency) {
        setError(t('Both accounts must be in the same currency.'))
        return
      }
      void send({
        ...common,
        accountId: effectiveAccountId || undefined,
        toAccountId: effectiveToAccountId || undefined,
      })
      return
    }
    if (!categoryId) {
      setError(t('Pick a category.'))
      return
    }
    void send({
      ...common,
      categoryId,
      subCategoryId: subCategoryId || undefined,
      accountId: effectiveAccountId || undefined,
    })
  }

  function repeat(entry: FrequentEntry) {
    void send(entryToInput(entry, new Date(), browserTimezone()))
  }

  const sign = type === 'income' ? '+' : type === 'expense' ? '−' : ''

  return (
    <Sheet label={t('Quick add')} onClose={onClose}>
      <Card>
        <CardBody>
          <form
            ref={formRef}
            tabIndex={-1}
            className="space-y-3 outline-none"
            onSubmit={handleSubmit}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-ink)]">{t('Quick add')}</p>
              <button
                type="button"
                aria-label={t('Close')}
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {favorites.length > 0 && (
              <div>
                <FieldLabel>{t('Frequent · tap to add again')}</FieldLabel>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                  {favorites.map((f) => {
                    const transfer = f.type === 'transfer'
                    const color = transfer
                      ? TRANSFER_COLOR
                      : (f.sample.category?.color ?? FALLBACK_COLOR)
                    const title = entryTitle(f)
                    return (
                      <button
                        key={f.key}
                        type="button"
                        disabled={saving}
                        onClick={() => repeat(f)}
                        aria-label={t('Add {name} {amount} again', {
                          name: title,
                          amount: money(f.amount, f.currency),
                        })}
                        className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] py-1.5 pl-1.5 pr-3 text-left transition-colors hover:bg-[var(--color-canvas)] disabled:opacity-50"
                      >
                        <span
                          className="flex size-7 items-center justify-center rounded-full"
                          style={{ backgroundColor: color + '20', color }}
                        >
                          <Icon
                            name={transfer ? TRANSFER_ICON : (f.sample.category?.icon ?? 'Circle')}
                            size={14}
                            aria-hidden
                          />
                        </span>
                        <span className="leading-tight">
                          <span className="block max-w-28 truncate text-[13px] font-medium text-[var(--color-ink)]">
                            {title}
                          </span>
                          <span className="tnum block text-[11px] text-[var(--color-muted)]">
                            {money(f.amount, f.currency)}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div
              className="flex gap-1 rounded-xl bg-[var(--color-canvas)] p-1"
              role="group"
              aria-label={t('Transaction type')}
            >
              {TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={type === opt.value}
                  onClick={() => pickType(opt.value)}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-sm font-semibold transition-colors',
                    type === opt.value
                      ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm'
                      : 'text-[var(--color-muted)]',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2">
              {/* An account fixes the currency; without one you can switch it. */}
              {!accountCurrency && (
                <button
                  type="button"
                  aria-label={t('Currency')}
                  onClick={() => setFreeCurrency((c) => (c === 'THB' ? 'USD' : 'THB'))}
                  className="h-7 rounded-full border border-[var(--color-line)] px-2.5 text-[12px] font-semibold text-[var(--color-muted)] hover:bg-[var(--color-canvas)]"
                >
                  {currency}
                </button>
              )}
              <output
                aria-label={t('Amount')}
                aria-live="polite"
                className={cn(
                  'tnum block text-right text-4xl font-bold tracking-tight',
                  type === 'income' ? 'text-[var(--color-gain)]' : 'text-[var(--color-ink)]',
                  !amount && 'text-[var(--color-muted)]',
                )}
              >
                {amount && sign}
                {currency === 'USD' ? '$' : '฿'}
                {formatKeypadAmount(amount)}
              </output>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]"
              >
                {error}
              </p>
            )}

            {!isTransfer && (
              <div>
                <FieldLabel>{t('Category')}</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {shownCategories.map((c) => (
                    <Chip
                      key={c.id}
                      active={categoryId === c.id}
                      color={c.color}
                      onClick={() => {
                        setCategoryId(c.id)
                        setSubCategoryId('')
                        setError(null)
                      }}
                    >
                      <Icon name={c.icon ?? 'Circle'} size={14} aria-hidden />
                      {c.name}
                    </Chip>
                  ))}
                  {rankedCategories.length > shownCategories.length && (
                    <Chip active={false} onClick={() => setAllCategories(true)}>
                      {t('More')}
                    </Chip>
                  )}
                </div>
                {subCategories.length > 0 && (
                  <div
                    className="mt-1.5 flex flex-wrap gap-1.5"
                    aria-label={t('Sub-category (optional)')}
                    role="group"
                  >
                    {subCategories.map((s) => (
                      <Chip
                        key={s.id}
                        active={subCategoryId === s.id}
                        onClick={() => setSubCategoryId(subCategoryId === s.id ? '' : s.id)}
                      >
                        {s.name}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
            )}

            {accounts.length > 0 && (
              <div>
                <FieldLabel>{isTransfer ? t('From account') : t('Account')}</FieldLabel>
                <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                  {rankedAccounts.map((a) => (
                    <Chip
                      key={a.id}
                      active={effectiveAccountId === a.id}
                      onClick={() => {
                        setAccountId(a.id)
                        if (
                          isTransfer &&
                          (effectiveToAccountId === a.id ||
                            accounts.find((x) => x.id === effectiveToAccountId)?.currency !==
                              a.currency)
                        ) {
                          setToAccountId('')
                        }
                      }}
                    >
                      {a.name}
                    </Chip>
                  ))}
                  <Chip active={effectiveAccountId === ''} onClick={() => setAccountId('')}>
                    {isTransfer ? t('Nowhere') : t('No account')}
                  </Chip>
                </div>
              </div>
            )}

            {isTransfer && accounts.length > 0 && (
              <div>
                <FieldLabel>{t('To account')}</FieldLabel>
                <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                  {toOptions.map((a) => (
                    <Chip
                      key={a.id}
                      active={effectiveToAccountId === a.id}
                      onClick={() => setToAccountId(a.id)}
                    >
                      {a.name}
                    </Chip>
                  ))}
                  <Chip active={effectiveToAccountId === ''} onClick={() => setToAccountId('')}>
                    {t('Nowhere')}
                  </Chip>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1">
              <Chip active={dateChoice === 'today'} onClick={() => setDateChoice('today')}>
                {t('Today')}
              </Chip>
              <Chip active={dateChoice === 'yesterday'} onClick={() => setDateChoice('yesterday')}>
                {t('Yesterday')}
              </Chip>
              {dateChoice === 'custom' ? (
                <input
                  type="datetime-local"
                  aria-label={t('Date & time')}
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="h-9 rounded-full border border-brand-500 bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-ink)]"
                />
              ) : (
                <Chip active={false} onClick={() => setDateChoice('custom')}>
                  {t('Other date')}
                </Chip>
              )}
              <Chip
                active={noteOpen || note.trim() !== ''}
                label={t('Note (optional)')}
                compact
                onClick={() => setNoteOpen((o) => !o)}
              >
                <NotebookPen size={14} aria-hidden />
              </Chip>
              {labels.length > 0 && (
                <Chip
                  active={labelsOpen || labelIds.length > 0}
                  label={t('Labels')}
                  compact
                  onClick={() => setLabelsOpen((o) => !o)}
                >
                  <Tags size={14} aria-hidden />
                  {labelIds.length > 0 && labelIds.length}
                </Chip>
              )}
            </div>

            {noteOpen && (
              <input
                type="text"
                aria-label={t('Note (optional)')}
                placeholder={t('e.g. Lunch with team')}
                value={note}
                autoFocus
                onChange={(e) => setNote(e.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500"
              />
            )}

            {labelsOpen && labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Labels')}>
                {labels.map((l) => (
                  <Chip
                    key={l.id}
                    active={labelIds.includes(l.id)}
                    color={l.color ?? FALLBACK_COLOR}
                    onClick={() => toggleLabel(l.id)}
                  >
                    {l.name}
                  </Chip>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={t('Keypad')}>
              {KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  aria-label={k === 'back' ? t('Delete digit') : undefined}
                  className="tnum flex h-11 items-center justify-center rounded-xl bg-[var(--color-canvas)] text-xl font-medium text-[var(--color-ink)] transition-colors active:bg-[var(--color-line)]"
                >
                  {k === 'back' ? <Delete size={20} aria-hidden /> : k}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 text-[15px] font-semibold text-white transition-colors hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
            >
              {saving ? t('Saving…') : t('Save')}
            </button>
          </form>
        </CardBody>
      </Card>
    </Sheet>
  )
}

/** Opens the quick-add sheet; null outside `QuickAddProvider`. */
const QuickAddContext = createContext<(() => void) | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useQuickAdd(): (() => void) | null {
  return useContext(QuickAddContext)
}

/**
 * Owns the quick-add flow for the app: the floating + button (every screen),
 * the sheet, and a toast with Undo for the entry just saved. Screens open it
 * with `useQuickAdd()`. A screen that listens with `useTransactionChanges`
 * updates itself in place; otherwise `onChange` runs so the screen can reload.
 */
export function QuickAddProvider({
  onChange,
  children,
}: {
  onChange: () => void
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<
    { id: number; tx: Transaction } | { id: number; error: string } | null
  >(null)
  const nextId = useRef(0)
  const [openSheet] = useState(() => () => setOpen(true))

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [toast])

  function created(tx: Transaction) {
    setOpen(false)
    setToast({ id: ++nextId.current, tx })
    if (!announceTransactionChange({ kind: 'created', tx })) onChange()
  }

  async function undo(tx: Transaction) {
    setToast(null)
    try {
      await deleteTransaction(tx.id)
      if (!announceTransactionChange({ kind: 'deleted', tx })) onChange()
    } catch (err) {
      const reason = err instanceof ApiError ? err.message : t('Try again.')
      setToast({ id: ++nextId.current, error: t("Couldn't undo. {reason}", { reason }) })
    }
  }

  return (
    <QuickAddContext.Provider value={openSheet}>
      {children}
      {/* Lifts above its toast (they share the bottom-right corner) so the
          next entry can start straight away. */}
      <button
        type="button"
        aria-label={t('Quick add')}
        onClick={openSheet}
        className={cn(
          'fixed right-4 z-30 flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-[bottom,transform] hover:bg-brand-700 active:scale-95 lg:right-8',
          toast
            ? 'bottom-[calc(8.5rem+env(safe-area-inset-bottom))] lg:bottom-24'
            : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-8',
        )}
      >
        <Plus size={26} aria-hidden />
      </button>
      {open && <QuickAddSheet onClose={() => setOpen(false)} onCreated={created} />}
      {toast &&
        ('tx' in toast ? (
          <UndoToast
            key={toast.id}
            message={t('Saved {amount}', { amount: money(toast.tx.amount, toast.tx.currency) })}
            onUndo={() => undo(toast.tx)}
            onDismiss={() => setToast(null)}
          />
        ) : (
          <UndoToast
            key={toast.id}
            tone="error"
            message={toast.error}
            onDismiss={() => setToast(null)}
          />
        ))}
    </QuickAddContext.Provider>
  )
}
