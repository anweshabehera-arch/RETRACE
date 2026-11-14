/**
 * RETRACE AI — High-Level Email Notification Dispatcher
 * Bridges security events to the email service with full deduplication,
 * privacy protection, and honest delivery telemetry.
 */

import { isValidEmail, sendEmail, isEmailConfigured, type EmailDeliveryResult } from './index'
import {
  buildRecoveryIncidentEmail,
  buildPanicModeEmail,
  buildQuorumApprovalRequestEmail,
  buildQuorumDecisionEmail,
  buildSuspiciousActivityEmail,
  buildRecoveryCompletedEmail,
  buildAccountSecurityEmail,
} from './templates'

export interface NotificationDispatchSummary {
  attempted: number
  delivered: number
  configured: boolean
  errors: string[]
}

/**
 * Helper to resolve an account owner's email address.
 */
async function resolveOwnerEmail(
  client: any,
  userId: string,
  hintEmail?: string | null
): Promise<string | null> {
  if (hintEmail && isValidEmail(hintEmail)) {
    return hintEmail.trim()
  }

  // Attempt to query via auth admin if service client is available
  if (client?.auth?.admin?.getUserById) {
    try {
      const { data, error } = await client.auth.admin.getUserById(userId)
      if (!error && data?.user?.email && isValidEmail(data.user.email)) {
        return data.user.email.trim()
      }
    } catch {
      // Fall through
    }
  }

  return null
}

/**
 * 1. Recovery Incident Created Notification
 */
