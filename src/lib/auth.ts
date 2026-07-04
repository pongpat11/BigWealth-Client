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
