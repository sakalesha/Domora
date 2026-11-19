import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  fetchSocieties,
  fetchVendors,
  listCamps,
  type CampListItem,
  type SocietyReference,
  type VendorReference,
} from '../../api/ops'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BuildingIcon,
  CalendarIcon,
  CampIcon,
  ClockIcon,
  GridIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  TableIcon,
  UsersIcon,
  VendorIcon,
  XIcon,
} from '../../components/icons/Icons'
import { CampStatusBadge, RiskBadge } from '../../components/ops/CampStatusBadge'
import { OpsLayout } from '../../components/ops/OpsLayout'
import {
  formatDateOnly,
  formatDateTime,
  formatPaiseToRupees,
} from '../../utils/format'

interface CampRiskInfo {
  level: 'critical' | 'warning'
  message: string
  sortWeight: number
}

function getCampRisk(camp: CampListItem): CampRiskInfo | null {
  if (camp.status !== 'open') return null

  const nowMs = Date.now()
  const deadlineMs = new Date(camp.join_deadline).getTime()
  const hoursUntilDeadline = (deadlineMs - nowMs) / (1000 * 60 * 60)
  const isUnderMin = camp.active_participants_count < camp.min_participants
  const shortfall = camp.min_participants - camp.active_participants_count

  if (hoursUntilDeadline > 0 && hoursUntilDeadline <= 24 && isUnderMin) {
    const hoursLeft = Math.max(1, Math.round(hoursUntilDeadline))
    return {
      level: 'critical',
      message: `Closes in ${hoursLeft}h · Needs ${shortfall} more`,
      sortWeight: 2,
    }
  }

  if ((hoursUntilDeadline > 0 && hoursUntilDeadline <= 72 && isUnderMin) || !camp.vendor) {
    let reason = ''
    if (isUnderMin && !camp.vendor) {
      reason = `Needs ${shortfall} more · No vendor`
    } else if (isUnderMin) {
      reason = `Needs ${shortfall} more homes`
    } else {
      reason = 'No vendor assigned'
    }
    return {
      level: 'warning',
      message: reason,
      sortWeight: 1,
    }
  }

  return null
}

