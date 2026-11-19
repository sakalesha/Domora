import { useAuth } from '../auth/useAuth'

export function CsrfStatus() {
  const { csrf, refreshCsrf } = useAuth()

  if (csrf.status === 'ready') {
    return null
  }

  if (csrf.status === 'loading') {
    return (
      <p className="flex items-center gap-3 text-sm font-medium text-body" role="status">
        <span
          aria-hidden="true"
          className="spinner !border-border !border-t-accent"
        />
        Preparing a secure form...
      </p>
    )
  }

  return (
    <div
      aria-live="polite"
      className="grid gap-3 rounded-sm border border-error/40 bg-red-50 p-4 text-sm font-medium text-error"
      role="alert"
    >
      <p>{csrf.message}</p>
      <button
        className="min-h-control justify-self-start rounded-sm border border-border-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors duration-base hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        onClick={() => void refreshCsrf()}
        type="button"
      >
        Try again
      </button>
    </div>
  )
}
