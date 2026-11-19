export function LoadingScreen() {
  return (
    <main className="auth-backdrop flex min-h-screen items-center justify-center px-4 text-ink">
      <div className="flex items-center gap-3.5 rounded-lg border border-border bg-surface px-6 py-5 shadow-auth">
        <span
          aria-hidden="true"
          className="spinner !border-border !border-t-accent"
        />
        <p className="text-sm font-medium text-body" role="status">
          Restoring your Domora session...
        </p>
      </div>
    </main>
  )
}
