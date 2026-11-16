import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ApiError,
  getCsrfToken,
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  NetworkError,
  registerSessionExpiredHandler,
  SessionExpiredError,
  signup as signupRequest,
  SignupLoginError,
} from './api'
import type { SignupValues } from './types'
import {
  AuthContext,
  type AuthProviderProps,
  type AuthState,
  type CsrfState,
} from './AuthContext'

function csrfErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return error.message
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Request could not be completed. Refresh and try again.'
  }
  return 'Something went wrong. Please try again.'
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading', user: null })
  const [csrf, setCsrf] = useState<CsrfState>({
    status: 'loading',
    token: null,
    message: null,
  })
  const [notice, setNotice] = useState<string | null>(null)

  const refreshCsrf = useCallback(async () => {
    setCsrf({ status: 'loading', token: null, message: null })
    try {
      const token = await getCsrfToken()
      setCsrf({ status: 'ready', token, message: null })
      return token
    } catch (error: unknown) {
      setCsrf({ status: 'error', token: null, message: csrfErrorMessage(error) })
      return null
    }
  }, [])

  useEffect(() => {
    return registerSessionExpiredHandler(() => {
      setAuth({ status: 'anonymous', user: null })
      setNotice('Your session expired. Please log in again.')
    })
  }, [])

  useEffect(() => {
    let active = true

    async function restoreSession() {
      const [csrfResult, profileResult] = await Promise.allSettled([
        getCsrfToken(),
        getCurrentUser(),
      ])
      if (!active) {
        return
      }

      let csrfToken: string | null = null
      if (csrfResult.status === 'fulfilled') {
        csrfToken = csrfResult.value
        setCsrf({ status: 'ready', token: csrfToken, message: null })
      } else {
        setCsrf({
          status: 'error',
          token: null,
          message: csrfErrorMessage(csrfResult.reason),
        })
      }

      if (profileResult.status === 'fulfilled') {
        setAuth({ status: 'authenticated', user: profileResult.value })
        return
      }

      setAuth({ status: 'anonymous', user: null })
      if (!isUnauthorized(profileResult.reason)) {
        setNotice('We could not restore your session. Please sign in again.')
      }

      if (csrfToken === null) {
        try {
          csrfToken = await getCsrfToken()
        } catch (error: unknown) {
          setCsrf({
            status: 'error',
            token: null,
            message: csrfErrorMessage(error),
          })
        }
      }

      let cleanupFailed = false
      if (csrfToken !== null) {
        try {
          await logoutRequest(csrfToken)
        } catch {
          cleanupFailed = true
        }
      } else {
        cleanupFailed = true
      }

      if (!active) {
        return
      }
      setCsrf({ status: 'loading', token: null, message: null })
      try {
        const freshToken = await getCsrfToken()
        if (active) {
          setCsrf({ status: 'ready', token: freshToken, message: null })
        }
      } catch (error: unknown) {
        if (active) {
          setCsrf({
            status: 'error',
            token: null,
            message: csrfErrorMessage(error),
          })
        }
      }

      if (active && cleanupFailed) {
        setNotice('The previous session could not be cleared. Please try again.')
      }
    }

    void restoreSession()
    return () => {
      active = false
    }
  }, [])

  const clearNotice = useCallback(() => setNotice(null), [])

  const signIn = useCallback(
    async (username: string, password: string) => {
      const csrfToken =
        csrf.status === 'ready' ? csrf.token : await refreshCsrf()
      if (csrfToken === null) {
        throw new Error('A secure request token is not available.')
      }
      setNotice(null)
      await loginRequest(username.trim(), password, csrfToken)

      try {
        const user = await getCurrentUser(true)
        setAuth({ status: 'authenticated', user })
        return user
      } catch (error: unknown) {
        setAuth({ status: 'anonymous', user: null })
        if (!isUnauthorized(error)) {
          setNotice('We could not restore your session. Please sign in again.')
        }

        try {
          await logoutRequest(csrfToken)
        } catch {
          setNotice('The previous session could not be cleared. Please try again.')
        }
        await refreshCsrf()

        if (isUnauthorized(error)) {
          throw new SessionExpiredError()
        }
        throw error
      }
    },
    [csrf, refreshCsrf],
  )

  const signUp = useCallback(
    async (values: SignupValues) => {
      const csrfToken =
        csrf.status === 'ready' ? csrf.token : await refreshCsrf()
      if (csrfToken === null) {
        throw new Error('A secure request token is not available.')
      }
      await signupRequest(values, csrfToken)
      try {
        return await signIn(values.username, values.password)
      } catch {
        throw new SignupLoginError()
      }
    },
    [csrf, refreshCsrf, signIn],
  )

  const signOut = useCallback(async () => {
    const csrfToken = csrf.status === 'ready' ? csrf.token : null
    setAuth({ status: 'anonymous', user: null })
    setNotice(null)
    setCsrf({ status: 'loading', token: null, message: null })

    let logoutFailed = false
    try {
      const token = csrfToken ?? (await getCsrfToken())
      await logoutRequest(token)
    } catch {
      logoutFailed = true
    }

    try {
      const freshToken = await getCsrfToken()
      setCsrf({ status: 'ready', token: freshToken, message: null })
    } catch (error: unknown) {
      const message = csrfErrorMessage(error)
      setCsrf({ status: 'error', token: null, message })
      setNotice(message)
      return
    }

    if (logoutFailed) {
      setNotice('We could not complete logout. Please try again.')
    }
  }, [csrf])

  const value = useMemo(
    () => ({
      auth,
      csrf,
      notice,
      clearNotice,
      refreshCsrf,
      signIn,
      signUp,
      signOut,
    }),
    [auth, clearNotice, csrf, notice, refreshCsrf, signIn, signOut, signUp],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

