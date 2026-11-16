import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import {
  ApiError,
  NetworkError,
  SessionExpiredError,
} from '../auth/api'
import { useAuth } from '../auth/useAuth'
import { roleHomePath } from '../auth/roleRoutes'
import { AuthShell } from '../components/AuthShell'
import { CsrfStatus } from '../components/CsrfStatus'
import { FormField } from '../components/FormField'
import { PrimaryButton } from '../components/PrimaryButton'

interface LoginRouteState {
  username?: string
  notice?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readLoginRouteState(value: unknown): LoginRouteState {
  if (!isRecord(value)) {
    return {}
  }
  return {
    username: typeof value.username === 'string' ? value.username : undefined,
    notice: typeof value.notice === 'string' ? value.notice : undefined,
  }
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof SessionExpiredError) {
    return 'Your session expired. Please log in again.'
  }
  if (error instanceof NetworkError) {
    return error.message
  }
  if (error instanceof ApiError && error.status === 401) {
    return 'Incorrect username or password.'
  }
  return 'Something went wrong. Please try again.'
}

export function LoginPage() {
  const { csrf, notice, clearNotice, refreshCsrf, signIn } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = readLoginRouteState(location.state)
  const [username, setUsername] = useState(routeState.username ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(
    routeState.notice ?? null,
  )
  const visibleError = notice ?? formError

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setFormError(null)
    clearNotice()

    try {
      const user = await signIn(username, password)
      navigate(roleHomePath(user.role), { replace: true })
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 403) {
        setFormError('Your secure form expired. Refresh and submit again.')
        await refreshCsrf()
      } else {
        setFormError(loginErrorMessage(error))
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <div className="grid gap-7">
        <Link
          className="inline-flex items-center gap-2 self-start rounded-sm text-base font-medium text-muted transition-colors duration-base hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          to="/welcome"
        >
          <span aria-hidden="true">&larr;</span> Back to Welcome
        </Link>

        <header className="grid gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Welcome back
          </h1>
          <p className="text-base text-body">
            Sign in to manage services for your society.
          </p>
        </header>

        {visibleError ? (
          <p
            aria-live="polite"
            className="rounded-sm border border-error bg-canvas p-4 text-base text-error"
            role="alert"
          >
            {visibleError}
          </p>
        ) : null}

        <CsrfStatus />

        <form className="grid gap-6" onSubmit={handleSubmit}>
          <FormField
            autoComplete="username"
            id="username"
            label="Username"
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
          <FormField
            autoComplete="current-password"
            id="password"
            label="Password"
            onChange={(event) => setPassword(event.target.value)}
            required
            trailing={
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="min-h-control min-w-[3rem] rounded-sm px-3 text-base font-medium text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            }
            type={showPassword ? 'text' : 'password'}
            value={password}
          />
          <PrimaryButton
            disabled={csrf.status !== 'ready'}
            pending={pending}
            pendingLabel="Signing in..."
            type="submit"
          >
            Sign in
          </PrimaryButton>
        </form>

        <p className="text-center text-base text-body">
          New to Domora?{' '}
          <Link
            className="rounded-sm font-medium text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            to="/signup"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
