import crypto from 'node:crypto'
import {
  CampRuleValidationError,
  calculateCapacitySlots,
  parseIsoDateTime,
  validateCampParameters,
} from './campRules.ts'
import {
  PricingError,
  calculateDiscountPct,
  calculateDiscountedPricePaise,
  calculatePricingQuote,
  validatePriceTiers,
  type PriceTier,
} from './pricing.ts'
import { hashPassword, verifyPassword } from './security.ts'

export type UserRole = 'resident' | 'vendor' | 'ops'
export type CampStatus = 'open' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
export type BookingStatus = 'joined' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export interface Society {
  id: string
  name: string
  city: string
  address: string
  invite_code: string
  created_at: string
}

export interface Service {
  id: string
  code: string
  name: string
}

export interface User {
  id: string
  username: string
  password_hash: string
  full_name: string
  phone: string
  role: UserRole
  is_active: boolean
  society_id: string | null
  unit_label: string | null
  created_at: string
}

export interface Camp {
  id: string
  society_id: string
  service_id: string
  title: string
  starts_at: string
  ends_at: string
  slot_minutes: number
  min_participants: number
  max_participants: number
  join_deadline: string
  base_price_paise: number
  status: CampStatus
  vendor_id: string | null
  created_by: string | null
  cancelled_reason: string | null
  created_at: string
  price_tiers: PriceTier[]
}

export interface Booking {
  id: string
  camp_id: string
  resident_id: string
  status: BookingStatus
  quoted_price_paise: number
  final_price_paise: number | null
  slot_starts_at: string | null
  created_at: string
  cancelled_at: string | null
}

export class InvalidInviteCodeError extends Error {}
export class DuplicateAccountError extends Error {}
export class InvalidCredentialsError extends Error {}
export class CampNotFoundError extends Error {}
export class SocietyNotFoundError extends Error {}
export class ServiceNotFoundError extends Error {}
export class VendorNotFoundError extends Error {}
export class InvalidCampParameterError extends Error {}
export class InvalidCampStateError extends Error {}

export interface CampCreateInput {
  society_id: string
  service_id: string
  title: string
  starts_at: string
  ends_at: string
  slot_minutes: number
  min_participants: number
  max_participants: number
  join_deadline: string
  base_price_paise: number
  vendor_id: string | null
  price_tiers: PriceTier[]
}

export interface UserSummaryDto {
  id: string
  username: string
  full_name: string
  phone: string
  role: UserRole
  society_id: string | null
  unit_label: string | null
  phone_verified: false
}

export interface CurrentUserDto extends UserSummaryDto {
  society: { id: string; name: string; city: string } | null
}

export class DomoraStore {
  societies = new Map<string, Society>()
  services = new Map<string, Service>()
  users = new Map<string, User>()
  camps = new Map<string, Camp>()
  bookings = new Map<string, Booking>()

  constructor(seedDemo = true) {
    if (seedDemo) {
      this.seed()
    }
  }