export async function notifyRecoveryIncidentCreated(params: {
  client: any
  userId: string
  deviceId: string
  incidentId: string
  notes?: string | null
  userEmail?: string | null
}): Promise<NotificationDispatchSummary> {
  const summary: NotificationDispatchSummary = {
    attempted: 0,
    delivered: 0,
    configured: isEmailConfigured(),
    errors: [],
  }

  try {
    // 1. Fetch device and user details
    const [{ data: device }, { data: profile }] = await Promise.all([
      params.client.from('devices').select('name, type').eq('id', params.deviceId).maybeSingle(),
      params.client.from('profiles').select('full_name').eq('id', params.userId).maybeSingle(),
    ])

    const deviceName = device?.name || 'Protected Device'
    const deviceType = device?.type || 'Smartphone'
    const ownerName = profile?.full_name || 'RETRACE User'

    // 2. Resolve owner email and send owner notification
    const ownerEmail = await resolveOwnerEmail(params.client, params.userId, params.userEmail)
    if (ownerEmail) {
      summary.attempted++
      const emailContent = buildRecoveryIncidentEmail({
        ownerName,
        deviceName,
        deviceType,
        incidentId: params.incidentId,
        notes: params.notes,
        isContactRecipient: false,
      })

      const res = await sendEmail({
        to: ownerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        deduplicationKey: `recovery_created:${params.incidentId}:owner:${params.userId}`,
      })

      if (res.success) {
        summary.delivered++
      } else if (res.error && !res.deduplicated) {
        summary.errors.push(res.error)
      }
    }

    // 3. Notify verified trusted contacts with valid email addresses
    const { data: contacts } = await params.client
      .from('trusted_contacts')
      .select('id, name, email, approved')
      .eq('user_id', params.userId)
      .eq('approved', true)

    if (contacts && Array.isArray(contacts)) {
      for (const contact of contacts) {
        if (contact.email && isValidEmail(contact.email)) {
          summary.attempted++
          const contactContent = buildRecoveryIncidentEmail({
            ownerName,
            deviceName,
            deviceType,
            incidentId: params.incidentId,
            notes: params.notes,
            isContactRecipient: true,
          })

          const res = await sendEmail({
            to: contact.email,
            subject: contactContent.subject,
            html: contactContent.html,
            text: contactContent.text,
            deduplicationKey: `recovery_created:${params.incidentId}:contact:${contact.id}`,
          })

          if (res.success) {
            summary.delivered++
          } else if (res.error && !res.deduplicated) {
            summary.errors.push(`Contact ${contact.name}: ${res.error}`)
          }
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error in recovery notification dispatch'
    summary.errors.push(msg)
  }

  return summary
}

/**
 * 2. Panic Mode Activated Notification
 */
export async function notifyPanicModeActivated(params: {
  client: any
  userId: string
  deviceId: string
  locationName?: string | null
  userEmail?: string | null
}): Promise<NotificationDispatchSummary> {
  const summary: NotificationDispatchSummary = {
    attempted: 0,
    delivered: 0,
    configured: isEmailConfigured(),
    errors: [],
  }

  try {
    const [{ data: device }, { data: profile }] = await Promise.all([
      params.client.from('devices').select('name').eq('id', params.deviceId).maybeSingle(),
      params.client.from('profiles').select('full_name').eq('id', params.userId).maybeSingle(),
    ])

    const deviceName = device?.name || 'Device'
    const ownerName = profile?.full_name || 'RETRACE User'

    // Owner notification
    const ownerEmail = await resolveOwnerEmail(params.client, params.userId, params.userEmail)
    const timeBucket = Math.floor(Date.now() / 60000)

    if (ownerEmail) {
      summary.attempted++
      const emailContent = buildPanicModeEmail({
        ownerName,
        deviceName,
        locationName: params.locationName,
        isContactRecipient: false,
      })

      const res = await sendEmail({
        to: ownerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        deduplicationKey: `panic:${params.deviceId}:owner:${timeBucket}`,
      })

      if (res.success) {
        summary.delivered++
      } else if (res.error && !res.deduplicated) {
        summary.errors.push(res.error)
      }
    }

    // Verified Trusted Contacts
    const { data: contacts } = await params.client
      .from('trusted_contacts')
      .select('id, name, email, approved')
      .eq('user_id', params.userId)
      .eq('approved', true)

    if (contacts && Array.isArray(contacts)) {
      for (const contact of contacts) {
        if (contact.email && isValidEmail(contact.email)) {
          summary.attempted++
          const contactContent = buildPanicModeEmail({
            ownerName,
            deviceName,
            locationName: params.locationName,
            isContactRecipient: true,
          })

          const res = await sendEmail({
            to: contact.email,
            subject: contactContent.subject,
            html: contactContent.html,
            text: contactContent.text,
            deduplicationKey: `panic:${params.deviceId}:contact:${contact.id}:${timeBucket}`,
          })

          if (res.success) {
            summary.delivered++
          } else if (res.error && !res.deduplicated) {
            summary.errors.push(`Contact ${contact.name}: ${res.error}`)
          }
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error in panic notification dispatch'
    summary.errors.push(msg)
  }

  return summary
}

/**
 * 3. Trusted Circle Quorum Approval Request Notification
 */
export async function notifyQuorumApprovalRequested(params: {
  client: any
  userId: string
  requestId: string
  actionType: string
  inviteLinks: {
    contactId: string
    contactName: string
    voteUrl: string
  }[]
  notes?: string | null
}): Promise<NotificationDispatchSummary> {
  const summary: NotificationDispatchSummary = {
    attempted: 0,
    delivered: 0,
    configured: isEmailConfigured(),
    errors: [],
  }

  try {
    const [{ data: reqRow }, { data: profile }] = await Promise.all([
      params.client.from('recovery_requests').select('device_id').eq('id', params.requestId).maybeSingle(),
      params.client.from('profiles').select('full_name').eq('id', params.userId).maybeSingle(),
    ])

    let deviceName = 'Device'
    if (reqRow?.device_id) {
      const { data: dev } = await params.client
        .from('devices')
        .select('name')
        .eq('id', reqRow.device_id)
        .maybeSingle()
      if (dev?.name) deviceName = dev.name
    }

    const ownerName = profile?.full_name || 'Device Owner'

    for (const link of params.inviteLinks) {
      // Fetch contact email ensuring it is approved
      const { data: contact } = await params.client
        .from('trusted_contacts')
        .select('id, name, email, approved')
        .eq('id', link.contactId)
        .eq('user_id', params.userId)
        .maybeSingle()

      if (contact && contact.approved && contact.email && isValidEmail(contact.email)) {
        summary.attempted++
        const emailContent = buildQuorumApprovalRequestEmail({
          contactName: contact.name,
          ownerName,
          deviceName,
          actionType: params.actionType,
          voteUrl: link.voteUrl,
          notes: params.notes,
        })

        const res = await sendEmail({
          to: contact.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          deduplicationKey: `quorum_request:${params.requestId}:${contact.id}:${params.actionType}`,
        })

        if (res.success) {
          summary.delivered++
        } else if (res.error && !res.deduplicated) {
          summary.errors.push(`Guardian ${contact.name}: ${res.error}`)
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error in quorum request dispatch'
    summary.errors.push(msg)
  }

  return summary
}

/**
 * 4. Recovery Approval or Rejection Decision Notification
 */
export async function notifyQuorumDecisionSubmitted(params: {
  client: any
  userId: string
  requestId: string
  contactId: string
  actionType: string
  decision: 'approve' | 'reject'
  quorumStatus: string
  comment?: string | null
  userEmail?: string | null
}): Promise<NotificationDispatchSummary> {
  const summary: NotificationDispatchSummary = {
    attempted: 0,
    delivered: 0,
    configured: isEmailConfigured(),
    errors: [],
  }

  try {
    const [{ data: contact }, { data: reqRow }, { data: profile }] = await Promise.all([
      params.client.from('trusted_contacts').select('name').eq('id', params.contactId).maybeSingle(),
      params.client.from('recovery_requests').select('device_id').eq('id', params.requestId).maybeSingle(),
      params.client.from('profiles').select('full_name').eq('id', params.userId).maybeSingle(),
    ])

    let deviceName = 'Device'
    if (reqRow?.device_id) {
      const { data: dev } = await params.client
        .from('devices')
        .select('name')
        .eq('id', reqRow.device_id)
        .maybeSingle()
      if (dev?.name) deviceName = dev.name
    }

    const contactName = contact?.name || 'A Guardian'
    const ownerName = profile?.full_name || 'RETRACE User'
    const ownerEmail = await resolveOwnerEmail(params.client, params.userId, params.userEmail)

    if (ownerEmail) {
      summary.attempted++
      const emailContent = buildQuorumDecisionEmail({
        ownerName,
        contactName,
        deviceName,
        actionType: params.actionType,
        decision: params.decision,
        quorumStatus: params.quorumStatus,
        comment: params.comment,
      })

      const res = await sendEmail({
        to: ownerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        deduplicationKey: `quorum_decision:${params.requestId}:${params.contactId}:${params.decision}`,
      })

      if (res.success) {
        summary.delivered++
      } else if (res.error && !res.deduplicated) {
        summary.errors.push(res.error)
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error in quorum decision dispatch'
    summary.errors.push(msg)
  }

  return summary
}

/**
 * 5. Suspicious Activity Notification (Sighting or High Anomaly Risk)
 */
export async function notifySuspiciousActivity(params: {
  client: any
  userId: string
  deviceId: string
  activityType: 'sighting' | 'theft_signal' | 'auth_spike'
  summary: string
  details?: string
  locationApprox?: string | null
  userEmail?: string | null
}): Promise<NotificationDispatchSummary> {
  const summary: NotificationDispatchSummary = {
    attempted: 0,
    delivered: 0,
    configured: isEmailConfigured(),
    errors: [],
  }

  try {
    const [{ data: device }, { data: profile }] = await Promise.all([
      params.client.from('devices').select('name').eq('id', params.deviceId).maybeSingle(),
      params.client.from('profiles').select('full_name').eq('id', params.userId).maybeSingle(),
    ])

    const deviceName = device?.name || 'Device'
    const ownerName = profile?.full_name || 'RETRACE User'
    const ownerEmail = await resolveOwnerEmail(params.client, params.userId, params.userEmail)

    // Deduplicate within 5-minute buckets to avoid floods
    const timeBucket = Math.floor(Date.now() / (5 * 60000))

    if (ownerEmail) {
      summary.attempted++
      const emailContent = buildSuspiciousActivityEmail({
        ownerName,
        deviceName,
        activityType: params.activityType,
        summary: params.summary,
        details: params.details,
        locationApprox: params.locationApprox,
      })

      const res = await sendEmail({
        to: ownerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        deduplicationKey: `suspicious:${params.deviceId}:${params.activityType}:${timeBucket}`,
      })

      if (res.success) {
        summary.delivered++
      } else if (res.error && !res.deduplicated) {
        summary.errors.push(res.error)
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error in suspicious activity dispatch'
    summary.errors.push(msg)
  }

  return summary
}

/**
 * 6. Recovery Completed Notification
 */
export async function notifyRecoveryCompleted(params: {
  client: any
  userId: string
  deviceId: string
  requestId: string
  action: 'recover' | 'cancel'
  userEmail?: string | null
}): Promise<NotificationDispatchSummary> {
  const summary: NotificationDispatchSummary = {
    attempted: 0,
    delivered: 0,
    configured: isEmailConfigured(),
    errors: [],
  }

  try {
    const [{ data: device }, { data: profile }] = await Promise.all([
      params.client.from('devices').select('name').eq('id', params.deviceId).maybeSingle(),
      params.client.from('profiles').select('full_name').eq('id', params.userId).maybeSingle(),
    ])

    const deviceName = device?.name || 'Device'
    const ownerName = profile?.full_name || 'RETRACE User'
    const ownerEmail = await resolveOwnerEmail(params.client, params.userId, params.userEmail)

    // Notify owner
    if (ownerEmail) {
      summary.attempted++
      const emailContent = buildRecoveryCompletedEmail({
        ownerName,
        deviceName,
        action: params.action,
        isContactRecipient: false,
      })

      const res = await sendEmail({
        to: ownerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        deduplicationKey: `recovery_completed:${params.requestId}:${params.action}:owner`,
      })

      if (res.success) {
        summary.delivered++
      } else if (res.error && !res.deduplicated) {
        summary.errors.push(res.error)
      }
    }

    // Notify verified contacts
    const { data: contacts } = await params.client
      .from('trusted_contacts')
      .select('id, name, email, approved')
      .eq('user_id', params.userId)
      .eq('approved', true)

    if (contacts && Array.isArray(contacts)) {
      for (const contact of contacts) {
        if (contact.email && isValidEmail(contact.email)) {
          summary.attempted++
          const contactContent = buildRecoveryCompletedEmail({
            ownerName,
            deviceName,
            action: params.action,
            isContactRecipient: true,
          })

          const res = await sendEmail({
            to: contact.email,
            subject: contactContent.subject,
            html: contactContent.html,
            text: contactContent.text,
            deduplicationKey: `recovery_completed:${params.requestId}:${params.action}:contact:${contact.id}`,
          })

          if (res.success) {
            summary.delivered++
          } else if (res.error && !res.deduplicated) {
            summary.errors.push(`Contact ${contact.name}: ${res.error}`)
          }
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error in recovery completed dispatch'
    summary.errors.push(msg)
  }

  return summary
}

/**
 * 7. Account Security Credential Event Notification
 */
export async function notifyAccountSecurityEvent(params: {
  client: any
  userId: string
  eventType: 'pin_configured' | 'pin_updated' | 'recovery_session_started' | 'contact_verified'
  detail: string
  userEmail?: string | null
}): Promise<NotificationDispatchSummary> {
  const summary: NotificationDispatchSummary = {
    attempted: 0,
    delivered: 0,
    configured: isEmailConfigured(),
    errors: [],
  }

  try {
    const { data: profile } = await params.client
      .from('profiles')
      .select('full_name')
      .eq('id', params.userId)
      .maybeSingle()

    const ownerName = profile?.full_name || 'RETRACE User'
    const ownerEmail = await resolveOwnerEmail(params.client, params.userId, params.userEmail)
    const timeBucket = Math.floor(Date.now() / 60000)

    if (ownerEmail) {
      summary.attempted++
      const emailContent = buildAccountSecurityEmail({
        ownerName,
        eventType: params.eventType,
        detail: params.detail,
      })

      const res = await sendEmail({
        to: ownerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        deduplicationKey: `security_event:${params.userId}:${params.eventType}:${timeBucket}`,
      })

      if (res.success) {
        summary.delivered++
      } else if (res.error && !res.deduplicated) {
        summary.errors.push(res.error)
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error in account security dispatch'
    summary.errors.push(msg)
  }

  return summary
}
