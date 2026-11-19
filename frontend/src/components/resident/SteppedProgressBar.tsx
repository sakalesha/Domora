import type { ResidentNextTier } from '../../api/resident'
import {
  computeSteppedBarMetrics,
  formatNeighbourCount,
} from '../../utils/residentCamp'

interface SteppedProgressBarProps {
  participantsCount: number
  minParticipants: number
  maxParticipants: number
  nextTier?: ResidentNextTier | null
  compact?: boolean
}

export function SteppedProgressBar({
  participantsCount,
  minParticipants,
  maxParticipants,
  nextTier,
  compact = false,
}: SteppedProgressBarProps) {
  const { fillPct, minPct, nextTierPct, reachedMinimum } =
    computeSteppedBarMetrics(
      participantsCount,
      minParticipants,
      maxParticipants,
      nextTier?.target_participants,
    )

  const showDistinctNextNotch =
    nextTierPct !== null && Math.abs(nextTierPct - minPct) >= 4

  return (
    <div className={compact ? 'grid gap-2' : 'grid gap-2.5'}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">
          {formatNeighbourCount(participantsCount)}
        </span>
        <span className="font-mono text-xs font-medium tabular-nums text-muted">
          {participantsCount}/{maxParticipants} homes
        </span>
      </div>

      <div
        aria-label={`Group participation: ${participantsCount} of ${maxParticipants} homes`}
        aria-valuemax={maxParticipants}
        aria-valuemin={0}
        aria-valuenow={participantsCount}
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-subtle ring-1 ring-inset ring-border"
        role="progressbar"
      >
        <div
          className={`h-full rounded-full transition-all duration-base ${
            reachedMinimum ? 'bg-accent' : 'bg-amber-500'
          }`}
          style={{ width: `${fillPct}%` }}
        />

        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-slate-700"
          style={{ left: `calc(${minPct}% - 1px)` }}
          title={`Minimum to confirm: ${minParticipants} neighbours`}
        />

        {showDistinctNextNotch ? (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 w-0.5 bg-accent-pressed"
            style={{ left: `calc(${nextTierPct}% - 1px)` }}
            title={`Next discount milestone: ${nextTier?.target_participants} neighbours`}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-0.5 rounded-full bg-slate-700"
          />
          <span>
            Min {minParticipants} to confirm
            {reachedMinimum ? ' (reached)' : ''}
          </span>
        </span>

        {nextTier ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-accent-pressed tabular-nums">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-0.5 rounded-full bg-accent-pressed"
            />
            <span>
              Next: {nextTier.target_participants} homes ({nextTier.discount_pct}% off)
            </span>
          </span>
        ) : (
          <span className="tabular-nums">Max {maxParticipants} homes</span>
        )}
      </div>
    </div>
  )
}
