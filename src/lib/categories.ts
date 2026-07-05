// Categories API client. Built-in categories are shared/read-only; each
// user's own categories (and sub-categories) are scoped to them.
import { apiFetch } from './api'
import { getAccessToken } from './auth'

export interface Category {
  id: string
  name: string
  kind: 'income' | 'expense'
  parentId: string | null
  icon: string | null
  color: string | null
  isDefault: boolean
}

export interface NewCategory {
  name: string
  kind: 'income' | 'expense'
  parentId?: string
  icon?: string
  color?: string
}

export interface CategoryEdit {
  name?: string
  icon?: string
  color?: string
}

function auth() {
  return { token: getAccessToken() ?? undefined }
}

export async function listCategories(): Promise<Category[]> {
  const { items } = await apiFetch<{ items: Category[] }>('/categories', auth())
  return items
}

export async function createCategory(input: NewCategory): Promise<Category> {
  return apiFetch<Category>('/categories', { method: 'POST', body: input, ...auth() })
}

export async function updateCategory(id: string, input: CategoryEdit): Promise<Category> {
  return apiFetch<Category>(`/categories/${id}`, { method: 'PATCH', body: input, ...auth() })
}

export async function deleteCategory(id: string): Promise<void> {
  await apiFetch<void>(`/categories/${id}`, { method: 'DELETE', ...auth() })
}
