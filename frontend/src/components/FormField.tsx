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
    <div className="grid gap-2">
      <label className="text-base font-medium text-ink" htmlFor={id}>
        {label}
      </label>
      <div
        className={`flex min-h-control items-center rounded-sm border bg-surface transition-colors duration-base ease-standard focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-canvas ${
          error ? 'border-error' : 'border-border'
        }`}
      >
        <input
          {...inputProps}
          id={id}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className="h-control min-w-0 flex-1 rounded-sm border-0 bg-transparent px-4 text-base text-ink outline-none placeholder:text-muted"
        />
        {trailing}
      </div>
      {hint ? (
        <p className="text-base text-muted" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-base text-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
