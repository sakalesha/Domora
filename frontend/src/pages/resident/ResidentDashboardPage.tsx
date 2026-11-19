import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  listResidentCamps,
  type ResidentCampListItem,
  type ResidentCampStatus,
} from '../../api/resident'
import { ApiError, NetworkError } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  InfoIcon,
  TagIcon,
} from '../../components/icons/Icons'
import { CampStatusBadge } from '../../components/ops/CampStatusBadge'
import { ResidentLayout } from '../../components/resident/ResidentLayout'
import { SteppedProgressBar } from '../../components/resident/SteppedProgressBar'
import { formatDateOnly } from '../../utils/format'
import {
  formatBookingStatusLabel,
  formatDeadlineStatus,
  formatRupeeAmount,
  formatSpotsRemaining,
  formatWindowDuration,
  PROVISIONAL_PRICE_DISCLAIMER,
} from '../../utils/residentCamp'

type StatusFilter = 'all' | ResidentCampStatus

const STATUS_TABS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All camps' },
  { value: 'open', label: 'Open' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

function isValidStatusFilter(value: string | null): value is StatusFilter {
  return STATUS_TABS.some((tab) => tab.value === value)
}

function errorMessageForLoad(error: unknown): string {
  if (error instanceof NetworkError) {
    return error.message
  }
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'You do not have permission to view these society camps.'
    }
    if (error.status === 404) {
      return 'Resident camp discovery endpoint is not reachable right now.'
    }
  }
  return 'Could not load your society camps. Please try again.'
}

