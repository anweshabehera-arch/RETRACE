import { createClient } from '@supabase/supabase-js'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Database } from './types'

const SCRYPT_KEYLEN = 64

/**
 * Create a request-scoped Supabase client authenticated with the caller's JWT.
 * All queries executed through this client remain subject to PostgreSQL RLS.
 */
export async function getAuthenticatedServerClient(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Server Supabase configuration is missing.')
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const accessToken = match?.[1]?.trim()

  if (!accessToken) {
    return { error: 'Authentication token is missing.', status: 401 as const }
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) {
    return { error: 'Invalid or expired authentication session.', status: 401 as const }
  }

  return { supabase, user: data.user }
}

/**
 * Hash a user recovery PIN using Node's scrypt with a random 16-byte salt.
 * Output format: scrypt$<saltHex>$<derivedKeyHex> (length > 160 chars).
 */
export function hashRecoveryPin(pin: string): string {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(pin, salt, SCRYPT_KEYLEN).toString('hex')
  return `scrypt$${salt}$${derivedKey}`
}

/**
 * Constant-time verification of a recovery PIN against a stored scrypt hash.
 */
export function verifyRecoveryPinHash(pin: string, storedHash: string): boolean {
  const parts = storedHash.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false
  }

  const [, salt, hashHex] = parts
  if (!salt || !hashHex) {
    return false
  }

  const expectedBuffer = Buffer.from(hashHex, 'hex')
  const actualBuffer = scryptSync(pin, salt, SCRYPT_KEYLEN)

  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, actualBuffer)
}

export function isValidRecoveryPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin)
}

