import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

interface StoredOtp {
  targetId: string // contactId or userId:phone
  salt: string
  hashHex: string
  createdAt: number
  expiresAt: number
  attempts: number
  lastSentAt: number
}

const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds
const MAX_ATTEMPTS = 5

// In-memory server store for active OTP verification sessions
const otpStore = new Map<string, StoredOtp>()

function hashOtp(otp: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${otp.trim()}`).digest('hex')
}

export function canSendOtp(targetId: string): { allowed: boolean; waitSeconds?: number } {
  const existing = otpStore.get(targetId)
  if (!existing) return { allowed: true }

  const elapsed = Date.now() - existing.lastSentAt
  if (elapsed < RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
    return { allowed: false, waitSeconds }
  }

  return { allowed: true }
}

export function generateAndStoreOtp(targetId: string): { otp: string; expiresAt: number } {
  const now = Date.now()
  const otp = randomInt(100000, 1000000).toString()
  const salt = randomBytes(16).toString('hex')
  const hashHex = hashOtp(otp, salt)
  const expiresAt = now + OTP_TTL_MS

  otpStore.set(targetId, {
    targetId,
    salt,
    hashHex,
    createdAt: now,
    expiresAt,
    attempts: 0,
    lastSentAt: now,
  })

  return { otp, expiresAt }
}

export function verifyOtp(
  targetId: string,
  candidateOtp: string
): { success: boolean; error?: string } {
  const stored = otpStore.get(targetId)
  if (!stored) {
    return { success: false, error: 'No verification code found. Please request a new code.' }
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(targetId)
    return { success: false, error: 'Verification code has expired. Please request a new code.' }
  }

  if (stored.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(targetId)
    return {
      success: false,
      error: 'Maximum verification attempts exceeded. Please request a new code.',
    }
  }

  stored.attempts += 1

  const candidateHash = hashOtp(candidateOtp, stored.salt)
  const expectedBuf = Buffer.from(stored.hashHex, 'hex')
  const actualBuf = Buffer.from(candidateHash, 'hex')

  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    const remaining = MAX_ATTEMPTS - stored.attempts
    return {
      success: false,
      error: `Incorrect verification code. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`,
    }
  }

  // Verification succeeded: invalidate OTP immediately (single-use)
  otpStore.delete(targetId)
  return { success: true }
}

export function clearOtp(targetId: string) {
  otpStore.delete(targetId)
}
