import { useEffect, useState } from 'react'
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
  TagIcon,
  XIcon,
} from '../../components/icons/Icons'
import { OpsLayout } from '../../components/ops/OpsLayout'

function formatPaiseToRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function CreateCampPage() {
  const navigate = useNavigate()

  // Reference Data
  const [societies, setSocieties] = useState<SocietyReference[]>([])
  const [services, setServices] = useState<ServiceReference[]>([])
  const [vendors, setVendors] = useState<VendorReference[]>([])
  const [loadingRefs, setLoadingRefs] = useState(true)

  // Form Fields
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

  // Dynamic Tiers
  const [tiers, setTiers] = useState<PriceTier[]>([
    { min_participants: 3, discount_pct: 10 },
    { min_participants: 6, discount_pct: 15 },
    { min_participants: 10, discount_pct: 20 },
  ])

  // UI State & Modal
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

  // Auto-calculate capacity slots and leftover minutes
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

  // Calculate maximum allowed join deadline (24 hours before startsAt)
  let latestJoinDeadlineNotice = ''
  let deadlineLeadValid = false
  if (startsAt) {
    const startDate = new Date(startsAt)
    const maxDeadlineDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000)
    latestJoinDeadlineNotice = maxDeadlineDate.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    if (joinDeadline) {
      deadlineLeadValid = new Date(joinDeadline).getTime() <= maxDeadlineDate.getTime()
    }
  }

  // Tier helpers
  function addTier() {
    const lastTier = tiers[tiers.length - 1]
    const nextMin = lastTier ? lastTier.min_participants + 3 : 3
    const nextPct = lastTier ? Math.min(100, lastTier.discount_pct + 5) : 10
    setTiers([...tiers, { min_participants: nextMin, discount_pct: nextPct }])
  }

  function removeTier(index: number) {
    setTiers(tiers.filter((_, i) => i !== index))
  }

  function updateTier(index: number, field: keyof PriceTier, value: number) {
    const updated = [...tiers]
    updated[index] = { ...updated[index], [field]: value }
    setTiers(updated)
  }

  // Tier validation check
  function validateTiersLocally(): string | null {
    if (tiers.length === 0) return null
    for (let i = 0; i < tiers.length; i++) {
      if (tiers[i].min_participants < 1) return 'Tier participants must be at least 1'
      if (tiers[i].discount_pct < 0 || tiers[i].discount_pct > 100)
        return 'Tier discount must be between 0% and 100%'
      if (tiers[i].min_participants > maxParticipants)
        return `Tier at ${tiers[i].min_participants} homes exceeds max participants (${maxParticipants})`
      if (i > 0) {
        if (tiers[i].min_participants <= tiers[i - 1].min_participants)
          return 'Tier participant thresholds must strictly increase'
        if (tiers[i].discount_pct <= tiers[i - 1].discount_pct)
          return 'Discounts must strictly increase with higher headcounts'
      }
    }
    return null
  }

  function handleTriggerReview(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!societyId) return setError('Please select a society')
    if (!serviceId) return setError('Please select a service')
    if (!title.trim()) return setError('Please enter a camp title')
    if (!startsAt || !endsAt)
      return setError('Please specify service window starts and ends time')

    const startDt = new Date(startsAt)
    const endDt = new Date(endsAt)
    if (startDt >= endDt) return setError('End time must be after start time')

    if (!joinDeadline) return setError('Please specify a join deadline')
    const deadlineDt = new Date(joinDeadline)
    const minLeadTimeMs = 24 * 60 * 60 * 1000
    if (startDt.getTime() - deadlineDt.getTime() < minLeadTimeMs) {
      return setError(
        `Join deadline must be at least 24 hours before camp start (before ${latestJoinDeadlineNotice})`,
      )
    }

    if (maxParticipants > capacitySlots) {
      return setError(
        `Max participants (${maxParticipants}) exceeds window capacity (${capacitySlots} slots of ${slotMinutes}m).`,
      )
    }

    if (minParticipants < 1 || minParticipants > maxParticipants) {
      return setError('Min participants must be at least 1 and no greater than max participants')
    }

    const tierError = validateTiersLocally()
    if (tierError) return setError(tierError)

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
          base_price_paise: Math.round(basePriceRupees * 100),
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
      subtitle="Schedule window, configure capacity, and define volume discount pricing tiers"
      actions={
        <Link
          to="/ops"
          className="rounded-lg border border-border/40 bg-surface px-3 py-1.5 text-xs font-semibold text-body hover:bg-canvas transition active:scale-[0.98]"
        >
          Cancel
        </Link>
      }
    >
      {loadingRefs ? (
        <div className="rounded-xl border border-border/30 bg-surface p-12 text-center text-xs text-muted">
          Loading society and service catalog options...
        </div>
      ) : (
        <form onSubmit={handleTriggerReview}>
          {error ? (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
              <p className="font-bold">Configuration Validation Error</p>
              <p className="mt-0.5">{error}</p>
            </div>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left Column: 4 Structured Form Cards (8 cols) */}
            <div className="space-y-6 lg:col-span-8">
              {/* 1. Basic Details */}
              <div className="rounded-xl border border-border/30 bg-surface p-6 shadow-sm">
                <div className="flex items-center gap-2 border-b border-border/20 pb-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                    1
                  </span>
                  <h2 className="text-sm font-bold text-ink">Camp Location & Service</h2>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-body">
                      Target Society *
                    </label>
                    <select
                      value={societyId}
                      onChange={(e) => setSocietyId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-border/40 bg-canvas px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      {societies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-body">
                      Service Catalog *
                    </label>
                    <select
                      value={serviceId}
                      onChange={(e) => {
                        setServiceId(e.target.value)
                        const s = services.find((srv) => srv.id === e.target.value)
                        if (s) setTitle(`${s.name} Camp`)
                      }}
                      required
                      className="w-full rounded-lg border border-border/40 bg-canvas px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      {services.map((srv) => (
                        <option key={srv.id} value={srv.id}>
                          {srv.name} ({srv.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-body">
                      Camp Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Pre-Monsoon AC Deep Cleaning Camp"
                      required
                      className="w-full rounded-lg border border-border/40 bg-canvas px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      Displayed on resident dashboard and community WhatsApp announcements.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Window & Capacity */}
              <div className="rounded-xl border border-border/30 bg-surface p-6 shadow-sm">
                <div className="flex items-center gap-2 border-b border-border/20 pb-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                    2
                  </span>
                  <h2 className="text-sm font-bold text-ink">Service Window & Slot Capacity</h2>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-body">
                      Window Starts At *
                    </label>
                    <input
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      required
                      className="w-full rounded-lg border border-border/40 bg-canvas px-3 py-2 text-xs font-mono text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-body">
                      Window Ends At *
                    </label>
                    <input
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      required
                      className="w-full rounded-lg border border-border/40 bg-canvas px-3 py-2 text-xs font-mono text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-body">
                      Slot Duration (minutes) *
                    </label>
                    <select
                      value={slotMinutes}
                      onChange={(e) => setSlotMinutes(Number(e.target.value))}
                      className="w-full rounded-lg border border-border/40 bg-canvas px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      <option value={20}>20 minutes (Quick checks / inspections)</option>
                      <option value={30}>30 minutes (Standard servicing)</option>
                      <option value={45}>45 minutes (Deep cleaning)</option>
                      <option value={60}>60 minutes (Heavy maintenance)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-body">
                      Calculated Window Capacity
                    </label>
                    <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-mono font-bold text-teal-900">
                      {capacitySlots > 0 ? (
                        <span>
                          {windowDurationHours}h window = {capacitySlots} slots
                          {leftoverMinutes > 0 ? (
                            <span className="ml-1 text-[11px] font-normal text-teal-700">
                              (+{leftoverMinutes}m buffer)
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted font-normal text-[11px]">
                          Select start and end times to calculate
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-body">
                      Min Participants (Threshold to Confirm) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={maxParticipants}
                      value={minParticipants}
                      onChange={(e) => setMinParticipants(Number(e.target.value))}
                      required
                      className="w-full rounded-lg border border-border/40 bg-canvas px-3 py-2 text-xs font-mono text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      Camp cannot confirm or schedule visits until this headcount is reached.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-body">
                      Max Participants (Hard Cap) *
                    </label>
                    <input
                      type="number"
                      min={minParticipants}
                      max={capacitySlots || 50}
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(Number(e.target.value))}
                      required
                      className="w-full rounded-lg border border-border/40 bg-canvas px-3 py-2 text-xs font-mono text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      Cannot exceed window capacity ({capacitySlots} slots).
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-body">
                      Join Deadline (Cutoff Time) *
                    </label>
                    <input
                      type="datetime-local"
                      value={joinDeadline}
                      onChange={(e) => setJoinDeadline(e.target.value)}
                      required
                      className="w-full rounded-lg border border-border/40 bg-canvas px-3 py-2 text-xs font-mono text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      {latestJoinDeadlineNotice ? (
                        <span>
                          Must be at least 24h prior to window start (latest allowed:{' '}
                          <strong className="text-ink">{latestJoinDeadlineNotice}</strong>).
                        </span>
                      ) : (
                        'Enter window start time first to calculate deadline requirements.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Base Price & Tiers */}
              <div className="rounded-xl border border-border/30 bg-surface p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/20 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                      3
                    </span>
                    <h2 className="text-sm font-bold text-ink">
                      Base Price & Volume Discount Tiers
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={addTier}
                    className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-canvas px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface active:scale-[0.98]"
                  >
                    <span>+ Add Tier</span>
                  </button>
                </div>

                <div className="mt-4">
                  <div className="max-w-xs">
                    <label className="mb-1 block text-xs font-semibold text-body">
                      Base Price per Home (₹) *
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-2 text-xs font-bold text-muted">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={basePriceRupees}
                        onChange={(e) => setBasePriceRupees(Number(e.target.value))}
                        required
                        className="w-full rounded-lg border border-border/40 bg-canvas py-2 pl-7 pr-3 text-xs font-mono font-bold text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>

                  {/* Tier Editor Table */}
                  <div className="mt-5 space-y-2">
                    <p className="text-xs font-semibold text-body">Discount Ladder</p>
                    {tiers.map((tier, idx) => {
                      const discountedPaise = Math.round(
                        basePriceRupees * 100 * (1 - tier.discount_pct / 100),
                      )
                      return (
                        <div
                          key={idx}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-border/30 bg-canvas p-2.5 text-xs"
                        >
                          <span className="w-12 font-bold text-muted text-[11px]">
                            Tier {idx + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-muted text-[11px]">At</span>
                            <input
                              type="number"
                              min={1}
                              max={maxParticipants}
                              value={tier.min_participants}
                              onChange={(e) =>
                                updateTier(idx, 'min_participants', Number(e.target.value))
                              }
                              className="w-16 rounded border border-border/40 bg-surface px-2 py-1 font-mono text-xs font-bold text-ink"
                            />
                            <span className="text-muted text-[11px]">homes:</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={tier.discount_pct}
                              onChange={(e) =>
                                updateTier(idx, 'discount_pct', Number(e.target.value))
                              }
                              className="w-16 rounded border border-border/40 bg-surface px-2 py-1 font-mono text-xs font-bold text-ink"
                            />
                            <span className="text-muted text-[11px]">% off</span>
                          </div>

                          <span className="rounded bg-teal-50 px-2 py-0.5 font-mono text-xs font-bold text-teal-800 border border-teal-200">
                            = {formatPaiseToRupees(discountedPaise)} / home
                          </span>

                          <button
                            type="button"
                            onClick={() => removeTier(idx)}
                            className="ml-auto rounded p-1 text-muted hover:text-rose-600 hover:bg-surface"
                            aria-label="Remove tier"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* 4. Vendor Assignment */}
              <div className="rounded-xl border border-border/30 bg-surface p-6 shadow-sm">
                <div className="flex items-center gap-2 border-b border-border/20 pb-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                    4
                  </span>
                  <h2 className="text-sm font-bold text-ink">
                    Partner Vendor Assignment (Optional)
                  </h2>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-xs font-semibold text-body">
                    Select Verified Vendor
                  </label>
                  <select
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="w-full max-w-md rounded-lg border border-border/40 bg-canvas px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="">Leave unassigned for now</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.full_name} ({v.phone})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-muted">
                    Can be assigned or updated at any point before confirming the camp.
                  </p>
                </div>
              </div>

              {/* Form Submission Bar */}
              <div className="flex items-center justify-end gap-3 pt-4">
                <Link
                  to="/ops"
                  className="rounded-lg border border-border/40 bg-surface px-4 py-2 text-xs font-semibold text-body hover:bg-canvas transition"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent-pressed active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span>Review & Launch Camp</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Right Column: Sticky Live Simulator on Desktop (4 cols) */}
            <div className="space-y-6 lg:col-span-4">
              {/* Stepped Pricing Preview Card */}
              <div className="sticky top-20 rounded-xl border border-border/30 bg-surface p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-border/20 pb-3">
                  <TagIcon className="h-4 w-4 text-accent" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                    Live Pricing Preview
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg bg-canvas p-3 border border-border/20">
                    <span className="text-[11px] font-semibold text-muted block">Base Price</span>
                    <span className="font-mono text-xl font-bold text-ink">
                      ₹{basePriceRupees}
                    </span>
                    <span className="text-[11px] text-muted ml-1">per home (solo / 1 home)</span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                      Stepped Ladder
                    </span>
                    {tiers.map((t, idx) => {
                      const tierPrice = Math.round(
                        basePriceRupees * 100 * (1 - t.discount_pct / 100),
                      )
                      const savingsPaise = Math.round(
                        basePriceRupees * 100 * (t.discount_pct / 100),
                      )
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50/60 p-2 text-xs"
                        >
                          <div>
                            <span className="font-bold text-teal-900 font-mono">
                              {t.min_participants}+ homes
                            </span>
                            <span className="text-[10px] text-teal-700 block">
                              Saves {formatPaiseToRupees(savingsPaise)} / home ({t.discount_pct}%)
                            </span>
                          </div>
                          <span className="font-mono font-bold text-teal-900">
                            {formatPaiseToRupees(tierPrice)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Guardrails Checklist */}
                <div className="border-t border-border/20 pt-4 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                    Validation Guardrails
                  </span>

                  <div className="flex items-center gap-2 text-xs">
                    {deadlineLeadValid ? (
                      <CheckIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangleIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    )}
                    <span className={deadlineLeadValid ? 'text-body' : 'text-amber-800'}>
                      Join deadline $\ge$ 24h before start
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {minParticipants <= maxParticipants ? (
                      <CheckIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangleIcon className="h-4 w-4 text-rose-500 flex-shrink-0" />
                    )}
                    <span>Min participants $\le$ Max participants</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {capacitySlots > 0 && maxParticipants <= capacitySlots ? (
                      <CheckIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangleIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    )}
                    <span>Max fits within window capacity</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Pre-Launch Confirmation Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-ink/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowReviewModal(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-border/40 bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/20 pb-3">
              <h3 className="text-base font-bold text-ink">Confirm Camp Publication</h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="rounded p-1 text-muted hover:text-ink"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="rounded-lg bg-canvas p-3 border border-border/20 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted">Target Society:</span>
                  <span className="font-bold text-ink">{selectedSociety?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Service:</span>
                  <span className="font-bold text-ink">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Camp Title:</span>
                  <span className="font-bold text-ink">{title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Service Window:</span>
                  <span className="font-mono text-ink">
                    {new Date(startsAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    • {capacitySlots} slots of {slotMinutes}m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Confirmation Min:</span>
                  <span className="font-bold text-ink">{minParticipants} homes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Vendor:</span>
                  <span className="font-semibold text-emerald-800">
                    {selectedVendor ? selectedVendor.full_name : 'Unassigned (can assign later)'}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <p className="font-bold">Immediate Resident Visibility</p>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  Publishing will immediately set this camp state to{' '}
                  <strong className="underline">Open</strong>. It will be live and bookable by all
                  residents of <strong className="underline">{selectedSociety?.name}</strong>.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-border/20 pt-4">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                disabled={submitting}
                className="rounded-lg border border-border/40 bg-surface px-4 py-2 text-xs font-semibold text-body hover:bg-canvas"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmLaunch()}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-accent-pressed disabled:opacity-50 active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <span className="spinner h-3.5 w-3.5" />
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
