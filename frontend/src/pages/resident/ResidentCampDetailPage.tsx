import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getResidentCampDetail,
  type ResidentCampDetail,
} from '../../api/resident'
import { ApiError, NetworkError } from '../../auth/api'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  InfoIcon,
  TagIcon,
  XIcon,
} from '../../components/icons/Icons'
import { CampStatusBadge } from '../../components/ops/CampStatusBadge'
import { ResidentLayout } from '../../components/resident/ResidentLayout'
import { SavingsLadder } from '../../components/resident/SavingsLadder'
import { SteppedProgressBar } from '../../components/resident/SteppedProgressBar'
import { formatDateOnly, formatDateTime } from '../../utils/format'
import {
  formatBookingStatusLabel,
  formatDeadlineStatus,
  formatRupeeAmount,
  formatSpotsRemaining,
  formatWindowDuration,
  getJoinUnavailableReason,
  PROVISIONAL_PRICE_DISCLAIMER,
} from '../../utils/residentCamp'

export function ResidentCampDetailPage() {
  const { campId } = useParams<{ campId: string }>()
  const [camp, setCamp] = useState<ResidentCampDetail | null>(null)
  const [loading, setLoading] = useState(Boolean(campId))
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(!campId)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [joinModalOpen, setJoinModalOpen] = useState(false)

  useEffect(() => {
    if (!campId) {
      return
    }
    const targetCampId = campId
    let active = true

    async function fetchCampDetail() {
      try {
        const detail = await getResidentCampDetail(targetCampId)
        if (!active) return
        setCamp(detail)
        setError(null)
        setNotFound(false)
      } catch (err: unknown) {
        if (!active) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
          setError(null)
        } else if (err instanceof NetworkError) {
          setError(err.message)
        } else if (err instanceof ApiError && err.status === 403) {
          setError('This camp is not available for your society account.')
        } else {
          setError('Could not load camp details. Please try again.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void fetchCampDetail()

    return () => {
      active = false
    }
  }, [campId, reloadNonce])

  function handleRetry() {
    if (!campId) return
    setLoading(true)
    setError(null)
    setNotFound(false)
    setReloadNonce((count) => count + 1)
  }

  useEffect(() => {
    if (!joinModalOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setJoinModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [joinModalOpen])

  if (loading) {
    return (
      <ResidentLayout
        breadcrumbs={[
          { label: 'Community Camps', to: '/resident' },
          { label: 'Loading camp...' },
        ]}
        documentTitle="Camp Details | Domora"
      >
        <div className="grid gap-6 lg:grid-cols-12" role="status">
          <div className="grid gap-5 lg:col-span-8">
            <div className="h-56 animate-pulse rounded-md border border-border bg-surface" />
            <div className="h-64 animate-pulse rounded-md border border-border bg-surface" />
          </div>
          <div className="lg:col-span-4">
            <div className="h-52 animate-pulse rounded-md border border-border bg-surface" />
          </div>
        </div>
      </ResidentLayout>
    )
  }

  if (notFound) {
    return (
      <ResidentLayout
        breadcrumbs={[
          { label: 'Community Camps', to: '/resident' },
          { label: 'Camp not found' },
        ]}
        documentTitle="Camp Not Found | Domora"
      >
        <section className="grid justify-items-start gap-4 rounded-md border border-border bg-surface p-6 shadow-card">
          <h1 className="font-display text-xl font-bold text-ink">
            We could not find that camp
          </h1>
          <p className="max-w-lg text-sm text-body">
            This camp may belong to a different society or may no longer be listed. Return to your society directory to browse available camps.
          </p>
          <Link
            className="inline-flex min-h-[44px] items-center gap-2 rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            to="/resident"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to community camps</span>
          </Link>
        </section>
      </ResidentLayout>
    )
  }

  if (error || !camp) {
    return (
      <ResidentLayout
        breadcrumbs={[
          { label: 'Community Camps', to: '/resident' },
          { label: 'Unable to load camp' },
        ]}
        documentTitle="Camp Details | Domora"
      >
        <section
          className="flex flex-col items-start justify-between gap-4 rounded-md border border-red-200 bg-red-50 p-6 sm:flex-row sm:items-center"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-error" />
            <div className="grid gap-1">
              <h1 className="font-display text-base font-bold text-ink">
                Unable to load camp details
              </h1>
              <p className="text-sm text-body">
                {error ?? 'Something went wrong while loading this camp.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="inline-flex min-h-[44px] items-center rounded-sm border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              to="/resident"
            >
              Back to directory
            </Link>
            <button
              className="inline-flex min-h-[44px] items-center rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={handleRetry}
              type="button"
            >
              Try again
            </button>
          </div>
        </section>
      </ResidentLayout>
    )
  }

  const currentPriceText = formatRupeeAmount(
    camp.current_price_rupees,
    camp.current_price_paise,
  )
  const basePriceText = formatRupeeAmount(
    camp.base_price_rupees,
    camp.base_price_paise,
  )
  const hasDiscount =
    camp.discount_pct > 0 && camp.current_price_paise < camp.base_price_paise
  const deadline = formatDeadlineStatus(camp.join_deadline)
  const disclaimerText =
    camp.price_disclaimer?.trim() || PROVISIONAL_PRICE_DISCLAIMER
  const unavailableInfo = getJoinUnavailableReason(camp)

  const bookingDisplayPrice = camp.user_booking
    ? formatRupeeAmount(
        camp.user_booking.final_price_rupees ??
          camp.user_booking.quoted_price_rupees,
        camp.user_booking.final_price_paise ??
          camp.user_booking.quoted_price_paise,
      )
    : null

  return (
    <ResidentLayout
      breadcrumbs={[
        { label: 'Community Camps', to: '/resident' },
        { label: camp.title },
      ]}
      documentTitle={`${camp.title} | Domora`}
      hasStickyBottomBar
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* Main Column */}
        <div className="grid gap-6 lg:col-span-8">
          {/* Overview Card */}
          <section className="grid gap-5 rounded-md border border-border bg-surface p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
                <span className="font-semibold text-accent-pressed">
                  {camp.service.name}
                </span>
                <span aria-hidden="true">·</span>
                <span>{camp.society.name}</span>
                {camp.society.city ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{camp.society.city}</span>
                  </>
                ) : null}
              </div>
              <CampStatusBadge status={camp.status} />
            </div>

            <div className="grid gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {camp.title}
              </h1>
              {camp.service.description ? (
                <p className="text-sm leading-relaxed text-body">
                  {camp.service.description}
                </p>
              ) : null}
              {camp.service.unit_label ? (
                <p className="text-xs font-medium text-muted">
                  Pricing basis: {camp.service.unit_label}
                </p>
              ) : null}
            </div>

            {/* Key Schedule Details */}
            <dl className="grid gap-3 rounded-sm border border-border bg-canvas p-4 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div className="grid gap-0.5">
                  <dt className="text-xs font-medium text-muted">Camp date</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {formatDateOnly(camp.starts_at)}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div className="grid gap-0.5">
                  <dt className="text-xs font-medium text-muted">
                    Service window
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums text-ink">
                    {formatWindowDuration(camp.starts_at, camp.ends_at)}
                  </dd>
                </div>
              </div>

              <div className="grid gap-0.5 border-t border-border pt-3">
                <dt className="text-xs font-medium text-muted">
                  Slot duration per home
                </dt>
                <dd className="text-sm font-semibold tabular-nums text-ink">
                  {camp.slot_minutes} minutes
                </dd>
              </div>

              <div className="grid gap-0.5 border-t border-border pt-3">
                <dt className="text-xs font-medium text-muted">
                  Join deadline
                </dt>
                <dd className="text-sm font-semibold tabular-nums text-ink">
                  <span
                    className={
                      deadline.isUrgent
                        ? 'text-warning'
                        : deadline.isPast
                          ? 'text-muted'
                          : 'text-ink'
                    }
                  >
                    {deadline.label}
                  </span>
                  <span className="block text-xs font-normal text-muted">
                    Cutoff: {deadline.cutoffText}
                  </span>
                </dd>
              </div>
            </dl>

            {/* Aggregate Participation Bar (Decision P6: aggregate only) */}
            <div className="grid gap-3 border-t border-border pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-ink">
                  Group participation
                </h2>
                <span
                  className={`inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                    camp.spots_remaining === 0
                      ? 'border-rose-200 bg-rose-50 text-rose-800'
                      : camp.spots_remaining <= 3
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-border bg-surface-subtle text-body'
                  }`}
                >
                  {formatSpotsRemaining(camp.spots_remaining)}
                </span>
              </div>

              <SteppedProgressBar
                maxParticipants={camp.max_participants}
                minParticipants={camp.min_participants}
                nextTier={camp.next_tier}
                participantsCount={camp.participants_count}
              />

              {camp.next_tier && !camp.is_confirmed_or_higher ? (
                <p className="rounded-sm border border-teal-200 bg-accent-soft/60 px-3.5 py-2.5 text-sm font-medium text-accent-pressed">
                  {camp.next_tier.more_needed} more{' '}
                  {camp.next_tier.more_needed === 1 ? 'neighbour' : 'neighbours'}{' '}
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
          </section>

          {/* Interactive Stepped-Savings Ladder */}
          <SavingsLadder
            basePricePaise={camp.base_price_paise}
            basePriceRupees={camp.base_price_rupees}
            isLocked={camp.is_confirmed_or_higher}
            participantsCount={camp.participants_count}
            tiers={camp.tiers}
          />

          {/* Decision P1: Prominent Provisional Pricing Notice Card */}
          <section
            aria-labelledby="provisional-pricing-heading"
            className="rounded-md border border-teal-200 bg-accent-soft/60 p-5"
          >
            <div className="flex items-start gap-3">
              <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div className="grid gap-1.5">
                <h2
                  className="font-display text-sm font-bold text-ink"
                  id="provisional-pricing-heading"
                >
                  {camp.is_confirmed_or_higher
                    ? 'Confirmed camp pricing'
                    : 'Provisional pricing notice'}
                </h2>
                <p className="text-sm leading-relaxed text-body">
                  {disclaimerText}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Desktop Sticky Action Sidebar */}
        <aside className="hidden lg:sticky lg:top-20 lg:col-span-4 lg:grid lg:gap-4">
          <div className="grid gap-5 rounded-md border border-border bg-surface p-6 shadow-card">
            <div className="grid gap-1.5">
              <p className="text-xs font-semibold text-muted">
                {camp.is_confirmed_or_higher
                  ? 'Confirmed group price'
                  : 'Current provisional price'}
              </p>
              <div className="flex flex-wrap items-baseline gap-2.5">
                <span className="font-mono text-3xl font-bold tracking-tight tabular-nums text-ink">
                  {currentPriceText}
                </span>
                {hasDiscount ? (
                  <span className="font-mono text-base tabular-nums text-muted line-through">
                    {basePriceText}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {camp.discount_pct > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-teal-200 bg-accent-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-accent-pressed">
                    <TagIcon className="h-3 w-3 shrink-0" />
                    <span>{camp.discount_pct}% off base price</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted">
                    Standard rate · unlocks discounts as neighbours join
                  </span>
                )}
              </div>
            </div>

            {camp.user_booking && bookingDisplayPrice ? (
              <div className="grid gap-2.5 rounded-sm border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                  <CheckIcon className="h-4 w-4 shrink-0 text-emerald-700" />
                  <span>
                    {formatBookingStatusLabel(camp.user_booking.status)}
                  </span>
                </div>
                <p className="text-xs text-emerald-900/90 tabular-nums">
                  {camp.user_booking.final_price_paise != null
                    ? `Final locked price: ${bookingDisplayPrice}`
                    : `Quoted provisional price: ${bookingDisplayPrice}`}
                </p>
                {camp.user_booking.slot_starts_at ? (
                  <p className="text-xs font-medium text-emerald-900 tabular-nums">
                    Assigned slot: {formatDateTime(camp.user_booking.slot_starts_at)}
                  </p>
                ) : null}
              </div>
            ) : camp.can_join ? (
              <div className="grid gap-2.5">
                <button
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-on-accent shadow-card transition-colors duration-base hover:bg-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  onClick={() => setJoinModalOpen(true)}
                  type="button"
                >
                  Join Camp for {currentPriceText}
                </button>
                <p className="text-center text-xs text-muted">
                  Price locks only when the camp confirms
                </p>
              </div>
            ) : (
              <div className="grid gap-1.5 rounded-sm border border-border bg-surface-subtle p-4">
                <p className="text-sm font-semibold text-ink">
                  {unavailableInfo.shortLabel}
                </p>
                <p className="text-xs leading-relaxed text-body">
                  {unavailableInfo.explanation}
                </p>
              </div>
            )}

            <Link
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-sm text-sm font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              to="/resident"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span>All {camp.society.name} camps</span>
            </Link>
          </div>
        </aside>
      </div>

      {/* Mobile Sticky Bottom Call-to-Action Bar (compact height to keep total sticky <= 15% of viewport) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 px-4 py-2.5 shadow-modal backdrop-blur-sm lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          {camp.user_booking && bookingDisplayPrice ? (
            <>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-800">
                  <CheckIcon className="h-4 w-4 shrink-0 text-emerald-700" />
                  <span className="truncate">
                    {formatBookingStatusLabel(camp.user_booking.status)}
                  </span>
                </span>
                <p className="truncate font-mono text-xs tabular-nums text-muted">
                  {bookingDisplayPrice}
                  {camp.user_booking.slot_starts_at
                    ? ` · ${formatDateTime(camp.user_booking.slot_starts_at)}`
                    : ''}
                </p>
              </div>
              <span className="shrink-0 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
                Booked
              </span>
            </>
          ) : camp.can_join ? (
            <>
              <div className="min-w-0">
                <p className="font-mono text-lg font-bold leading-tight tabular-nums text-ink">
                  {currentPriceText}
                </p>
                <p className="truncate text-xs text-muted">
                  {camp.discount_pct > 0
                    ? `${camp.discount_pct}% off · provisional`
                    : 'Provisional group rate'}
                </p>
              </div>
              <button
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent shadow-card transition-colors hover:bg-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                onClick={() => setJoinModalOpen(true)}
                type="button"
              >
                Join Camp for {currentPriceText}
              </button>
            </>
          ) : (
            <div className="flex w-full items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {unavailableInfo.shortLabel}
                </p>
                <p className="truncate text-xs text-muted">
                  {unavailableInfo.explanation}
                </p>
              </div>
              <span className="shrink-0 rounded-sm border border-border bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-muted">
                Closed
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Phase 4c Booking Preview Modal */}
      {joinModalOpen ? (
        <div
          aria-labelledby="join-camp-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
        >
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setJoinModalOpen(false)}
          />
          <div className="relative z-10 grid w-full max-w-md gap-4 rounded-md border border-border bg-surface p-6 shadow-modal">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <p className="text-xs font-semibold text-accent">
                  Phase 4c booking flow
                </p>
                <h2
                  className="font-display text-xl font-bold text-ink"
                  id="join-camp-modal-title"
                >
                  Ready to join this camp?
                </h2>
              </div>
              <button
                aria-label="Close dialog"
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => setJoinModalOpen(false)}
                type="button"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-2 rounded-sm border border-border bg-canvas p-4 text-sm">
              <p className="font-semibold text-ink">{camp.title}</p>
              <p className="text-xs text-body">
                {formatDateOnly(camp.starts_at)} ·{' '}
                {formatWindowDuration(camp.starts_at, camp.ends_at)}
              </p>
              <p className="font-mono text-sm font-bold tabular-nums text-accent-pressed">
                Current provisional rate: {currentPriceText}
                {camp.discount_pct > 0 ? ` (${camp.discount_pct}% off)` : ''}
              </p>
            </div>

            <p className="text-sm leading-relaxed text-body">
              Resident camp enrollment and slot reservation will be activated next in Phase 4c. {disclaimerText}
            </p>

            <div className="flex justify-end">
              <button
                className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                onClick={() => setJoinModalOpen(false)}
                type="button"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ResidentLayout>
  )
}
