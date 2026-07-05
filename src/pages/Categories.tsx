import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { ApiError } from '@/lib/api'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type Category,
} from '@/lib/categories'

const FALLBACK_COLOR = '#94a3b8'

function chipStyle(color: string | null) {
  const c = color ?? FALLBACK_COLOR
  return { backgroundColor: c + '20', color: c }
}

/** Inline "tap once to arm, tap again to confirm" delete button. */
function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={
        'text-xs font-medium transition-colors ' +
        (armed ? 'text-[var(--color-loss)]' : 'text-[var(--color-muted)] hover:text-[var(--color-loss)]')
      }
    >
      {armed ? 'Confirm?' : '×'}
    </button>
  )
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
      setError('Enter a name.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const created = await createCategory({ name: name.trim(), kind })
      onSaved(created)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-[var(--color-ink)]">New category</p>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-[var(--color-loss)]">
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
            label="Name"
            placeholder="e.g. Side Hustle"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Add category'}
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
      setError('Enter a name.')
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
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.')
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
          placeholder="Sub-category name"
          className="h-9 flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500"
        />
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? '…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function CategoryGroup({
  category,
  children,
  onChanged,
  onRemoved,
}: {
  category: Category
  children: Category[]
  onChanged: (c: Category) => void
  onRemoved: (id: string) => void
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
      setError(err instanceof ApiError ? err.message : 'Could not rename.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCategory(id)
      onRemoved(id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete.')
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
            <Badge tone="neutral">Default</Badge>
          ) : (
            <button
              type="button"
              onClick={() => setRenaming((v) => !v)}
              className="shrink-0 text-xs font-medium text-brand-600"
            >
              Edit
            </button>
          )}
        </div>

        {error && <p className="text-xs text-[var(--color-loss)]">{error}</p>}

        {children.length > 0 && (
          <div className="space-y-1.5 pl-1">
            {children.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between gap-2 pl-6">
                <span className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                  <span className="text-[var(--color-muted)]">•</span>
                  {sub.name}
                </span>
                {!sub.isDefault && (
                  <DeleteButton onConfirm={() => handleDelete(sub.id)} />
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
            + Add sub-category
          </button>
        )}

        {!category.isDefault && (
          <DeleteButton onConfirm={() => handleDelete(category.id)} />
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
          setError(err instanceof ApiError ? err.message : 'Could not load categories.'),
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

  function remove(id: string) {
    setItems((prev) => (prev ?? []).filter((c) => c.id !== id && c.parentId !== id))
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categories"
        subtitle="Defaults are built-in · add your own"
        action={
          <Button size="sm" onClick={() => setAddingCategory((v) => !v)}>
            <Plus size={16} aria-hidden />
            New
          </Button>
        }
      />

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
            <p className="text-sm text-[var(--color-muted)]">Loading…</p>
          </CardBody>
        </Card>
      )}

      {items !== null && (
        <>
          {defaults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Defaults
              </p>
              <div className="space-y-3">
                {defaults.map((cat) => (
                  <CategoryGroup
                    key={cat.id}
                    category={cat}
                    children={childrenOf(cat.id)}
                    onChanged={upsert}
                    onRemoved={remove}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Your categories
            </p>
            {custom.length === 0 ? (
              <Card>
                <CardBody>
                  <p className="text-sm text-[var(--color-muted)]">
                    No custom categories yet.
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
                    onRemoved={remove}
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
