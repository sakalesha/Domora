import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'

const roleLabels = {
  resident: 'Resident',
  vendor: 'Vendor',
  ops: 'Society operations',
} as const

export function RoleHomePage() {
  const { auth, signOut } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  if (auth.status !== 'authenticated') {
    return null
  }

  const { user } = auth

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await signOut()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <AuthShell>
      <div className="grid gap-7">
        <header className="grid gap-2">
          <p className="text-base font-medium text-accent">
            {roleLabels[user.role]}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Hi, {user.full_name}
          </h1>
          {user.society ? (
            <p className="text-base text-body">
              {user.society.name} ({user.society.city})
            </p>
          ) : (
            <p className="text-base text-body">
              {user.role === 'vendor'
                ? 'Domora Partner Network'
                : 'Platform Operations'}
            </p>
          )}
          {user.unit_label ? (
            <p className="text-base text-muted">Unit: {user.unit_label}</p>
          ) : null}
        </header>
        <button
          className="min-h-control w-full rounded-sm border border-border bg-surface px-5 text-base font-medium text-ink transition-colors duration-base ease-standard hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loggingOut}
          onClick={() => void handleLogout()}
          type="button"
        >
          {loggingOut ? 'Logging out...' : 'Log out'}
        </button>
      </div>
    </AuthShell>
  )
}

