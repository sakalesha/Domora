import express, { type NextFunction, type Request, type Response } from 'express'
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_EXPIRE_MINUTES,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  createAccessToken,
  createCsrfToken,
  csrfTokenExpiry,
  decodeAccessToken,
  isValidCsrfToken,
  timingSafeStringEqual,
} from './security.ts'
import {
  CampNotFoundError,
  DomoraStore,
  DuplicateAccountError,
  InvalidCampParameterError,
  InvalidCampStateError,
  InvalidCredentialsError,
  InvalidInviteCodeError,
  ServiceNotFoundError,
  SocietyNotFoundError,
  VendorNotFoundError,
  type User,
  type UserRole,
} from './store.ts'

const DEFAULT_ALLOWED_ORIGINS = new Set(
  (
    process.env.CORS_ALLOWED_ORIGINS ||
    'http://localhost:5173,http://localhost:3000,http://127.0.0.1:3000'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
)

interface ValidationIssue {
  loc: Array<string | number>
  msg: string
  type: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = req.headers['x-forwarded-proto']
  if (typeof forwardedProto === 'string') {
    return forwardedProto.split(',')[0].trim().toLowerCase() === 'https'
  }
  return req.secure
}

function cookieOptions(req: Request, maxAgeSeconds?: number) {
  const https = isHttpsRequest(req)
  return {
    httpOnly: true,
    path: '/',
    secure: https,
    sameSite: (https ? 'none' : 'lax') as 'none' | 'lax',
    ...(maxAgeSeconds !== undefined ? { maxAge: maxAgeSeconds * 1000 } : {}),
  }
}

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.origin
  if (typeof origin === 'string' && origin.length > 0) {
    if (DEFAULT_ALLOWED_ORIGINS.has(origin)) {
      return true
    }
    try {
      const originUrl = new URL(origin)
      const requestHost =
        (typeof req.headers['x-forwarded-host'] === 'string'
          ? req.headers['x-forwarded-host'].split(',')[0].trim()
          : req.headers.host) || ''
      if (requestHost && originUrl.host === requestHost) {
        return true
      }
    } catch {
      return false
    }
    return false
  }

  // Same-origin GET or direct request without Origin header
  const fetchSite = req.headers['sec-fetch-site']
  if (fetchSite === 'cross-site') {
    return false
  }
  return true
}

function requireAllowedOrigin(req: Request, res: Response, next: NextFunction): void {
  if (!isAllowedOrigin(req)) {
    res.status(403).json({ detail: 'Request could not be completed' })
    return
  }
  next()
}

function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    next()
    return
  }

  if (!isAllowedOrigin(req)) {
    res.status(403).json({ detail: 'Request could not be completed' })
    return
  }

  const headerToken = req.headers[CSRF_HEADER_NAME]
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME]

  if (
    typeof headerToken !== 'string' ||
    typeof cookieToken !== 'string' ||
    !timingSafeStringEqual(headerToken, cookieToken) ||
    !isValidCsrfToken(cookieToken)
  ) {
    res.status(403).json({ detail: 'Request could not be completed' })
    return
  }

  next()
}

function extractCurrentUser(req: Request, store: DomoraStore): User | null {
  let token: string | undefined
  const cookieToken = req.cookies?.[ACCESS_COOKIE_NAME]
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    token = cookieToken
  } else {
    const authHeader = req.headers.authorization
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length).trim()
    }
  }

  if (!token) return null

  try {
    const { sub } = decodeAccessToken(token)
    const user = store.users.get(sub)
    if (!user || !user.is_active) return null
    return user
  } catch {
    return null
  }
}

function requireAuth(store: DomoraStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = extractCurrentUser(req, store)
    if (!user) {
      res.status(401).json({ detail: 'Could not validate credentials' })
      return
    }
    res.locals.currentUser = user
    next()
  }
}

