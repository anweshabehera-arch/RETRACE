import { NextResponse } from 'next/server'
import {
  getAuthenticatedServerClient,
  getRecoverySessionFromRequest,
  getServerServiceClient,
} from '@/lib/supabase/server-auth'
import {
  isEmailConfigured,
  getSenderEmail,
  getAppBaseUrl,
  isValidEmail,
  sendEmail,
} from '@/lib/email'
import {
  buildRecoveryIncidentEmail,
  buildPanicModeEmail,
  buildQuorumApprovalRequestEmail,
  buildQuorumDecisionEmail,
  buildSuspiciousActivityEmail,
  buildRecoveryCompletedEmail,
  buildAccountSecurityEmail,
} from '@/lib/email/templates'

export async function GET(request: Request) {
  try {
    // Check authentication
    const authRes = await getAuthenticatedServerClient(request).catch(() => null)
    let authenticated = Boolean(authRes && 'user' in authRes && authRes.user)

    if (!authenticated) {
      const session = getRecoverySessionFromRequest(request)
      if (session) authenticated = true
    }

    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    return NextResponse.json({
      service: 'RETRACE Email Notification Service',
      provider: 'Resend REST API (https://api.resend.com/emails)',
      configured: isEmailConfigured(),
      senderAddress: getSenderEmail(),
      appBaseUrl: getAppBaseUrl(),
      supportedEvents: [
        'recovery_incident_created',
        'panic_mode_activated',
        'quorum_approval_requested',
        'quorum_decision_submitted',
        'suspicious_activity_detected',
        'recovery_completed',
        'account_security_event',
      ],
      features: {
        serverSideOnly: true,
        deduplicationEnabled: true,
        liveAcceptanceEnforced: true,
        privacyPreserved: true,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error checking email notification status.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authRes = await getAuthenticatedServerClient(request).catch(() => null)
    let userEmail: string | null = null
    let userName = 'RETRACE User'

    if (authRes && 'user' in authRes && authRes.user) {
      userEmail = authRes.user.email || null
      userName = authRes.user.user_metadata?.full_name || 'RETRACE User'
    } else {
      const session = getRecoverySessionFromRequest(request)
      if (session) {
        userName = session.fullName
      } else {
        return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
      }
    }

    const body = await request.json().catch(() => ({}))
    const recipientEmail = typeof body?.recipientEmail === 'string' ? body.recipientEmail.trim() : (userEmail || '')
    const templateType = typeof body?.template === 'string' ? body.template.trim() : 'security_event'

    if (!recipientEmail || !isValidEmail(recipientEmail)) {
      return NextResponse.json(
        { error: 'Valid recipient email address is required for test email dispatch.' },
        { status: 400 }
      )
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          error:
            'Resend provider credentials are not configured. Set RESEND_API_KEY in server environment variables to enable live delivery.',
        },
        { status: 503 }
      )
    }

    let rendered: { subject: string; html: string; text: string }

    switch (templateType) {
      case 'incident_created':
        rendered = buildRecoveryIncidentEmail({
          ownerName: userName,
          deviceName: 'Test iPhone 15 Pro',
          deviceType: 'Smartphone',
          incidentId: 'test-incident-uuid',
          notes: 'Test email notification verification.',
          isContactRecipient: false,
        })
        break

      case 'panic':
        rendered = buildPanicModeEmail({
          ownerName: userName,
          deviceName: 'Test iPhone 15 Pro',
          locationName: 'Test Security Area, Delhi NCR',
          isContactRecipient: false,
        })
        break

      case 'quorum_request':
        rendered = buildQuorumApprovalRequestEmail({
          contactName: 'Test Guardian Contact',
          ownerName: userName,
          deviceName: 'Test MacBook Pro',
          actionType: 'Incident Status Verification',
          voteUrl: '/verify-contact?token=test-token-preview&action=verify',
          notes: 'Test guardian authorization check.',
        })
        break

      case 'quorum_decision':
        rendered = buildQuorumDecisionEmail({
          ownerName: userName,
          contactName: 'Sarah Jenkins',
          deviceName: 'Test MacBook Pro',
          actionType: 'Incident Status Verification',
          decision: 'approve',
          quorumStatus: 'authorized',
          comment: 'Verified with owner via secondary channel.',
        })
        break

      case 'suspicious':
        rendered = buildSuspiciousActivityEmail({
          ownerName: userName,
          deviceName: 'Test Pixel 8',
          activityType: 'sighting',
          summary: 'Community member reported sighting near Connaught Place.',
          locationApprox: 'Central Delhi',
        })
        break

      case 'recovery_completed':
        rendered = buildRecoveryCompletedEmail({
          ownerName: userName,
          deviceName: 'Test Pixel 8',
          action: 'recover',
          isContactRecipient: false,
        })
        break

      case 'security_event':
      default:
        rendered = buildAccountSecurityEmail({
          ownerName: userName,
          eventType: 'pin_configured',
          detail: 'A test security credential alert was generated to verify email delivery.',
        })
        break
    }

    const delivery = await sendEmail({
      to: recipientEmail,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
      // No deduplication key for intentional manual test sends
    })

    if (!delivery.success) {
      return NextResponse.json(
        {
          success: false,
          configured: delivery.configured,
          error: delivery.error,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      configured: true,
      messageId: delivery.messageId,
      recipient: recipientEmail,
      template: templateType,
      message: 'Test email successfully accepted and queued by Resend.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error dispatching test email.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
