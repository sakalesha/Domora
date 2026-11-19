import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const ACCESS_COOKIE_NAME = 'domora_access'
export const CSRF_COOKIE_NAME = 'domora_csrf'
export const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_PURPOSE = 'domora-csrf-v1'
export const CSRF_TOKEN_EXPIRE_SECONDS = 24 * 60 * 60
export const ACCESS_TOKEN_EXPIRE_MINUTES = Number(
  process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '1440',
)
export const SECRET_KEY = process.env.SECRET_KEY || 'local-dev-secret-domora-change-me'

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  return bcrypt.compareSync(password, passwordHash)
}

export function createAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET_KEY, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_EXPIRE_MINUTES * 60,
  })
}

export function decodeAccessToken(token: string): { sub: string } {
  const payload = jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] })
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof payload.sub !== 'string' ||
    !payload.sub
  ) {
    throw new Error('Invalid token subject')
  }
  return { sub: payload.sub }
}

export function createCsrfToken(nowSeconds?: number): { token: string; expiresAt: number } {
  const issuedAt = nowSeconds ?? Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + CSRF_TOKEN_EXPIRE_SECONDS
  const nonce = crypto.randomBytes(24).toString('base64url')
  const message = `${CSRF_PURPOSE}:${nonce}:${expiresAt}`
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(message, 'utf8')
    .digest('base64url')
  return {
    token: `${nonce}.${expiresAt}.${signature}`,
    expiresAt,
  }
}

export function csrfTokenExpiry(token: string): number | null {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [nonce, expiryRaw, signature] = parts
  if (!nonce || !signature) return null
  const expiresAt = Number.parseInt(expiryRaw, 10)
  if (!Number.isFinite(expiresAt) || String(expiresAt) !== expiryRaw) return null
  return expiresAt
}

export function isValidCsrfToken(token: string, nowSeconds?: number): boolean {
  const expiresAt = csrfTokenExpiry(token)
  if (expiresAt === null) return false

  const currentTime = nowSeconds ?? Math.floor(Date.now() / 1000)
  if (expiresAt <= currentTime) return false

  const parts = token.split('.')
  const nonce = parts[0]
  const supplied = parts[2]
  const message = `${CSRF_PURPOSE}:${nonce}:${expiresAt}`
  const expected = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(message, 'utf8')
    .digest('base64url')

  const expectedBuf = Buffer.from(expected, 'utf8')
  const suppliedBuf = Buffer.from(supplied, 'utf8')
  if (expectedBuf.length !== suppliedBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, suppliedBuf)
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}
