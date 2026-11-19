import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pending?: boolean
  pendingLabel?: string
  variant?: 'primary' | 'secondary'
  children: ReactNode
}

export function PrimaryButton({
  pending = false,
  pendingLabel = 'Please wait...',
  variant = 'primary',
  children,
  disabled,
  className = '',
  ...buttonProps
}: PrimaryButtonProps) {
  const variantClasses =
    variant === 'secondary'
      ? 'border border-border-strong bg-surface text-ink hover:bg-surface-subtle'
      : 'bg-accent text-on-accent shadow-card hover:bg-accent-pressed'

  return (
    <button
      {...buttonProps}
      className={`flex min-h-control w-full items-center justify-center gap-2.5 rounded-sm px-5 text-base font-semibold transition-colors duration-base ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses} ${className}`}
      disabled={disabled || pending}
    >
      {pending ? <span aria-hidden="true" className="spinner" /> : null}
      {pending ? pendingLabel : children}
    </button>
  )
}
