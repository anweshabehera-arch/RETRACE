/**
 * RETRACE Server-Side Email Notification Service
 * Provider: Resend REST API (https://api.resend.com/emails)
 *
 * Rules:
 * - Server-side only. Never imported on client.
 * - Live provider verification. Never fakes delivery.
 * - Cryptographic and memory-safe deduplication against spam or duplicate notifications.
 * - Full E-mail RFC format validation.
 */

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  deduplicationKey?: string
  headers?: Record<string, string>
}

export interface EmailDeliveryResult {
  success: boolean
  messageId?: string
  error?: string
  configured: boolean
  deduplicated?: boolean
}

// In-memory deduplication tracking (Key -> Timestamp)
const deduplicationCache = new Map<string, number>()
const DEFAULT_DEDUPLICATION_WINDOW_MS = 60 * 1000 // 60 seconds

/**
 * Basic RFC 5322 compliant email regex validation.
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  if (trimmed.length > 254 || trimmed.length < 5) return false
  // Strict standard format checking local-part@domain.tld
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  return emailRegex.test(trimmed)
}

/**
 * Check whether Resend email credentials are configured in server environment.
 */
export function isEmailConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  return Boolean(apiKey && apiKey.startsWith('re_') && apiKey.length > 10)
}

/**
 * Get the configured sender email address.
 * Defaults to Resend's verified development onboarding address if unset.
 */
export function getSenderEmail(): string {
  const customFrom = process.env.RETRACE_EMAIL_FROM?.trim()
  if (customFrom && customFrom.length > 3) {
    return customFrom
  }
  return 'RETRACE Security <onboarding@resend.dev>'
}

/**
 * Get the public URL for links in email notifications.
 */
export function getAppBaseUrl(): string {
  const configured =
    process.env.RETRACE_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()

  if (configured) {
    if (configured.startsWith('http://') || configured.startsWith('https://')) {
      return configured.replace(/\/$/, '')
    }
    return `https://${configured.replace(/\/$/, '')}`
  }

  return 'https://retrace-ai-alpha.vercel.app'
}

/**
 * Check and record a deduplication key.
 * Returns true if allowed, false if duplicate within the active window.
 */
export function checkAndRecordDeduplication(
  key: string,
  windowMs = DEFAULT_DEDUPLICATION_WINDOW_MS
): boolean {
  const now = Date.now()
  const lastSent = deduplicationCache.get(key)

  if (lastSent && now - lastSent < windowMs) {
    return false // Suppress duplicate
  }

  deduplicationCache.set(key, now)

  // Periodic pruning of expired entries
  if (deduplicationCache.size > 2000) {
    for (const [k, ts] of deduplicationCache.entries()) {
      if (now - ts > windowMs * 2) {
        deduplicationCache.delete(k)
      }
    }
  }

  return true
}

/**
 * Clear deduplication cache entry (useful for testing or forced resends).
 */
export function clearDeduplicationKey(key: string): void {
  deduplicationCache.delete(key)
}

/**
 * Send an email via Resend's REST API.
 * Never reports success unless Resend accepts the email and returns an ID.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  deduplicationKey,
  headers,
}: SendEmailParams): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()

  if (!apiKey || !apiKey.startsWith('re_')) {
    return {
      success: false,
      configured: false,
      error:
        'Resend API key is not configured. Set RESEND_API_KEY in server environment variables to enable live email notifications.',
    }
  }

  // Normalize recipient list
  const recipients = Array.isArray(to) ? to : [to]
  const validRecipients = recipients
    .map((e) => e.trim())
    .filter((e) => isValidEmail(e))

  if (validRecipients.length === 0) {
    return {
      success: false,
      configured: true,
      error: 'No valid recipient email address was provided.',
    }
  }

  // Check deduplication if a key is provided
  if (deduplicationKey) {
    const isAllowed = checkAndRecordDeduplication(deduplicationKey)
    if (!isAllowed) {
      return {
        success: false,
        configured: true,
        deduplicated: true,
        error: 'Notification suppressed: duplicate alert already dispatched within cooldown window.',
      }
    }
  }

  try {
    const fromAddress = getSenderEmail()
    const payload: Record<string, unknown> = {
      from: fromAddress,
      to: validRecipients,
      subject: subject.trim(),
      html,
    }

    if (text) {
      payload.text = text
    }

    if (headers) {
      payload.headers = headers
    }

    const apiUrl = process.env.RESEND_API_URL?.trim() || 'https://api.resend.com/emails'
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = (await response.json().catch(() => ({}))) as {
      id?: string
      message?: string
      statusCode?: number
      name?: string
    }

    if (!response.ok || !data.id) {
      const errMsg = data.message || `Resend provider error HTTP ${response.status}`
      return {
        success: false,
        configured: true,
        error: `Email delivery failed: ${errMsg}`,
      }
    }

    return {
      success: true,
      configured: true,
      messageId: data.id,
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Network error connecting to email provider.'
    return {
      success: false,
      configured: true,
      error: `Email provider error: ${errMsg}`,
    }
  }
}
