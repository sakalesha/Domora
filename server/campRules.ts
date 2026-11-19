export class CampRuleValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CampRuleValidationError'
  }
}

export function parseIsoDateTime(value: string, fieldName: string): Date {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CampRuleValidationError(`${fieldName} must be a valid ISO-8601 datetime string`)
  }
  // Require timezone offset or Z suffix to match timezone-aware Python datetime checks
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value.trim())) {
    throw new CampRuleValidationError(`Datetime must be timezone-aware (got ${value})`)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new CampRuleValidationError(`Invalid datetime for ${fieldName}: ${value}`)
  }
  return date
}

export function calculateCapacitySlots(
  startsAt: Date,
  endsAt: Date,
  slotMinutes: number,
): number {
  const startMs = startsAt.getTime()
  const endMs = endsAt.getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new CampRuleValidationError('Invalid start or end datetime')
  }
  if (startMs >= endMs) {
    throw new CampRuleValidationError(
      `starts_at must be strictly before ends_at (${startsAt.toISOString()} >= ${endsAt.toISOString()})`,
    )
  }
  if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) {
    throw new CampRuleValidationError(`slot_minutes must be greater than 0, got ${slotMinutes}`)
  }

  const durationSeconds = (endMs - startMs) / 1000
  const durationMinutes = Math.floor(durationSeconds / 60)
  return Math.floor(durationMinutes / slotMinutes)
}

export interface CampRuleParams {
  startsAt: Date
  endsAt: Date
  slotMinutes: number
  minParticipants: number
  maxParticipants: number
  joinDeadline: Date
  basePricePaise: number
}

export function validateCampParameters(params: CampRuleParams): number {
  const {
    startsAt,
    endsAt,
    slotMinutes,
    minParticipants,
    maxParticipants,
    joinDeadline,
    basePricePaise,
  } = params

  if (startsAt.getTime() >= endsAt.getTime()) {
    throw new CampRuleValidationError(
      `starts_at must be strictly before ends_at (${startsAt.toISOString()} >= ${endsAt.toISOString()})`,
    )
  }
  if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) {
    throw new CampRuleValidationError(`slot_minutes must be greater than 0, got ${slotMinutes}`)
  }
  if (!Number.isInteger(basePricePaise) || basePricePaise < 0) {
    throw new CampRuleValidationError(`base_price_paise cannot be negative, got ${basePricePaise}`)
  }
  if (!Number.isInteger(minParticipants) || minParticipants < 1) {
    throw new CampRuleValidationError(`min_participants must be at least 1, got ${minParticipants}`)
  }
  if (!Number.isInteger(maxParticipants) || maxParticipants < minParticipants) {
    throw new CampRuleValidationError(
      `max_participants must be greater than or equal to min_participants (${maxParticipants} < ${minParticipants})`,
    )
  }

  const capacitySlots = calculateCapacitySlots(startsAt, endsAt, slotMinutes)

  if (maxParticipants > capacitySlots) {
    throw new CampRuleValidationError(
      `max_participants (${maxParticipants}) cannot exceed capacity (${capacitySlots} slots available in window)`,
    )
  }

  const twentyFourHoursMs = 24 * 60 * 60 * 1000
  const minRequiredDeadlineMs = startsAt.getTime() - twentyFourHoursMs
  if (joinDeadline.getTime() > minRequiredDeadlineMs) {
    throw new CampRuleValidationError(
      `join_deadline must be at least 24 hours before starts_at (latest allowed: ${new Date(minRequiredDeadlineMs).toISOString()}, got: ${joinDeadline.toISOString()})`,
    )
  }

  return capacitySlots
}