  seed(): void {
    const now = Date.now()
    const daysFromNow = (days: number, hoursOffset = 0) =>
      new Date(now + days * 24 * 60 * 60 * 1000 + hoursOffset * 60 * 60 * 1000).toISOString()

    // Societies
    const sunriseId = '11111111-1111-4111-8111-111111111101'
    const palmGroveId = '11111111-1111-4111-8111-111111111102'

    this.societies.set(sunriseId, {
      id: sunriseId,
      name: 'Sunrise Heights',
      address: '1 Main Road, Indiranagar',
      city: 'Bengaluru',
      invite_code: 'SUNRISE-DEMO',
      created_at: daysFromNow(-30),
    })

    this.societies.set(palmGroveId, {
      id: palmGroveId,
      name: 'Palm Grove Residency',
      address: '42 Outer Ring Road, Bellandur',
      city: 'Bengaluru',
      invite_code: 'PALM-2026',
      created_at: daysFromNow(-20),
    })

    // Services
    const pestId = '22222222-2222-4222-8222-222222222201'
    const acId = '22222222-2222-4222-8222-222222222202'

    this.services.set(pestId, {
      id: pestId,
      code: 'pest_control',
      name: 'Pest control',
    })
    this.services.set(acId, {
      id: acId,
      code: 'ac_service',
      name: 'AC servicing',
    })

    // Seed Users (Ops, Vendors, Residents)
    const opsId = '33333333-3333-4333-8333-333333333301'
    const vendor1Id = '33333333-3333-4333-8333-333333333302'
    const vendor2Id = '33333333-3333-4333-8333-333333333303'
    const res1Id = '33333333-3333-4333-8333-333333333311'
    const res2Id = '33333333-3333-4333-8333-333333333312'
    const res3Id = '33333333-3333-4333-8333-333333333313'
    const res4Id = '33333333-3333-4333-8333-333333333314'

    const opsPasswordHash = hashPassword(process.env.SEED_OPS_PASSWORD || 'domora-ops-2026')
    const vendorPasswordHash = hashPassword(
      process.env.SEED_VENDOR_PASSWORD || 'domora-vendor-2026',
    )
    const residentPasswordHash = hashPassword('domora-res-2026')

    this.users.set(opsId, {
      id: opsId,
      username: process.env.SEED_OPS_USERNAME || 'ops.admin',
      password_hash: opsPasswordHash,
      full_name: process.env.SEED_OPS_FULL_NAME || 'Priya Sharma',
      phone: process.env.SEED_OPS_PHONE || '+919800000001',
      role: 'ops',
      is_active: true,
      society_id: null,
      unit_label: null,
      created_at: daysFromNow(-29),
    })

    this.users.set(vendor1Id, {
      id: vendor1Id,
      username: process.env.SEED_VENDOR_USERNAME || 'vendor.arjun',
      password_hash: vendorPasswordHash,
      full_name: process.env.SEED_VENDOR_FULL_NAME || 'Arjun CoolCare Services',
      phone: process.env.SEED_VENDOR_PHONE || '+919800000011',
      role: 'vendor',
      is_active: true,
      society_id: null,
      unit_label: null,
      created_at: daysFromNow(-28),
    })

    this.users.set(vendor2Id, {
      id: vendor2Id,
      username: 'vendor.meera',
      password_hash: vendorPasswordHash,
      full_name: 'Meera Pest Shield',
      phone: '+919800000012',
      role: 'vendor',
      is_active: true,
      society_id: null,
      unit_label: null,
      created_at: daysFromNow(-27),
    })

    const residents: Array<[string, string, string, string, string, string]> = [
      [res1Id, 'resident.ananya', 'Ananya Rao', '+919900000101', sunriseId, 'A-104'],
      [res2Id, 'resident.vikram', 'Vikram Patel', '+919900000102', sunriseId, 'B-302'],
      [res3Id, 'resident.kavya', 'Kavya Nair', '+919900000103', sunriseId, 'C-205'],
      [res4Id, 'resident.rohan', 'Rohan Verma', '+919900000104', palmGroveId, 'D-402'],
    ]

    for (const [id, username, fullName, phone, socId, unitLabel] of residents) {
      this.users.set(id, {
        id,
        username,
        password_hash: residentPasswordHash,
        full_name: fullName,
        phone,
        role: 'resident',
        is_active: true,
        society_id: socId,
        unit_label: unitLabel,
        created_at: daysFromNow(-15),
      })
    }

    // Seed Camps
    const camp1Id = '44444444-4444-4444-8444-444444444401'
    const camp2Id = '44444444-4444-4444-8444-444444444402'
    const camp3Id = '44444444-4444-4444-8444-444444444403'

    const camp1Start = daysFromNow(4, 0)
    const camp1End = daysFromNow(4, 6)
    const camp1Deadline = daysFromNow(2, 12)

    this.camps.set(camp1Id, {
      id: camp1Id,
      society_id: sunriseId,
      service_id: acId,
      title: 'Pre-Monsoon AC Deep Cleaning Camp',
      starts_at: camp1Start,
      ends_at: camp1End,
      slot_minutes: 30,
      min_participants: 3,
      max_participants: 12,
      join_deadline: camp1Deadline,
      base_price_paise: 80000,
      status: 'open',
      vendor_id: vendor1Id,
      created_by: opsId,
      cancelled_reason: null,
      created_at: daysFromNow(-3),
      price_tiers: [
        { min_participants: 3, discount_pct: 10 },
        { min_participants: 6, discount_pct: 15 },
        { min_participants: 10, discount_pct: 20 },
      ],
    })

    this.camps.set(camp2Id, {
      id: camp2Id,
      society_id: palmGroveId,
      service_id: pestId,
      title: 'Quarterly Pest Control Drive',
      starts_at: daysFromNow(2, 2),
      ends_at: daysFromNow(2, 6),
      slot_minutes: 30,
      min_participants: 4,
      max_participants: 8,
      join_deadline: daysFromNow(0, 18), // within 24h -> triggers critical triage!
      base_price_paise: 120000,
      status: 'open',
      vendor_id: null,
      created_by: opsId,
      cancelled_reason: null,
      created_at: daysFromNow(-2),
      price_tiers: [
        { min_participants: 4, discount_pct: 10 },
        { min_participants: 7, discount_pct: 20 },
      ],
    })

    this.camps.set(camp3Id, {
      id: camp3Id,
      society_id: sunriseId,
      service_id: acId,
      title: 'Split AC Gas & Coil Check',
      starts_at: daysFromNow(1, 0),
      ends_at: daysFromNow(1, 3),
      slot_minutes: 30,
      min_participants: 3,
      max_participants: 6,
      join_deadline: daysFromNow(-1, 0),
      base_price_paise: 95000,
      status: 'confirmed',
      vendor_id: vendor1Id,
      created_by: opsId,
      cancelled_reason: null,
      created_at: daysFromNow(-6),
      price_tiers: [
        { min_participants: 3, discount_pct: 10 },
        { min_participants: 5, discount_pct: 15 },
      ],
    })

    // Seed Bookings for Camp 1 (3 active bookings -> Tier 1 unlocked, 72,000 paise)
    const camp1Bookings: Array<[string, string, number]> = [
      ['55555555-5555-4555-8555-555555555501', res1Id, -48],
      ['55555555-5555-4555-8555-555555555502', res2Id, -36],
      ['55555555-5555-4555-8555-555555555503', res3Id, -12],
    ]
    for (const [bId, residentId, hoursAgo] of camp1Bookings) {
      this.bookings.set(bId, {
        id: bId,
        camp_id: camp1Id,
        resident_id: residentId,
        status: 'joined',
        quoted_price_paise: 72000,
        final_price_paise: null,
        slot_starts_at: null,
        created_at: new Date(now + hoursAgo * 60 * 60 * 1000).toISOString(),
        cancelled_at: null,
      })
    }

    // Seed Booking for Camp 2 (1 active booking)
    this.bookings.set('55555555-5555-4555-8555-555555555504', {
      id: '55555555-5555-4555-8555-555555555504',
      camp_id: camp2Id,
      resident_id: res4Id,
      status: 'joined',
      quoted_price_paise: 120000,
      final_price_paise: null,
      slot_starts_at: null,
      created_at: daysFromNow(-1),
      cancelled_at: null,
    })

    // Seed Bookings for Camp 3 (confirmed with scheduled slot times)
    const camp3StartMs = new Date(daysFromNow(1, 0)).getTime()
    const camp3Bookings: Array<[string, string, number]> = [
      ['55555555-5555-4555-8555-555555555505', res1Id, 0],
      ['55555555-5555-4555-8555-555555555506', res2Id, 30],
      ['55555555-5555-4555-8555-555555555507', res3Id, 60],
    ]
    for (const [bId, residentId, offsetMinutes] of camp3Bookings) {
      this.bookings.set(bId, {
        id: bId,
        camp_id: camp3Id,
        resident_id: residentId,
        status: 'scheduled',
        quoted_price_paise: 85500,
        final_price_paise: 85500,
        slot_starts_at: new Date(camp3StartMs + offsetMinutes * 60 * 1000).toISOString(),
        created_at: daysFromNow(-4),
        cancelled_at: null,
      })
    }
  }

