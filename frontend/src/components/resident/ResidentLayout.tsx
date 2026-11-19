import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useDocumentTitle } from '../../utils/format'
import { ChevronRightIcon, DomoraMark, LogOutIcon } from '../icons/Icons'

export interface ResidentBreadcrumb {
  label: string
  to?: string
}

interface ResidentLayoutProps {
  children: ReactNode
  documentTitle: string
  breadcrumbs?: ResidentBreadcrumb[]
  hasStickyBottomBar?: boolean
}

export function ResidentLayout({
  children,
  documentTitle,
  breadcrumbs,
  hasStickyBottomBar = false,
}: ResidentLayoutProps) {
  const { auth, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  useDocumentTitle(documentTitle)

  const user = auth.status === 'authenticated' ? auth.user : null

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink antialiased">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent"
        href="#resident-main-content"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 h-14 border-b border-border bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            aria-label="Domora community camps"
            className="group inline-flex min-h-[44px] shrink-0 items-center gap-2.5 whitespace-nowrap rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            to="/resident"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-accent text-on-accent shadow-card transition-colors duration-base group-hover:bg-accent-pressed">
              <DomoraMark className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-ink">
              domora
            </span>
          </Link>

          <nav
            aria-label="Resident navigation"
            className="hidden items-center gap-6 md:flex"
          >
            <Link
              className="whitespace-nowrap text-sm font-medium text-ink underline-offset-4 transition-colors hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
              to="/resident"
            >
              Community Camps
            </Link>
          </nav>

          <div className="flex min-w-0 items-center gap-3 shrink-0">
            {user ? (
              <div className="hidden min-w-0 text-right sm:block">
                <p className="max-w-[12rem] truncate text-sm font-semibold leading-tight text-ink">
                  {user.full_name}
                </p>
                {user.society ? (
                  <p className="max-w-[12rem] truncate text-xs text-muted">
                    {user.society.name}
                  </p>
                ) : null}
              </div>
            ) : null}

            <button
              aria-label="Sign out"
              className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-sm border border-border bg-surface px-3 py-2 text-sm font-semibold text-body transition-colors duration-base hover:border-border-strong hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              type="button"
            >
              <LogOutIcon className="h-4 w-4 shrink-0" />
              <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
            </button>
          </div>
        </div>
      </header>

      <main
        className={`flex-1 px-4 py-6 sm:px-6 lg:px-8 ${
          hasStickyBottomBar ? 'pb-28 lg:pb-12' : 'pb-12'
        }`}
        id="resident-main-content"
      >
        <div className="mx-auto max-w-6xl">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <nav
              aria-label="Breadcrumb"
              className="mb-5 flex items-center gap-1.5 text-sm text-muted"
            >
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1
                return (
                  <div
                    className="flex min-w-0 items-center gap-1.5"
                    key={`${crumb.label}-${idx}`}
                  >
                    {idx > 0 ? (
                      <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-border-strong" />
                    ) : null}
                    {crumb.to && !isLast ? (
                      <Link
                        className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded-sm font-medium text-muted transition-colors hover:text-ink hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        to={crumb.to}
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        aria-current={isLast ? 'page' : undefined}
                        className="truncate font-semibold text-ink"
                      >
                        {crumb.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </nav>
          ) : null}

          {children}
        </div>
      </main>
    </div>
  )
}
