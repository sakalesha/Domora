export function LoadingScreen() {
  return (
    <main className="auth-backdrop flex min-h-screen items-center justify-center px-4 text-ink">
      <div className="flex items-center gap-4 rounded-md border border-border bg-surface p-6 shadow-auth">
        <span aria-hidden="true" className="spinner !border-border !border-t-accent" />
        <p className="text-base text-body" role="status">
          Restoring your Domora session...
        </p>
      </div>
    </main>
  )
}
