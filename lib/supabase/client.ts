import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseUrl.trim()) {
  throw new Error(
    'Missing environment variable: NEXT_PUBLIC_SUPABASE_URL. Please define it in your .env.local file.'
  )
}

if (!supabasePublishableKey || !supabasePublishableKey.trim()) {
  throw new Error(
    'Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Please define it in your .env.local file.'
  )
}

const safeSupabaseUrl: string = supabaseUrl
const safeSupabasePublishableKey: string = supabasePublishableKey

/**
 * Helper function to create a Supabase client instance.
 */
export function createClient() {
  return createSupabaseClient(safeSupabaseUrl, safeSupabasePublishableKey)
}

/**
 * Singleton Supabase client instance for client-side operations.
 */
export const supabase = createClient()

export default supabase
