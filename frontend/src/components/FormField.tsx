import type { InputHTMLAttributes, ReactNode } from 'react'

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string
  label: string
  error?: string
  hint?: string
  trailing?: ReactNode
}

export function FormField({
  id,
  label,
  error,
  hint,
  trailing,
  required,
  ...inputProps
}: FormFieldProps) {
  const describedBy = [
    hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ]
    .filter((value): value is string => value !== null)
    .join(' ')

  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-semibold text-ink" htmlFor={id}>
        {label}
      </label>
      <div
        className={`flex min-h-control items-center rounded-sm border bg-surface transition-colors duration-base ease-standard focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 ${
          error ? 'border-error' : 'border-border-strong'
        }`}
      >
        <input
          {...inputProps}
          id={id}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className="h-control min-w-0 flex-1 rounded-sm border-0 bg-transparent px-3.5 text-base text-ink outline-none placeholder:text-muted/80"
        />
        {trailing}
      </div>
      {hint ? (
        <p className="text-xs text-muted" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
