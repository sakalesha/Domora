import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  fetchSocieties,
  listCamps,
  type CampListItem,
  type SocietyReference,
} from '../../api/ops'
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BuildingIcon,
  CalendarIcon,
  CampIcon,
  ClockIcon,
  GridIcon,
  PlusIcon,
  SearchIcon,
  TableIcon,
  UsersIcon,
  VendorIcon,
  XIcon,
} from '../../components/icons/Icons'
import { CampStatusBadge, RiskBadge } from '../../components/ops/CampStatusBadge'
import { OpsLayout } from '../../components/ops/OpsLayout'

function formatDateTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatDateOnly(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatPaiseToRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

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

  // Critical: under 24 hours until join deadline and still below minimum threshold
  if (hoursUntilDeadline > 0 && hoursUntilDeadline <= 24 && isUnderMin) {
    const hoursLeft = Math.max(1, Math.round(hoursUntilDeadline))
    return {
      level: 'critical',
      message: `Closes in ${hoursLeft}h • Needs ${shortfall} more`,
      sortWeight: 2,
    }
  }

  // Warning: under 72 hours until deadline and below minimum, OR no vendor assigned
  if ((hoursUntilDeadline > 0 && hoursUntilDeadline <= 72 && isUnderMin) || !camp.vendor) {
    let reason = ''
    if (isUnderMin && !camp.vendor) {
      reason = `Needs ${shortfall} more • No vendor`
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
]

export function OpsDashboardPage() {
  const [searchParams] = useSearchParams()
  const [camps, setCamps] = useState<CampListItem[]>([])
  const [societies, setSocieties] = useState<SocietyReference[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & View Mode
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSocietyId, setSelectedSocietyId] = useState('all')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  useEffect(() => {
    let cancelled = false

    Promise.all([
      listCamps(),
      fetchSocieties().catch(() => []),
    ])
      .then(([campsData, societiesData]) => {
        if (!cancelled) {
          setCamps(campsData)
          setSocieties(societiesData)
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
    listCamps()
      .then((data) => {
        setCamps(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load camps')
        setLoading(false)
      })
  }

  // Calculate counts per status tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: camps.length }
    for (const c of camps) {
      counts[c.status] = (counts[c.status] ?? 0) + 1
    }
    return counts
  }, [camps])

  // Count total at-risk camps for sidebar badge
  const atRiskCount = useMemo(() => {
    return camps.filter((c) => getCampRisk(c) !== null).length
  }, [camps])

  // KPI Metrics
  const metrics = useMemo(() => {
    const active = camps.filter(
      (c) => c.status === 'open' || c.status === 'confirmed' || c.status === 'in_progress',
    ).length
    const totalBookings = camps.reduce((sum, c) => sum + c.active_participants_count, 0)
    const uniqueSocieties = new Set(camps.map((c) => c.society.id)).size
    return {
      activeCamps: active,
      attentionNeeded: atRiskCount,
      totalBookings,
      activeSocieties: uniqueSocieties,
    }
  }, [camps, atRiskCount])

  // Filtered & Sorted Camps
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

  // Directory View Mode if requested via query param
  const directoryTab = searchParams.get('tab')

  return (
    <OpsLayout
      breadcrumbs={[{ label: 'Operations', to: '/ops' }, { label: 'Dashboard & Camps' }]}
      title="Operations Dashboard"
      subtitle="Camp capacity planning, booking velocity, and service delivery triage"
      attentionCount={atRiskCount}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/ops/camps/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-pressed active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Create New Camp</span>
          </Link>
        </div>
      }
    >
      {/* 1. Operational KPI Metric Cards */}
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border/30 bg-surface p-4 shadow-sm transition hover:border-border/60">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Camps</span>
            <CampIcon className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-ink tabular-nums">
              {metrics.activeCamps}
            </span>
            <span className="text-xs text-muted">live in field</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/30 bg-surface p-4 shadow-sm transition hover:border-border/60">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Needs Action</span>
            <AlertTriangleIcon
              className={`h-4 w-4 ${metrics.attentionNeeded > 0 ? 'text-amber-500' : 'text-muted'}`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`font-mono text-2xl font-bold tracking-tight tabular-nums ${
                metrics.attentionNeeded > 0 ? 'text-rose-600' : 'text-ink'
              }`}
            >
              {metrics.attentionNeeded}
            </span>
            <span className="text-xs text-muted">
              {metrics.attentionNeeded > 0 ? 'urgent triage' : 'all clear'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border/30 bg-surface p-4 shadow-sm transition hover:border-border/60">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Bookings</span>
            <UsersIcon className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-ink tabular-nums">
              {metrics.totalBookings}
            </span>
            <span className="text-xs text-muted">enrolled homes</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/30 bg-surface p-4 shadow-sm transition hover:border-border/60">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Societies</span>
            <BuildingIcon className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-ink tabular-nums">
              {metrics.activeSocieties}
            </span>
            <span className="text-xs text-muted">communities</span>
          </div>
        </div>
      </section>

      {/* Directory Tab Alert (if selected from sidebar) */}
      {directoryTab ? (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs text-teal-900">
          <div className="flex items-center gap-2">
            <BuildingIcon className="h-4 w-4 text-teal-700" />
            <span>
              Showing reference information for{' '}
              <strong className="capitalize">{directoryTab}</strong>. You can view all linked
              societies and verified vendors below.
            </span>
          </div>
          <Link
            to="/ops"
            className="rounded border border-teal-300 bg-white px-2 py-1 font-semibold text-teal-800 hover:bg-teal-100"
          >
            Clear view
          </Link>
        </div>
      ) : null}

      {/* 2. Status Filter Tabs */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/30 pb-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist">
          {statusTabs.map((tab) => {
            const count = tabCounts[tab.id] ?? 0
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                  isActive
                    ? 'bg-ink text-white shadow-sm'
                    : 'bg-surface text-muted hover:bg-canvas hover:text-ink border border-border/30'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] tabular-nums ${
                    isActive ? 'bg-white/20 text-white' : 'bg-canvas text-muted border border-border/20'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* View Switcher (Dense Table vs Cards) */}
        <div className="flex items-center rounded-lg border border-border/40 bg-surface p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            title="Dense Table View"
            aria-label="Dense Table View"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'table'
                ? 'bg-canvas font-semibold text-ink shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            title="Card Grid View"
            aria-label="Card Grid View"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'cards'
                ? 'bg-canvas font-semibold text-ink shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <GridIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
        </div>
      </div>

      {/* 3. Search and Society Dropdown Filter Bar */}
      <div className="mb-6 grid gap-3 sm:grid-cols-12">
        <div className="relative sm:col-span-8">
          <SearchIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by camp title, society name, city or service..."
            className="w-full rounded-lg border border-border/40 bg-surface py-2 pl-9 pr-9 text-xs text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 rounded text-muted hover:text-ink"
              aria-label="Clear search"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="sm:col-span-4">
          <select
            value={selectedSocietyId}
            onChange={(e) => setSelectedSocietyId(e.target.value)}
            className="w-full rounded-lg border border-border/40 bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-border/30 bg-surface"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
          <p className="font-bold">Failed to load camp operations data</p>
          <p className="mt-1 text-xs text-red-700">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-4 rounded-lg bg-red-700 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-red-800 active:scale-[0.98]"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredCamps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
            <CampIcon className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-ink">No matching camps found</h3>
          <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
            {searchQuery || selectedSocietyId !== 'all' || activeTab !== 'all'
              ? 'Try adjusting your search criteria or clearing filters to locate camps.'
              : 'Get started by creating your first group-buying service camp for an apartment society.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {searchQuery || selectedSocietyId !== 'all' || activeTab !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedSocietyId('all')
                  setActiveTab('all')
                }}
                className="rounded-lg border border-border/50 bg-canvas px-3 py-1.5 text-xs font-semibold text-body hover:bg-surface"
              >
                Clear All Filters
              </button>
            ) : (
              <Link
                to="/ops/camps/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-pressed active:scale-[0.98]"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Create First Camp</span>
              </Link>
            )}
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* Dense Table View */
        <div className="overflow-hidden rounded-xl border border-border/30 bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/30 bg-canvas/80 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Camp & Society
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Service Window
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Fill & Velocity
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Price (Paise/₹)
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Partner Vendor
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status & Urgency
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-body">
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
                      className="group transition-colors hover:bg-canvas/60"
                    >
                      {/* Camp & Society */}
                      <td className="px-4 py-3">
                        <Link
                          to={`/ops/camps/${camp.id}`}
                          className="font-bold text-ink hover:text-accent hover:underline flex items-center gap-1.5"
                        >
                          <span>{camp.title}</span>
                        </Link>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                          <span className="font-semibold text-accent/90">
                            {camp.society.name}
                          </span>
                          <span>•</span>
                          <span>{camp.society.city}</span>
                          <span>•</span>
                          <span>{camp.service.name}</span>
                        </div>
                      </td>

                      {/* Service Window */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-ink font-medium tabular-nums">
                          {formatDateOnly(camp.starts_at)}
                        </div>
                        <div className="text-[11px] text-muted font-mono tabular-nums">
                          {camp.slot_minutes}m slots ({camp.max_participants} max)
                        </div>
                      </td>

                      {/* Fill & Velocity */}
                      <td className="px-4 py-3 w-48">
                        <div className="flex items-center justify-between text-[11px] font-medium font-mono tabular-nums">
                          <span
                            className={
                              isUnderMin ? 'text-amber-800 font-bold' : 'text-emerald-800 font-bold'
                            }
                          >
                            {camp.active_participants_count} / {camp.max_participants} homes
                          </span>
                          <span className="text-muted text-[10px]">
                            min: {camp.min_participants}
                          </span>
                        </div>
                        <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border/20">
                          {/* Min threshold notch marker */}
                          <div
                            className="absolute top-0 bottom-0 z-10 w-0.5 bg-ink/70"
                            style={{ left: `${minPct}%` }}
                            title={`Min threshold to confirm: ${camp.min_participants} homes`}
                          />
                          {/* Fill Bar */}
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isUnderMin ? 'bg-amber-500' : 'bg-accent'
                            }`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-ink tabular-nums">
                          {formatPaiseToRupees(camp.current_price_paise)}
                        </div>
                        <div className="text-[11px] text-muted">
                          Base:{' '}
                          <span className="line-through">
                            {formatPaiseToRupees(camp.base_price_paise)}
                          </span>
                        </div>
                      </td>

                      {/* Vendor */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {camp.vendor ? (
                          <div className="flex items-center gap-1.5 font-medium text-emerald-800">
                            <VendorIcon className="h-3.5 w-3.5 text-emerald-600" />
                            <span>{camp.vendor.full_name}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                            <AlertTriangleIcon className="h-3 w-3 text-amber-600" />
                            <span>Unassigned</span>
                          </span>
                        )}
                      </td>

                      {/* Status & Urgency */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <CampStatusBadge status={camp.status} />
                          {risk ? <RiskBadge level={risk.level} message={risk.message} /> : null}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          to={`/ops/camps/${camp.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-border/40 bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-xs transition hover:bg-canvas hover:border-accent active:scale-[0.98]"
                        >
                          <span>Roster</span>
                          <ArrowRightIcon className="h-3 w-3 text-muted group-hover:text-ink" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Visual Cards Grid View */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                className="group flex flex-col justify-between rounded-xl border border-border/30 bg-surface p-5 shadow-sm transition hover:border-accent/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                      {camp.society.name} • {camp.society.city}
                    </span>
                    <CampStatusBadge status={camp.status} />
                  </div>

                  <h3 className="mt-1 text-sm font-bold text-ink group-hover:text-accent transition">
                    <Link to={`/ops/camps/${camp.id}`}>{camp.title}</Link>
                  </h3>
                  <p className="text-xs text-muted">{camp.service.name}</p>

                  {risk ? (
                    <div className="mt-2.5">
                      <RiskBadge level={risk.level} message={risk.message} />
                    </div>
                  ) : null}

                  {/* Window Timing Block */}
                  <div className="mt-3.5 space-y-1 rounded-lg bg-canvas p-2.5 text-xs">
                    <div className="flex items-center gap-2 text-muted">
                      <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="font-mono tabular-nums text-body">
                        {formatDateTime(camp.starts_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted">
                      <ClockIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        {camp.slot_minutes}m slots • Max {camp.max_participants} homes
                      </span>
                    </div>
                  </div>

                  {/* Fill Progress Bar */}
                  <div className="mt-3.5">
                    <div className="flex justify-between text-xs font-mono font-medium tabular-nums">
                      <span className={isUnderMin ? 'text-amber-800' : 'text-emerald-800'}>
                        {camp.active_participants_count} / {camp.max_participants} homes
                      </span>
                      <span className="text-muted text-[11px]">Min: {camp.min_participants}</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border/20">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isUnderMin ? 'bg-amber-500' : 'bg-accent'
                        }`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial & Vendor Snapshot */}
                  <div className="mt-4 flex items-center justify-between border-t border-border/20 pt-3 text-xs">
                    <div>
                      <span className="font-mono text-base font-bold text-ink tabular-nums">
                        {formatPaiseToRupees(camp.current_price_paise)}
                      </span>
                      <span className="ml-1 text-[11px] text-muted line-through">
                        {formatPaiseToRupees(camp.base_price_paise)}
                      </span>
                    </div>

                    <div>
                      {camp.vendor ? (
                        <span className="text-xs font-medium text-emerald-800">
                          {camp.vendor.full_name}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-700">No vendor</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-border/20 pt-3">
                  <Link
                    to={`/ops/camps/${camp.id}`}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/40 bg-canvas py-2 text-xs font-semibold text-ink transition hover:bg-surface hover:border-accent active:scale-[0.98]"
                  >
                    <span>View Details & Roster</span>
                    <ArrowRightIcon className="h-3.5 w-3.5 text-muted" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </OpsLayout>
  )
}
