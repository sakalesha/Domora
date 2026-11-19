import { Link } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell'
import { useDocumentTitle } from '../utils/format'

const steps = [
  {
    number: '01',
    title: 'Join a scheduled camp',
    detail: 'Pick an upcoming home-service window organised for your residential society.',
  },
  {
    number: '02',
    title: 'Unlock group pricing',
    detail: 'As more neighbours book, everyone moves together to lower per-home rates.',
  },
  {
    number: '03',
    title: 'Confirmed doorstep slots',
    detail: 'Once the minimum homes join, a verified partner completes visits in slot order.',
  },
] as const

export function WelcomePage() {
  useDocumentTitle('Welcome | Domora')

  return (
    <AuthShell>
      <div className="grid gap-6">
        <header className="grid gap-2.5">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
            Resident Community Portal
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Book home services together with your neighbours
          </h1>
          <p className="text-sm leading-relaxed text-body">
            Coordinate AC servicing, deep cleaning, and maintenance camps inside your apartment
            society to unlock shared volume rates.
          </p>
        </header>

        <ol className="grid gap-3 border-y border-border py-4">
          {steps.map((step) => (
            <li key={step.number} className="flex items-start gap-3">
              <span className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-accent">
                {step.number}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{step.title}</p>
                <p className="text-xs leading-relaxed text-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="grid gap-3">
          <Link
            className="flex min-h-control w-full items-center justify-center rounded-sm bg-accent px-5 text-base font-semibold text-on-accent shadow-card transition-colors duration-base ease-standard hover:bg-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            to="/signup"
          >
            Create resident account
          </Link>
          <Link
            className="flex min-h-control w-full items-center justify-center rounded-sm border border-border-strong bg-surface px-5 text-base font-semibold text-ink transition-colors duration-base ease-standard hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            to="/login"
          >
            Sign in
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
