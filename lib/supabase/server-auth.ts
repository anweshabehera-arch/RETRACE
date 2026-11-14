import { createClient } from '@supabase/supabase-js'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cleanEnv, resolveSupabaseCredentials } from './client'
import type { Database } from './types'

const SCRYPT_KEYLEN = 64
const RECOVERY_SESSION_DURATION_MS = 2 * 60 * 60 * 1000 // 2 hours
const RECOVERY_SECRET =
  cleanEnv(process.env.RETRACE_SESSION_SECRET) ||
  resolveSupabaseCredentials().key ||
  'retrace-secure-session-salt-2026'

/**
 * Create a request-scoped Supabase client authenticated with the caller's JWT.
 * All queries executed through this client remain subject to PostgreSQL RLS.
 */
export async function getAuthenticatedServerClient(request: Request) {
  const { url: supabaseUrl, key: supabaseKey } = resolveSupabaseCredentials()

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
 * Create a privileged Supabase client using SUPABASE_SERVICE_ROLE_KEY if available.
 * Returns null if service role key is not configured.
 */
export function getServerServiceClient() {
  const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!supabaseUrl || !serviceKey) {
    return null
  }

  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
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

// ============================================================================
// Independent Recovery Session Tokens (HMAC-SHA256)
// ============================================================================

export interface RecoverySessionPayload {
  userId: string
  recoveryId: string
  fullName: string
  issuedAt: number
  expiresAt: number
}

export function createRecoverySessionToken(payload: Omit<RecoverySessionPayload, 'issuedAt' | 'expiresAt'>): string {
  const issuedAt = Date.now()
  const expiresAt = issuedAt + RECOVERY_SESSION_DURATION_MS
  const body = JSON.stringify({ ...payload, issuedAt, expiresAt })
  const bodyB64 = Buffer.from(body).toString('base64url')
  const signature = createHmac('sha256', RECOVERY_SECRET).update(bodyB64).digest('base64url')
  return `${bodyB64}.${signature}`
}

export function verifyRecoverySessionToken(token: string): RecoverySessionPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [bodyB64, signature] = parts
    const expectedSig = createHmac('sha256', RECOVERY_SECRET).update(bodyB64).digest('base64url')

    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expectedSig)
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null
    }

    const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as RecoverySessionPayload
    if (typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) {
      return null // Expired
    }

    return payload
  } catch {
    return null
  }
}

export function getRecoverySessionFromRequest(request: Request): RecoverySessionPayload | null {
  const authHeader = request.headers.get('authorization') ?? ''
  const match = authHeader.match(/^RecoveryToken\s+(.+)$/i)
  if (!match?.[1]) return null
  return verifyRecoverySessionToken(match[1].trim())
}
