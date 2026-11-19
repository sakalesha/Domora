import type {
  ResidentBookingStatus,
  ResidentCampListItem,
  ResidentCampStatus,
} from '../api/resident'
import { formatDateTime, formatTimeOnly } from './format'

export const PROVISIONAL_PRICE_DISCLAIMER =
  'Current price is provisional based on group participation and locks when the camp is confirmed. Price may adjust if neighbours join or leave before confirmation.'

export function formatRupeeAmount(rupees: number, paise?: number): string {
  const amount =
    typeof paise === 'number' && Number.isFinite(paise)
      ? paise / 100
      : Number.isFinite(rupees)
        ? rupees
        : 0

  const hasFraction = Math.abs(amount - Math.round(amount)) > 1e-6

  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })}`
}

export function formatNeighbourCount(count: number): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  if (safe === 0) return 'No neighbours joined yet'
  if (safe === 1) return '1 neighbour joined'
  return `${safe} neighbours joined`
}

export function formatSpotsRemaining(spots: number): string {
  const safe = Number.isFinite(spots) ? Math.max(0, Math.floor(spots)) : 0
  if (safe === 0) return 'Camp full'
  if (safe === 1) return '1 spot left'
  return `${safe} spots left`
}

export function formatWindowDuration(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '—'
  }

  const diffMins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  const durationText =
    hours > 0 && mins > 0
      ? `${hours}h ${mins}m`
      : hours > 0
        ? `${hours}h`
        : `${mins}m`

  return `${formatTimeOnly(startsAt)} – ${formatTimeOnly(endsAt)} (${durationText})`
}

export interface DeadlineDisplay {
  label: string
  cutoffText: string
  isPast: boolean
  isUrgent: boolean
}

export function formatDeadlineStatus(
  joinDeadline: string,
  nowMs: number = Date.now(),
): DeadlineDisplay {
  const deadline = new Date(joinDeadline)
  if (Number.isNaN(deadline.getTime())) {
    return {
      label: 'Deadline unavailable',
      cutoffText: '—',
      isPast: false,
      isUrgent: false,
    }
  }

  const cutoffText = formatDateTime(joinDeadline)
  const diffMs = deadline.getTime() - nowMs

  if (diffMs <= 0) {
    return {
      label: 'Deadline passed',
      cutoffText,
      isPast: true,
      isUrgent: false,
    }
  }

  const totalMinutes = Math.ceil(diffMs / 60000)
  const totalHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  const totalDays = Math.floor(totalHours / 24)
  const remainingHours = totalHours % 24

  if (totalHours < 1) {
    return {
      label: `Closes in ${totalMinutes}m`,
      cutoffText,
      isPast: false,
      isUrgent: true,
    }
  }

  if (totalHours < 24) {
    const minsPart = remainingMinutes > 0 ? ` ${remainingMinutes}m` : ''
    return {
      label: `Closes in ${totalHours}h${minsPart}`,
      cutoffText,
      isPast: false,
      isUrgent: true,
    }
  }

  if (totalDays === 1) {
    const hrsPart = remainingHours > 0 ? ` ${remainingHours}h` : ''
    return {
      label: `Closes in 1d${hrsPart}`,
      cutoffText,
      isPast: false,
      isUrgent: totalHours <= 36,
    }
  }

  return {
    label: `Closes in ${totalDays} days`,
    cutoffText,
    isPast: false,
    isUrgent: false,
  }
}

export interface SteppedBarMetrics {
  fillPct: number
  minPct: number
  nextTierPct: number | null
  reachedMinimum: boolean
}

export function computeSteppedBarMetrics(
  participantsCount: number,
  minParticipants: number,
  maxParticipants: number,
  nextTierTarget?: number | null,
): SteppedBarMetrics {
  const safeMax = Math.max(1, maxParticipants)
  const safeCount = Math.max(0, participantsCount)
  const safeMin = Math.max(1, Math.min(minParticipants, safeMax))

  const fillPct = Math.min(100, Math.round((safeCount / safeMax) * 100))
  const minPct = Math.min(100, Math.round((safeMin / safeMax) * 100))
  const nextTierPct =
    typeof nextTierTarget === 'number' &&
    nextTierTarget > 0 &&
    nextTierTarget <= safeMax
      ? Math.min(100, Math.round((nextTierTarget / safeMax) * 100))
      : null

  return {
    fillPct,
    minPct,
    nextTierPct,
    reachedMinimum: safeCount >= safeMin,
  }
}

export function formatCampStatusLabel(status: ResidentCampStatus): string {
  switch (status) {
    case 'open':
      return 'Open'
    case 'confirmed':
      return 'Confirmed'
    case 'in_progress':
      return 'In Progress'
    case 'completed':
      return 'Completed'
  }
}

export function formatBookingStatusLabel(status: ResidentBookingStatus): string {
  switch (status) {
    case 'joined':
      return 'Joined'
    case 'scheduled':
      return 'Slot scheduled'
    case 'in_progress':
      return 'Service in progress'
    case 'completed':
      return 'Completed'
  }
}

export interface JoinUnavailableInfo {
  shortLabel: string
  explanation: string
}

export function getJoinUnavailableReason(
  camp: Pick<
    ResidentCampListItem,
    'status' | 'spots_remaining' | 'join_deadline' | 'is_confirmed_or_higher'
  >,
  nowMs: number = Date.now(),
): JoinUnavailableInfo {
  if (camp.status === 'completed') {
    return {
      shortLabel: 'Camp completed',
      explanation: 'This society camp has already finished.',
    }
  }
  if (camp.status === 'in_progress') {
    return {
      shortLabel: 'Camp in progress',
      explanation: 'Service slots are currently underway and new bookings are closed.',
    }
  }
  if (camp.status === 'confirmed' || camp.is_confirmed_or_higher) {
    return {
      shortLabel: 'Camp confirmed',
      explanation: 'Group pricing and resident slots are locked for this camp.',
    }
  }
  if (camp.spots_remaining <= 0) {
    return {
      shortLabel: 'Camp full',
      explanation: 'All available home slots for this camp have been claimed.',
    }
  }
  const deadlineTime = new Date(camp.join_deadline).getTime()
  if (!Number.isNaN(deadlineTime) && deadlineTime <= nowMs) {
    return {
      shortLabel: 'Deadline passed',
      explanation: 'The join cutoff for this camp has passed while confirmation is prepared.',
    }
  }
  return {
    shortLabel: 'Joining closed',
    explanation: 'This camp is not currently accepting new resident bookings.',
  }
}