  toUserSummary(user: User): UserSummaryDto {
    return {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
      society_id: user.society_id,
      unit_label: user.unit_label,
      phone_verified: false,
    }
  }

  toCurrentUser(user: User): CurrentUserDto {
    const society = user.society_id ? this.societies.get(user.society_id) ?? null : null
    return {
      ...this.toUserSummary(user),
      society: society
        ? {
            id: society.id,
            name: society.name,
            city: society.city,
          }
        : null,
    }
  }

  createResident(input: {
    username: string
    password: string
    full_name: string
    phone: string
    unit_label: string
    invite_code: string
  }): User {
    const normalizedInvite = input.invite_code.trim().toLowerCase()
    const society = [...this.societies.values()].find(
      (s) => s.invite_code.toLowerCase() === normalizedInvite,
    )
    if (!society) {
      throw new InvalidInviteCodeError('Invalid invite code')
    }

    const existing = [...this.users.values()].find(
      (u) => u.username === input.username || u.phone === input.phone,
    )
    if (existing) {
      throw new DuplicateAccountError('Username or phone number is already in use')
    }

    const user: User = {
      id: crypto.randomUUID(),
      username: input.username,
      password_hash: hashPassword(input.password),
      full_name: input.full_name,
      phone: input.phone,
      role: 'resident',
      is_active: true,
      society_id: society.id,
      unit_label: input.unit_label,
      created_at: new Date().toISOString(),
    }
    this.users.set(user.id, user)
    return user
  }

