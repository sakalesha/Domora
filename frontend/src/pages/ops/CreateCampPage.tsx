import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createCamp,
  fetchServices,
  fetchSocieties,
  fetchVendors,
  type PriceTier,
  type ServiceReference,
  type SocietyReference,
  type VendorReference,
} from '../../api/ops'
import { getCsrfToken } from '../../auth/api'
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  InfoIcon,
  PlusIcon,
  TagIcon,
  XIcon,
} from '../../components/icons/Icons'
import { OpsLayout } from '../../components/ops/OpsLayout'
import {
  calculateDiscountedPricePaise,
  formatDateOnly,
  formatPaiseToRupees,
} from '../../utils/format'

export function CreateCampPage() {
  const navigate = useNavigate()
  const errorBannerRef = useRef<HTMLDivElement | null>(null)

  const [societies, setSocieties] = useState<SocietyReference[]>([])
  const [services, setServices] = useState<ServiceReference[]>([])
  const [vendors, setVendors] = useState<VendorReference[]>([])
  const [loadingRefs, setLoadingRefs] = useState(true)

  const [societyId, setSocietyId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [slotMinutes, setSlotMinutes] = useState(30)
  const [minParticipants, setMinParticipants] = useState(3)
  const [maxParticipants, setMaxParticipants] = useState(12)
  const [joinDeadline, setJoinDeadline] = useState('')
  const [basePriceRupees, setBasePriceRupees] = useState(800)
  const [vendorId, setVendorId] = useState('')

  const [tiers, setTiers] = useState<PriceTier[]>([
    { min_participants: 3, discount_pct: 10 },
    { min_participants: 6, discount_pct: 15 },
    { min_participants: 10, discount_pct: 20 },
  ])

  const [submitting, setSubmitting] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRefs() {
      try {
        const [socs, srvs, vens] = await Promise.all([
          fetchSocieties(),
          fetchServices(),
          fetchVendors(),
        ])
        setSocieties(socs)
        setServices(srvs)
        setVendors(vens)
        if (socs.length > 0) setSocietyId(socs[0].id)
        if (srvs.length > 0) {
          setServiceId(srvs[0].id)
          setTitle(`${srvs[0].name} Camp`)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load reference options')
      } finally {
        setLoadingRefs(false)
      }
    }
    void loadRefs()
  }, [])

  useEffect(() => {
    if (!showReviewModal) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        setShowReviewModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showReviewModal, submitting])

  const safeBaseRupees =
    Number.isFinite(basePriceRupees) && basePriceRupees > 0 ? basePriceRupees : 0
  const basePricePaise = Math.round(safeBaseRupees * 100)

  let capacitySlots = 0
  let windowDurationHours = 0
  let leftoverMinutes = 0
  if (startsAt && endsAt && slotMinutes > 0) {
    const startMs = new Date(startsAt).getTime()
    const endMs = new Date(endsAt).getTime()
    if (endMs > startMs) {
      const durationMinutes = Math.floor((endMs - startMs) / 60000)
      windowDurationHours = Math.round((durationMinutes / 60) * 10) / 10
      capacitySlots = Math.floor(durationMinutes / slotMinutes)
      leftoverMinutes = durationMinutes % slotMinutes
    }
  }

  let latestJoinDeadlineNotice = ''
  let deadlineLeadValid = false
  if (startsAt) {
    const startDate = new Date(startsAt)
    if (!Number.isNaN(startDate.getTime())) {
      const maxDeadlineDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000)
      latestJoinDeadlineNotice = maxDeadlineDate.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
      if (joinDeadline) {
        deadlineLeadValid = new Date(joinDeadline).getTime() <= maxDeadlineDate.getTime()
      }
    }
  }

  function showValidationError(message: string) {
    setError(message)
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  function addTier() {
    const lastTier = tiers[tiers.length - 1]
    const nextMin = lastTier ? lastTier.min_participants + 3 : 3
    const nextPct = lastTier ? Math.min(100, lastTier.discount_pct + 5) : 10
    setTiers([...tiers, { min_participants: nextMin, discount_pct: nextPct }])
  }

  function removeTier(index: number) {
    setTiers(tiers.filter((_, i) => i !== index))
  }

  function updateTier(index: number, field: keyof PriceTier, rawValue: string) {
    const parsed = rawValue === '' ? 0 : Math.max(0, Math.floor(Number(rawValue) || 0))
    const updated = [...tiers]
    updated[index] = { ...updated[index], [field]: parsed }
    setTiers(updated)
  }

  function validateTiersLocally(): string | null {
    if (tiers.length === 0) return null
    for (let i = 0; i < tiers.length; i++) {
      if (tiers[i].min_participants < 1) return 'Tier participants must be at least 1'
      if (tiers[i].discount_pct < 0 || tiers[i].discount_pct > 100) {
        return 'Tier discount must be between 0% and 100%'
      }
      if (tiers[i].min_participants > maxParticipants) {
        return `Tier at ${tiers[i].min_participants} homes exceeds max participants (${maxParticipants})`
      }
      if (i > 0) {
        if (tiers[i].min_participants <= tiers[i - 1].min_participants) {
          return 'Tier participant thresholds must strictly increase'
        }
        if (tiers[i].discount_pct <= tiers[i - 1].discount_pct) {
          return 'Discounts must strictly increase with higher headcounts'
        }
      }
    }
    return null
  }

  function handleTriggerReview(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!societyId) return showValidationError('Please select a society')
    if (!serviceId) return showValidationError('Please select a service')
    if (!title.trim()) return showValidationError('Please enter a camp title')
    if (!startsAt || !endsAt) {
      return showValidationError('Please specify service window start and end times')
    }

    const startDt = new Date(startsAt)
    const endDt = new Date(endsAt)
    if (startDt >= endDt) return showValidationError('End time must be after start time')

    if (!joinDeadline) return showValidationError('Please specify a join deadline')
    const deadlineDt = new Date(joinDeadline)
    const minLeadTimeMs = 24 * 60 * 60 * 1000
    if (startDt.getTime() - deadlineDt.getTime() < minLeadTimeMs) {
      return showValidationError(
        `Join deadline must be at least 24 hours before camp start (before ${latestJoinDeadlineNotice})`,
      )
    }

    if (maxParticipants > capacitySlots) {
      return showValidationError(
        `Max participants (${maxParticipants}) exceeds window capacity (${capacitySlots} slots of ${slotMinutes}m).`,
      )
    }

    if (minParticipants < 1 || minParticipants > maxParticipants) {
      return showValidationError(
        'Min participants must be at least 1 and no greater than max participants',
      )
    }

    if (!Number.isFinite(basePriceRupees) || basePriceRupees < 1) {
      return showValidationError('Base price per home must be at least ₹1')
    }

    const tierError = validateTiersLocally()
    if (tierError) return showValidationError(tierError)

    setShowReviewModal(true)
  }

  async function handleConfirmLaunch() {
    setSubmitting(true)
    setError(null)
    try {
      const csrfToken = await getCsrfToken()
      const created = await createCamp(
        {
          society_id: societyId,
          service_id: serviceId,
          title: title.trim(),
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
          slot_minutes: slotMinutes,
          min_participants: minParticipants,
          max_participants: maxParticipants,
          join_deadline: new Date(joinDeadline).toISOString(),
          base_price_paise: basePricePaise,
          vendor_id: vendorId || null,
          price_tiers: tiers,
        },
        csrfToken,
      )

      navigate(`/ops/camps/${created.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create camp')
      setShowReviewModal(false)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedSociety = societies.find((s) => s.id === societyId)
  const selectedService = services.find((s) => s.id === serviceId)
  const selectedVendor = vendors.find((v) => v.id === vendorId)

  return (
    <OpsLayout
      breadcrumbs={[
        { label: 'Operations', to: '/ops' },
        { label: 'Camps', to: '/ops' },
        { label: 'New Camp' },
      ]}
      title="Create New Service Camp"
      subtitle="Configure society window, slot capacity, and stepped group pricing tiers"
      actions={
        <Link
          to="/ops"
          className="rounded-sm border border-border-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Cancel
        </Link>
      }
    >
      {loadingRefs ? (
        <div className="rounded-md border border-border bg-surface p-12 text-center text-sm text-muted">
          Loading society and service catalog options...
        </div>
      ) : (
        <form onSubmit={handleTriggerReview}>
          {error ? (
            <div
              ref={errorBannerRef}
              role="alert"
              className="mb-6 rounded-md border border-error/40 bg-red-50 p-4 text-sm text-error"
            >
              <p className="font-semibold">Configuration Validation Error</p>
              <p className="mt-0.5">{error}</p>
            </div>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left Column: 4 Structured Form Sections */}
            <div className="space-y-6 lg:col-span-8">
              {/* 01. Location & Service */}
              <section className="rounded-md border border-border bg-surface p-6 shadow-card">
                <div className="flex items-center gap-2.5 border-b border-border pb-3">
                  <span className="font-mono text-xs font-semibold text-accent">01</span>
                  <h2 className="font-display text-base font-bold text-ink">
                    Camp Location & Service
                  </h2>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="camp-society"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Target Society <span className="text-error">*</span>
                    </label>
                    <select
                      id="camp-society"
                      value={societyId}
                      onChange={(e) => setSocietyId(e.target.value)}
                      required
                      className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                    >
                      {societies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="camp-service"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Service Catalog <span className="text-error">*</span>
                    </label>
                    <select
                      id="camp-service"
                      value={serviceId}
                      onChange={(e) => {
                        setServiceId(e.target.value)
                        const s = services.find((srv) => srv.id === e.target.value)
                        if (s) setTitle(`${s.name} Camp`)
                      }}
                      required
                      className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                    >
                      {services.map((srv) => (
                        <option key={srv.id} value={srv.id}>
                          {srv.name} ({srv.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label
                      htmlFor="camp-title"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Camp Title <span className="text-error">*</span>
                    </label>
                    <input
                      id="camp-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Pre-Monsoon AC Deep Cleaning Camp"
                      required
                      maxLength={200}
                      className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      Shown to residents when browsing open camps in their society portal.
                    </p>
                  </div>
                </div>
              </section>

              {/* 02. Window & Slot Capacity */}
              <section className="rounded-md border border-border bg-surface p-6 shadow-card">
                <div className="flex items-center gap-2.5 border-b border-border pb-3">
                  <span className="font-mono text-xs font-semibold text-accent">02</span>
                  <h2 className="font-display text-base font-bold text-ink">
                    Service Window & Slot Capacity
                  </h2>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="camp-starts-at"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Window Starts At <span className="text-error">*</span>
                    </label>
                    <input
                      id="camp-starts-at"
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      required
                      className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="camp-ends-at"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Window Ends At <span className="text-error">*</span>
                    </label>
                    <input
                      id="camp-ends-at"
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      required
                      className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="camp-slot-minutes"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Slot Duration (minutes) <span className="text-error">*</span>
                    </label>
                    <select
                      id="camp-slot-minutes"
                      value={slotMinutes}
                      onChange={(e) => setSlotMinutes(Number(e.target.value))}
                      className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                    >
                      <option value={20}>20 minutes (Quick checks / inspections)</option>
                      <option value={30}>30 minutes (Standard servicing)</option>
                      <option value={45}>45 minutes (Deep cleaning)</option>
                      <option value={60}>60 minutes (Heavy maintenance)</option>
                    </select>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-sm font-semibold text-ink">
                      Calculated Window Capacity
                    </span>
                    <div className="flex min-h-[2.375rem] items-center rounded-sm border border-teal-200 bg-accent-soft px-3 py-2 font-mono text-sm font-semibold tabular-nums text-accent-pressed">
                      {capacitySlots > 0 ? (
                        <span>
                          {windowDurationHours}h = {capacitySlots} slots
                          {leftoverMinutes > 0 ? (
                            <span className="ml-1.5 text-xs font-normal text-accent">
                              (+{leftoverMinutes}m buffer)
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="font-sans text-xs font-normal text-muted">
                          Select start and end times to calculate
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="camp-min-participants"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Min Participants <span className="text-error">*</span>
                    </label>
                    <input
                      id="camp-min-participants"
                      type="number"
                      min={1}
                      max={maxParticipants || undefined}
                      value={minParticipants}
                      onChange={(e) =>
                        setMinParticipants(
                          e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0),
                        )
                      }
                      required
                      className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 font-mono text-sm font-semibold tabular-nums text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      Minimum homes required before the camp can confirm.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="camp-max-participants"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Max Participants <span className="text-error">*</span>
                    </label>
                    <input
                      id="camp-max-participants"
                      type="number"
                      min={minParticipants || 1}
                      max={capacitySlots || 50}
                      value={maxParticipants}
                      onChange={(e) =>
                        setMaxParticipants(
                          e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0),
                        )
                      }
                      required
                      className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 font-mono text-sm font-semibold tabular-nums text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      Hard cap cannot exceed window capacity ({capacitySlots} slots).
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label
                      htmlFor="camp-join-deadline"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Join Deadline (Cutoff Time) <span className="text-error">*</span>
                    </label>
                    <input
                      id="camp-join-deadline"
                      type="datetime-local"
                      value={joinDeadline}
                      onChange={(e) => setJoinDeadline(e.target.value)}
                      required
                      className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      {latestJoinDeadlineNotice ? (
                        <span>
                          Must be at least 24h prior to start (latest allowed:{' '}
                          <strong className="font-mono text-ink">
                            {latestJoinDeadlineNotice}
                          </strong>
                          ).
                        </span>
                      ) : (
                        'Enter window start time first to compute the 24h cutoff.'
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-2.5 rounded-sm border border-border bg-canvas p-3 text-xs text-body">
                  <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>
                    Standard cancellation rule: Residents can cancel bookings up to 24 hours before
                    the camp start time.
                  </span>
                </div>
              </section>

              {/* 03. Base Price & Volume Discount Tiers */}
              <section className="rounded-md border border-border bg-surface p-6 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-semibold text-accent">03</span>
                    <h2 className="font-display text-base font-bold text-ink">
                      Base Price & Volume Discount Tiers
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={addTier}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    <span>Add Tier</span>
                  </button>
                </div>

                <div className="mt-5">
                  <div className="max-w-xs">
                    <label
                      htmlFor="camp-base-price"
                      className="mb-1.5 block text-sm font-semibold text-ink"
                    >
                      Base Price per Home (₹) <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-2 font-mono text-sm font-semibold text-muted">
                        ₹
                      </span>
                      <input
                        id="camp-base-price"
                        type="number"
                        min={1}
                        step="any"
                        value={basePriceRupees}
                        onChange={(e) =>
                          setBasePriceRupees(
                            e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0),
                          )
                        }
                        required
                        className="w-full rounded-sm border border-border-strong bg-surface py-2 pl-7 pr-3 font-mono text-sm font-semibold tabular-nums text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                      />
                    </div>
                  </div>

                  <div className="mt-5 space-y-2.5">
                    <p className="text-sm font-semibold text-ink">Discount Ladder</p>
                    {tiers.length === 0 ? (
                      <p className="rounded-sm border border-dashed border-border-strong bg-canvas px-4 py-3 text-xs text-muted">
                        No group discount tiers configured. All homes will pay the base price.
                      </p>
                    ) : (
                      tiers.map((tier, idx) => {
                        const discountedPaise = calculateDiscountedPricePaise(
                          basePricePaise,
                          tier.discount_pct,
                        )
                        return (
                          <div
                            key={idx}
                            className="flex flex-wrap items-center gap-3 rounded-sm border border-border bg-canvas px-3.5 py-2.5 text-sm"
                          >
                            <span className="w-14 font-mono text-xs font-semibold text-muted">
                              Tier {idx + 1}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <label
                                htmlFor={`tier-${idx}-min`}
                                className="text-xs font-medium text-muted"
                              >
                                At
                              </label>
                              <input
                                id={`tier-${idx}-min`}
                                type="number"
                                min={1}
                                max={maxParticipants || undefined}
                                value={tier.min_participants}
                                onChange={(e) =>
                                  updateTier(idx, 'min_participants', e.target.value)
                                }
                                className="w-16 rounded-sm border border-border-strong bg-surface px-2 py-1 font-mono text-xs font-semibold tabular-nums text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                              />
                              <span className="text-xs text-muted">homes:</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input
                                aria-label={`Tier ${idx + 1} discount percentage`}
                                type="number"
                                min={0}
                                max={100}
                                value={tier.discount_pct}
                                onChange={(e) =>
                                  updateTier(idx, 'discount_pct', e.target.value)
                                }
                                className="w-16 rounded-sm border border-border-strong bg-surface px-2 py-1 font-mono text-xs font-semibold tabular-nums text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                              />
                              <span className="text-xs text-muted">% off</span>
                            </div>

                            <span className="rounded-sm border border-teal-200 bg-accent-soft px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-accent-pressed">
                              {formatPaiseToRupees(discountedPaise)} / home
                            </span>

                            <button
                              type="button"
                              onClick={() => removeTier(idx)}
                              className="ml-auto rounded-sm p-1 text-muted transition-colors hover:bg-surface hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                              aria-label={`Remove tier ${idx + 1}`}
                            >
                              <XIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </section>

              {/* 04. Partner Vendor Assignment */}
              <section className="rounded-md border border-border bg-surface p-6 shadow-card">
                <div className="flex items-center gap-2.5 border-b border-border pb-3">
                  <span className="font-mono text-xs font-semibold text-accent">04</span>
                  <h2 className="font-display text-base font-bold text-ink">
                    Partner Vendor Assignment (Optional)
                  </h2>
                </div>

                <div className="mt-5">
                  <label
                    htmlFor="camp-vendor"
                    className="mb-1.5 block text-sm font-semibold text-ink"
                  >
                    Select Verified Vendor
                  </label>
                  <select
                    id="camp-vendor"
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="w-full max-w-md rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                  >
                    <option value="">Leave unassigned for now</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.full_name} ({v.phone})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-muted">
                    Can be assigned or updated later from Camp Detail before confirming the camp.
                  </p>
                </div>
              </section>

              {/* Form Submission Bar */}
              <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                <Link
                  to="/ops"
                  className="rounded-sm border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-card transition-colors hover:bg-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <span>Review & Launch Camp</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Right Column: Sticky Live Simulator */}
            <aside className="lg:col-span-4">
              <div className="sticky top-20 space-y-5 rounded-md border border-border bg-surface p-5 shadow-card">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <TagIcon className="h-4 w-4 text-accent" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
                    Live Pricing Preview
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="rounded-sm border border-border bg-canvas p-3">
                    <span className="block text-xs font-medium text-muted">Base Price</span>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="font-mono text-xl font-semibold tabular-nums text-ink">
                        {formatPaiseToRupees(basePricePaise)}
                      </span>
                      <span className="text-xs text-muted">per home (1+ homes)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      Stepped Ladder
                    </span>
                    {tiers.map((t, idx) => {
                      const tierPricePaise = calculateDiscountedPricePaise(
                        basePricePaise,
                        t.discount_pct,
                      )
                      const savingsPaise = Math.max(0, basePricePaise - tierPricePaise)
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-sm border border-teal-200 bg-accent-soft px-3 py-2 text-xs"
                        >
                          <div>
                            <span className="block font-mono font-semibold tabular-nums text-accent-pressed">
                              {t.min_participants}+ homes
                            </span>
                            <span className="font-mono text-xs tabular-nums text-accent">
                              Saves {formatPaiseToRupees(savingsPaise)} ({t.discount_pct}%)
                            </span>
                          </div>
                          <span className="font-mono text-sm font-semibold tabular-nums text-accent-pressed">
                            {formatPaiseToRupees(tierPricePaise)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2.5 border-t border-border pt-4">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
                    Validation Guardrails
                  </span>

                  <div className="flex items-center gap-2 text-xs">
                    {deadlineLeadValid ? (
                      <CheckIcon className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <AlertTriangleIcon className="h-4 w-4 shrink-0 text-warning" />
                    )}
                    <span className={deadlineLeadValid ? 'text-body' : 'font-medium text-warning'}>
                      Join deadline ≥ 24h before start
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {minParticipants >= 1 && minParticipants <= maxParticipants ? (
                      <CheckIcon className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <AlertTriangleIcon className="h-4 w-4 shrink-0 text-error" />
                    )}
                    <span
                      className={
                        minParticipants >= 1 && minParticipants <= maxParticipants
                          ? 'text-body'
                          : 'font-medium text-error'
                      }
                    >
                      Min participants ≤ Max participants
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {capacitySlots > 0 && maxParticipants <= capacitySlots ? (
                      <CheckIcon className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <AlertTriangleIcon className="h-4 w-4 shrink-0 text-warning" />
                    )}
                    <span
                      className={
                        capacitySlots > 0 && maxParticipants <= capacitySlots
                          ? 'text-body'
                          : 'font-medium text-warning'
                      }
                    >
                      Max fits within window capacity
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </form>
      )}

      {/* Pre-Launch Confirmation Review Modal */}
      {showReviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
        >
          <div
            className="fixed inset-0 bg-ink/50 backdrop-blur-sm transition-opacity"
            onClick={() => {
              if (!submitting) setShowReviewModal(false)
            }}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-lg rounded-md border border-border bg-surface p-6 shadow-modal">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id="review-modal-title" className="font-display text-base font-bold text-ink">
                Confirm Camp Publication
              </h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                disabled={submitting}
                aria-label="Close review dialog"
                className="rounded-sm p-1 text-muted transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <dl className="space-y-2 rounded-sm border border-border bg-canvas p-4 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Target Society</dt>
                  <dd className="font-semibold text-ink">{selectedSociety?.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Service</dt>
                  <dd className="font-semibold text-ink">{selectedService?.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Camp Title</dt>
                  <dd className="font-semibold text-ink">{title}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Service Window</dt>
                  <dd className="font-mono font-semibold tabular-nums text-ink">
                    {formatDateOnly(startsAt)} · {capacitySlots} slots of {slotMinutes}m
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Base Price & Threshold</dt>
                  <dd className="font-mono font-semibold tabular-nums text-ink">
                    {formatPaiseToRupees(basePricePaise)} · Min {minParticipants} / Max{' '}
                    {maxParticipants}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Vendor</dt>
                  <dd className="font-semibold text-ink">
                    {selectedVendor ? selectedVendor.full_name : 'Unassigned (assign later)'}
                  </dd>
                </div>
              </dl>

              <div className="rounded-sm border border-amber-200 bg-amber-50 p-3.5 text-amber-900">
                <p className="text-xs font-semibold">Immediate Resident Visibility</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Publishing sets this camp status to <strong>Open</strong> immediately so
                  residents of <strong>{selectedSociety?.name}</strong> can book slots right away.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                disabled={submitting}
                className="rounded-sm border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmLaunch()}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-card transition-colors hover:bg-accent-pressed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {submitting ? (
                  <>
                    <span aria-hidden="true" className="spinner" />
                    <span>Publishing Camp...</span>
                  </>
                ) : (
                  <span>Confirm & Launch Live Camp</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </OpsLayout>
  )
}
