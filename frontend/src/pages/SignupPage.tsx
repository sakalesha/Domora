import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  ApiError,
  NetworkError,
  SignupLoginError,
} from '../auth/api'
import { roleHomePath } from '../auth/roleRoutes'
import type { SignupValues } from '../auth/types'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { CsrfStatus } from '../components/CsrfStatus'
import { FormField } from '../components/FormField'
import { ArrowLeftIcon } from '../components/icons/Icons'
import { PrimaryButton } from '../components/PrimaryButton'
import { useDocumentTitle } from '../utils/format'

type SignupFieldName = keyof SignupValues
type SignupErrors = Partial<Record<SignupFieldName, string>>

const signupLimits: Record<SignupFieldName, number> = {
  full_name: 150,
  username: 80,
  password: 128,
  phone: 30,
  unit_label: 50,
  invite_code: 50,
}

const signupFieldNames = new Set<SignupFieldName>([
  'full_name',
  'username',
  'password',
  'phone',
  'unit_label',
  'invite_code',
])

const emptyValues: SignupValues = {
  full_name: '',
  username: '',
  password: '',
  phone: '',
  unit_label: '',
  invite_code: '',
}

function normalizeSignupValues(values: SignupValues): SignupValues {
  return {
    full_name: values.full_name.trim(),
    username: values.username.trim(),
    password: values.password,
    phone: values.phone.trim(),
    unit_label: values.unit_label.trim(),
    invite_code: values.invite_code.trim(),
  }
}

function validateSignup(values: SignupValues): SignupErrors {
  const errors: SignupErrors = {}
  const requiredFields: SignupFieldName[] = [
    'full_name',
    'username',
    'password',
    'phone',
    'unit_label',
    'invite_code',
  ]

  for (const field of requiredFields) {
    const value = values[field]
    if (value.length === 0) {
      errors[field] = 'This field is required.'
    } else if (value.length > signupLimits[field]) {
      errors[field] = `Use ${signupLimits[field]} characters or fewer.`
    }
  }

  if (values.password.length > 0 && values.password.length < 8) {
    errors.password = 'At least 8 characters.'
  }
  return errors
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function validationErrors(error: ApiError): SignupErrors {
  if (!Array.isArray(error.detail)) {
    return {}
  }

  const errors: SignupErrors = {}
  for (const issue of error.detail) {
    if (!isRecord(issue) || !Array.isArray(issue.loc)) {
      continue
    }
    const field = issue.loc[issue.loc.length - 1]
    if (typeof field !== 'string' || !signupFieldNames.has(field as SignupFieldName)) {
      continue
    }

    const signupField = field as SignupFieldName
    const type = typeof issue.type === 'string' ? issue.type : ''
    if (type === 'missing') {
      errors[signupField] = 'This field is required.'
    } else if (type === 'string_too_short' && signupField === 'password') {
      errors.password = 'At least 8 characters.'
    } else if (type === 'string_too_long') {
      errors[signupField] =
        `Use ${signupLimits[signupField]} characters or fewer.`
    } else {
      errors[signupField] = 'Check this field and try again.'
    }
  }
  return errors
}

export function SignupPage() {
  useDocumentTitle('Create resident account | Domora')

  const { csrf, refreshCsrf, signUp } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState<SignupValues>(emptyValues)
  const [errors, setErrors] = useState<SignupErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)

  function updateField(field: SignupFieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedValues = normalizeSignupValues(values)
    const clientErrors = validateSignup(normalizedValues)
    setErrors(clientErrors)
    setFormError(null)

    if (Object.keys(clientErrors).length > 0) {
      return
    }

    setPending(true)
    try {
      const user = await signUp(normalizedValues)
      navigate(roleHomePath(user.role), { replace: true })
    } catch (error: unknown) {
      if (error instanceof SignupLoginError) {
        navigate('/login', {
          replace: true,
          state: {
            username: normalizedValues.username,
            notice: 'Account created, please log in.',
          },
        })
      } else if (error instanceof ApiError && error.status === 403) {
        setFormError('Your secure form expired. Refresh and submit again.')
        await refreshCsrf()
      } else if (error instanceof ApiError && error.status === 409) {
        setErrors((current) => ({
          ...current,
          username: 'That username is already taken.',
        }))
        setFormError('That username or phone number is already in use.')
      } else if (
        error instanceof ApiError &&
        error.status === 422 &&
        error.detail === 'Invalid invite code'
      ) {
        setErrors((current) => ({
          ...current,
          invite_code:
            "That invite code isn't valid. Check with your society committee.",
        }))
      } else if (error instanceof ApiError && error.status === 422) {
        const serverErrors = validationErrors(error)
        if (Object.keys(serverErrors).length > 0) {
          setErrors(serverErrors)
        } else {
          setFormError('Something went wrong. Please try again.')
        }
      } else if (error instanceof NetworkError) {
        setFormError(error.message)
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell maxWidth="wide">
      <div className="grid gap-6">
        <Link
          className="inline-flex items-center gap-2 self-start rounded-sm text-sm font-medium text-muted transition-colors duration-base hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          to="/login"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back to sign in</span>
        </Link>

        <header className="grid gap-1.5">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Join your society
          </h1>
          <p className="text-sm text-body">
            Create a resident account to join home-service camps in your apartment community.
          </p>
        </header>

        {formError ? (
          <p
            aria-live="polite"
            className="rounded-sm border border-error/40 bg-red-50 px-4 py-3 text-sm font-medium text-error"
            role="alert"
          >
            {formError}
          </p>
        ) : null}

        <CsrfStatus />

        <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
          <FormField
            autoComplete="name"
            error={errors.full_name}
            id="full_name"
            label="Full name"
            onChange={(event) => updateField('full_name', event.target.value)}
            required
            value={values.full_name}
          />
          <FormField
            autoComplete="username"
            error={errors.username}
            hint="Letters, numbers and underscores"
            id="username"
            label="Username"
            onChange={(event) => updateField('username', event.target.value)}
            required
            value={values.username}
          />
          <FormField
            autoComplete="new-password"
            error={errors.password}
            hint="At least 8 characters."
            id="password"
            label="Password"
            onChange={(event) => updateField('password', event.target.value)}
            required
            trailing={
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="min-h-control min-w-[3.5rem] rounded-sm px-3 text-sm font-semibold text-accent transition-colors hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            }
            type={showPassword ? 'text' : 'password'}
            value={values.password}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              autoComplete="tel"
              error={errors.phone}
              id="phone"
              label="Phone number"
              onChange={(event) => updateField('phone', event.target.value)}
              required
              type="tel"
              value={values.phone}
            />
            <FormField
              autoComplete="address-line2"
              error={errors.unit_label}
              id="unit_label"
              label="Flat or unit"
              onChange={(event) => updateField('unit_label', event.target.value)}
              required
              value={values.unit_label}
            />
          </div>
          <FormField
            autoComplete="off"
            error={errors.invite_code}
            hint="Ask your society committee or a neighbour for this code."
            id="invite_code"
            label="Society invite code"
            onChange={(event) =>
              updateField('invite_code', event.target.value.toUpperCase())
            }
            required
            value={values.invite_code}
          />
          <div className="pt-1">
            <PrimaryButton
              disabled={csrf.status !== 'ready'}
              pending={pending}
              pendingLabel="Creating your account..."
              type="submit"
            >
              Create account
            </PrimaryButton>
          </div>
        </form>

        <p className="border-t border-border pt-5 text-center text-sm text-body">
          Already have an account?{' '}
          <Link
            className="rounded-sm font-semibold text-accent underline underline-offset-4 hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            to="/login"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
