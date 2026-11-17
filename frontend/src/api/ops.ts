import { apiRequest } from '../auth/api'

export interface SocietyReference {
  id: string
  name: string
  city: string
  address: string
  invite_code: string
}

export interface ServiceReference {
  id: string
  code: string
  name: string
}

export interface VendorReference {
  id: string
  full_name: string
  phone: string
}

export interface PriceTier {
  min_participants: number
  discount_pct: number
}

export interface NextTier {
  min_participants: number
  discount_pct: number
  participants_needed: number
  potential_price_paise: number
}

export interface PricingQuote {
  headcount: number
  base_price_paise: number
  discount_pct: number
  discounted_price_paise: number
  next_tier?: NextTier | null
}

export interface Participant {
  booking_id: string
  resident_id: string
  full_name: string
  unit_label: string | null
  phone: string
  status: string
  quoted_price_paise: number
  final_price_paise: number | null
  slot_starts_at: string | null
  created_at: string
}

export interface CampListItem {
  id: string
  society: SocietyReference
  service: ServiceReference
  vendor?: VendorReference | null
  title: string
  starts_at: string
  ends_at: string
  slot_minutes: number
  status: string
  min_participants: number
  max_participants: number
  capacity_slots: number
  active_participants_count: number
  spots_remaining: number
  base_price_paise: number
  current_price_paise: number
  join_deadline: string
  created_at: string
}

export interface CampDetail {
  id: string
  society: SocietyReference
  service: ServiceReference
  vendor?: VendorReference | null
  title: string
  starts_at: string
  ends_at: string
  slot_minutes: number
  status: string
  min_participants: number
  max_participants: number
  capacity_slots: number
  base_price_paise: number
  join_deadline: string
  cancelled_reason?: string | null
  created_at: string
  price_tiers: PriceTier[]
  pricing_quote: PricingQuote
  participants: Participant[]
}

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
  vendor_id?: string | null
  price_tiers: PriceTier[]
}

export async function fetchSocieties(): Promise<SocietyReference[]> {
  return (await apiRequest('/ops/societies', { authenticated: true })) as SocietyReference[]
}

export async function fetchServices(): Promise<ServiceReference[]> {
  return (await apiRequest('/ops/services', { authenticated: true })) as ServiceReference[]
}

export async function fetchVendors(): Promise<VendorReference[]> {
  return (await apiRequest('/ops/vendors', { authenticated: true })) as VendorReference[]
}

export async function listCamps(filters?: {
  society_id?: string
  status?: string
}): Promise<CampListItem[]> {
  const params = new URLSearchParams()
  if (filters?.society_id) params.set('society_id', filters.society_id)
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status)

  const query = params.toString() ? `?${params.toString()}` : ''
  return (await apiRequest(`/ops/camps${query}`, { authenticated: true })) as CampListItem[]
}

export async function getCampDetail(campId: string): Promise<CampDetail> {
  return (await apiRequest(`/ops/camps/${campId}`, { authenticated: true })) as CampDetail
}

export async function createCamp(
  input: CampCreateInput,
  csrfToken: string,
): Promise<CampDetail> {
  return (await apiRequest('/ops/camps', {
    method: 'POST',
    body: input,
    csrfToken,
    authenticated: true,
  })) as CampDetail
}

export async function assignVendor(
  campId: string,
  vendorId: string | null,
  csrfToken: string,
): Promise<CampDetail> {
  return (await apiRequest(`/ops/camps/${campId}/vendor`, {
    method: 'PATCH',
    body: { vendor_id: vendorId },
    csrfToken,
    authenticated: true,
  })) as CampDetail
}
