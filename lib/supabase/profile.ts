import { supabase } from './client'
import type { Profile } from './types'

/**
 * Safe client-side profile shape excluding sensitive hash fields.
 */
export type PublicProfile = Omit<Profile, 'recovery_pin_hash'>

const PUBLIC_PROFILE_COLUMNS =
  'id, full_name, recovery_id, backup_phone, has_recovery_pin, is_verified, created_at, updated_at'

/**
 * Fetch the authenticated user's profile from `public.profiles`.
 * Never selects `recovery_pin_hash`.
 */
export async function getUserProfile(userId: string): Promise<PublicProfile | null> {
  if (!userId || !userId.trim()) {
    throw new Error('Authenticated user ID is required to load profile.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Unable to load your RETRACE profile.')
  }

  return data
}

/**
 * Mask a phone number for privacy in UI summaries while keeping last 2 digits visible.
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone || !phone.trim()) {
    return 'Not configured yet'
  }
  const trimmed = phone.trim()
  if (trimmed.length <= 4) {
    return '••••'
  }
  return `${trimmed.slice(0, Math.min(3, trimmed.length - 2))} ••• ••${trimmed.slice(-2)}`
}

