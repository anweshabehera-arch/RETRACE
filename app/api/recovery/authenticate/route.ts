import { NextResponse } from 'next/server'
import {
  createClient as createSupabaseClient
} from '@supabase/supabase-js'
import {
  createRecoverySessionToken,
  getServerServiceClient,
  isValidRecoveryPinFormat,
  verifyRecoveryPinHash,
} from '@/lib/supabase/server-auth'
import { resolveSupabaseCredentials } from '@/lib/supabase/client'
import { notifyAccountSecurityEvent } from '@/lib/email/notifications'
import type { Database } from '@/lib/supabase/types'

// Rate limiting in-memory tracking
interface AttemptRecord {
  attempts: number
  firstAttemptAt: number
  lockedUntil?: number
}

const attemptTracker = new Map<string, AttemptRecord>()
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const WINDOW_MS = 15 * 60 * 1000

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'unknown-ip'
}

function checkRateLimit(key: string): { allowed: boolean; remainingAttempts: number; retryAfterSec?: number } {
  const now = Date.now()
  const record = attemptTracker.get(key)

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS }
  }

  if (record.lockedUntil && now < record.lockedUntil) {
    const retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000)
    return { allowed: false, remainingAttempts: 0, retryAfterSec }
  }

  // Reset window if expired
  if (now - record.firstAttemptAt > WINDOW_MS) {
    attemptTracker.delete(key)
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS }
  }

  const remainingAttempts = Math.max(0, MAX_ATTEMPTS - record.attempts)
  return { allowed: remainingAttempts > 0, remainingAttempts }
}

function recordFailedAttempt(key: string) {
  const now = Date.now()
  const record = attemptTracker.get(key) || { attempts: 0, firstAttemptAt: now }

  record.attempts += 1
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS
  }

  attemptTracker.set(key, record)
}

function clearRateLimit(key: string) {
  attemptTracker.delete(key)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      recoveryId?: unknown
      recoveryPin?: unknown
    } | null

    const recoveryId = typeof body?.recoveryId === 'string' ? body.recoveryId.trim().toUpperCase() : ''
    const recoveryPin = typeof body?.recoveryPin === 'string' ? body.recoveryPin.trim() : ''

    if (!recoveryId || !recoveryPin) {
      return NextResponse.json(
        { error: 'Both Recovery ID and Recovery PIN are required.' },
        { status: 400 }
      )
    }

    if (!isValidRecoveryPinFormat(recoveryPin)) {
      return NextResponse.json(
        { error: 'Recovery PIN must be 4 to 6 numeric digits.' },
        { status: 400 }
      )
    }

    const clientIp = getClientIp(request)
    const rateLimitKey = `${clientIp}:${recoveryId}`

    const rateStatus = checkRateLimit(rateLimitKey)
    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed recovery attempts. For your security, recovery for this ID is locked for ${Math.ceil(
            (rateStatus.retryAfterSec || 900) / 60
          )} minutes.`,
        },
        { status: 429 }
      )
    }

    // Attempt to fetch profile record by recovery_id
    // 1. Try service role client if configured
    let serviceClient = getServerServiceClient()

    // 2. If no service role client, fallback to client credentials (will require public.get_recovery_profile_for_auth RPC)
    if (!serviceClient) {
      const { url, key } = resolveSupabaseCredentials()
      if (url && key) {
        serviceClient = createSupabaseClient<Database>(url, key, { auth: { persistSession: false } })
      }
    }

    if (!serviceClient) {
      return NextResponse.json(
        { error: 'Server database configuration is missing.' },
        { status: 500 }
      )
    }

    // Query profiles for matching recovery_id
    let profileData: {
      id: string
      full_name: string
      recovery_id: string
      recovery_pin_hash: string | null
      has_recovery_pin: boolean
    } | null = null

    // Attempt direct select (works with service_role)
    const { data: directProfile } = await serviceClient
      .from('profiles')
      .select('id, full_name, recovery_id, recovery_pin_hash, has_recovery_pin')
      .eq('recovery_id', recoveryId)
      .maybeSingle()

    if (directProfile) {
      profileData = directProfile
    } else {
      // Attempt RPC function fallback
      const { data: rpcRows } = await serviceClient.rpc('get_recovery_profile_for_auth' as any, {
        p_recovery_id: recoveryId,
      })

      if (Array.isArray(rpcRows) && rpcRows.length > 0) {
        profileData = rpcRows[0]
      }
    }

    if (!profileData) {
      recordFailedAttempt(rateLimitKey)
      return NextResponse.json(
        {
          error: 'Invalid Recovery ID or Recovery PIN. Please check your credentials.',
          remainingAttempts: Math.max(0, rateStatus.remainingAttempts - 1),
        },
        { status: 401 }
      )
    }

    if (!profileData.has_recovery_pin || !profileData.recovery_pin_hash) {
      return NextResponse.json(
        {
          error:
            'A Recovery PIN has not been set for this recovery identity yet. You must first configure one in Settings before using independent recovery.',
        },
        { status: 403 }
      )
    }

    // Constant-time scrypt verification
    const isValid = verifyRecoveryPinHash(recoveryPin, profileData.recovery_pin_hash)

    if (!isValid) {
      recordFailedAttempt(rateLimitKey)

      // Log failure in activity logs if serviceClient can write
      try {
        await serviceClient.from('activity_logs').insert({
          user_id: profileData.id,
          title: 'Recovery authentication failed',
          description: `Failed recovery PIN attempt recorded from ${clientIp}.`,
          category: 'Security',
        })
      } catch {
        // Non-blocking log failure
      }

      return NextResponse.json(
        {
          error: 'Invalid Recovery ID or Recovery PIN. Please check your credentials.',
          remainingAttempts: Math.max(0, rateStatus.remainingAttempts - 1),
        },
        { status: 401 }
      )
    }

    // Reset rate limiter on successful authentication
    clearRateLimit(rateLimitKey)

    // Issue cryptographically signed Recovery Session Token
    const sessionToken = createRecoverySessionToken({
      userId: profileData.id,
      recoveryId: profileData.recovery_id,
      fullName: profileData.full_name,
    })

    // Log successful recovery session
    try {
      await serviceClient.from('activity_logs').insert({
        user_id: profileData.id,
        title: 'Independent recovery session started',
        description: 'Recovery identity verified via Recovery ID and PIN from an external browser/device.',
        category: 'Recovery',
      })
    } catch {
      // Non-blocking log failure
    }

    // Dispatch security email alerting owner of new external recovery session
    notifyAccountSecurityEvent({
      client: serviceClient,
      userId: profileData.id,
      eventType: 'recovery_session_started',
      detail: `An independent recovery session was authenticated for Recovery ID ${profileData.recovery_id}.`,
    }).catch((err) => {
      console.error('[Recovery Auth Security Email Error]', err)
    })

    return NextResponse.json({
      success: true,
      recoveryToken: sessionToken,
      user: {
        id: profileData.id,
        recoveryId: profileData.recovery_id,
        fullName: profileData.full_name,
      },
      expiresIn: '2 hours',
      message: 'Independent recovery session established successfully.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
