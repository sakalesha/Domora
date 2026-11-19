import { useMemo, useState } from 'react'
import type { ResidentTierItem, ResidentTierStatus } from '../../api/resident'
import { formatRupeeAmount } from '../../utils/residentCamp'
import { CheckIcon } from '../icons/Icons'

interface SavingsLadderProps {
  basePricePaise: number
  basePriceRupees: number
  participantsCount: number
  tiers: ResidentTierItem[]
  isLocked: boolean
}

const tierStatusMeta: Record<
  ResidentTierStatus,
  { label: string; className: string }
> = {
  reached: {
    label: 'Reached',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  current: {
    label: 'Current tier',
    className: 'border-accent bg-accent-soft text-accent-pressed',
  },
  next: {
    label: 'Next unlock',
    className: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  upcoming: {
    label: 'Upcoming',
    className: 'border-border bg-surface-subtle text-muted',
  },
}

export function SavingsLadder({
  basePricePaise,
  basePriceRupees,
  participantsCount,
  tiers,
  isLocked,
}: SavingsLadderProps) {
  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.min_participants - b.min_participants),
    [tiers],
  )

  const defaultSelectedThreshold = useMemo(() => {
    const nextTier = sortedTiers.find((tier) => tier.status === 'next')
    if (nextTier) return nextTier.min_participants
    const currentTier = sortedTiers.find((tier) => tier.status === 'current')
    if (currentTier) return currentTier.min_participants
    return sortedTiers[0]?.min_participants ?? null
  }, [sortedTiers])

  const [selectedThreshold, setSelectedThreshold] = useState<number | null>(
    defaultSelectedThreshold,
  )

  const activeSelection = useMemo(() => {
    if (sortedTiers.length === 0) return null
    return (
      sortedTiers.find((tier) => tier.min_participants === selectedThreshold) ??
      sortedTiers[0]
    )
  }, [selectedThreshold, sortedTiers])

  const anyTierReached = sortedTiers.some(
    (tier) => tier.status === 'current' || tier.status === 'reached',
  )

  if (sortedTiers.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold text-ink">
          Group pricing
        </h2>
        <p className="mt-1.5 text-sm text-body">
          This camp runs at a flat community rate of{' '}
          <span className="font-mono font-semibold tabular-nums text-ink">
            {formatRupeeAmount(basePriceRupees, basePricePaise)}
          </span>{' '}
          per home.
        </p>
      </div>
    )
  }

  return (
    <section
      aria-labelledby="savings-ladder-heading"
      className="rounded-md border border-border bg-surface p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2
            className="font-display text-lg font-bold tracking-tight text-ink"
            id="savings-ladder-heading"
          >
            Group Savings Ladder
          </h2>
          <p className="mt-1 text-sm text-body">
            Every additional neighbour who joins lowers the per-home price for the whole group.
          </p>
        </div>
        <span className="font-mono text-xs font-medium tabular-nums text-muted">
          {isLocked ? 'Final tier locked' : 'Select a tier to preview'}
        </span>
      </div>

      <div className="mt-5 grid gap-2.5" role="list">
        {/* Base Rate Row */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-canvas px-4 py-3 text-sm"
          role="listitem"
        >
          <div className="grid gap-0.5">
            <span className="font-semibold text-ink">Standard base rate</span>
            <span className="text-xs text-muted">
              Before group discount threshold
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-sm border px-2 py-0.5 text-xs font-semibold ${
                !anyTierReached
                  ? 'border-accent bg-accent-soft text-accent-pressed'
                  : 'border-border bg-surface text-muted'
              }`}
            >
              {!anyTierReached ? 'Current rate' : 'Superseded'}
            </span>
            <span className="font-mono text-base font-bold tabular-nums text-ink">
              {formatRupeeAmount(basePriceRupees, basePricePaise)}
            </span>
          </div>
        </div>

        {/* Tier Rows */}
        {sortedTiers.map((tier) => {
          const statusMeta = tierStatusMeta[tier.status]
          const savingsPaise = Math.max(0, basePricePaise - tier.price_paise)
          const isSelected =
            activeSelection?.min_participants === tier.min_participants
          const isCurrent = tier.status === 'current'
          const isReached = tier.status === 'reached' || isCurrent

          return (
            <button
              aria-pressed={isSelected}
              className={`group flex w-full items-center justify-between gap-3 rounded-sm border px-4 py-3.5 text-left transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                isSelected
                  ? 'border-accent bg-accent-soft ring-1 ring-accent'
                  : isCurrent
                    ? 'border-teal-300 bg-teal-50/50 hover:border-accent'
                    : 'border-border bg-surface hover:border-border-strong hover:bg-canvas'
              }`}
              key={tier.min_participants}
              onClick={() => setSelectedThreshold(tier.min_participants)}
              type="button"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border text-xs font-bold tabular-nums ${
                    isReached
                      ? 'border-accent bg-accent text-on-accent'
                      : tier.status === 'next'
                        ? 'border-amber-400 bg-amber-50 text-amber-800'
                        : 'border-border bg-surface-subtle text-muted'
                  }`}
                >
                  {isReached ? (
                    <CheckIcon className="h-3.5 w-3.5" />
                  ) : (
                    tier.min_participants
                  )}
                </span>

                <div className="grid min-w-0 gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink tabular-nums">
                      {tier.min_participants}+ neighbours
                    </span>
                    <span
                      className={`rounded-sm border px-2 py-0.5 text-xs font-semibold ${statusMeta.className}`}
                    >
                      {statusMeta.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted tabular-nums">
                    {tier.discount_pct}% group discount
                    {savingsPaise > 0
                      ? ` · Save ${formatRupeeAmount(savingsPaise / 100, savingsPaise)} per home`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="font-mono text-base font-bold tabular-nums text-ink">
                  {formatRupeeAmount(tier.price_rupees, tier.price_paise)}
                </p>
                <p className="text-xs text-muted">per home</p>
              </div>
            </button>
          )
        })}
      </div>

      {activeSelection ? (
        <div
          aria-live="polite"
          className="mt-4 rounded-sm border border-border bg-canvas px-4 py-3 text-sm text-body"
        >
          {(() => {
            const savingsPaise = Math.max(
              0,
              basePricePaise - activeSelection.price_paise,
            )
            const needed = Math.max(
              0,
              activeSelection.min_participants - participantsCount,
            )
            const priceLabel = formatRupeeAmount(
              activeSelection.price_rupees,
              activeSelection.price_paise,
            )
            const savingsLabel = formatRupeeAmount(
              savingsPaise / 100,
              savingsPaise,
            )

            if (needed === 0) {
              return (
                <p>
                  <span className="font-semibold text-ink">
                    {activeSelection.min_participants}+ neighbour tier unlocked:
                  </span>{' '}
                  each home pays{' '}
                  <span className="font-mono font-semibold tabular-nums text-ink">
                    {priceLabel}
                  </span>{' '}
                  ({activeSelection.discount_pct}% off, saving {savingsLabel} vs base rate).
                </p>
              )
            }

            return (
              <p>
                <span className="font-semibold text-ink">
                  {needed} more {needed === 1 ? 'neighbour' : 'neighbours'} needed
                </span>{' '}
                to reach {activeSelection.min_participants} homes and lower everyone&apos;s price to{' '}
                <span className="font-mono font-semibold tabular-nums text-ink">
                  {priceLabel}
                </span>{' '}
                (saving {savingsLabel} per home).
              </p>
            )
          })()}
        </div>
      ) : null}
    </section>
  )
}