function requireRole(store: DomoraStore, role: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = extractCurrentUser(req, store)
    if (!user) {
      res.status(401).json({ detail: 'Could not validate credentials' })
      return
    }
    if (user.role !== role) {
      res.status(403).json({ detail: 'Insufficient permissions' })
      return
    }
    res.locals.currentUser = user
    next()
  }
}

function validateStringField(
  body: Record<string, unknown>,
  field: string,
  opts: { minLength: number; maxLength: number; strip: boolean },
  issues: ValidationIssue[],
): string | null {
  if (!(field in body) || body[field] === undefined || body[field] === null) {
    issues.push({ loc: ['body', field], msg: 'Field required', type: 'missing' })
    return null
  }
  if (typeof body[field] !== 'string') {
    issues.push({ loc: ['body', field], msg: 'Input should be a valid string', type: 'string_type' })
    return null
  }
  const value = opts.strip ? body[field].trim() : body[field]
  if (value.length < opts.minLength) {
    issues.push({
      loc: ['body', field],
      msg: `String should have at least ${opts.minLength} characters`,
      type: 'string_too_short',
    })
    return null
  }
  if (value.length > opts.maxLength) {
    issues.push({
      loc: ['body', field],
      msg: `String should have at most ${opts.maxLength} characters`,
      type: 'string_too_long',
    })
    return null
  }
  return value
}

