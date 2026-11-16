import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pending?: boolean
  pendingLabel?: string
  children: ReactNode
}

export function PrimaryButton({
  pending = false,
  pendingLabel = 'Please wait...',
  children,
  disabled,
  ...buttonProps
}: PrimaryButtonProps) {
  return (
    <button
      {...buttonProps}
      className="flex min-h-control w-full items-center justify-center gap-3 rounded-sm bg-accent px-5 text-base font-medium text-on-accent transition-colors duration-base ease-standard hover:bg-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled || pending}
    >
      {pending ? (
        <span aria-hidden="true" className="spinner" />
      ) : null}
      {pending ? pendingLabel : children}
    </button>
  )
}