  authenticateUser(username: string, password: string): User {
    const user = [...this.users.values()].find((u) => u.username === username)
    if (!user) {
      throw new InvalidCredentialsError('Invalid username or password')
    }
    const matches = verifyPassword(password, user.password_hash)
    if (!matches || !user.is_active) {
      throw new InvalidCredentialsError('Invalid username or password')
    }
    return user
  }

  listSocieties(): Society[] {
    return [...this.societies.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  listServices(): Service[] {
    return [...this.services.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  listActiveVendors(): Array<{ id: string; full_name: string; phone: string }> {
    return [...this.users.values()]
      .filter((u) => u.role === 'vendor' && u.is_active)
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map((v) => ({
        id: v.id,
        full_name: v.full_name,
        phone: v.phone,
      }))
  }

  createCamp(creatorId: string, data: CampCreateInput) {
    let startsAt: Date
    let endsAt: Date
    let joinDeadline: Date
    try {
      startsAt = parseIsoDateTime(data.starts_at, 'starts_at')
      endsAt = parseIsoDateTime(data.ends_at, 'ends_at')
      joinDeadline = parseIsoDateTime(data.join_deadline, 'join_deadline')

      validateCampParameters({
        startsAt,
        endsAt,
        slotMinutes: data.slot_minutes,
        minParticipants: data.min_participants,
        maxParticipants: data.max_participants,
        joinDeadline,
        basePricePaise: data.base_price_paise,
      })
    } catch (err) {
      if (err instanceof CampRuleValidationError) {
        throw new InvalidCampParameterError(err.message)
      }
      throw err
    }

    let sortedTiers: PriceTier[]
    try {
      sortedTiers = validatePriceTiers(data.price_tiers)
    } catch (err) {
      if (err instanceof PricingError) {
        throw new InvalidCampParameterError(err.message)
      }
      throw err
    }

    for (const tier of sortedTiers) {
      if (tier.min_participants > data.max_participants) {
        throw new InvalidCampParameterError(
          `Price tier min_participants (${tier.min_participants}) cannot exceed max_participants (${data.max_participants})`,
        )
      }
    }

    const society = this.societies.get(data.society_id)
    if (!society) {
      throw new SocietyNotFoundError(`Society '${data.society_id}' does not exist`)
    }

    const service = this.services.get(data.service_id)
    if (!service) {
      throw new ServiceNotFoundError(`Service '${data.service_id}' does not exist`)
    }

    if (data.vendor_id !== null) {
      const vendor = this.users.get(data.vendor_id)
      if (!vendor || vendor.role !== 'vendor' || !vendor.is_active) {
        throw new VendorNotFoundError(`Vendor '${data.vendor_id}' is invalid or inactive`)
      }
    }

    const camp: Camp = {
      id: crypto.randomUUID(),
      society_id: data.society_id,
      service_id: data.service_id,
      title: data.title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      slot_minutes: data.slot_minutes,
      min_participants: data.min_participants,
      max_participants: data.max_participants,
      join_deadline: joinDeadline.toISOString(),
      base_price_paise: data.base_price_paise,
      status: 'open',
      vendor_id: data.vendor_id,
      created_by: creatorId,
      cancelled_reason: null,
      created_at: new Date().toISOString(),
      price_tiers: sortedTiers,
    }

    this.camps.set(camp.id, camp)
    return this.getCampDetail(camp.id)
  }

  listCamps(filters?: { societyId?: string; status?: string }) {
    const camps = [...this.camps.values()]
      .filter((c) => {
        if (filters?.societyId && c.society_id !== filters.societyId) return false
        if (filters?.status && c.status !== filters.status) return false
        return true
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return camps.map((camp) => {
      const society = this.societies.get(camp.society_id)!
      const service = this.services.get(camp.service_id)!
      const vendor = camp.vendor_id ? this.users.get(camp.vendor_id) ?? null : null
      const activeBookings = [...this.bookings.values()].filter(
        (b) => b.camp_id === camp.id && b.status !== 'cancelled',
      )
      const activeCount = activeBookings.length
      const capacitySlots = calculateCapacitySlots(
        new Date(camp.starts_at),
        new Date(camp.ends_at),
        camp.slot_minutes,
      )
      const spotsRemaining = Math.max(0, camp.max_participants - activeCount)
      const discountPct = calculateDiscountPct(activeCount, camp.price_tiers)
      const currentPrice = calculateDiscountedPricePaise(camp.base_price_paise, discountPct)

      return {
        id: camp.id,
        society: {
          id: society.id,
          name: society.name,
          city: society.city,
          address: society.address,
          invite_code: society.invite_code,
        },
        service: {
          id: service.id,
          code: service.code,
          name: service.name,
        },
        vendor: vendor
          ? {
              id: vendor.id,
              full_name: vendor.full_name,
              phone: vendor.phone,
            }
          : null,
        title: camp.title,
        starts_at: camp.starts_at,
        ends_at: camp.ends_at,
        slot_minutes: camp.slot_minutes,
        status: camp.status,
        min_participants: camp.min_participants,
        max_participants: camp.max_participants,
        capacity_slots: capacitySlots,
        active_participants_count: activeCount,
        spots_remaining: spotsRemaining,
        base_price_paise: camp.base_price_paise,
        current_price_paise: currentPrice,
        join_deadline: camp.join_deadline,
        created_at: camp.created_at,
      }
    })
  }

  getCampDetail(campId: string) {
    const camp = this.camps.get(campId)
    if (!camp) {
      throw new CampNotFoundError(`Camp '${campId}' not found`)
    }

    const society = this.societies.get(camp.society_id)!
    const service = this.services.get(camp.service_id)!
    const vendor = camp.vendor_id ? this.users.get(camp.vendor_id) ?? null : null

    const sortedTiers = [...camp.price_tiers].sort(
      (a, b) => a.min_participants - b.min_participants,
    )
    const activeBookings = [...this.bookings.values()]
      .filter((b) => b.camp_id === camp.id && b.status !== 'cancelled')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const activeCount = activeBookings.length
    const capacitySlots = calculateCapacitySlots(
      new Date(camp.starts_at),
      new Date(camp.ends_at),
      camp.slot_minutes,
    )

    const quote = calculatePricingQuote(camp.base_price_paise, activeCount, sortedTiers)
    const nextTierResp = quote.next_tier
      ? {
          min_participants: quote.next_tier.target_participants,
          discount_pct: quote.next_tier.discount_pct,
          participants_needed: quote.next_tier.more_needed,
          potential_price_paise: calculateDiscountedPricePaise(
            camp.base_price_paise,
            quote.next_tier.discount_pct,
          ),
        }
      : null

    const participants = activeBookings.map((b) => {
      const resident = this.users.get(b.resident_id)!
      return {
        booking_id: b.id,
        resident_id: b.resident_id,
        full_name: resident.full_name,
        unit_label: resident.unit_label,
        phone: resident.phone,
        status: b.status,
        quoted_price_paise: b.quoted_price_paise,
        final_price_paise: b.final_price_paise,
        slot_starts_at: b.slot_starts_at,
        created_at: b.created_at,
      }
    })

    return {
      id: camp.id,
      society: {
        id: society.id,
        name: society.name,
        city: society.city,
        address: society.address,
        invite_code: society.invite_code,
      },
      service: {
        id: service.id,
        code: service.code,
        name: service.name,
      },
      vendor: vendor
        ? {
            id: vendor.id,
            full_name: vendor.full_name,
            phone: vendor.phone,
          }
        : null,
      title: camp.title,
      starts_at: camp.starts_at,
      ends_at: camp.ends_at,
      slot_minutes: camp.slot_minutes,
      status: camp.status,
      min_participants: camp.min_participants,
      max_participants: camp.max_participants,
      capacity_slots: capacitySlots,
      base_price_paise: camp.base_price_paise,
      join_deadline: camp.join_deadline,
      cancelled_reason: camp.cancelled_reason,
      created_at: camp.created_at,
      price_tiers: sortedTiers,
      pricing_quote: {
        headcount: quote.headcount,
        base_price_paise: quote.base_price_paise,
        discount_pct: quote.discount_pct,
        discounted_price_paise: quote.final_price_paise,
        next_tier: nextTierResp,
      },
      participants,
    }
  }

  assignVendor(campId: string, vendorId: string | null) {
    const camp = this.camps.get(campId)
    if (!camp) {
      throw new CampNotFoundError(`Camp '${campId}' not found`)
    }

    if (camp.status === 'completed' || camp.status === 'cancelled') {
      throw new InvalidCampStateError(`Cannot assign vendor to camp with status '${camp.status}'`)
    }

    if (vendorId !== null) {
      const vendor = this.users.get(vendorId)
      if (!vendor || vendor.role !== 'vendor' || !vendor.is_active) {
        throw new VendorNotFoundError(`Vendor '${vendorId}' is invalid or inactive`)
      }
    }

    camp.vendor_id = vendorId
    return this.getCampDetail(campId)
  }
}
