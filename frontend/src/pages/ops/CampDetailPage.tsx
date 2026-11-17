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
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  PhoneIcon,
  TagIcon,
  UsersIcon,
  VendorIcon,
  XIcon,
} from '../../components/icons/Icons'
import { CampStatusBadge } from '../../components/ops/CampStatusBadge'
import { OpsLayout } from '../../components/ops/OpsLayout'

function formatDateTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

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

  // Primary Tabs State
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
      setNotice('Partner vendor updated successfully')
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
        breadcrumbs={[{ label: 'Operations', to: '/ops' }, { label: 'Camps', to: '/ops' }, { label: 'Loading...' }]}
      >
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted">
            <span className="spinner h-4 w-4" />
            <span>Loading camp data & roster...</span>
          </div>
        </div>
      </OpsLayout>
    )
  }

  if (error && !camp) {
    return (
      <OpsLayout
        breadcrumbs={[{ label: 'Operations', to: '/ops' }, { label: 'Camps', to: '/ops' }, { label: 'Error' }]}
      >
        <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
          <p className="font-bold">Error Loading Camp</p>
          <p className="mt-1 text-xs text-red-700">{error}</p>
          <Link
            to="/ops"
            className="mt-4 inline-block rounded-lg bg-red-800 px-4 py-2 text-xs font-semibold text-white"
          >
            ← Return to Dashboard
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

  return (
    <OpsLayout
      breadcrumbs={[
        { label: 'Operations', to: '/ops' },
        { label: 'Camps', to: '/ops' },
        { label: camp.title },
      ]}
      title={camp.title}
      subtitle={`${camp.society.name} (${camp.society.city}) • ${camp.service.name}`}
      actions={
        <div className="flex items-center gap-2.5">
          <CampStatusBadge status={camp.status} />
          <button
            type="button"
            onClick={() => setShowVendorModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-xs transition hover:bg-canvas active:scale-[0.98]"
          >
            <VendorIcon className="h-3.5 w-3.5 text-muted" />
            <span>{camp.vendor ? 'Reassign Vendor' : 'Assign Vendor'}</span>
          </button>
        </div>
      }
    >
      {/* Toast Notice */}
      {notice ? (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      {/* Top Milestone Progression Banner */}
      {camp.pricing_quote.next_tier ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50/70 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-bold text-sm">
              ↑
            </div>
            <div>
              <p className="text-xs font-bold text-teal-950 sm:text-sm">
                {camp.pricing_quote.next_tier.participants_needed} more neighbour
                {camp.pricing_quote.next_tier.participants_needed > 1 ? 's' : ''} needed to unlock{' '}
                <span className="text-accent font-extrabold">
                  {camp.pricing_quote.next_tier.discount_pct}% off
                </span>
              </p>
              <p className="text-[11px] text-teal-800 font-mono">
                Target: {camp.pricing_quote.next_tier.min_participants} homes • Next price:{' '}
                {formatPaise(camp.pricing_quote.next_tier.potential_price_paise)} / home
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-teal-300 bg-surface px-3 py-1.5 text-xs font-mono font-bold text-teal-900 shadow-xs">
            Current Est: {formatPaise(camp.pricing_quote.discounted_price_paise)} / home
          </div>
        </div>
      ) : camp.pricing_quote.discount_pct > 0 ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4 text-xs font-bold text-purple-900">
          <CheckIcon className="h-4 w-4 text-purple-700 flex-shrink-0" />
          <span>
            Maximum group volume discount unlocked ({camp.pricing_quote.discount_pct}% off applies to all{' '}
            {activeCount} registered homes).
          </span>
        </div>
      ) : null}

      {/* Navigation Sub-Tabs */}
      <div className="mb-6 flex items-center gap-2 border-b border-border/30 pb-3" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'roster'}
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
            activeTab === 'roster'
              ? 'bg-ink text-white shadow-xs'
              : 'bg-surface text-muted hover:bg-canvas hover:text-ink border border-border/30'
          }`}
        >
          <UsersIcon className="h-3.5 w-3.5" />
          <span>Roster & Visits</span>
          <span
            className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] tabular-nums ${
              activeTab === 'roster' ? 'bg-white/20 text-white' : 'bg-canvas text-muted'
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
          className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
            activeTab === 'overview'
              ? 'bg-ink text-white shadow-xs'
              : 'bg-surface text-muted hover:bg-canvas hover:text-ink border border-border/30'
          }`}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span>Overview & Schedule</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tiers'}
          onClick={() => setActiveTab('tiers')}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
            activeTab === 'tiers'
              ? 'bg-ink text-white shadow-xs'
              : 'bg-surface text-muted hover:bg-canvas hover:text-ink border border-border/30'
          }`}
        >
          <TagIcon className="h-3.5 w-3.5" />
          <span>Group Tiers</span>
          <span
            className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] tabular-nums ${
              activeTab === 'tiers' ? 'bg-white/20 text-white' : 'bg-canvas text-muted'
            }`}
          >
            {camp.price_tiers.length}
          </span>
        </button>
      </div>

      {/* TAB CONTENT 1: Roster & Visits */}
      {activeTab === 'roster' && (
        <div className="rounded-xl border border-border/30 bg-surface shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/20 px-6 py-4">
            <div>
              <h2 className="text-sm font-bold text-ink">Resident Bookings & Scheduled Slots</h2>
              <p className="text-xs text-muted">
                Sequential visit times scheduled in join order • {activeCount} of {camp.max_participants} slots filled
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-canvas px-2.5 py-1 font-mono text-xs font-bold text-body border border-border/30">
                {spotsRemaining > 0 ? `${spotsRemaining} spots left` : 'Capacity Full'}
              </span>
            </div>
          </div>

          {camp.participants.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                <UsersIcon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-xs font-bold text-ink">No bookings enrolled yet</h3>
              <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
                Residents of {camp.society.name} will appear here as soon as they join this camp through their portal.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/30 bg-canvas/70 text-[11px] font-bold uppercase tracking-wider text-muted">
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
                        Enrolled Order
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Quoted Price
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Booking Status
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Contact
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 text-body">
                    {camp.participants.map((p, idx) => (
                      <tr key={p.booking_id} className="transition-colors hover:bg-canvas/50">
                        {/* Visit Time */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {p.slot_starts_at ? (
                            <div className="flex items-center gap-1.5 font-mono font-bold text-ink">
                              <ClockIcon className="h-3.5 w-3.5 text-accent" />
                              <span>
                                {new Date(p.slot_starts_at).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="rounded bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted border border-border/20 italic">
                              Pending confirmation
                            </span>
                          )}
                        </td>

                        {/* Unit */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-ink">
                            {p.unit_label ?? '—'}
                          </span>
                        </td>

                        {/* Resident */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-semibold text-ink">{p.full_name}</span>
                        </td>

                        {/* Join Order */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-muted font-mono">
                          #{idx + 1}
                        </td>

                        {/* Quoted Price */}
                        <td className="px-5 py-3.5 whitespace-nowrap font-mono font-bold text-ink">
                          {formatPaise(p.quoted_price_paise)}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200">
                            {p.status}
                          </span>
                        </td>

                        {/* Tap to Call */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          <a
                            href={`tel:${p.phone}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-xs transition hover:bg-canvas hover:text-accent"
                          >
                            <PhoneIcon className="h-3 w-3 text-muted" />
                            <span>{p.phone}</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards */}
              <div className="grid divide-y divide-border/20 sm:hidden">
                {camp.participants.map((p, idx) => (
                  <div key={p.booking_id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono font-bold text-sm text-ink">
                          Unit {p.unit_label ?? '—'}
                        </span>
                        <span className="ml-2 text-[11px] text-muted font-mono">
                          Join #{idx + 1}
                        </span>
                        <p className="text-xs font-medium text-body mt-0.5">{p.full_name}</p>
                      </div>
                      <a
                        href={`tel:${p.phone}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-white shadow-xs"
                      >
                        <PhoneIcon className="h-3 w-3" />
                        <span>Call</span>
                      </a>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/10 pt-2 text-xs">
                      <span className="font-mono text-muted text-[11px]">
                        Slot:{' '}
                        {p.slot_starts_at
                          ? new Date(p.slot_starts_at).toLocaleTimeString('en-IN', {
                              timeStyle: 'short',
                            })
                          : 'Pending confirmation'}
                      </span>
                      <span className="font-mono font-bold text-ink">
                        {formatPaise(p.quoted_price_paise)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: Overview & Schedule */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Main Overview Column (8 cols) */}
          <div className="space-y-6 lg:col-span-8">
            {/* Unified Multi-Milestone Capacity Progress Meter */}
            <div className="rounded-xl border border-border/30 bg-surface p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/20 pb-3">
                <h3 className="text-sm font-bold text-ink">Capacity & Milestone Progress</h3>
                <span className="font-mono text-xs font-bold text-ink">
                  {activeCount} of {camp.max_participants} homes ({capacityPercent}%)
                </span>
              </div>

              {/* Progress track with milestones */}
              <div className="relative mt-8 mb-10">
                <div className="h-3 w-full rounded-full bg-border/20 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      activeCount >= camp.min_participants ? 'bg-accent' : 'bg-amber-500'
                    }`}
                    style={{ width: `${capacityPercent}%` }}
                  />
                </div>

                {/* Min Confirmation Notch */}
                {camp.min_participants > 0 && camp.min_participants < camp.max_participants ? (
                  <div
                    className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                    style={{ left: `${(camp.min_participants / camp.max_participants) * 100}%` }}
                  >
                    <div className="h-5 w-0.5 bg-ink" />
                    <span className="mt-1 font-mono text-[10px] font-bold text-ink whitespace-nowrap">
                      Min ({camp.min_participants})
                    </span>
                  </div>
                ) : null}

                {/* Tier Milestone Notches */}
                {camp.price_tiers.map((t, idx) => {
                  if (t.min_participants >= camp.max_participants) return null
                  const leftPct = (t.min_participants / camp.max_participants) * 100
                  return (
                    <div
                      key={idx}
                      className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                      style={{ left: `${leftPct}%` }}
                    >
                      <div className="h-3 w-0.5 bg-accent" />
                      <span className="mt-1 font-mono text-[9px] text-muted whitespace-nowrap">
                        {t.discount_pct}% ({t.min_participants})
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 border-t border-border/20 pt-4 text-xs">
                <div>
                  <span className="text-muted block">Service Window:</span>
                  <span className="font-mono font-semibold text-ink">
                    {formatDateTime(camp.starts_at)} –{' '}
                    {new Date(camp.ends_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Slot Breakdown:</span>
                  <span className="font-mono font-semibold text-ink">
                    {camp.slot_minutes} mins per visit ({camp.capacity_slots} slots total)
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Join Deadline:</span>
                  <span className="font-mono font-semibold text-ink">
                    {formatDateTime(camp.join_deadline)}
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Confirmation Threshold:</span>
                  <span className="font-semibold text-ink">
                    {activeCount >= camp.min_participants ? (
                      <span className="text-emerald-700 font-bold">
                        ✓ Met ({activeCount} ≥ {camp.min_participants} homes)
                      </span>
                    ) : (
                      <span className="text-amber-700 font-bold">
                        Needs {camp.min_participants - activeCount} more homes to confirm
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Society Context Card */}
            <div className="rounded-xl border border-border/30 bg-surface p-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/20 pb-3">
                <BuildingIcon className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-bold text-ink">Society & Community Details</h3>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
                <div>
                  <span className="text-muted block">Society Name:</span>
                  <span className="font-bold text-ink">{camp.society.name}</span>
                </div>
                <div>
                  <span className="text-muted block">City:</span>
                  <span className="font-bold text-ink">{camp.society.city}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted block">Address:</span>
                  <span className="text-body">{camp.society.address}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Vendor & Operational Actions (4 cols) */}
          <div className="space-y-6 lg:col-span-4">
            {/* Assigned Partner Vendor Card */}
            <div className="rounded-xl border border-border/30 bg-surface p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border/20 pb-3">
                <div className="flex items-center gap-2">
                  <VendorIcon className="h-4 w-4 text-accent" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                    Partner Vendor
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVendorModal(true)}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Change
                </button>
              </div>

              {camp.vendor ? (
                <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3 text-xs">
                  <span className="text-[11px] font-semibold text-teal-800">Assigned Partner</span>
                  <p className="mt-0.5 font-bold text-ink text-sm">{camp.vendor.full_name}</p>
                  <p className="font-mono text-muted text-[11px]">{camp.vendor.phone}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-bold">No Vendor Assigned</p>
                  <p className="mt-0.5 text-[11px]">
                    Camp cannot be confirmed until an active technician partner is assigned.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowVendorModal(true)}
                    className="mt-2.5 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-900"
                  >
                    Assign Vendor Now
                  </button>
                </div>
              )}
            </div>

            {/* Lifecycle Controls (Phase 4d integration) */}
            <div className="rounded-xl border border-border/30 bg-surface p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Camp Transitions
              </h3>
              <div className="space-y-2">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-lg border border-border/40 bg-canvas py-2 text-xs font-semibold text-muted opacity-60 cursor-not-allowed"
                >
                  Confirm Camp & Lock Price
                </button>
                <p className="text-[10px] text-muted text-center leading-tight">
                  Scheduled for Phase 4d (validates min headcount + assigned vendor)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: Group Volume Discount Tiers */}
      {activeTab === 'tiers' && (
        <div className="rounded-xl border border-border/30 bg-surface shadow-sm overflow-hidden">
          <div className="border-b border-border/20 px-6 py-4">
            <h2 className="text-sm font-bold text-ink">Volume Discount Pricing Schedule</h2>
            <p className="text-xs text-muted">
              Base Price: <strong className="font-mono text-ink">{formatPaise(camp.base_price_paise)}</strong> per home
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/30 bg-canvas/70 text-[11px] font-bold uppercase tracking-wider text-muted">
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
                  <th scope="col" className="px-5 py-3">
                    Effective Price
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Savings per Home
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-body">
                {camp.price_tiers.map((tier, idx) => {
                  const isActiveTier =
                    camp.pricing_quote.discount_pct === tier.discount_pct &&
                    camp.pricing_quote.headcount >= tier.min_participants
                  const isUnlocked = camp.pricing_quote.headcount >= tier.min_participants
                  const pricePaise = Math.round(
                    camp.base_price_paise * ((100 - tier.discount_pct) / 100),
                  )
                  const savingsPaise = camp.base_price_paise - pricePaise

                  return (
                    <tr
                      key={idx}
                      className={isActiveTier ? 'bg-teal-50/70 font-semibold' : ''}
                    >
                      <td className="px-5 py-3.5">Tier {idx + 1}</td>
                      <td className="px-5 py-3.5 font-mono">{tier.min_participants}+ homes</td>
                      <td className="px-5 py-3.5 font-mono font-bold text-accent">
                        {tier.discount_pct}% off
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-ink">
                        {formatPaise(pricePaise)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-muted">
                        {formatPaise(savingsPaise)}
                      </td>
                      <td className="px-5 py-3.5">
                        {isActiveTier ? (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                            Current Active Tier
                          </span>
                        ) : isUnlocked ? (
                          <span className="text-emerald-700 font-semibold">✓ Unlocked</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-ink/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowVendorModal(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border/40 bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/20 pb-3">
              <h3 className="text-sm font-bold text-ink">Assign Partner Vendor</h3>
              <button
                type="button"
                onClick={() => setShowVendorModal(false)}
                className="rounded p-1 text-muted hover:text-ink"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssignVendor} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-body mb-1">
                  Select Partner Vendor
                </label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="w-full rounded-lg border border-border/40 bg-canvas px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">Leave unassigned</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.full_name} ({v.phone})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted">
                  The assigned vendor is responsible for completing all visits during the window.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border/20 pt-4">
                <button
                  type="button"
                  onClick={() => setShowVendorModal(false)}
                  disabled={assigningVendor}
                  className="rounded-lg border border-border/40 bg-surface px-3 py-1.5 text-xs font-semibold text-body hover:bg-canvas"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningVendor}
                  className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-accent-pressed disabled:opacity-50 active:scale-[0.98]"
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
