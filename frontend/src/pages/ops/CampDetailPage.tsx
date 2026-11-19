import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  assignVendor,
  fetchVendors,
  getCampDetail,
  type CampDetail,
  type VendorReference,
} from '../../api/ops'
import { getCsrfToken } from '../../auth/api'
import {
  AlertTriangleIcon,
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  InfoIcon,
  PhoneIcon,
  TagIcon,
  UsersIcon,
  VendorIcon,
  XIcon,
} from '../../components/icons/Icons'
import { CampStatusBadge } from '../../components/ops/CampStatusBadge'
import { OpsLayout } from '../../components/ops/OpsLayout'
import {
  calculateDiscountedPricePaise,
  formatDateTime,
  formatPaiseToRupees,
  formatTimeOnly,
} from '../../utils/format'

const lifecycleStages = [
  { id: 'open', label: 'Open for Booking' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
] as const

export function CampDetailPage() {
  const { campId } = useParams<{ campId: string }>()
  const [camp, setCamp] = useState<CampDetail | null>(null)
  const [vendors, setVendors] = useState<VendorReference[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [loading, setLoading] = useState(true)
  const [assigningVendor, setAssigningVendor] = useState(false)
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'roster' | 'overview' | 'tiers'>('roster')

  useEffect(() => {
    async function loadData() {
      if (!campId) return
      setLoading(true)
      try {
        const [campData, vendorsList] = await Promise.all([
          getCampDetail(campId),
          fetchVendors(),
        ])
        setCamp(campData)
        setVendors(vendorsList)
        setSelectedVendorId(campData.vendor ? campData.vendor.id : '')
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load camp detail')
      } finally {
        setLoading(false)
      }
    }
    void loadData()
  }, [campId])

  useEffect(() => {
    if (!showVendorModal) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !assigningVendor) {
        setShowVendorModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showVendorModal, assigningVendor])

  async function handleAssignVendor(e: React.FormEvent) {
    e.preventDefault()
    if (!campId) return
    setAssigningVendor(true)
    setError(null)
    setNotice(null)
    try {
      const csrfToken = await getCsrfToken()
      const updated = await assignVendor(
        campId,
        selectedVendorId ? selectedVendorId : null,
        csrfToken,
      )
      setCamp(updated)
      setNotice(
        updated.vendor
          ? `Assigned partner vendor: ${updated.vendor.full_name}`
          : 'Partner vendor unassigned',
      )
      setShowVendorModal(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to assign vendor')
    } finally {
      setAssigningVendor(false)
    }
  }

  if (loading) {
    return (
      <OpsLayout
        breadcrumbs={[
          { label: 'Operations', to: '/ops' },
          { label: 'Camps', to: '/ops' },
          { label: 'Loading...' },
        ]}
      >
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-medium text-muted">
            <span
              aria-hidden="true"
              className="spinner !border-border !border-t-accent"
            />
            <span>Loading camp data & roster...</span>
          </div>
        </div>
      </OpsLayout>
    )
  }

  if (error && !camp) {
    return (
      <OpsLayout
        breadcrumbs={[
          { label: 'Operations', to: '/ops' },
          { label: 'Camps', to: '/ops' },
          { label: 'Error' },
        ]}
      >
        <div className="mx-auto mt-12 max-w-lg rounded-md border border-error/40 bg-red-50 p-6 text-center text-error">
          <p className="font-display text-base font-bold">Error Loading Camp</p>
          <p className="mt-1 text-sm">{error}</p>
          <Link
            to="/ops"
            className="mt-4 inline-block rounded-sm bg-error px-4 py-2 text-sm font-semibold text-on-accent"
          >
            Return to Dashboard
          </Link>
        </div>
      </OpsLayout>
    )
  }

  if (!camp) return null

  const activeCount = camp.participants.length
  const spotsRemaining = Math.max(0, camp.max_participants - activeCount)
  const capacityPercent = Math.min(
    100,
    Math.round((activeCount / camp.max_participants) * 100),
  )
  const currentStageIndex = lifecycleStages.findIndex((s) => s.id === camp.status)

  return (
    <OpsLayout
      breadcrumbs={[
        { label: 'Operations', to: '/ops' },
        { label: 'Camps', to: '/ops' },
        { label: camp.title },
      ]}
      title={camp.title}
      subtitle={`${camp.society.name} (${camp.society.city}) · ${camp.service.name}`}
      actions={
        <div className="flex items-center gap-2.5">
          <CampStatusBadge status={camp.status} />
          <button
            type="button"
            onClick={() => setShowVendorModal(true)}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-sm font-semibold text-ink shadow-card transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <VendorIcon className="h-4 w-4 text-muted" />
            <span>{camp.vendor ? 'Reassign Vendor' : 'Assign Vendor'}</span>
          </button>
        </div>
      }
    >
      {/* Feedback Notice / Error */}
      {notice ? (
        <div
          role="status"
          className="mb-6 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          <div className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
            className="rounded-sm p-1 text-emerald-700 hover:bg-emerald-100"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mb-6 rounded-md border border-error/40 bg-red-50 p-4 text-sm font-medium text-error"
        >
          {error}
        </div>
      ) : null}

      {/* Lifecycle Stepper or Cancelled State Banner */}
      {camp.status === 'cancelled' ? (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div>
            <p className="font-semibold">Camp Cancelled</p>
            {camp.cancelled_reason ? (
              <p className="mt-0.5 text-xs text-rose-800">{camp.cancelled_reason}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <ol
          aria-label="Camp lifecycle progress"
          className="mb-6 grid grid-cols-2 gap-2 rounded-md border border-border bg-surface p-3 sm:grid-cols-4"
        >
          {lifecycleStages.map((stage, idx) => {
            const isComplete = currentStageIndex > idx
            const isCurrent = currentStageIndex === idx
            return (
              <li
                key={stage.id}
                className={`flex items-center gap-2.5 rounded-sm px-3 py-2 text-xs ${
                  isCurrent
                    ? 'bg-accent-soft font-semibold text-accent-pressed'
                    : isComplete
                      ? 'bg-canvas font-medium text-ink'
                      : 'text-muted'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm font-mono text-xs font-semibold ${
                    isCurrent
                      ? 'bg-accent text-on-accent'
                      : isComplete
                        ? 'bg-emerald-600 text-on-accent'
                        : 'border border-border-strong bg-surface text-muted'
                  }`}
                >
                  {isComplete ? <CheckIcon className="h-3.5 w-3.5" /> : idx + 1}
                </span>
                <span className="truncate">{stage.label}</span>
              </li>
            )
          })}
        </ol>
      )}

      {/* Milestone Progression Banner */}
      {camp.pricing_quote.next_tier ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-teal-200 bg-accent-soft p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-accent font-mono text-sm font-bold text-on-accent">
              ↑
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                {camp.pricing_quote.next_tier.participants_needed} more neighbour
                {camp.pricing_quote.next_tier.participants_needed > 1 ? 's' : ''} needed to unlock{' '}
                <span className="text-accent-pressed">
                  {camp.pricing_quote.next_tier.discount_pct}% off
                </span>
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-body">
                Target: {camp.pricing_quote.next_tier.min_participants} homes · Next rate:{' '}
                {formatPaiseToRupees(camp.pricing_quote.next_tier.potential_price_paise)} / home
              </p>
            </div>
          </div>
          <div className="rounded-sm border border-teal-300 bg-surface px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-accent-pressed">
            Current Est: {formatPaiseToRupees(camp.pricing_quote.discounted_price_paise)} / home
          </div>
        </div>
      ) : camp.pricing_quote.discount_pct > 0 ? (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-teal-200 bg-accent-soft p-4 text-sm font-semibold text-accent-pressed">
          <CheckIcon className="h-4 w-4 shrink-0 text-accent" />
          <span>
            Maximum volume discount unlocked ({camp.pricing_quote.discount_pct}% off applies to all{' '}
            {activeCount} registered homes).
          </span>
        </div>
      ) : null}

      {/* Navigation Sub-Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-3" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'roster'}
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 rounded-sm px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            activeTab === 'roster'
              ? 'bg-ink text-surface shadow-card'
              : 'border border-border bg-surface text-body hover:bg-surface-subtle hover:text-ink'
          }`}
        >
          <UsersIcon className="h-4 w-4" />
          <span>Roster & Visits</span>
          <span
            className={`rounded-sm px-1.5 py-0.5 font-mono text-xs tabular-nums ${
              activeTab === 'roster' ? 'bg-surface/20 text-surface' : 'bg-canvas text-muted'
            }`}
          >
            {activeCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 rounded-sm px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            activeTab === 'overview'
              ? 'bg-ink text-surface shadow-card'
              : 'border border-border bg-surface text-body hover:bg-surface-subtle hover:text-ink'
          }`}
        >
          <CalendarIcon className="h-4 w-4" />
          <span>Overview & Schedule</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tiers'}
          onClick={() => setActiveTab('tiers')}
          className={`flex items-center gap-2 rounded-sm px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            activeTab === 'tiers'
              ? 'bg-ink text-surface shadow-card'
              : 'border border-border bg-surface text-body hover:bg-surface-subtle hover:text-ink'
          }`}
        >
          <TagIcon className="h-4 w-4" />
          <span>Group Tiers</span>
          <span
            className={`rounded-sm px-1.5 py-0.5 font-mono text-xs tabular-nums ${
              activeTab === 'tiers' ? 'bg-surface/20 text-surface' : 'bg-canvas text-muted'
            }`}
          >
            {camp.price_tiers.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Roster & Visits */}
      {activeTab === 'roster' && (
        <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-display text-base font-bold text-ink">
                Resident Bookings & Scheduled Slots
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Sequential visit times assigned in join order · {activeCount} of{' '}
                {camp.max_participants} slots filled
              </p>
            </div>
            <span className="rounded-sm border border-border bg-canvas px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-ink">
              {spotsRemaining > 0 ? `${spotsRemaining} spots left` : 'Capacity Full'}
            </span>
          </div>

          {camp.participants.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent">
                <UsersIcon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-display text-sm font-bold text-ink">
                No bookings enrolled yet
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
                Residents of {camp.society.name} will appear here as soon as they join this camp.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-subtle text-xs font-semibold uppercase tracking-wider text-muted">
                    <tr>
                      <th scope="col" className="px-5 py-3">
                        Scheduled Visit Time
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Unit
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Resident Name
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Order
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Quoted Price
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Status
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Contact
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-body">
                    {camp.participants.map((p, idx) => (
                      <tr key={p.booking_id} className="transition-colors hover:bg-canvas">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {p.slot_starts_at ? (
                            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums text-ink">
                              <ClockIcon className="h-3.5 w-3.5 text-accent" />
                              <span>{formatTimeOnly(p.slot_starts_at)}</span>
                            </div>
                          ) : (
                            <span className="rounded-sm border border-border bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
                              Pending confirmation
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs font-semibold text-ink">
                          {p.unit_label ?? '—'}
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-ink">
                          {p.full_name}
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs tabular-nums text-muted">
                          #{idx + 1}
                        </td>

                        <td className="px-5 py-3.5 text-right whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-ink">
                          {formatPaiseToRupees(p.quoted_price_paise)}
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                            {p.status}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <a
                            href={`tel:${p.phone}`}
                            className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2.5 py-1 font-mono text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                          >
                            <PhoneIcon className="h-3.5 w-3.5 text-muted" />
                            <span>{p.phone}</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards */}
              <div className="grid divide-y divide-border sm:hidden">
                {camp.participants.map((p, idx) => (
                  <div key={p.booking_id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-sm font-bold text-ink">
                          Unit {p.unit_label ?? '—'}
                        </span>
                        <span className="ml-2 font-mono text-xs tabular-nums text-muted">
                          #{idx + 1}
                        </span>
                        <p className="mt-0.5 text-sm font-medium text-body">{p.full_name}</p>
                      </div>
                      <a
                        href={`tel:${p.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent"
                      >
                        <PhoneIcon className="h-3.5 w-3.5" />
                        <span>Call</span>
                      </a>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                      <span className="font-mono text-muted">
                        Slot:{' '}
                        {p.slot_starts_at ? formatTimeOnly(p.slot_starts_at) : 'Pending'}
                      </span>
                      <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                        {formatPaiseToRupees(p.quoted_price_paise)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: Overview & Schedule */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {/* Capacity & Milestone Progress */}
            <div className="rounded-md border border-border bg-surface p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <h2 className="font-display text-base font-bold text-ink">
                  Capacity & Milestone Progress
                </h2>
                <span className="font-mono text-xs font-semibold tabular-nums text-ink">
                  {activeCount} of {camp.max_participants} homes ({capacityPercent}%)
                </span>
              </div>

              <div className="mt-5">
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-subtle">
                  <div
                    className={`h-full rounded-full transition-all duration-slow ${
                      activeCount >= camp.min_participants ? 'bg-accent' : 'bg-amber-500'
                    }`}
                    style={{ width: `${capacityPercent}%` }}
                  />
                  {camp.min_participants > 0 && camp.min_participants < camp.max_participants ? (
                    <div
                      className="absolute bottom-0 top-0 z-10 w-0.5 bg-ink"
                      style={{
                        left: `${(camp.min_participants / camp.max_participants) * 100}%`,
                      }}
                      title={`Minimum confirmation threshold: ${camp.min_participants} homes`}
                    />
                  ) : null}
                </div>

                {/* Non-overlapping Milestone Legend */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-canvas px-2 py-1 font-mono font-semibold tabular-nums text-ink">
                    <span aria-hidden="true" className="h-2.5 w-0.5 bg-ink" />
                    Min confirm: {camp.min_participants} homes
                  </span>
                  {camp.price_tiers.map((t, idx) => {
                    const reached = activeCount >= t.min_participants
                    return (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-mono font-semibold tabular-nums ${
                          reached
                            ? 'border-teal-200 bg-accent-soft text-accent-pressed'
                            : 'border-border bg-canvas text-muted'
                        }`}
                      >
                        {t.discount_pct}% at {t.min_participants}+
                      </span>
                    )
                  })}
                </div>
              </div>

              <dl className="mt-5 grid gap-4 border-t border-border pt-4 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted">Service Window</dt>
                  <dd className="mt-0.5 font-mono font-semibold tabular-nums text-ink">
                    {formatDateTime(camp.starts_at)} – {formatTimeOnly(camp.ends_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Slot Breakdown</dt>
                  <dd className="mt-0.5 font-mono font-semibold tabular-nums text-ink">
                    {camp.slot_minutes} mins per visit ({camp.capacity_slots} slots total)
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Join Deadline</dt>
                  <dd className="mt-0.5 font-mono font-semibold tabular-nums text-ink">
                    {formatDateTime(camp.join_deadline)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Confirmation Threshold</dt>
                  <dd className="mt-0.5 font-semibold">
                    {activeCount >= camp.min_participants ? (
                      <span className="text-success">
                        Met ({activeCount} ≥ {camp.min_participants} homes)
                      </span>
                    ) : (
                      <span className="text-warning">
                        Needs {camp.min_participants - activeCount} more homes to confirm
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Society Context Card */}
            <div className="rounded-md border border-border bg-surface p-6 shadow-card">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <BuildingIcon className="h-4 w-4 text-accent" />
                <h2 className="font-display text-base font-bold text-ink">
                  Society & Community Details
                </h2>
              </div>
              <dl className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted">Society Name</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">{camp.society.name}</dd>
                </div>
                <div>
                  <dt className="text-muted">City</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink">{camp.society.city}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted">Address</dt>
                  <dd className="mt-0.5 text-sm text-body">{camp.society.address}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-4">
            {/* Assigned Partner Vendor */}
            <div className="space-y-3 rounded-md border border-border bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <VendorIcon className="h-4 w-4 text-accent" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
                    Partner Vendor
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVendorModal(true)}
                  className="text-xs font-semibold text-accent hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                >
                  Change
                </button>
              </div>

              {camp.vendor ? (
                <div className="rounded-sm border border-teal-200 bg-accent-soft p-3.5 text-xs">
                  <span className="font-semibold text-accent-pressed">Assigned Partner</span>
                  <p className="mt-1 text-sm font-bold text-ink">{camp.vendor.full_name}</p>
                  <p className="mt-0.5 font-mono text-xs text-body">{camp.vendor.phone}</p>
                </div>
              ) : (
                <div className="rounded-sm border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                  <p className="font-semibold">No Vendor Assigned</p>
                  <p className="mt-1 leading-relaxed">
                    Camp cannot confirm until an active technician partner is assigned.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowVendorModal(true)}
                    className="mt-3 rounded-sm bg-amber-800 px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                  >
                    Assign Vendor Now
                  </button>
                </div>
              )}
            </div>

            {/* Lifecycle Controls */}
            <div className="space-y-3 rounded-md border border-border bg-surface p-5 shadow-card">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted">
                Camp Transitions
              </h3>
              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-sm border border-border bg-canvas py-2 text-xs font-semibold text-muted opacity-70"
              >
                Confirm Camp & Lock Price
              </button>
              <div className="flex items-start gap-2 text-xs text-muted">
                <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Scheduled for Phase 4d (validates minimum headcount and assigned vendor).
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Group Volume Discount Tiers */}
      {activeTab === 'tiers' && (
        <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-bold text-ink">
              Volume Discount Pricing Schedule
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Base Price:{' '}
              <strong className="font-mono tabular-nums text-ink">
                {formatPaiseToRupees(camp.base_price_paise)}
              </strong>{' '}
              per home
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-subtle text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    Tier Milestone
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Threshold
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Discount %
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Effective Price
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Savings / Home
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-body">
                {camp.price_tiers.map((tier, idx) => {
                  const isActiveTier =
                    camp.pricing_quote.discount_pct === tier.discount_pct &&
                    camp.pricing_quote.headcount >= tier.min_participants
                  const isUnlocked = camp.pricing_quote.headcount >= tier.min_participants
                  const pricePaise = calculateDiscountedPricePaise(
                    camp.base_price_paise,
                    tier.discount_pct,
                  )
                  const savingsPaise = camp.base_price_paise - pricePaise

                  return (
                    <tr
                      key={idx}
                      className={isActiveTier ? 'bg-accent-soft font-semibold' : 'hover:bg-canvas'}
                    >
                      <td className="px-5 py-3.5 text-ink">Tier {idx + 1}</td>
                      <td className="px-5 py-3.5 font-mono text-xs tabular-nums">
                        {tier.min_participants}+ homes
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold tabular-nums text-accent">
                        {tier.discount_pct}% off
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums text-ink">
                        {formatPaiseToRupees(pricePaise)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-muted">
                        {formatPaiseToRupees(savingsPaise)}
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {isActiveTier ? (
                          <span className="rounded-sm bg-accent px-2 py-0.5 font-semibold text-on-accent">
                            Current Active Tier
                          </span>
                        ) : isUnlocked ? (
                          <span className="font-semibold text-success">Unlocked</span>
                        ) : (
                          <span className="text-muted">
                            Needs {tier.min_participants - camp.pricing_quote.headcount} more
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vendor Assignment Modal */}
      {showVendorModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vendor-modal-title"
        >
          <div
            className="fixed inset-0 bg-ink/50 backdrop-blur-sm transition-opacity"
            onClick={() => {
              if (!assigningVendor) setShowVendorModal(false)
            }}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md rounded-md border border-border bg-surface p-6 shadow-modal">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id="vendor-modal-title" className="font-display text-base font-bold text-ink">
                Assign Partner Vendor
              </h3>
              <button
                type="button"
                onClick={() => setShowVendorModal(false)}
                disabled={assigningVendor}
                aria-label="Close vendor dialog"
                className="rounded-sm p-1 text-muted transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssignVendor} className="mt-4 space-y-4">
              <div className="rounded-sm border border-border bg-canvas p-3 text-xs text-body">
                {activeCount} registered home{activeCount === 1 ? '' : 's'} across{' '}
                {camp.slot_minutes}-minute slots will be served by the selected partner.
              </div>

              <div>
                <label
                  htmlFor="assign-vendor-select"
                  className="mb-1.5 block text-sm font-semibold text-ink"
                >
                  Select Partner Vendor
                </label>
                <select
                  id="assign-vendor-select"
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                >
                  <option value="">Leave unassigned</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.full_name} ({v.phone})
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-muted">
                  The assigned vendor is responsible for completing all visits during the window.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowVendorModal(false)}
                  disabled={assigningVendor}
                  className="rounded-sm border border-border-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningVendor}
                  className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-card transition-colors hover:bg-accent-pressed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {assigningVendor ? 'Updating...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </OpsLayout>
  )
}
