import {
  parseUserProfile,
  type SignupValues,
  type UserProfile,
} from './types'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.PROD ? '/api' : 'http://localhost:8000')
).replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(status: number, detail: unknown) {
    super(`The server returned status ${status}.`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export class NetworkError extends Error {
  constructor() {
    super("Can't reach the server. Check your connection and try again.")
    this.name = 'NetworkError'
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Your session expired. Please log in again.')
    this.name = 'SessionExpiredError'
  }
}

export class SignupLoginError extends Error {
  constructor() {
    super('The account was created, but login did not complete.')
    this.name = 'SignupLoginError'
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  csrfToken?: string
  authenticated?: boolean
}

let sessionExpiredHandler: (() => void) | null = null

export function registerSessionExpiredHandler(handler: () => void): () => void {
  sessionExpiredHandler = handler
  return () => {
    if (sessionExpiredHandler === handler) {
      sessionExpiredHandler = null
    }
  }
}

export async function apiRequest(
  path: string,
  options: ApiRequestOptions = {},
): Promise<unknown> {
  const headers = new Headers()
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.csrfToken !== undefined) {
    headers.set('X-CSRF-Token', options.csrfToken)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      throw new NetworkError()
    }
    throw error
  }

  if (response.status === 204) {
    if (!response.ok) {
      throw new ApiError(response.status, undefined)
    }
    return undefined
  }

  let payload: unknown
  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      payload = await response.json()
    } catch {
      if (response.ok) {
        throw new Error('The server returned an unreadable response.')
      }
    }
  }

  if (!response.ok) {
    const error = new ApiError(response.status, payload)
    if (options.authenticated && response.status === 401) {
      sessionExpiredHandler?.()
    }
    throw error
  }

  if (payload === undefined) {
    throw new Error('The server returned an empty response.')
  }

  return payload
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function getCsrfToken(): Promise<string> {
  const payload = await apiRequest('/auth/csrf')
  if (!isRecord(payload) || typeof payload.csrf_token !== 'string') {
    throw new Error('The server returned an invalid CSRF token.')
  }
  return payload.csrf_token
}

export async function login(
  username: string,
  password: string,
  csrfToken: string,
): Promise<void> {
  const payload = await apiRequest('/auth/login', {
    method: 'POST',
    body: { username, password },
    csrfToken,
  })
  if (
    !isRecord(payload) ||
    typeof payload.expires_in !== 'number' ||
    !Number.isInteger(payload.expires_in) ||
    payload.expires_in <= 0
  ) {
    throw new Error('The server returned an invalid session response.')
  }
}

export async function signup(
  values: SignupValues,
  csrfToken: string,
): Promise<void> {
  await apiRequest('/auth/signup', {
    method: 'POST',
    body: values,
    csrfToken,
  })
}

export async function getCurrentUser(authenticated = false): Promise<UserProfile> {
  return parseUserProfile(
    await apiRequest('/auth/me', { authenticated }),
  )
}

export async function logout(csrfToken: string): Promise<void> {
  await apiRequest('/auth/logout', {
    method: 'POST',
    csrfToken,
  })
}
