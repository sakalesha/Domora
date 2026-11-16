import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AuthShellProps {
  children: ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-4 focus:py-3 focus:text-ink focus:ring-2 focus:ring-accent"
        href="#main-content"
      >
        Skip to main content
      </a>
      <div className="auth-backdrop flex min-h-screen flex-col px-4 text-ink sm:px-6">
        <header className="mx-auto flex w-full max-w-auth items-center justify-between py-6 sm:py-8">
          <Link
            aria-label="Domora home"
            className="text-2xl font-bold tracking-tight text-ink no-underline"
            to="/"
          >
            domora
          </Link>
          <span className="hidden text-base text-body sm:block">
            Home services, together
          </span>
        </header>
        <main
          className="mx-auto flex w-full max-w-auth flex-1 items-center justify-center py-4"
          id="main-content"
        >
          <div className="w-full rounded-md border border-border bg-surface p-6 shadow-auth sm:p-8">
            {children}
          </div>
        </main>
        <footer className="mx-auto w-full max-w-auth py-6 text-center text-base text-body sm:py-8">
          A simpler way to coordinate everyday services in your society.
        </footer>
      </div>
    </>
  )
}
