import { useEffect, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { ApiError } from '@/lib/api'
import {
  createLabel,
  deleteLabel,
  listLabels,
  updateLabel,
  type Label,
} from '@/lib/labels'

const FALLBACK_COLOR = '#94a3b8'

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
      {armed ? 'Confirm delete?' : 'Delete'}
    </button>
  )
}

function NewLabelForm({
  onSaved,
  onClose,
}: {
  onSaved: (l: Label) => void
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
    setError(null)
    setSaving(true)
    try {
      const created = await createLabel({ name: name.trim() })
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
          <p className="text-sm font-semibold text-[var(--color-ink)]">New label</p>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-[var(--color-loss)]">
              {error}
            </p>
          )}
          <Input
            id="new-label-name"
            label="Name"
            placeholder="e.g. Vacation"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Add label'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function LabelRow({
  label,
  onChanged,
  onRemoved,
}: {
  label: Label
  onChanged: (l: Label) => void
  onRemoved: (id: string) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(label.name)
  const [error, setError] = useState<string | null>(null)

  async function handleRename() {
    if (!name.trim() || name === label.name) {
      setRenaming(false)
      setName(label.name)
      return
    }
    try {
      const updated = await updateLabel(label.id, { name: name.trim() })
      onChanged(updated)
      setRenaming(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not rename.')
    }
  }

  async function handleDelete() {
    try {
      await deleteLabel(label.id)
      onRemoved(label.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete.')
    }
  }

  return (
    <div className="flex flex-col gap-1 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: label.color ?? FALLBACK_COLOR }}
          />
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              onBlur={handleRename}
              className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-sm font-medium text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-brand-500"
            />
          ) : (
            <p className="truncate text-sm font-medium text-[var(--color-ink)]">
              {label.name}
            </p>
          )}
        </div>
        {label.isDefault ? (
          <Badge tone="neutral">Default</Badge>
        ) : (
          <div className="flex shrink-0 items-center gap-4">
            <button
              type="button"
              onClick={() => setRenaming((v) => !v)}
              className="text-xs font-medium text-[var(--color-muted)]"
            >
              Edit
            </button>
            <DeleteButton onConfirm={handleDelete} />
          </div>
        )}
      </div>
      {error && <p className="text-xs text-[var(--color-loss)]">{error}</p>}
    </div>
  )
}

export function Labels() {
  const [items, setItems] = useState<Label[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addingLabel, setAddingLabel] = useState(false)

  useEffect(() => {
    let active = true
    listLabels()
      .then((rows) => active && setItems(rows))
      .catch(
        (err) =>
          active && setError(err instanceof ApiError ? err.message : 'Could not load labels.'),
      )
    return () => {
      active = false
    }
  }, [])

  function upsert(updated: Label) {
    setItems((prev) => {
      const list = prev ?? []
      const exists = list.some((l) => l.id === updated.id)
      return exists ? list.map((l) => (l.id === updated.id ? updated : l)) : [...list, updated]
    })
  }

  function remove(id: string) {
    setItems((prev) => (prev ?? []).filter((l) => l.id !== id))
  }

  const defaults = (items ?? []).filter((l) => l.isDefault)
  const custom = (items ?? []).filter((l) => !l.isDefault)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Labels"
        subtitle="Defaults are built-in · add your own"
        action={
          <Button size="sm" onClick={() => setAddingLabel((v) => !v)}>
            <Plus size={16} aria-hidden />
            New
          </Button>
        }
      />

      {addingLabel && (
        <NewLabelForm
          onSaved={(l) => {
            upsert(l)
            setAddingLabel(false)
          }}
          onClose={() => setAddingLabel(false)}
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
              <Card>
                <CardBody className="divide-y divide-[var(--color-line)] py-0">
                  {defaults.map((l) => (
                    <LabelRow key={l.id} label={l} onChanged={upsert} onRemoved={remove} />
                  ))}
                </CardBody>
              </Card>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Your labels
            </p>
            {custom.length === 0 ? (
              <Card>
                <CardBody>
                  <p className="text-sm text-[var(--color-muted)]">No custom labels yet.</p>
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardBody className="divide-y divide-[var(--color-line)] py-0">
                  {custom.map((l) => (
                    <LabelRow key={l.id} label={l} onChanged={upsert} onRemoved={remove} />
                  ))}
                </CardBody>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}
