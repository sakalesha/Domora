import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CampRuleValidationError,
  calculateCapacitySlots,
  parseIsoDateTime,
  validateCampParameters,
} from './campRules.ts'

test('calculateCapacitySlots computes whole slots and discards remainder', () => {
  const startsAt = new Date('2026-12-01T09:00:00Z')
  const endsAt = new Date('2026-12-01T15:15:00Z') // 375 mins
  assert.equal(calculateCapacitySlots(startsAt, endsAt, 30), 12)
  assert.equal(calculateCapacitySlots(startsAt, endsAt, 60), 6)
})

test('validateCampParameters enforces window, capacity, and 24h join deadline', () => {
  const startsAt = new Date('2026-12-05T10:00:00Z')
  const endsAt = new Date('2026-12-05T16:00:00Z') // 12 slots of 30m
  const validDeadline = new Date('2026-12-04T09:00:00Z') // 25h prior

  const slots = validateCampParameters({
    startsAt,
    endsAt,
    slotMinutes: 30,
    minParticipants: 3,
    maxParticipants: 12,
    joinDeadline: validDeadline,
    basePricePaise: 80000,
  })
  assert.equal(slots, 12)

  // Deadline < 24h before start
  assert.throws(
    () =>
      validateCampParameters({
        startsAt,
        endsAt,
        slotMinutes: 30,
        minParticipants: 3,
        maxParticipants: 12,
        joinDeadline: new Date('2026-12-04T15:00:00Z'),
        basePricePaise: 80000,
      }),
    CampRuleValidationError,
  )

  // maxParticipants > capacitySlots
  assert.throws(
    () =>
      validateCampParameters({
        startsAt,
        endsAt,
        slotMinutes: 30,
        minParticipants: 3,
        maxParticipants: 15,
        joinDeadline: validDeadline,
        basePricePaise: 80000,
      }),
    CampRuleValidationError,
  )

  // Timezone-naive ISO string rejected
  assert.throws(
    () => parseIsoDateTime('2026-12-05T10:00:00', 'starts_at'),
    CampRuleValidationError,
  )
})
