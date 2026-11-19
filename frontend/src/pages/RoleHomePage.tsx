import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { BuildingIcon, UsersIcon } from '../components/icons/Icons'
import { PrimaryButton } from '../components/PrimaryButton'
import { useDocumentTitle } from '../utils/format'

const roleLabels = {
  resident: 'Resident',
  vendor: 'Partner Vendor',
  ops: 'Society Operations',
} as const

export function RoleHomePage() {
  const { auth, signOut } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const roleTitle =
    auth.status === 'authenticated'
      ? `${roleLabels[auth.user.role]} | Domora`
      : 'Account | Domora'
  useDocumentTitle(roleTitle)

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
      <div className="grid gap-6">
        <header className="grid gap-1.5">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
            {roleLabels[user.role]}
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Hi, {user.full_name}
          </h1>
          <p className="text-sm text-body">
            Your account is active and verified for Domora society services.
          </p>
        </header>

        <dl className="grid gap-3 rounded-md border border-border bg-canvas p-4 text-sm">
          <div className="flex items-start gap-3">
            <BuildingIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted">
                {user.society ? 'Residential Society' : 'Workspace'}
              </dt>
              <dd className="font-semibold text-ink">
                {user.society
                  ? `${user.society.name} (${user.society.city})`
                  : user.role === 'vendor'
                    ? 'Domora Partner Network'
                    : 'Platform Operations'}
              </dd>
            </div>
          </div>

          {user.unit_label ? (
            <div className="flex items-start gap-3 border-t border-border pt-3">
              <UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted">Flat or Unit</dt>
                <dd className="font-mono font-semibold text-ink">{user.unit_label}</dd>
              </div>
            </div>
          ) : null}
        </dl>

        <PrimaryButton
          onClick={() => void handleLogout()}
          pending={loggingOut}
          pendingLabel="Logging out..."
          type="button"
          variant="secondary"
        >
          Log out
        </PrimaryButton>
      </div>
    </AuthShell>
  )
}
