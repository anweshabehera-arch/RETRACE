/**
 * RETRACE SMS Provider Interface
 * Supports real SMS delivery via Twilio with clean error handling and provider detection.
 * Never fakes SMS delivery.
 */

export interface SendSmsParams {
  to: string
  body: string
}

export interface SmsProviderResult {
  success: boolean
  messageId?: string
  error?: string
  configured: boolean
}

export function isSmsConfigured(): boolean {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER
  return Boolean(accountSid?.trim() && authToken?.trim() && fromNumber?.trim())
}

export async function sendSms({ to, body }: SendSmsParams): Promise<SmsProviderResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim()

  if (!accountSid || !authToken || !fromNumber) {
    return {
      success: false,
      configured: false,
      error:
        'SMS provider credentials are not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env.local to enable live phone verification.',
    }
  }

  // Sanitize recipient phone (must be E.164 compliant)
  const cleanTo = to.trim().replace(/[^\d+]/g, '')
  if (!cleanTo.startsWith('+') || cleanTo.length < 10) {
    return {
      success: false,
      configured: true,
      error: 'Recipient phone number must include a country code in international format (e.g. +14155550100).',
    }
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const formData = new URLSearchParams()
    formData.append('To', cleanTo)
    formData.append('From', fromNumber)
    formData.append('Body', body)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const json = (await res.json().catch(() => ({}))) as {
      sid?: string
      message?: string
      status?: string
      code?: number
    }

    if (!res.ok || !json.sid) {
      const errMsg = json.message || `Twilio error HTTP ${res.status}`
      return {
        success: false,
        configured: true,
        error: `SMS delivery failed: ${errMsg}`,
      }
    }

    return {
      success: true,
      configured: true,
      messageId: json.sid,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error connecting to SMS provider.'
    return {
      success: false,
      configured: true,
      error: `SMS provider error: ${message}`,
    }
  }
}
