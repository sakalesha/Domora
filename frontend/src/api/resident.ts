import { ApiError, apiRequest } from '../auth/api'

export type ResidentCampStatus =
  | 'open'
  | 'confirmed'
  | 'in_progress'
  | 'completed'

export type ResidentBookingStatus =
  | 'joined'
  | 'scheduled'
  | 'in_progress'
  | 'completed'

export type ResidentTierStatus = 'reached' | 'current' | 'next' | 'upcoming'

export interface ResidentSocietySummary {
  id: string
  name: string
  city: string
}

export interface ResidentServiceSummary {
  id: string
  name: string
  description?: string | null
  unit_label?: string | null
}

export interface ResidentNextTier {
  more_needed: number
  target_participants: number
  discount_pct: number
  target_price_paise: number
  target_price_rupees: number
}

export interface ResidentBookingSummary {
  id: string
  status: ResidentBookingStatus
  quoted_price_paise: number
  quoted_price_rupees: number
  final_price_paise?: number | null
  final_price_rupees?: number | null
  slot_starts_at?: string | null
}

export interface ResidentCampListItem {
  id: string
  title: string
  status: ResidentCampStatus
  starts_at: string
  ends_at: string
  slot_minutes: number
  join_deadline: string
  base_price_paise: number
  base_price_rupees: number
  current_price_paise: number
  current_price_rupees: number
  discount_pct: number
  participants_count: number
  min_participants: number
  max_participants: number
  spots_remaining: number
  is_confirmed_or_higher: boolean
  can_join: boolean
  society: ResidentSocietySummary
  service: ResidentServiceSummary
  next_tier?: ResidentNextTier | null
  user_booking?: ResidentBookingSummary | null
}

export interface ResidentTierItem {
  min_participants: number
  discount_pct: number
  price_paise: number
  price_rupees: number
  status: ResidentTierStatus
}

export interface ResidentCampDetail extends ResidentCampListItem {
  tiers: ResidentTierItem[]
  price_disclaimer: string
}

type ResidentApiPrefix = '/v1/resident' | '/resident'

let preferredPrefix: ResidentApiPrefix = '/v1/resident'

async function requestResidentApi<T>(relativePath: string): Promise<T> {
  const primaryPrefix: ResidentApiPrefix = preferredPrefix
  const fallbackPrefix: ResidentApiPrefix =
    primaryPrefix === '/v1/resident' ? '/resident' : '/v1/resident'

  try {
    return (await apiRequest(`${primaryPrefix}${relativePath}`, {
      authenticated: true,
    })) as T
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 404) {
      const response = (await apiRequest(`${fallbackPrefix}${relativePath}`, {
        authenticated: true,
      })) as T
      preferredPrefix = fallbackPrefix
      return response
    }
    throw error
  }
}

export async function listResidentCamps(
  status?: string,
): Promise<ResidentCampListItem[]> {
  const params = new URLSearchParams()
  if (status && status !== 'all') {
    params.set('status', status)
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  return requestResidentApi<ResidentCampListItem[]>(`/camps${query}`)
}

export async function getResidentCampDetail(
  campId: string,
): Promise<ResidentCampDetail> {
  const encodedId = encodeURIComponent(campId)
  return requestResidentApi<ResidentCampDetail>(`/camps/${encodedId}`)
}