export function createApiRouter(store: DomoraStore): express.Router {
  const router = express.Router()

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // =========================================================================
  // Auth Routes (/auth/*)
  // =========================================================================

  router.get('/auth/csrf', requireAllowedOrigin, (req, res) => {
    let token = req.cookies?.[CSRF_COOKIE_NAME]
    let expiresAt: number | null = null

    if (typeof token !== 'string' || !isValidCsrfToken(token)) {
      const created = createCsrfToken()
      token = created.token
      expiresAt = created.expiresAt
    } else {
      expiresAt = csrfTokenExpiry(token)
    }

    const nowSec = Math.floor(Date.now() / 1000)
    const maxAgeSec = Math.max(0, (expiresAt ?? nowSec) - nowSec)

    res.cookie(CSRF_COOKIE_NAME, token, cookieOptions(req, maxAgeSec))
    res.json({ csrf_token: token })
  })

  router.post('/auth/signup', requireCsrf, (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(422).json({ detail: 'Invalid request body' })
      return
    }

    const allowedKeys = new Set([
      'username',
      'password',
      'full_name',
      'phone',
      'unit_label',
      'invite_code',
    ])
    for (const key of Object.keys(req.body)) {
      if (!allowedKeys.has(key)) {
        res.status(422).json({
          detail: [{ loc: ['body', key], msg: 'Extra inputs are not permitted', type: 'extra_forbidden' }],
        })
        return
      }
    }

    const issues: ValidationIssue[] = []
    const username = validateStringField(req.body, 'username', { minLength: 1, maxLength: 80, strip: true }, issues)
    const password = validateStringField(req.body, 'password', { minLength: 8, maxLength: 128, strip: false }, issues)
    const fullName = validateStringField(req.body, 'full_name', { minLength: 1, maxLength: 150, strip: true }, issues)
    const phone = validateStringField(req.body, 'phone', { minLength: 1, maxLength: 30, strip: true }, issues)
    const unitLabel = validateStringField(req.body, 'unit_label', { minLength: 1, maxLength: 50, strip: true }, issues)
    const inviteCode = validateStringField(req.body, 'invite_code', { minLength: 1, maxLength: 50, strip: true }, issues)

    if (
      issues.length > 0 ||
      username === null ||
      password === null ||
      fullName === null ||
      phone === null ||
      unitLabel === null ||
      inviteCode === null
    ) {
      res.status(422).json({ detail: issues })
      return
    }

    try {
      const user = store.createResident({
        username,
        password,
        full_name: fullName,
        phone,
        unit_label: unitLabel,
        invite_code: inviteCode,
      })
      res.status(201).json(store.toUserSummary(user))
    } catch (err) {
      if (err instanceof InvalidInviteCodeError) {
        res.status(422).json({ detail: 'Invalid invite code' })
        return
      }
      if (err instanceof DuplicateAccountError) {
        res.status(409).json({ detail: 'Username or phone number is already in use' })
        return
      }
      throw err
    }
  })

  router.post('/auth/login', requireCsrf, (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(422).json({ detail: 'Invalid request body' })
      return
    }

    const allowedKeys = new Set(['username', 'password'])
    for (const key of Object.keys(req.body)) {
      if (!allowedKeys.has(key)) {
        res.status(422).json({
          detail: [{ loc: ['body', key], msg: 'Extra inputs are not permitted', type: 'extra_forbidden' }],
        })
        return
      }
    }

    const issues: ValidationIssue[] = []
    const username = validateStringField(req.body, 'username', { minLength: 1, maxLength: 80, strip: true }, issues)
    const password = validateStringField(req.body, 'password', { minLength: 1, maxLength: 128, strip: false }, issues)

    if (issues.length > 0 || username === null || password === null) {
      res.status(422).json({ detail: issues })
      return
    }

    try {
      const user = store.authenticateUser(username, password)
      const expiresIn = ACCESS_TOKEN_EXPIRE_MINUTES * 60
      const token = createAccessToken(user.id)
      res.cookie(ACCESS_COOKIE_NAME, token, cookieOptions(req, expiresIn))
      res.json({ expires_in: expiresIn })
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        res.status(401).json({ detail: 'Invalid username or password' })
        return
      }
      throw err
    }
  })

  router.get('/auth/me', requireAuth(store), (_req, res) => {
    const user = res.locals.currentUser as User
    res.json(store.toCurrentUser(user))
  })

  router.post('/auth/logout', requireCsrf, (req, res) => {
    res.clearCookie(ACCESS_COOKIE_NAME, cookieOptions(req))
    res.clearCookie(CSRF_COOKIE_NAME, cookieOptions(req))
    res.status(204).send()
  })

  // =========================================================================
  // Ops Routes (/ops/*)
  // =========================================================================

  router.get('/ops/societies', requireRole(store, 'ops'), (_req, res) => {
    res.json(store.listSocieties())
  })

  router.get('/ops/services', requireRole(store, 'ops'), (_req, res) => {
    res.json(store.listServices())
  })

  router.get('/ops/vendors', requireRole(store, 'ops'), (_req, res) => {
    res.json(store.listActiveVendors())
  })

  router.get('/ops/camps', requireRole(store, 'ops'), (req, res) => {
    const societyId = typeof req.query.society_id === 'string' ? req.query.society_id : undefined
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    res.json(store.listCamps({ societyId, status }))
  })

  router.get('/ops/camps/:campId', requireRole(store, 'ops'), (req, res) => {
    try {
      res.json(store.getCampDetail(String(req.params.campId)))
    } catch (err) {
      if (err instanceof CampNotFoundError) {
        res.status(404).json({ detail: err.message })
        return
      }
      throw err
    }
  })

  router.post('/ops/camps', requireCsrf, requireRole(store, 'ops'), (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(422).json({ detail: 'Invalid request body' })
      return
    }

    const currentUser = res.locals.currentUser as User
    const body = req.body

    const allowedKeys = new Set([
      'society_id',
      'service_id',
      'title',
      'starts_at',
      'ends_at',
      'slot_minutes',
      'min_participants',
      'max_participants',
      'join_deadline',
      'base_price_paise',
      'vendor_id',
      'price_tiers',
    ])
    for (const key of Object.keys(body)) {
      if (!allowedKeys.has(key)) {
        res.status(422).json({ detail: `Extra field '${key}' is not permitted` })
        return
      }
    }

    if (
      typeof body.society_id !== 'string' ||
      !body.society_id.trim() ||
      typeof body.service_id !== 'string' ||
      !body.service_id.trim() ||
      typeof body.title !== 'string' ||
      !body.title.trim() ||
      body.title.trim().length > 200 ||
      typeof body.starts_at !== 'string' ||
      typeof body.ends_at !== 'string' ||
      typeof body.join_deadline !== 'string' ||
      typeof body.slot_minutes !== 'number' ||
      !Number.isInteger(body.slot_minutes) ||
      typeof body.min_participants !== 'number' ||
      !Number.isInteger(body.min_participants) ||
      typeof body.max_participants !== 'number' ||
      !Number.isInteger(body.max_participants) ||
      typeof body.base_price_paise !== 'number' ||
      !Number.isInteger(body.base_price_paise)
    ) {
      res.status(422).json({ detail: 'Invalid camp creation payload' })
      return
    }

    const vendorId =
      body.vendor_id === undefined || body.vendor_id === null
        ? null
        : typeof body.vendor_id === 'string'
          ? body.vendor_id
          : undefined
    if (vendorId === undefined) {
      res.status(422).json({ detail: 'Invalid vendor_id' })
      return
    }

    const rawTiers = body.price_tiers === undefined ? [] : body.price_tiers
    if (!Array.isArray(rawTiers)) {
      res.status(422).json({ detail: 'price_tiers must be an array' })
      return
    }
    const priceTiers: Array<{ min_participants: number; discount_pct: number }> = []
    for (const t of rawTiers) {
      if (
        !isPlainObject(t) ||
        typeof t.min_participants !== 'number' ||
        !Number.isInteger(t.min_participants) ||
        typeof t.discount_pct !== 'number' ||
        !Number.isInteger(t.discount_pct)
      ) {
        res.status(422).json({ detail: 'Invalid price tier item' })
        return
      }
      priceTiers.push({
        min_participants: t.min_participants,
        discount_pct: t.discount_pct,
      })
    }

    try {
      const created = store.createCamp(currentUser.id, {
        society_id: body.society_id.trim(),
        service_id: body.service_id.trim(),
        title: body.title.trim(),
        starts_at: body.starts_at,
        ends_at: body.ends_at,
        slot_minutes: body.slot_minutes,
        min_participants: body.min_participants,
        max_participants: body.max_participants,
        join_deadline: body.join_deadline,
        base_price_paise: body.base_price_paise,
        vendor_id: vendorId,
        price_tiers: priceTiers,
      })
      res.status(201).json(created)
    } catch (err) {
      if (err instanceof InvalidCampParameterError) {
        res.status(400).json({ detail: err.message })
        return
      }
      if (
        err instanceof SocietyNotFoundError ||
        err instanceof ServiceNotFoundError ||
        err instanceof VendorNotFoundError
      ) {
        res.status(404).json({ detail: err.message })
        return
      }
      throw err
    }
  })

  router.patch(
    '/ops/camps/:campId/vendor',
    requireCsrf,
    requireRole(store, 'ops'),
    (req, res) => {
      if (!isPlainObject(req.body)) {
        res.status(422).json({ detail: 'Invalid request body' })
        return
      }
      const allowedKeys = new Set(['vendor_id'])
      for (const key of Object.keys(req.body)) {
        if (!allowedKeys.has(key)) {
          res.status(422).json({ detail: `Extra field '${key}' is not permitted` })
          return
        }
      }

      const vendorId =
        req.body.vendor_id === undefined || req.body.vendor_id === null
          ? null
          : typeof req.body.vendor_id === 'string'
            ? req.body.vendor_id
            : undefined
      if (vendorId === undefined) {
        res.status(422).json({ detail: 'Invalid vendor_id' })
        return
      }

      try {
        const updated = store.assignVendor(String(req.params.campId), vendorId)
        res.json(updated)
      } catch (err) {
        if (err instanceof CampNotFoundError || err instanceof VendorNotFoundError) {
          res.status(404).json({ detail: err.message })
          return
        }
        if (err instanceof InvalidCampStateError) {
          res.status(400).json({ detail: err.message })
          return
        }
        throw err
      }
    },
  )

  return router
}
