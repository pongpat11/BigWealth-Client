// Thin fetch wrapper around the BigWealth API. Centralises the base URL,
// JSON handling, error mapping, and transparent access-token refresh on 401.
import { clearTokens, refreshSession } from './auth'

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
)

// Dev-only offline mode: serve requests from an in-memory mock instead of a real
// backend. Enable by running the client with VITE_MOCK=1 (see .env.mock).
const USE_MOCK =
  import.meta.env.VITE_MOCK === '1' || import.meta.env.VITE_MOCK === 'true'

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Bearer token for authenticated requests. */
  token?: string
  signal?: AbortSignal
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
  _retried = false,
): Promise<T> {
  const { method = 'GET', body, token, signal } = options

  if (USE_MOCK) {
    const { mockFetch } = await import('./mock/mockApi')
    return mockFetch<T>(path, method, body as Record<string, unknown> | undefined)
  }

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch {
    // Network failure / server unreachable
    throw new ApiError(0, 'Cannot reach the server. Please try again.')
  }

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await res.json().catch(() => undefined) : undefined

  if (!res.ok) {
    // Access token expired: refresh once and retry the original request.
    if (res.status === 401 && token && !_retried && path !== '/auth/refresh') {
      const newToken = await refreshSession().catch(() => null)
      if (newToken) {
        return apiFetch<T>(path, { ...options, token: newToken }, true)
      }
      // Refresh failed — the session is dead; the route guard will send the
      // user to /login on the next navigation.
      clearTokens()
    }

    const message =
      (payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : undefined) ?? `Request failed (${res.status})`
    throw new ApiError(res.status, message, payload)
  }

  return payload as T
}