export function ResidentDashboardPage() {
  const { auth } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawStatus = searchParams.get('status')
  const statusFilter: StatusFilter = isValidStatusFilter(rawStatus)
    ? rawStatus
    : 'all'

  const [camps, setCamps] = useState<ResidentCampListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const user = auth.status === 'authenticated' ? auth.user : null
  const societyName =
    camps[0]?.society.name ?? user?.society?.name ?? 'Your society'
  const societyCity = camps[0]?.society.city ?? user?.society?.city ?? null

  useEffect(() => {
    let active = true

    async function fetchCamps() {
      try {
        const data = await listResidentCamps(
          statusFilter === 'all' ? undefined : statusFilter,
        )
        if (!active) return
        setCamps(data)
        setError(null)
      } catch (err: unknown) {
        if (!active) return
        setError(errorMessageForLoad(err))
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void fetchCamps()

    return () => {
      active = false
    }
  }, [statusFilter, reloadNonce])

  function handleRetry() {
    setLoading(true)
    setError(null)
    setReloadNonce((count) => count + 1)
  }

  function handleStatusChange(next: StatusFilter) {
    if (next === statusFilter) return
    setLoading(true)
    setError(null)
    const params = new URLSearchParams(searchParams)
    if (next === 'all') {
      params.delete('status')
    } else {
      params.set('status', next)
    }
    setSearchParams(params, { replace: true })
  }

  const joinedCount = useMemo(
    () => camps.filter((camp) => Boolean(camp.user_booking)).length,
    [camps],
  )

  const openCount = useMemo(
    () => camps.filter((camp) => camp.status === 'open').length,
    [camps],
  )

  return (
    <ResidentLayout documentTitle={`${societyName} Community Camps | Domora`}>
      <div className="grid gap-6">
        {/* Society Hero Header */}
        <section className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1.5">
            <p className="text-xs font-semibold text-accent">
              {societyCity ? `${societyCity} · Resident portal` : 'Resident portal'}
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {societyName} community camps
            </h1>
            <p className="max-w-2xl text-sm text-body">
              Join scheduled home-service camps with neighbours in your society to unlock lower group rates together.
            </p>
          </div>

          {!loading && !error ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted tabular-nums">
              <span>
                <strong className="font-semibold text-ink">{openCount}</strong> open
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="font-semibold text-ink">{joinedCount}</strong> joined
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="font-semibold text-ink">{camps.length}</strong>{' '}
                {camps.length === 1 ? 'camp shown' : 'camps shown'}
              </span>
            </div>
          ) : null}
        </section>

        {/* Decision P1: Provisional Pricing Notice */}
        <section
          aria-label="Provisional group pricing notice"
          className="flex items-start gap-3 rounded-md border border-teal-200 bg-accent-soft/60 px-4 py-3.5 text-sm text-ink"
        >
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="leading-relaxed text-body">
            <span className="font-semibold text-ink">How group pricing works: </span>
            {PROVISIONAL_PRICE_DISCLAIMER}
          </p>
        </section>

        {/* Interactive Status Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            aria-label="Filter camps by status"
            className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface p-1"
            role="tablist"
          >
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.value
              return (
                <button
                  aria-selected={active}
                  className={`min-h-[40px] whitespace-nowrap rounded-sm px-3.5 py-2 text-sm font-semibold transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                    active
                      ? 'bg-accent text-on-accent shadow-card'
                      : 'text-body hover:bg-surface-subtle hover:text-ink'
                  }`}
                  key={tab.value}
                  onClick={() => handleStatusChange(tab.value)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div
            aria-label="Loading community camps"
            className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
            role="status"
          >
            {[0, 1, 2].map((item) => (
              <div
                className="grid gap-4 rounded-md border border-border bg-surface p-5 shadow-card"
                key={item}
              >
                <div className="h-4 w-28 animate-pulse rounded bg-surface-subtle" />
                <div className="h-6 w-3/4 animate-pulse rounded bg-surface-subtle" />
                <div className="h-12 w-full animate-pulse rounded bg-surface-subtle" />
                <div className="h-2.5 w-full animate-pulse rounded-full bg-surface-subtle" />
                <div className="h-10 w-full animate-pulse rounded bg-surface-subtle" />
              </div>
            ))}
          </div>
        ) : null}

        {/* Error State */}
        {!loading && error ? (
          <div
            className="flex flex-col items-start justify-between gap-4 rounded-md border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-error" />
              <div className="grid gap-1">
                <h2 className="font-display text-base font-bold text-ink">
                  Unable to load community camps
                </h2>
                <p className="text-sm text-body">{error}</p>
              </div>
            </div>
            <button
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-sm border border-red-300 bg-surface px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-red-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={handleRetry}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : null}

        {/* Empty State */}
        {!loading && !error && camps.length === 0 ? (
          <section className="grid justify-items-center gap-3 rounded-md border border-border bg-surface px-6 py-12 text-center shadow-card">
            <h2 className="font-display text-lg font-bold text-ink">
              {statusFilter === 'all'
                ? `No service camps scheduled for ${societyName} yet`
                : `No ${statusFilter.replace('_', ' ')} camps right now`}
            </h2>
            <p className="max-w-md text-sm text-body">
              {statusFilter === 'all'
                ? 'When your society schedules an upcoming AC servicing or pest control camp, it will appear here.'
                : 'Try switching back to all camps to see every scheduled drive in your society.'}
            </p>
            {statusFilter !== 'all' ? (
              <button
                className="mt-1 inline-flex min-h-[44px] items-center justify-center rounded-sm border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => handleStatusChange('all')}
                type="button"
              >
                Show all camps
              </button>
            ) : null}
          </section>
        ) : null}

        {/* Camp Card Grid */}
        {!loading && !error && camps.length > 0 ? (
          <section
            aria-label="Society service camps"
            className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
          >
            {camps.map((camp) => {
              const deadline = formatDeadlineStatus(camp.join_deadline)
              const currentPriceText = formatRupeeAmount(
                camp.current_price_rupees,
                camp.current_price_paise,
              )
              const basePriceText = formatRupeeAmount(
                camp.base_price_rupees,
                camp.base_price_paise,
              )
              const hasDiscount =
                camp.discount_pct > 0 &&
                camp.current_price_paise < camp.base_price_paise

              const bookingPriceText = camp.user_booking
                ? formatRupeeAmount(
                    camp.user_booking.final_price_rupees ??
                      camp.user_booking.quoted_price_rupees,
                    camp.user_booking.final_price_paise ??
                      camp.user_booking.quoted_price_paise,
                  )
                : null

              return (
                <article
                  className="group flex flex-col justify-between rounded-md border border-border bg-surface p-5 shadow-card transition-colors duration-base hover:border-border-strong"
                  key={camp.id}
                >
                  <div className="grid gap-4">
                    {/* Top Metadata Line + Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted">
                        <span className="truncate font-semibold text-accent-pressed">
                          {camp.service.name}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="whitespace-nowrap tabular-nums">
                          {camp.slot_minutes} min slot
                        </span>
                      </div>
                      <CampStatusBadge status={camp.status} />
                    </div>

                    {/* Title & Schedule */}
                    <div className="grid gap-2">
                      <h2 className="font-display text-lg font-bold leading-snug tracking-tight text-ink">
                        <Link
                          className="rounded-sm transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          to={`/resident/camps/${camp.id}`}
                        >
                          {camp.title}
                        </Link>
                      </h2>

                      <div className="grid gap-1 text-xs text-body">
                        <p className="inline-flex items-center gap-2">
                          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
                          <span>{formatDateOnly(camp.starts_at)}</span>
                        </p>
                        <p className="inline-flex items-center gap-2 tabular-nums">
                          <ClockIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
                          <span>
                            {formatWindowDuration(camp.starts_at, camp.ends_at)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* User Booking Badge */}
                    {camp.user_booking && bookingPriceText ? (
                      <div className="inline-flex items-center gap-2 self-start rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
                        <CheckIcon className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                        <span className="tabular-nums">
                          {formatBookingStatusLabel(camp.user_booking.status)} ·{' '}
                          {bookingPriceText}
                        </span>
                      </div>
                    ) : null}

                    {/* Price & Discount Block */}
                    <div className="rounded-sm border border-border bg-canvas px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono text-2xl font-bold tracking-tight tabular-nums text-ink">
                            {currentPriceText}
                          </span>
                          {hasDiscount ? (
                            <span className="font-mono text-sm tabular-nums text-muted line-through">
                              {basePriceText}
                            </span>
                          ) : null}
                        </div>

                        {camp.discount_pct > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-sm border border-teal-200 bg-accent-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-accent-pressed">
                            <TagIcon className="h-3 w-3 shrink-0" />
                            <span>{camp.discount_pct}% off</span>
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-muted">
                            Base rate
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-muted">
                        {camp.is_confirmed_or_higher
                          ? 'Final group price locked'
                          : 'Provisional price · locks on confirmation'}
                      </p>
                    </div>

                    {/* Live Stepped Progress Bar */}
                    <SteppedProgressBar
                      compact
                      maxParticipants={camp.max_participants}
                      minParticipants={camp.min_participants}
                      nextTier={camp.next_tier}
                      participantsCount={camp.participants_count}
                    />

                    {/* Motivation Microcopy */}
                    {camp.next_tier && !camp.is_confirmed_or_higher ? (
                      <p className="rounded-sm border border-teal-200/80 bg-accent-soft/50 px-3 py-2 text-xs font-medium leading-relaxed text-accent-pressed">
                        {camp.next_tier.more_needed} more{' '}
                        {camp.next_tier.more_needed === 1
                          ? 'neighbour'
                          : 'neighbours'}{' '}
                        needed for{' '}
                        <span className="font-mono font-semibold tabular-nums">
                          {formatRupeeAmount(
                            camp.next_tier.target_price_rupees,
                            camp.next_tier.target_price_paise,
                          )}
                        </span>{' '}
                        ({camp.next_tier.discount_pct}% off)
                      </p>
                    ) : null}
                  </div>

                  {/* Card Footer: Spots Left, Join Deadline & View Details */}
                  <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span
                        className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-semibold tabular-nums ${
                          camp.spots_remaining === 0
                            ? 'border-rose-200 bg-rose-50 text-rose-800'
                            : camp.spots_remaining <= 3
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : 'border-border bg-surface-subtle text-body'
                        }`}
                      >
                        {formatSpotsRemaining(camp.spots_remaining)}
                      </span>

                      <span
                        className={`tabular-nums ${
                          deadline.isUrgent
                            ? 'font-semibold text-warning'
                            : 'text-muted'
                        }`}
                        title={`Join deadline: ${deadline.cutoffText}`}
                      >
                        {deadline.label}
                      </span>
                    </div>

                    <Link
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-sm border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors duration-base hover:border-accent hover:bg-accent hover:text-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      to={`/resident/camps/${camp.id}`}
                    >
                      <span>View details</span>
                      <ArrowRightIcon className="h-4 w-4 shrink-0" />
                    </Link>
                  </div>
                </article>
              )
            })}
          </section>
        ) : null}
      </div>
    </ResidentLayout>
  )
}
