import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ApiError } from '@/lib/api'
import {
  createGoal,
  deleteGoal,
  goalPlan,
  listGoals,
  updateGoal,
  type Goal,
} from '@/lib/goals'
import { formatTHB } from '@/lib/format'

function formatDeadline(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** One line under the progress bar: what's left and what it takes. */
function planLine(goal: Goal): string {
  const plan = goalPlan(goal)
  if (plan.remaining === 0) return 'Goal reached'
  if (!goal.deadline) return `${formatTHB(plan.remaining)} to go`
  if (plan.overdue) return `${formatTHB(plan.remaining)} to go · due ${formatDeadline(goal.deadline)}`
  const months = plan.monthsLeft === 1 ? '1 month left' : `${plan.monthsLeft} months left`
  return `${months} · ${formatTHB(plan.perMonth ?? 0)}/mo`
}

function GoalForm({
  initial,
  onSaved,
  onDeleted,
  onClose,
}: {
  initial?: Goal
  onSaved: (g: Goal, isEdit: boolean) => void
  onDeleted: (id: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [target, setTarget] = useState(initial ? String(initial.target) : '')
  const [saved, setSaved] = useState(initial ? String(initial.saved) : '')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [armed, setArmed] = useState(false) // two-tap delete confirm

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const targetValue = Number(target)
    const savedValue = saved.trim() === '' ? 0 : Number(saved)
    if (!name.trim()) {
      setError('Enter a name.')
      return
    }
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      setError('Enter a target greater than 0.')
      return
    }
    if (!Number.isFinite(savedValue) || savedValue < 0) {
      setError('Saved amount cannot be negative.')
      return
    }
    setError(null)
    setSaving(true)
    const input = {
      name: name.trim(),
      target: targetValue,
      saved: savedValue,
      deadline: deadline || null,
    }
    try {
      const result = initial ? await updateGoal(initial.id, input) : await createGoal(input)
      onSaved(result, Boolean(initial))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initial) return
    if (!armed) {
      setArmed(true)
      return
    }
    setError(null)
    setSaving(true)
    try {
      await deleteGoal(initial.id)
      onDeleted(initial.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete. Try again.')
      setSaving(false)
      setArmed(false)
    }
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {initial ? 'Edit goal' : 'New goal'}
          </p>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-[var(--color-loss)]">
              {error}
            </p>
          )}
          <Input
            id="goal-name"
            label="Name"
            placeholder="e.g. Emergency fund"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="goal-target"
              label="Target (฿)"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <Input
              id="goal-saved"
              label="Saved so far (฿)"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0"
              value={saved}
              onChange={(e) => setSaved(e.target.value)}
            />
          </div>
          <Input
            id="goal-deadline"
            label="Deadline (optional)"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Add goal'}
            </Button>
          </div>

          {initial && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="w-full rounded-xl py-2 text-sm font-semibold text-[var(--color-loss)] transition-colors hover:bg-rose-500/10 disabled:opacity-50"
            >
              {armed ? 'Tap again to delete' : 'Delete goal'}
            </button>
          )}
        </form>
      </CardBody>
    </Card>
  )
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: (g: Goal) => void }) {
  const done = goal.saved >= goal.target
  const pct = goal.target > 0 ? Math.min(Math.round((goal.saved / goal.target) * 100), 100) : 0
  return (
    <button
      type="button"
      onClick={() => onEdit(goal)}
      aria-label={`Edit goal ${goal.name}`}
      className={
        'block w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-left shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--color-canvas)] ' +
        (done ? 'opacity-70' : '')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]">
          {done && (
            <CheckCircle2 size={16} className="shrink-0 text-[var(--color-gain)]" aria-hidden />
          )}
          <span className="truncate">{goal.name}</span>
        </p>
        <span className="tnum shrink-0 text-sm font-bold text-[var(--color-ink)]">{pct}%</span>
      </div>
      <p className="tnum mt-1 text-xs text-[var(--color-muted)]">
        <span className="font-semibold text-[var(--color-ink)]">{formatTHB(goal.saved)}</span> /{' '}
        {formatTHB(goal.target)}
      </p>
      {/* Progress toward a goal is always "good", so don't auto-tone it red. */}
      <ProgressBar value={goal.saved} max={goal.target} tone="brand" className="mt-3" />
      <p className="tnum mt-2 text-xs text-[var(--color-muted)]">{planLine(goal)}</p>
    </button>
  )
}

export function Goals() {
  const [items, setItems] = useState<Goal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)

  useEffect(() => {
    let active = true
    listGoals()
      .then((rows) => active && setItems(rows))
      .catch(
        (err) =>
          active && setError(err instanceof ApiError ? err.message : 'Could not load goals.'),
      )
    return () => {
      active = false
    }
  }, [])

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  function handleSaved(saved: Goal, isEdit: boolean) {
    setItems((prev) => {
      const list = prev ?? []
      return isEdit ? list.map((g) => (g.id === saved.id ? saved : g)) : [...list, saved]
    })
    closeForm()
  }

  function handleDeleted(id: string) {
    setItems((prev) => (prev ?? []).filter((g) => g.id !== id))
    closeForm()
  }

  // Active goals first; reached ones sink to the bottom.
  const sorted = [...(items ?? [])].sort(
    (a, b) => Number(a.saved >= a.target) - Number(b.saved >= b.target),
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Goals"
        action={
          <Button
            size="sm"
            onClick={() => {
              if (formOpen && editing === null) {
                closeForm()
              } else {
                setEditing(null)
                setFormOpen(true)
              }
            }}
          >
            <Plus size={16} aria-hidden />
            Add
          </Button>
        }
      />

      {formOpen && (
        <GoalForm
          key={editing?.id ?? 'new'}
          initial={editing ?? undefined}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onClose={closeForm}
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

      {items !== null && items.length === 0 && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-canvas)] text-[var(--color-muted)]">
              <Target size={22} aria-hidden />
            </span>
            <p className="text-sm text-[var(--color-muted)]">
              No goals yet. Add something you're saving for.
            </p>
          </CardBody>
        </Card>
      )}

      {sorted.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          onEdit={(g) => {
            setEditing(g)
            setFormOpen(true)
          }}
        />
      ))}
    </div>
  )
}
