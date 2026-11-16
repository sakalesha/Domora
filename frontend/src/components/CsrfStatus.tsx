import { useAuth } from '../auth/useAuth'

export function CsrfStatus() {
  const { csrf, refreshCsrf } = useAuth()

  if (csrf.status === 'ready') {
    return null
  }

  if (csrf.status === 'loading') {
    return (
      <p className="flex items-center gap-3 text-base text-body" role="status">
        <span aria-hidden="true" className="spinner !border-border !border-t-accent" />
        Preparing a secure form...
      </p>
    )
  }

  return (
    <div
      aria-live="polite"
      className="grid gap-3 rounded-sm border border-error bg-canvas p-4 text-base text-error"
      role="alert"
    >
      <p>{csrf.message}</p>
      <button
        className="min-h-control justify-self-start rounded-sm border border-border bg-surface px-4 text-base font-medium text-ink transition-colors duration-base hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        onClick={() => void refreshCsrf()}
        type="button"
      >
        Try again
      </button>
    </div>
  )
}
