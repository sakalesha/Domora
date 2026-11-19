import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccessToken, createCsrfToken, decodeAccessToken, isValidCsrfToken } from './security.ts'
import {
  DomoraStore,
  DuplicateAccountError,
  InvalidCampParameterError,
  InvalidCredentialsError,
  InvalidInviteCodeError,
} from './store.ts'

test('CSRF and JWT tokens sign and verify properly', () => {
  const { token } = createCsrfToken()
  assert.equal(isValidCsrfToken(token), true)
  const { token: expired } = createCsrfToken(100)
  assert.equal(isValidCsrfToken(expired), false)

  const jwt = createAccessToken('user-123')
  assert.deepEqual(decodeAccessToken(jwt), { sub: 'user-123' })
})

test('DomoraStore signup, authentication, camp creation, and vendor assignment', () => {
  const store = new DomoraStore(true)

  // Invalid invite code rejected
  assert.throws(
    () =>
      store.createResident({
        username: 'bad.invite',
        password: 'password123',
        full_name: 'Bad Invite',
        phone: '+919900009999',
        unit_label: 'A-101',
        invite_code: 'NO-SUCH-CODE',
      }),
    InvalidInviteCodeError,
  )

  // Case-insensitive invite code accepted
  const resident = store.createResident({
    username: 'new.resident',
    password: 'correct horse battery staple',
    full_name: 'New Resident',
    phone: '+919900008888',
    unit_label: 'E-501',
    invite_code: 'sunrise-demo',
  })
  assert.equal(resident.role, 'resident')

  // Duplicate username rejected
  assert.throws(
    () =>
      store.createResident({
        username: 'new.resident',
        password: 'correct horse battery staple',
        full_name: 'Dup',
        phone: '+919900007777',
        unit_label: 'E-502',
        invite_code: 'SUNRISE-DEMO',
      }),
    DuplicateAccountError,
  )

  // Authentication
  const authed = store.authenticateUser('new.resident', 'correct horse battery staple')
  assert.equal(authed.id, resident.id)
  assert.throws(
    () => store.authenticateUser('new.resident', 'wrong'),
    InvalidCredentialsError,
  )

  // Camp creation and vendor assignment
  const ops = [...store.users.values()].find((u) => u.role === 'ops')!
  const society = store.listSocieties()[0]
  const service = store.listServices()[0]
  const vendor = store.listActiveVendors()[0]

  const startsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
  const endsAt = new Date(startsAt.getTime() + 6 * 60 * 60 * 1000)
  const joinDeadline = new Date(startsAt.getTime() - 25 * 60 * 60 * 1000)

  const created = store.createCamp(ops.id, {
    society_id: society.id,
    service_id: service.id,
    title: 'Unit Test Camp',
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    slot_minutes: 30,
    min_participants: 3,
    max_participants: 12,
    join_deadline: joinDeadline.toISOString(),
    base_price_paise: 80000,
    vendor_id: null,
    price_tiers: [
      { min_participants: 3, discount_pct: 10 },
      { min_participants: 6, discount_pct: 15 },
    ],
  })

  assert.equal(created.capacity_slots, 12)
  assert.equal(created.vendor, null)

  const reassigned = store.assignVendor(created.id, vendor.id)
  assert.equal(reassigned.vendor?.id, vendor.id)

  // Tier threshold exceeding max_participants rejected
  assert.throws(
    () =>
      store.createCamp(ops.id, {
        society_id: society.id,
        service_id: service.id,
        title: 'Bad Tier Camp',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        slot_minutes: 30,
        min_participants: 3,
        max_participants: 4,
        join_deadline: joinDeadline.toISOString(),
        base_price_paise: 80000,
        vendor_id: null,
        price_tiers: [{ min_participants: 5, discount_pct: 10 }],
      }),
    InvalidCampParameterError,
  )
})
