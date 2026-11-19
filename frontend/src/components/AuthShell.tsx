import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DomoraMark } from './icons/Icons'

interface AuthShellProps {
  children: ReactNode
  maxWidth?: 'default' | 'wide'
}

export function AuthShell({ children, maxWidth = 'default' }: AuthShellProps) {
  const widthClass = maxWidth === 'wide' ? 'max-w-auth-wide' : 'max-w-auth'

  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-sm focus:border focus:border-border-strong focus:bg-surface focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-card focus:outline-none focus:ring-2 focus:ring-accent"
        href="#main-content"
      >
        Skip to main content
      </a>
      <div className="auth-backdrop flex min-h-screen flex-col px-4 text-ink sm:px-6">
        <header
          className={`mx-auto flex w-full ${widthClass} items-center justify-between py-6 sm:py-8`}
        >
          <Link
            aria-label="Domora home"
            className="inline-flex items-center gap-2.5 rounded-sm font-display text-xl font-bold tracking-tight text-ink no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            to="/"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-accent text-on-accent shadow-card">
              <DomoraMark className="h-4 w-4" />
            </span>
            <span>domora</span>
          </Link>
          <span className="hidden text-sm font-medium text-muted sm:block">
            Society services, booked together
          </span>
        </header>

        <main
          className={`mx-auto flex w-full ${widthClass} flex-1 items-center justify-center py-3`}
          id="main-content"
        >
          <div className="w-full rounded-lg border border-border bg-surface p-6 shadow-auth sm:p-8">
            {children}
          </div>
        </main>

        <footer
          className={`mx-auto w-full ${widthClass} py-6 text-center text-sm text-muted sm:py-8`}
        >
          Coordinated everyday services for residential societies.
        </footer>
      </div>
    </>
  )
}
