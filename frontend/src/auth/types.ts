export type UserRole = 'resident' | 'vendor' | 'ops'

export interface SocietyProfile {
  id: string
  name: string
  city: string
}

export interface UserProfile {
  id: string
  username: string
  full_name: string
  phone: string
  role: UserRole
  society_id: string | null
  unit_label: string | null
  phone_verified: false
  society: SocietyProfile | null
}

export interface SignupValues {
  full_name: string
  username: string
  password: string
  phone: string
  unit_label: string
  invite_code: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'resident' || value === 'vendor' || value === 'ops'
}

function isSocietyProfile(value: unknown): value is SocietyProfile {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.city === 'string'
  )
}

export function parseUserProfile(value: unknown): UserProfile {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.username !== 'string' ||
    typeof value.full_name !== 'string' ||
    typeof value.phone !== 'string' ||
    !isUserRole(value.role) ||
    !(typeof value.society_id === 'string' || value.society_id === null) ||
    !(typeof value.unit_label === 'string' || value.unit_label === null) ||
    value.phone_verified !== false ||
    !(value.society === null || isSocietyProfile(value.society))
  ) {
    throw new Error('The server returned an invalid user profile.')
  }

  return {
    id: value.id,
    username: value.username,
    full_name: value.full_name,
    phone: value.phone,
    role: value.role,
    society_id: value.society_id,
    unit_label: value.unit_label,
    phone_verified: false,
    society: value.society,
  }
}
