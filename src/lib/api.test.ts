import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch } from './api'

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  } as unknown as Response
}

describe('apiFetch — token refresh on 401', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refreshes the access token on 401, then retries and succeeds', async () => {
    localStorage.setItem('bw.refreshToken', 'old-refresh')
    localStorage.setItem('bw.accessToken', 'old-access')

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' })) // original
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: 'new-access', refreshToken: 'new-refresh' }),
      ) // /auth/refresh
      .mockResolvedValueOnce(jsonResponse(200, { items: [] })) // retry
    vi.stubGlobal('fetch', fetchMock)

    const data = await apiFetch<{ items: unknown[] }>('/transactions', {
      token: 'old-access',
    })

    expect(data).toEqual({ items: [] })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    // rotated tokens stored
    expect(localStorage.getItem('bw.accessToken')).toBe('new-access')
    // retry used the fresh token
    const retryHeaders = fetchMock.mock.calls[2][1].headers as Record<string, string>
    expect(retryHeaders.Authorization).toBe('Bearer new-access')
  })

  it('clears tokens and throws when the refresh fails', async () => {
    localStorage.setItem('bw.refreshToken', 'old-refresh')
    localStorage.setItem('bw.accessToken', 'old-access')

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' })) // original
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Invalid refresh token' })) // refresh fails
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiFetch('/transactions', { token: 'old-access' }),
    ).rejects.toBeInstanceOf(ApiError)

    expect(localStorage.getItem('bw.accessToken')).toBeNull()
    expect(localStorage.getItem('bw.refreshToken')).toBeNull()
  })

  it('does not attempt a refresh for unauthenticated requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Invalid email or password' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiFetch('/auth/login', { method: 'POST', body: {} }),
    ).rejects.toBeInstanceOf(ApiError)
    // no token on the request → only the single call, no refresh
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