const statusTabs = [
  { id: 'all', label: 'All Camps' },
  { id: 'open', label: 'Open' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
] as const

const validStatuses = new Set<string>(statusTabs.map((t) => t.id))

export function OpsDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [camps, setCamps] = useState<CampListItem[]>([])
  const [societies, setSocieties] = useState<SocietyReference[]>([])
  const [vendors, setVendors] = useState<VendorReference[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const rawStatus = searchParams.get('status') ?? 'all'
  const activeTab = validStatuses.has(rawStatus) ? rawStatus : 'all'
  const selectedSocietyId = searchParams.get('society') ?? 'all'
  const searchQuery = searchParams.get('q') ?? ''
  const viewMode = searchParams.get('view') === 'cards' ? 'cards' : 'table'
  const directoryTab = searchParams.get('tab')

  function updateFilters(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === 'all' || (key === 'view' && value === 'table')) {
        next.delete(key)
      } else {
        next.set(key, value)
      }
    }
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    let cancelled = false

    Promise.all([
      listCamps(),
      fetchSocieties().catch(() => [] as SocietyReference[]),
      fetchVendors().catch(() => [] as VendorReference[]),
    ])
      .then(([campsData, societiesData, vendorsData]) => {
        if (!cancelled) {
          setCamps(campsData)
          setSocieties(societiesData)
          setVendors(vendorsData)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load camps')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  function handleRetry() {
    setLoading(true)
    setError(null)
    Promise.all([
      listCamps(),
      fetchSocieties().catch(() => [] as SocietyReference[]),
      fetchVendors().catch(() => [] as VendorReference[]),
    ])
      .then(([campsData, societiesData, vendorsData]) => {
        setCamps(campsData)
        setSocieties(societiesData)
        setVendors(vendorsData)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load camps')
        setLoading(false)
      })
  }

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: camps.length }
    for (const c of camps) {
      counts[c.status] = (counts[c.status] ?? 0) + 1
    }
    return counts
  }, [camps])

  const atRiskCount = useMemo(() => {
    return camps.filter((c) => getCampRisk(c) !== null).length
  }, [camps])

  const metrics = useMemo(() => {
    const active = camps.filter(
      (c) => c.status === 'open' || c.status === 'confirmed' || c.status === 'in_progress',
    ).length
    const totalBookings = camps.reduce((sum, c) => sum + c.active_participants_count, 0)
    const activeSocieties = new Set(camps.map((c) => c.society.id)).size
    return {
      activeCamps: active,
      attentionNeeded: atRiskCount,
      totalBookings,
      activeSocieties,
    }
  }, [camps, atRiskCount])

  const vendorCampCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const camp of camps) {
      if (camp.vendor) {
        map.set(camp.vendor.id, (map.get(camp.vendor.id) ?? 0) + 1)
      }
    }
    return map
  }, [camps])

  const societyCampCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const camp of camps) {
      map.set(camp.society.id, (map.get(camp.society.id) ?? 0) + 1)
    }
    return map
  }, [camps])

  const filteredCamps = useMemo(() => {
    return camps
      .filter((camp) => {
        if (activeTab !== 'all' && camp.status !== activeTab) return false
        if (selectedSocietyId !== 'all' && camp.society.id !== selectedSocietyId) return false
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase()
          const matchTitle = camp.title.toLowerCase().includes(query)
          const matchSociety = camp.society.name.toLowerCase().includes(query)
          const matchCity = camp.society.city.toLowerCase().includes(query)
          const matchService = camp.service.name.toLowerCase().includes(query)
          if (!matchTitle && !matchSociety && !matchCity && !matchService) return false
        }
        return true
      })
      .sort((a, b) => {
        const riskA = getCampRisk(a)?.sortWeight ?? 0
        const riskB = getCampRisk(b)?.sortWeight ?? 0
        if (riskA !== riskB) return riskB - riskA
        return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      })
  }, [camps, activeTab, selectedSocietyId, searchQuery])

  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedSocietyId !== 'all' || activeTab !== 'all'

  const pageTitle =
    directoryTab === 'vendors'
      ? 'Partner Vendors'
      : directoryTab === 'societies'
        ? 'Societies & Invite Codes'
        : 'Operations Dashboard'

  const pageSubtitle =
    directoryTab === 'vendors'
      ? 'Verified technician partners available for society service camps'
      : directoryTab === 'societies'
        ? 'Registered residential apartment societies and resident invite codes'
        : 'Camp capacity planning, booking velocity, and service delivery triage'

  return (
    <OpsLayout
      breadcrumbs={[
        { label: 'Operations', to: '/ops' },
        { label: pageTitle },
      ]}
      title={pageTitle}
      subtitle={pageSubtitle}
      attentionCount={atRiskCount}
    >
      {/* 1. Operational KPI Metric Strip */}
      <section aria-label="Operations summary" className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-md border border-border bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Camps</span>
            <CampIcon className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tracking-tight text-ink tabular-nums">
              {metrics.activeCamps}
            </span>
            <span className="text-xs text-muted">live in field</span>
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Needs Action</span>
            <AlertTriangleIcon
              className={`h-4 w-4 ${metrics.attentionNeeded > 0 ? 'text-warning' : 'text-muted'}`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`font-mono text-2xl font-semibold tracking-tight tabular-nums ${
                metrics.attentionNeeded > 0 ? 'text-error' : 'text-ink'
              }`}
            >
              {metrics.attentionNeeded}
            </span>
            <span className="text-xs text-muted">
              {metrics.attentionNeeded > 0 ? 'urgent triage' : 'all clear'}
            </span>
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Bookings</span>
            <UsersIcon className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tracking-tight text-ink tabular-nums">
              {metrics.totalBookings}
            </span>
            <span className="text-xs text-muted">enrolled homes</span>
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Societies</span>
            <BuildingIcon className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tracking-tight text-ink tabular-nums">
              {metrics.activeSocieties}
            </span>
            <span className="text-xs text-muted">communities</span>
          </div>
        </div>
      </section>

      {/* Directory Reference Views (?tab=vendors or ?tab=societies) */}
      {directoryTab === 'vendors' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/ops"
              className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ArrowLeftIcon className="h-4 w-4 text-muted" />
              <span>Back to All Camps</span>
            </Link>
            <span className="font-mono text-xs font-semibold tabular-nums text-muted">
              {vendors.length} verified partner{vendors.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted">Loading partner vendors...</div>
            ) : vendors.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted">
                No partner vendors registered yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-subtle text-xs font-semibold uppercase tracking-wider text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Partner Vendor
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Phone
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Assigned Camps
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Contact
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-body">
                    {vendors.map((vendor) => (
                      <tr key={vendor.id} className="transition-colors hover:bg-canvas">
                        <td className="px-4 py-3 font-semibold text-ink">
                          <div className="flex items-center gap-2.5">
                            <VendorIcon className="h-4 w-4 text-accent" />
                            <span>{vendor.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs tabular-nums text-body">
                          {vendor.phone}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-ink">
                          {vendorCampCounts.get(vendor.id) ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`tel:${vendor.phone}`}
                            className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                          >
                            <PhoneIcon className="h-3.5 w-3.5 text-muted" />
                            <span>Call</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : directoryTab === 'societies' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/ops"
              className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ArrowLeftIcon className="h-4 w-4 text-muted" />
              <span>Back to All Camps</span>
            </Link>
            <span className="font-mono text-xs font-semibold tabular-nums text-muted">
              {societies.length} active societ{societies.length === 1 ? 'y' : 'ies'}
            </span>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted">Loading societies...</div>
            ) : societies.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted">
                No apartment societies found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-subtle text-xs font-semibold uppercase tracking-wider text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Society & Address
                      </th>
                      <th scope="col" className="px-4 py-3">
                        City
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Resident Invite Code
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Camps
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-body">
                    {societies.map((society) => (
                      <tr key={society.id} className="transition-colors hover:bg-canvas">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink">{society.name}</div>
                          <div className="text-xs text-muted">{society.address}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-body">
                          {society.city}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <code className="rounded-sm border border-border bg-canvas px-2 py-0.5 font-mono text-xs font-semibold text-accent">
                            {society.invite_code}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-ink">
                          {societyCampCounts.get(society.id) ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Link
                            to={`/ops?society=${encodeURIComponent(society.id)}`}
                            className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                          >
                            <span>View Camps</span>
                            <ArrowRightIcon className="h-3.5 w-3.5 text-muted" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : (
        <>
          {/* 2. Status Filter Tabs & View Mode Switcher */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Camp status filter">
              {statusTabs.map((tab) => {
                const count = tabCounts[tab.id] ?? 0
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => updateFilters({ status: tab.id })}
                    className={`inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      isActive
                        ? 'bg-ink text-surface shadow-card'
                        : 'border border-border bg-surface text-body hover:bg-surface-subtle hover:text-ink'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-sm px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                        isActive
                          ? 'bg-surface/20 text-surface'
                          : 'bg-canvas text-muted'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="hidden items-center rounded-sm border border-border bg-surface p-0.5 shadow-card md:flex">
              <button
                type="button"
                onClick={() => updateFilters({ view: 'table' })}
                title="Dense Table View"
                aria-label="Dense Table View"
                aria-pressed={viewMode === 'table'}
                className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  viewMode === 'table'
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => updateFilters({ view: 'cards' })}
                title="Card Grid View"
                aria-label="Card Grid View"
                aria-pressed={viewMode === 'cards'}
                className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  viewMode === 'cards'
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <GridIcon className="h-3.5 w-3.5" />
                <span>Cards</span>
              </button>
            </div>
          </div>

          {/* 3. Search and Society Dropdown Filter Bar */}
          <div className="mb-6 grid gap-3 sm:grid-cols-12">
            <div className="relative sm:col-span-8">
              <label className="sr-only" htmlFor="camp-search">
                Search camps
              </label>
              <SearchIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                id="camp-search"
                type="text"
                value={searchQuery}
                onChange={(e) => updateFilters({ q: e.target.value })}
                placeholder="Search by camp title, society name, city, or service..."
                className="w-full rounded-sm border border-border-strong bg-surface py-2 pl-9 pr-9 text-sm text-ink placeholder:text-muted/80 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => updateFilters({ q: null })}
                  className="absolute right-2.5 top-2 rounded-sm p-0.5 text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Clear search"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="sm:col-span-4">
              <label className="sr-only" htmlFor="society-filter">
                Filter by society
              </label>
              <select
                id="society-filter"
                value={selectedSocietyId}
                onChange={(e) => updateFilters({ society: e.target.value })}
                className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
              >
                <option value="all">All Societies ({societies.length})</option>
                {societies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Main Camp Triage Surface */}
          {loading ? (
            <div className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="divide-y divide-border">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-4 px-4 py-4">
                    <div className="space-y-2">
                      <div className="h-4 w-56 rounded-sm bg-surface-subtle" />
                      <div className="h-3 w-40 rounded-sm bg-canvas" />
                    </div>
                    <div className="h-4 w-24 rounded-sm bg-surface-subtle" />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="rounded-md border border-error/40 bg-red-50 p-6 text-center text-error">
              <p className="font-display text-base font-bold">
                Failed to load camp operations data
              </p>
              <p className="mt-1 text-sm">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-4 rounded-sm bg-error px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
              >
                Retry Connection
              </button>
            </div>
          ) : filteredCamps.length === 0 ? (
            <div className="rounded-md border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-accent-soft text-accent">
                <CampIcon className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-base font-bold text-ink">
                No matching camps found
              </h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                {hasActiveFilters
                  ? 'Try adjusting your search criteria or clearing filters to locate camps.'
                  : 'Get started by creating your first group-buying service camp for an apartment society.'}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={() =>
                      updateFilters({ q: null, society: null, status: null })
                    }
                    className="rounded-sm border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Clear All Filters
                  </button>
                ) : (
                  <Link
                    to="/ops/camps/new"
                    className="inline-flex items-center gap-1.5 rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Create First Camp</span>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <>
              {viewMode === 'table' ? (
                <div className="hidden overflow-hidden rounded-md border border-border bg-surface shadow-card md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-surface-subtle text-xs font-semibold uppercase tracking-wider text-muted">
                        <tr>
                          <th scope="col" className="py-3 pl-4 pr-3">
                            Camp & Society
                          </th>
                          <th scope="col" className="px-3 py-3">
                            Service Window
                          </th>
                          <th scope="col" className="px-3 py-3">
                            Fill & Threshold
                          </th>
                          <th scope="col" className="px-3 py-3 text-right">
                            Price (₹)
                          </th>
                          <th scope="col" className="px-3 py-3">
                            Partner Vendor
                          </th>
                          <th scope="col" className="px-3 py-3">
                            Status & Urgency
                          </th>
                          <th scope="col" className="py-3 pl-3 pr-4 text-right">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-body">
                        {filteredCamps.map((camp) => {
                          const risk = getCampRisk(camp)
                          const fillPct = Math.min(
                            100,
                            Math.round((camp.active_participants_count / camp.max_participants) * 100),
                          )
                          const minPct = Math.min(
                            100,
                            Math.round((camp.min_participants / camp.max_participants) * 100),
                          )
                          const isUnderMin = camp.active_participants_count < camp.min_participants

                          return (
                            <tr
                              key={camp.id}
                              className="group transition-colors hover:bg-canvas"
                            >
                              <td className="py-3 pl-4 pr-3">
                                <Link
                                  to={`/ops/camps/${camp.id}`}
                                  className="font-semibold text-ink transition-colors hover:text-accent hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                                >
                                  {camp.title}
                                </Link>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                                  <span className="font-medium text-accent">
                                    {camp.society.name}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>{camp.society.city}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{camp.service.name}</span>
                                </div>
                              </td>

                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="font-mono text-xs font-semibold tabular-nums text-ink">
                                  {formatDateOnly(camp.starts_at)}
                                </div>
                                <div className="mt-0.5 font-mono text-xs tabular-nums text-muted">
                                  {camp.slot_minutes}m · {camp.max_participants} max
                                </div>
                              </td>

                              <td className="w-32 px-3 py-3 whitespace-nowrap">
                                <div className="flex items-center justify-between gap-2 font-mono text-xs font-semibold tabular-nums">
                                  <span
                                    className={
                                      isUnderMin ? 'text-warning' : 'text-success'
                                    }
                                  >
                                    {camp.active_participants_count}/{camp.max_participants}
                                  </span>
                                  <span className="text-muted">min {camp.min_participants}</span>
                                </div>
                                <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
                                  <div
                                    className="absolute bottom-0 top-0 z-10 w-0.5 bg-ink/70"
                                    style={{ left: `${minPct}%` }}
                                    title={`Min threshold to confirm: ${camp.min_participants} homes`}
                                  />
                                  <div
                                    className={`h-full rounded-full transition-all duration-slow ${
                                      isUnderMin ? 'bg-amber-500' : 'bg-accent'
                                    }`}
                                    style={{ width: `${fillPct}%` }}
                                  />
                                </div>
                              </td>

                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                <div className="font-mono text-sm font-semibold tabular-nums text-ink">
                                  {formatPaiseToRupees(camp.current_price_paise)}
                                </div>
                                {camp.current_price_paise < camp.base_price_paise ? (
                                  <div className="font-mono text-xs tabular-nums text-muted">
                                    Base{' '}
                                    <span className="line-through">
                                      {formatPaiseToRupees(camp.base_price_paise)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted">Base rate</div>
                                )}
                              </td>

                              <td className="px-3 py-3 whitespace-nowrap">
                                {camp.vendor ? (
                                  <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
                                    <VendorIcon className="h-3.5 w-3.5 shrink-0 text-accent" />
                                    <span className="max-w-[9.5rem] truncate">{camp.vendor.full_name}</span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 rounded-sm border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                    <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-600" />
                                    <span>Unassigned</span>
                                  </span>
                                )}
                              </td>

                              <td className="px-3 py-3">
                                <div className="flex flex-col items-start gap-1.5">
                                  <CampStatusBadge status={camp.status} />
                                  {risk ? <RiskBadge level={risk.level} message={risk.message} /> : null}
                                </div>
                              </td>

                              <td className="py-3 pl-3 pr-4 text-right whitespace-nowrap">
                                <Link
                                  to={`/ops/camps/${camp.id}`}
                                  className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                >
                                  <span>Roster</span>
                                  <ArrowRightIcon className="h-3.5 w-3.5 text-muted" />
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <div
                className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${
                  viewMode === 'table' ? 'md:hidden' : ''
                }`}
              >
              {filteredCamps.map((camp) => {
                const risk = getCampRisk(camp)
                const fillPct = Math.min(
                  100,
                  Math.round((camp.active_participants_count / camp.max_participants) * 100),
                )
                const isUnderMin = camp.active_participants_count < camp.min_participants

                return (
                  <div
                    key={camp.id}
                    className="group flex flex-col justify-between rounded-md border border-border bg-surface p-5 shadow-card transition-colors hover:border-border-strong"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-accent">
                          {camp.society.name} · {camp.society.city}
                        </span>
                        <CampStatusBadge status={camp.status} />
                      </div>

                      <h3 className="mt-1.5 font-display text-base font-bold text-ink">
                        <Link
                          to={`/ops/camps/${camp.id}`}
                          className="transition-colors hover:text-accent hover:underline underline-offset-2"
                        >
                          {camp.title}
                        </Link>
                      </h3>
                      <p className="text-xs text-muted">{camp.service.name}</p>

                      {risk ? (
                        <div className="mt-3">
                          <RiskBadge level={risk.level} message={risk.message} />
                        </div>
                      ) : null}

                      <div className="mt-4 space-y-1.5 rounded-sm border border-border bg-canvas p-3 text-xs">
                        <div className="flex items-center gap-2 text-muted">
                          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-mono font-medium tabular-nums text-ink">
                            {formatDateTime(camp.starts_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted">
                          <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-mono tabular-nums">
                            {camp.slot_minutes}m slots · Max {camp.max_participants} homes
                          </span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex justify-between font-mono text-xs font-semibold tabular-nums">
                          <span className={isUnderMin ? 'text-warning' : 'text-success'}>
                            {camp.active_participants_count} / {camp.max_participants} homes
                          </span>
                          <span className="text-muted">Min {camp.min_participants}</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
                          <div
                            className={`h-full rounded-full transition-all duration-slow ${
                              isUnderMin ? 'bg-amber-500' : 'bg-accent'
                            }`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-mono text-base font-semibold tabular-nums text-ink">
                            {formatPaiseToRupees(camp.current_price_paise)}
                          </span>
                          {camp.current_price_paise < camp.base_price_paise ? (
                            <span className="font-mono text-xs tabular-nums text-muted line-through">
                              {formatPaiseToRupees(camp.base_price_paise)}
                            </span>
                          ) : null}
                        </div>

                        <div>
                          {camp.vendor ? (
                            <span className="font-medium text-ink">{camp.vendor.full_name}</span>
                          ) : (
                            <span className="font-semibold text-warning">No vendor</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-border pt-3">
                      <Link
                        to={`/ops/camps/${camp.id}`}
                        className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-border-strong bg-surface py-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                      >
                        <span>View Details & Roster</span>
                        <ArrowRightIcon className="h-3.5 w-3.5 text-muted" />
                      </Link>
                    </div>
                  </div>
                )
              })}
              </div>
            </>
          )}
        </>
      )}
    </OpsLayout>
  )
}
