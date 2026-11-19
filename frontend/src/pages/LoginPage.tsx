import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import {
  ApiError,
  NetworkError,
  SessionExpiredError,
} from '../auth/api'
import { roleHomePath } from '../auth/roleRoutes'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { CsrfStatus } from '../components/CsrfStatus'
import { FormField } from '../components/FormField'
import { ArrowLeftIcon } from '../components/icons/Icons'
import { PrimaryButton } from '../components/PrimaryButton'
import { useDocumentTitle } from '../utils/format'

interface DemoAccount {
  roleLabel: string
  username: string
  password: string
}

const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    roleLabel: 'Ops Admin',
    username: 'ops.admin',
    password: 'domora-ops-2026',
  },
  {
    roleLabel: 'Resident',
    username: 'resident.ananya',
    password: 'domora-res-2026',
  },
  {
    roleLabel: 'Vendor',
    username: 'vendor.arjun',
    password: 'domora-vendor-2026',
  },
]

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
  useDocumentTitle('Sign in | Domora')

  const { csrf, notice, clearNotice, refreshCsrf, signIn } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = readLoginRouteState(location.state)
  const [username, setUsername] = useState(routeState.username ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [routeNotice, setRouteNotice] = useState<string | null>(
    routeState.notice ?? null,
  )

  const visibleError = notice ?? formError

  function fillDemoAccount(account: DemoAccount) {
    setUsername(account.username)
    setPassword(account.password)
    setFormError(null)
    clearNotice()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setFormError(null)
    setRouteNotice(null)
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
      <div className="grid gap-6">
        <Link
          className="inline-flex items-center gap-2 self-start rounded-sm text-sm font-medium text-muted transition-colors duration-base hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          to="/welcome"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back to Welcome</span>
        </Link>

        <header className="grid gap-1.5">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Welcome back
          </h1>
          <p className="text-sm text-body">
            Sign in to manage service camps for your society.
          </p>
        </header>

        {routeNotice && !visibleError ? (
          <p
            aria-live="polite"
            className="rounded-sm border border-teal-200 bg-accent-soft px-4 py-3 text-sm font-medium text-accent-pressed"
            role="status"
          >
            {routeNotice}
          </p>
        ) : null}

        {visibleError ? (
          <p
            aria-live="polite"
            className="rounded-sm border border-error/40 bg-red-50 px-4 py-3 text-sm font-medium text-error"
            role="alert"
          >
            {visibleError}
          </p>
        ) : null}

        <CsrfStatus />

        <form className="grid gap-5" onSubmit={handleSubmit}>
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
                className="min-h-control min-w-[3.5rem] rounded-sm px-3 text-sm font-semibold text-accent transition-colors hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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

        <section
          aria-labelledby="demo-credentials-heading"
          className="grid gap-2.5 rounded-sm border border-border bg-surface-subtle p-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <h2
              className="text-xs font-semibold uppercase tracking-wider text-muted"
              id="demo-credentials-heading"
            >
              Demo credentials (testing)
            </h2>
            <span className="text-xs text-muted">One-click fill</span>
          </div>
          <ul className="grid gap-2">
            {DEMO_ACCOUNTS.map((account) => {
              const isSelected =
                username === account.username && password === account.password
              return (
                <li
                  className="flex items-center justify-between gap-3 rounded-sm border border-border bg-surface px-3 py-2"
                  key={account.username}
                >
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-xs font-semibold text-ink">
                      {account.roleLabel}
                    </span>
                    <span className="break-words font-mono text-xs text-body">
                      {account.username} / {account.password}
                    </span>
                  </div>
                  <button
                    aria-label={`Fill ${account.roleLabel} demo credentials`}
                    className={`min-h-[2rem] shrink-0 rounded-sm border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                      isSelected
                        ? 'border-accent bg-accent-soft text-accent-pressed'
                        : 'border-border-strong bg-surface text-ink hover:border-accent hover:text-accent'
                    }`}
                    onClick={() => fillDemoAccount(account)}
                    type="button"
                  >
                    {isSelected ? 'Filled' : 'Fill'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <p className="border-t border-border pt-5 text-center text-sm text-body">
          New to Domora?{' '}
          <Link
            className="rounded-sm font-semibold text-accent underline underline-offset-4 hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            to="/signup"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
