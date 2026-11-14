import { createHmac, timingSafeEqual } from 'node:crypto'

export interface QuorumTokenPayload {
  requestId: string
  contactId: string
  actionType: string
  userId: string
  issuedAt: number
  expiresAt: number
}

/**
 * Resolves the server-side quorum secret.
 * Fails closed if RETRACE_QUORUM_SECRET is missing or insecure.
 */
export function getQuorumSecret(): string {
  const secret = process.env.RETRACE_QUORUM_SECRET?.trim()
  if (!secret || secret.length < 16) {
    throw new Error('Server configuration error: RETRACE_QUORUM_SECRET is required and must be at least 16 characters.')
  }
  return secret
}

/**
 * Creates an HMAC-SHA256 signed Quorum Vote Token.
 * Requires RETRACE_QUORUM_SECRET.
 */
export function createQuorumVoteToken(params: {
  requestId: string
  contactId: string
  actionType: string
  userId: string
}): string {
  const secret = getQuorumSecret()
  const issuedAt = Date.now()
  const expiresAt = issuedAt + 24 * 60 * 60 * 1000 // 24 hours validity
  const payload: QuorumTokenPayload = { ...params, issuedAt, expiresAt }
  const bodyB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(bodyB64).digest('base64url')
  return `${bodyB64}.${sig}`
}

/**
 * Verifies an HMAC-SHA256 signed Quorum Vote Token.
 * Fails closed if RETRACE_QUORUM_SECRET is missing or token is invalid/expired.
 */
export function verifyQuorumVoteToken(token: string): QuorumTokenPayload | null {
  try {
    const secret = process.env.RETRACE_QUORUM_SECRET?.trim()
    if (!secret || secret.length < 16) return null // Fail closed if secret missing or insecure

    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [bodyB64, sig] = parts
    if (!bodyB64 || !sig) return null

    const expectedSig = createHmac('sha256', secret).update(bodyB64).digest('base64url')
    const sigBuf = Buffer.from(sig)
    const expBuf = Buffer.from(expectedSig)
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null
    }

    const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as QuorumTokenPayload
    if (typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) {
      return null // Expired
    }

    return payload
  } catch {
    return null
  }
}

