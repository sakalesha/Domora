import { Link } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell'

export function WelcomePage() {
  return (
    <AuthShell>
      <div className="grid gap-7 text-center">
        <header className="grid gap-3">
          <p className="text-base font-medium text-accent">Welcome to Domora</p>
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Book home services together with your neighbours
          </h1>
          <p className="text-base text-body">
            Coordinate everyday services in your residential society to unlock volume discounts.
          </p>
        </header>

        <div className="grid gap-4 pt-2">
          <Link
            className="flex min-h-control w-full items-center justify-center rounded-sm bg-accent px-5 text-base font-medium text-on-accent transition-colors duration-base ease-standard hover:bg-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            to="/signup"
          >
            Create resident account
          </Link>
          <Link
            className="flex min-h-control w-full items-center justify-center rounded-sm border border-border bg-surface px-5 text-base font-medium text-ink transition-colors duration-base ease-standard hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            to="/login"
          >
            Sign in
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
