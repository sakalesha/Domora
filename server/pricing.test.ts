import test from 'node:test'
import assert from 'node:assert/strict'
import {
  InvalidTierError,
  PricingError,
  calculateDiscountPct,
  calculateDiscountedPricePaise,
  calculateNextTier,
  calculatePricingQuote,
  validatePriceTiers,
} from './pricing.ts'

test('validatePriceTiers sorts ascending and rejects invalid tiers', () => {
  const sorted = validatePriceTiers([
    { min_participants: 6, discount_pct: 15 },
    { min_participants: 3, discount_pct: 10 },
  ])
  assert.deepEqual(sorted, [
    { min_participants: 3, discount_pct: 10 },
    { min_participants: 6, discount_pct: 15 },
  ])

  assert.throws(
    () =>
      validatePriceTiers([
        { min_participants: 3, discount_pct: 10 },
        { min_participants: 3, discount_pct: 15 },
      ]),
    InvalidTierError,
  )

  assert.throws(
    () =>
      validatePriceTiers([
        { min_participants: 3, discount_pct: 20 },
        { min_participants: 6, discount_pct: 10 },
      ]),
    InvalidTierError,
  )
})

test('calculateDiscountedPricePaise uses exact integer round-half-up', () => {
  assert.equal(calculateDiscountedPricePaise(80000, 10), 72000)
  assert.equal(calculateDiscountedPricePaise(80000, 15), 68000)
  assert.equal(calculateDiscountedPricePaise(15, 50), 8) // 7.5 -> 8
  assert.equal(calculateDiscountedPricePaise(15, 51), 7) // 7.35 -> 7
  assert.equal(calculateDiscountedPricePaise(95000, 0), 95000)
  assert.equal(calculateDiscountedPricePaise(95000, 100), 0)
  assert.throws(() => calculateDiscountedPricePaise(-1, 10), PricingError)
})

test('calculatePricingQuote computes discount, final price, and next tier', () => {
  const tiers = [
    { min_participants: 3, discount_pct: 10 },
    { min_participants: 6, discount_pct: 15 },
    { min_participants: 10, discount_pct: 20 },
  ]

  assert.equal(calculateDiscountPct(2, tiers), 0)
  assert.equal(calculateDiscountPct(3, tiers), 10)
  assert.equal(calculateDiscountPct(7, tiers), 15)
  assert.equal(calculateDiscountPct(12, tiers), 20)

  const quoteAt3 = calculatePricingQuote(80000, 3, tiers)
  assert.equal(quoteAt3.discount_pct, 10)
  assert.equal(quoteAt3.final_price_paise, 72000)
  assert.deepEqual(quoteAt3.next_tier, {
    more_needed: 3,
    target_participants: 6,
    discount_pct: 15,
  })

  assert.equal(calculateNextTier(10, tiers), null)
})
