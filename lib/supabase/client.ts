import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

export function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined
  const cleaned = value.trim().replace(/^["']|["']$/g, '').trim()
  return cleaned || undefined
}

export function isValidKeyFormat(key: string | undefined): boolean {
  if (!key) return false
  if (key.includes(' ') || key.includes('...')) return false
  if (key.startsWith('sb_publishable_') || key.startsWith('sb_secret_')) {
    return key.length >= 20
  }
  if (key.startsWith('eyJ')) {
    return key.split('.').length === 3
  }
  return false
}

export function resolveSupabaseCredentials() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)

  const pubKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  const anonKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // Prioritize a valid key format: if publishable key is an unreplaced placeholder or has invalid characters,
  // fall back to anon key if valid.
  let key: string | undefined
  if (isValidKeyFormat(pubKey)) {
    key = pubKey
  } else if (isValidKeyFormat(anonKey)) {
    key = anonKey
  } else {
    key = pubKey ?? anonKey
  }

  return { url, key }
}

const { url: resolvedUrl, key: resolvedKey } = resolveSupabaseCredentials()

if (!resolvedUrl) {
  throw new Error(
    'Missing environment variable: NEXT_PUBLIC_SUPABASE_URL. Please define it in your environment or .env.local file.'
  )
}

if (!resolvedKey) {
  throw new Error(
    'Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Please define it in your environment or .env.local file.'
  )
}

if (resolvedKey.includes('...') || resolvedKey.includes(' ')) {
  throw new Error(
    'Invalid Supabase API key: Detected placeholder text or whitespace in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Please provide the actual Supabase publishable key.'
  )
}

const safeSupabaseUrl: string = resolvedUrl
const safeSupabasePublishableKey: string = resolvedKey

/**
 * Helper function to create a Supabase client instance.
 */
export function createClient() {
  return createSupabaseClient<Database>(safeSupabaseUrl, safeSupabasePublishableKey)
}

/**
 * Singleton Supabase client instance for client-side operations.
 */
export const supabase = createClient()

export default supabase
