// Auth API calls + token storage. Mirrors the server's /auth endpoints.
// Tokens live in localStorage for now; a proper session/guard lands with the
// session-handling task (server issue pairing: client #6).
import { apiFetch } from './api'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  createdAt: string
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
}

interface LoginResponse extends AuthTokens {
  user: AuthUser
}

const ACCESS_KEY = 'bw.accessToken'
const REFRESH_KEY = 'bw.refreshToken'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

function storeTokens({ accessToken, refreshToken }: AuthTokens): void {
  localStorage.setItem(ACCESS_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null
}

export async function login(
  email: string,
  password: string,
): Promise<AuthUser> {
  const data = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  storeTokens(data)
  return data.user
}

/** The signed-in user's profile. */
export async function me(): Promise<AuthUser> {
  const { user } = await apiFetch<{ user: AuthUser }>('/auth/me', {
    token: getAccessToken() ?? undefined,
  })
  return user
}

export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  clearTokens()
  if (refreshToken) {
    // Best-effort revoke; ignore failures so logout always succeeds locally.
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    }).catch(() => undefined)
  }
}

let refreshInFlight: Promise<string> | null = null

/**
 * Exchange the stored refresh token for a fresh access token, storing the
 * rotated pair. Single-flight: concurrent callers share one request (the server
 * rotates refresh tokens, so parallel refreshes would invalidate each other).
 * Throws if there's no refresh token or the server rejects it.
 */
export function refreshSession(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function doRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) throw new Error('No refresh token')
  // No bearer token on this call, so it never triggers the 401 refresh retry.
  const data = await apiFetch<AuthTokens>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  })
  storeTokens(data)
  return data.accessToken
}
