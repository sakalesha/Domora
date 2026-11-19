export class PricingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PricingError'
  }
}

export class InvalidTierError extends PricingError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidTierError'
  }
}

export interface PriceTier {
  min_participants: number
  discount_pct: number
}

export interface NextTierInfo {
  more_needed: number
  target_participants: number
  discount_pct: number
}

export interface PricingQuote {
  base_price_paise: number
  headcount: number
  discount_pct: number
  final_price_paise: number
  next_tier: NextTierInfo | null
}

export function validatePriceTiers(tiers: readonly PriceTier[]): PriceTier[] {
  if (tiers.length === 0) {
    return []
  }

  for (const tier of tiers) {
    if (!Number.isInteger(tier.min_participants) || tier.min_participants < 1) {
      throw new InvalidTierError(
        `Minimum participants must be at least 1, got ${tier.min_participants}`,
      )
    }
    if (!Number.isInteger(tier.discount_pct) || tier.discount_pct < 0 || tier.discount_pct > 100) {
      throw new InvalidTierError(
        `Discount percentage must be between 0 and 100, got ${tier.discount_pct}`,
      )
    }
  }

  const sortedTiers = [...tiers]
    .map((t) => ({ min_participants: t.min_participants, discount_pct: t.discount_pct }))
    .sort((a, b) => a.min_participants - b.min_participants)

  for (let i = 0; i < sortedTiers.length - 1; i++) {
    const currentTier = sortedTiers[i]
    const nextTier = sortedTiers[i + 1]

    if (currentTier.min_participants === nextTier.min_participants) {
      throw new InvalidTierError(
        `Duplicate participant threshold: ${currentTier.min_participants}`,
      )
    }
    if (nextTier.discount_pct <= currentTier.discount_pct) {
      throw new InvalidTierError(
        'Discounts must strictly increase as participant thresholds grow ' +
          `(${currentTier.discount_pct}% at ${currentTier.min_participants} vs ` +
          `${nextTier.discount_pct}% at ${nextTier.min_participants})`,
      )
    }
  }

  return sortedTiers
}

export function calculateDiscountPct(headcount: number, tiers: readonly PriceTier[]): number {
  if (!Number.isInteger(headcount) || headcount < 0) {
    throw new PricingError('Headcount cannot be negative')
  }

  const validTiers = validatePriceTiers(tiers)
  let discount = 0

  for (const tier of validTiers) {
    if (headcount >= tier.min_participants) {
      discount = tier.discount_pct
    } else {
      break
    }
  }

  return discount
}

export function calculateDiscountedPricePaise(
  basePricePaise: number,
  discountPct: number,
): number {
  if (!Number.isInteger(basePricePaise) || basePricePaise < 0) {
    throw new PricingError('Base price cannot be negative')
  }
  if (!Number.isInteger(discountPct) || discountPct < 0 || discountPct > 100) {
    throw new PricingError('Discount percentage must be between 0 and 100')
  }

  if (discountPct === 0) return basePricePaise
  if (discountPct === 100) return 0

  // Exact integer round-half-up equivalent of Decimal.quantize(ROUND_HALF_UP)
  return Math.floor((basePricePaise * (100 - discountPct) + 50) / 100)
}

export function calculateNextTier(
  headcount: number,
  tiers: readonly PriceTier[],
): NextTierInfo | null {
  if (!Number.isInteger(headcount) || headcount < 0) {
    throw new PricingError('Headcount cannot be negative')
  }

  const validTiers = validatePriceTiers(tiers)

  for (const tier of validTiers) {
    if (tier.min_participants > headcount) {
      return {
        more_needed: tier.min_participants - headcount,
        target_participants: tier.min_participants,
        discount_pct: tier.discount_pct,
      }
    }
  }

  return null
}

export function calculatePricingQuote(
  basePricePaise: number,
  headcount: number,
  tiers: readonly PriceTier[],
): PricingQuote {
  if (!Number.isInteger(basePricePaise) || basePricePaise < 0) {
    throw new PricingError('Base price cannot be negative')
  }
  if (!Number.isInteger(headcount) || headcount < 0) {
    throw new PricingError('Headcount cannot be negative')
  }

  const discountPct = calculateDiscountPct(headcount, tiers)
  const finalPricePaise = calculateDiscountedPricePaise(basePricePaise, discountPct)
  const nextTier = calculateNextTier(headcount, tiers)

  return {
    base_price_paise: basePricePaise,
    headcount,
    discount_pct: discountPct,
    final_price_paise: finalPricePaise,
    next_tier: nextTier,
  }
}
