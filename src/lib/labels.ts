// Labels API client. Built-in labels are shared/read-only; each user's own
// labels are scoped to them. Labels attach to transactions via labelIds.
import { apiFetch } from './api'
import { getAccessToken } from './auth'

export interface Label {
  id: string
  name: string
  color: string | null
  isDefault: boolean
}

export interface NewLabel {
  name: string
  color?: string
}

export interface LabelEdit {
  name?: string
  color?: string
}

function auth() {
  return { token: getAccessToken() ?? undefined }
}

export async function listLabels(): Promise<Label[]> {
  const { items } = await apiFetch<{ items: Label[] }>('/labels', auth())
  return items
}

export async function createLabel(input: NewLabel): Promise<Label> {
  return apiFetch<Label>('/labels', { method: 'POST', body: input, ...auth() })
}

export async function updateLabel(id: string, input: LabelEdit): Promise<Label> {
  return apiFetch<Label>(`/labels/${id}`, { method: 'PATCH', body: input, ...auth() })
}

export async function deleteLabel(id: string): Promise<void> {
  await apiFetch<void>(`/labels/${id}`, { method: 'DELETE', ...auth() })
}
