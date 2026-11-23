import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { useUndoableDelete } from '@/lib/useUndoableDelete'
import { ApiError } from '@/lib/api'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type Category,
} from '@/lib/categories'
import { t } from '@/lib/i18n'

const FALLBACK_COLOR = '#94a3b8'

function chipStyle(color: string | null) {
  const c = color ?? FALLBACK_COLOR
  return { backgroundColor: c + '20', color: c }
}

function NewCategoryForm({
  onSaved,
  onClose,
}: {
  onSaved: (c: Category) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('Enter a name.'))
      return
    }
    setError(null)
    setSaving(true)
    try {
      const created = await createCategory({ name: name.trim(), kind })
      onSaved(created)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Could not save. Try again.'))
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-[var(--color-ink)]">{t('New category')}</p>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {(['expense', 'income'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={
                  'flex-1 rounded-xl py-2 text-sm font-semibold capitalize transition-colors ' +
                  (kind === k
                    ? 'bg-brand-600 text-white'
                    : 'bg-[var(--color-canvas)] text-[var(--color-muted)]')
                }
              >
                {k}
              </button>
            ))}
          </div>
          <Input
            id="new-category-name"
            label={t('Name')}
            placeholder={t('e.g. Side Hustle')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? t('Saving…') : t('Add category')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function AddSubCategoryRow({
  parent,
  onSaved,
  onClose,
}: {
  parent: Category
  onSaved: (c: Category) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('Enter a name.'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await createCategory({
        name: name.trim(),
        kind: parent.kind,
        parentId: parent.id,
      })
      onSaved(created)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Could not save. Try again.'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 pl-6">
      {error && <p className="text-xs text-[var(--color-loss)]">{error}</p>}
      <div className="flex gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('Sub-category name')}
          className="h-9 flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500"
        />
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? '…' : t('Save')}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          {t('Cancel')}
        </Button>
      </div>
    </form>
  )
}

function CategoryGroup({
  category,
  children,
  onChanged,
  onDelete,
}: {
  category: Category
  children: Category[]
  onChanged: (c: Category) => void
  onDelete: (c: Category) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(category.name)
  const [addingSub, setAddingSub] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRename() {
    if (!name.trim() || name === category.name) {
      setRenaming(false)
      setName(category.name)
      return
    }
    try {
      const updated = await updateCategory(category.id, { name: name.trim() })
      onChanged(updated)
      setRenaming(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Could not rename.'))
    }
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full"
              style={chipStyle(category.color)}
            >
              <Icon name={category.icon ?? 'Tag'} size={14} aria-hidden />
            </span>
            {renaming ? (
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                onBlur={handleRename}
                className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-sm font-semibold text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500"
              />
            ) : (
              <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
                {category.name}
              </p>
            )}
          </div>
          {category.isDefault ? (
            <Badge tone="neutral">{t('Default')}</Badge>
          ) : (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setRenaming((v) => !v)}
                className="h-9 rounded-xl px-2 text-xs font-medium text-brand-600 hover:bg-[var(--color-canvas)]"
              >
                {t('Rename')}
              </button>
              <DeleteButton
                label={t('Delete {name}', { name: category.name })}
                onClick={() => onDelete(category)}
                className="-mr-2"
              />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-[var(--color-loss)]">{error}</p>}

        {children.length > 0 && (
          <div className="space-y-1.5 pl-1">
            {children.map((sub) => (
              <div key={sub.id} className="flex min-h-9 items-center justify-between gap-2 pl-6">
                <span className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                  <span className="text-[var(--color-muted)]">•</span>
                  {sub.name}
                </span>
                {!sub.isDefault && (
                  <DeleteButton
                    label={t('Delete {name}', { name: sub.name })}
                    onClick={() => onDelete(sub)}
                    className="-mr-2"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {addingSub ? (
          <AddSubCategoryRow
            parent={category}
            onSaved={(c) => {
              onChanged(c)
              setAddingSub(false)
            }}
            onClose={() => setAddingSub(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingSub(true)}
            className="pl-1 text-left text-xs font-semibold text-brand-600"
          >
            {t('+ Add sub-category')}
          </button>
        )}
      </CardBody>
    </Card>
  )
}

export function Categories() {
  const [items, setItems] = useState<Category[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addingCategory, setAddingCategory] = useState(false)

  useEffect(() => {
    let active = true
    listCategories()
      .then((rows) => active && setItems(rows))
      .catch(
        (err) =>
          active &&
          setError(err instanceof ApiError ? err.message : t('Could not load categories.')),
      )
    return () => {
      active = false
    }
  }, [])

  const { defaults, custom, childrenOf } = useMemo(() => {
    const all = items ?? []
    const topLevel = all.filter((c) => !c.parentId)
    return {
      defaults: topLevel.filter((c) => c.isDefault),
      custom: topLevel.filter((c) => !c.isDefault),
      childrenOf: (id: string) => all.filter((c) => c.parentId === id),
    }
  }, [items])

  function upsert(updated: Category) {
    setItems((prev) => {
      const list = prev ?? []
      const exists = list.some((c) => c.id === updated.id)
      return exists ? list.map((c) => (c.id === updated.id ? updated : c)) : [...list, updated]
    })
  }

  const undoable = useUndoableDelete()

  /** Deleting a category takes its sub-categories with it. */
  function handleDelete(category: Category) {
    const all = items ?? []
    const order = new Map(all.map((c, i) => [c.id, i]))
    const removed = all.filter((c) => c.id === category.id || c.parentId === category.id)
    const subs = removed.length - 1
    undoable.remove({
      message:
        subs === 0
          ? t('Deleted “{name}”', { name: category.name })
          : subs === 1
            ? t('Deleted “{name}” and 1 sub-category', { name: category.name })
            : t('Deleted “{name}” and {n} sub-categories', { name: category.name, n: subs }),
      hide: () =>
        setItems((prev) =>
          (prev ?? []).filter((c) => c.id !== category.id && c.parentId !== category.id),
        ),
      restore: () =>
        setItems((prev) => {
          const list = prev ?? []
          const missing = removed.filter((r) => !list.some((c) => c.id === r.id))
          return [...list, ...missing].sort(
            (a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity),
          )
        }),
      commit: () => deleteCategory(category.id),
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Categories')}
        subtitle={t('Defaults are built-in · add your own')}
        action={
          <Button size="sm" onClick={() => setAddingCategory((v) => !v)}>
            <Plus size={16} aria-hidden />
            {t('New')}
          </Button>
        }
      />

      {undoable.toast}
      {addingCategory && (
        <NewCategoryForm
          onSaved={(c) => {
            upsert(c)
            setAddingCategory(false)
          }}
          onClose={() => setAddingCategory(false)}
        />
      )}

      {error && (
        <Card>
          <CardBody>
            <p role="alert" className="text-sm text-[var(--color-loss)]">
              {error}
            </p>
          </CardBody>
        </Card>
      )}

      {!error && items === null && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--color-muted)]">{t('Loading…')}</p>
          </CardBody>
        </Card>
      )}

      {items !== null && (
        <>
          {defaults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {t('Defaults')}
              </p>
              <div className="space-y-3">
                {defaults.map((cat) => (
                  <CategoryGroup
                    key={cat.id}
                    category={cat}
                    children={childrenOf(cat.id)}
                    onChanged={upsert}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {t('Your categories')}
            </p>
            {custom.length === 0 ? (
              <Card>
                <CardBody>
                  <p className="text-sm text-[var(--color-muted)]">
                    {t('No custom categories yet.')}
                  </p>
                </CardBody>
              </Card>
            ) : (
              <div className="space-y-3">
                {custom.map((cat) => (
                  <CategoryGroup
                    key={cat.id}
                    category={cat}
                    children={childrenOf(cat.id)}
                    onChanged={upsert}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
