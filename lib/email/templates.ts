/**
 * RETRACE AI — Branded Email Templates
 * Responsive, mobile-first HTML & plain-text templates for security notifications.
 */

import { getAppBaseUrl } from './index'

export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return ''
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface BaseLayoutOptions {
  title: string
  preheader: string
  badgeText: string
  badgeColor: string // hex color e.g. '#dc2626' (red), '#f59e0b' (amber), '#10b981' (green), '#3b82f6' (blue)
  headline: string
  bodyHtml: string
  ctaLabel?: string
  ctaUrl?: string
  securityWarning?: string
  plainTextContent: string
}

function renderBaseLayout(opts: BaseLayoutOptions): { html: string; text: string } {
  const appUrl = getAppBaseUrl()
  const ctaLink = opts.ctaUrl ? (opts.ctaUrl.startsWith('http') ? opts.ctaUrl : `${appUrl}${opts.ctaUrl}`) : null
  const formattedDate = new Date().toUTCString()

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.title)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Preheader text (hidden preview) -->
  <div style="display: none; font-size: 1px; color: #0b0f19; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${escapeHtml(opts.preheader)}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b0f19; width: 100%; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">

          <!-- Brand Header -->
          <tr>
            <td style="padding: 24px 28px; background: linear-gradient(180deg, #1f2937 0%, #111827 100%); border-bottom: 1px solid #1f2937;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 800; letter-spacing: 0.1em; color: #ffffff; text-transform: uppercase;">
                      <span style="color: #3b82f6;">RETRACE</span> AI
                    </span>
                    <span style="display: block; font-size: 11px; color: #9ca3af; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 2px;">
                      Autonomous Anti-Theft & Device Recovery
                    </span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; background-color: ${opts.badgeColor}20; color: ${opts.badgeColor}; border: 1px solid ${opts.badgeColor}40;">
                      ${escapeHtml(opts.badgeText)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                ${escapeHtml(opts.headline)}
              </h1>

              <div style="font-size: 14px; line-height: 1.6; color: #d1d5db;">
                ${opts.bodyHtml}
              </div>

              ${
                ctaLink && opts.ctaLabel
                  ? `
              <!-- Call to Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0 20px 0;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #2563eb;">
                    <a href="${escapeHtml(ctaLink)}" target="_blank" style="display: inline-block; padding: 13px 26px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; border: 1px solid #3b82f6; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);">
                      ${escapeHtml(opts.ctaLabel)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <div style="font-size: 11px; color: #6b7280; margin-bottom: 24px; word-break: break-all;">
                Or copy and open link: <a href="${escapeHtml(ctaLink)}" style="color: #60a5fa; text-decoration: underline;">${escapeHtml(ctaLink)}</a>
              </div>
              `
                  : ''
              }

              ${
                opts.securityWarning
                  ? `
              <!-- Security Warning Banner -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 24px; background-color: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px;">
                <tr>
                  <td style="padding: 14px 16px; font-size: 12px; line-height: 1.5; color: #fef3c7;">
                    <strong style="color: #fbbf24;">SECURITY NOTICE:</strong> ${opts.securityWarning}
                  </td>
                </tr>
              </table>
              `
                  : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 28px; background-color: #0d131f; border-top: 1px solid #1f2937; font-size: 11px; line-height: 1.5; color: #6b7280;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    Sent by RETRACE AI Security Dispatch &bull; ${escapeHtml(formattedDate)}<br>
                    This is an automated critical security notification for your protected devices.
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 10px;">
                    <a href="${escapeHtml(appUrl)}" style="color: #9ca3af; text-decoration: underline; margin-right: 12px;">Security Dashboard</a>
                    <a href="${escapeHtml(appUrl)}/settings" style="color: #9ca3af; text-decoration: underline;">Emergency Settings</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `====================================================
RETRACE AI - ${opts.badgeText.toUpperCase()}
====================================================

${opts.headline}

${opts.plainTextContent}

${ctaLink ? `ACTION REQUIRED:\n${opts.ctaLabel}: ${ctaLink}\n` : ''}
${opts.securityWarning ? `SECURITY NOTICE:\n${opts.securityWarning}\n` : ''}
Sent at: ${formattedDate}
Manage Security: ${appUrl}
====================================================`

  return { html, text }
}

// ============================================================================
// TEMPLATE 1: Recovery Incident Created
// ============================================================================

export interface RecoveryIncidentCreatedData {
  ownerName: string
  deviceName: string
  deviceType: string
  incidentId: string
  notes?: string | null
  isContactRecipient?: boolean
}

export function buildRecoveryIncidentEmail(data: RecoveryIncidentCreatedData) {
  const isContact = Boolean(data.isContactRecipient)
  const subject = isContact
    ? `[RETRACE ALERT] Emergency Recovery Started: ${data.ownerName}'s ${data.deviceName}`
    : `[RETRACE] Recovery Incident Active for ${data.deviceName}`

  const preheader = isContact
    ? `${data.ownerName} has flagged their device as lost. Trusted Circle alerted.`
    : `Your device ${data.deviceName} is marked lost. Recovery workflows initiated.`

  const headline = isContact
    ? `Emergency Recovery Active for ${escapeHtml(data.ownerName)}'s ${escapeHtml(data.deviceName)}`
    : `Recovery Incident Opened for ${escapeHtml(data.deviceName)}`

  const bodyHtml = isContact
    ? `<p>You are receiving this urgent alert because you are a verified guardian in <strong>${escapeHtml(data.ownerName)}</strong>'s RETRACE Trusted Circle.</p>
       <p>The device <strong>${escapeHtml(data.deviceName)}</strong> (${escapeHtml(data.deviceType)}) was reported lost or stolen. Autonomous tracking and recovery networks are now actively searching.</p>
       <table role="presentation" width="100%" style="background-color: #1f2937; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px;">
         <tr><td style="color: #9ca3af; padding: 4px 0;">Device:</td><td style="color: #ffffff; font-weight: 600;">${escapeHtml(data.deviceName)}</td></tr>
         <tr><td style="color: #9ca3af; padding: 4px 0;">Device Owner:</td><td style="color: #ffffff;">${escapeHtml(data.ownerName)}</td></tr>
         <tr><td style="color: #9ca3af; padding: 4px 0;">Status:</td><td style="color: #ef4444; font-weight: 600;">ACTIVE SEARCH / LOST</td></tr>
         ${data.notes ? `<tr><td style="color: #9ca3af; padding: 4px 0;">Owner Notes:</td><td style="color: #e5e7eb;">${escapeHtml(data.notes)}</td></tr>` : ''}
       </table>
       <p style="margin-top: 16px;"><strong>What you should do:</strong></p>
       <ul style="padding-left: 20px; margin: 8px 0; color: #d1d5db;">
         <li>Be on standby in case your friend requests guardian quorum authorization.</li>
         <li>Do NOT share any verification codes or OTPs if an unknown person calls you.</li>
         <li>Assist the owner by attempting to contact their alternate phone or in person.</li>
       </ul>`
    : `<p>A recovery incident has been opened for your device <strong>${escapeHtml(data.deviceName)}</strong>. The device has been moved into <strong>LOST</strong> status.</p>
       <table role="presentation" width="100%" style="background-color: #1f2937; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px;">
         <tr><td style="color: #9ca3af; padding: 4px 0;">Device:</td><td style="color: #ffffff; font-weight: 600;">${escapeHtml(data.deviceName)}</td></tr>
         <tr><td style="color: #9ca3af; padding: 4px 0;">Owner:</td><td style="color: #ffffff;">${escapeHtml(data.ownerName)}</td></tr>
         <tr><td style="color: #9ca3af; padding: 4px 0;">Incident ID:</td><td style="color: #e5e7eb; font-family: monospace;">${escapeHtml(data.incidentId)}</td></tr>
         <tr><td style="color: #9ca3af; padding: 4px 0;">Current Status:</td><td style="color: #ef4444; font-weight: 600;">LOST &bull; Protection Protocols Active</td></tr>
       </table>
       <p>The RETRACE Autonomous Community Network and AI Theft Detection monitors are tracking telemetry and offline signals.</p>`

  const plainText = isContact
    ? `${data.ownerName} has flagged their ${data.deviceName} (${data.deviceType}) as lost.\nAs a verified Trusted Contact, please be alert.\nDo not disclose verification codes to unsolicited callers.`
    : `Your device ${data.deviceName} is marked lost. Incident ID: ${data.incidentId}.\nRecovery workflows, Community QR Beacons, and telemetry tracking are active.`

  const { html, text } = renderBaseLayout({
    title: subject,
    preheader,
    badgeText: isContact ? 'Trusted Circle Alert' : 'Recovery Active',
    badgeColor: '#ef4444',
    headline,
    bodyHtml,
    ctaLabel: isContact ? 'Open Guardian View' : 'Open Recovery Dashboard',
    ctaUrl: '/dashboard',
    securityWarning:
      'RETRACE will NEVER call you or email you asking for your 6-digit Recovery PIN, master passwords, or SMS one-time codes.',
    plainTextContent: plainText,
  })

  return { subject, html, text }
}

// ============================================================================
// TEMPLATE 2: Panic Mode Activated
// ============================================================================

export interface PanicModeActivatedData {
  ownerName: string
  deviceName: string
  locationName?: string | null
  isContactRecipient?: boolean
}

export function buildPanicModeEmail(data: PanicModeActivatedData) {
  const isContact = Boolean(data.isContactRecipient)
  const subject = `[CRITICAL] Panic Mode Activated: ${data.deviceName}`
  const preheader = `Emergency Panic Playbook initiated for ${data.deviceName}. Immediate protection steps required.`

  const headline = `Emergency Panic Mode Activated: ${escapeHtml(data.deviceName)}`

  const bodyHtml = `
    <p style="color: #fca5a5; font-size: 15px; font-weight: 600;">
      A high-priority emergency panic signal was triggered for <strong>${escapeHtml(data.deviceName)}</strong>.
    </p>
    <p>
      ${isContact ? `Device owner <strong>${escapeHtml(data.ownerName)}</strong> triggered Panic Mode.` : 'Panic mode has been engaged for your device.'}
      ${data.locationName ? ` Approximate area: <strong>${escapeHtml(data.locationName)}</strong>.` : ''}
    </p>

    <div style="background-color: #1f2937; border-left: 4px solid #dc2626; padding: 14px 16px; margin: 18px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em;">
        Immediate Defensive Playbook:
      </h3>
      <ol style="margin: 0; padding-left: 18px; color: #d1d5db; font-size: 13px; line-height: 1.6;">
        <li><strong>Carrier SIM Lock (0-30 min):</strong> Call carrier helpline (198) to immediately deactivate SIM card and prevent banking OTP interception.</li>
        <li><strong>UPI & Banking Freeze (0-60 min):</strong> Dial National Cyber Helpline <strong>1930</strong> to block payment apps (PhonePe, GPay, Paytm).</li>
        <li><strong>Revoke Sessions (Within 2 hrs):</strong> Sign out of Google Account and Apple ID active device sessions.</li>
        <li><strong>CEIR IMEI Block (Within 24 hrs):</strong> Submit IMEI block report on Central Equipment Identity Register (ceir.gov.in).</li>
      </ol>
    </div>
  `

  const plainText = `CRITICAL ALERT: Panic Mode triggered for ${data.deviceName}.\nImmediate actions:\n1. Deactivate SIM with carrier (call 198)\n2. Dial 1930 to freeze UPI/banking\n3. Purge active Google/Apple ID sessions\n4. File CEIR IMEI block`

  const { html, text } = renderBaseLayout({
    title: subject,
    preheader,
    badgeText: 'CRITICAL PANIC',
    badgeColor: '#dc2626',
    headline,
    bodyHtml,
    ctaLabel: 'Open Emergency Playbook',
    ctaUrl: '/dashboard',
    securityWarning:
      'Thieves frequently attempt to call contacts pretending to be police or technicians to acquire OTPs. NEVER give out SMS codes or authorization links.',
    plainTextContent: plainText,
  })

  return { subject, html, text }
}

// ============================================================================
// TEMPLATE 3: Trusted Circle Recovery Approval Request (Quorum)
// ============================================================================

export interface QuorumApprovalRequestData {
  contactName: string
  ownerName: string
  deviceName: string
  actionType: string
  voteUrl: string
  notes?: string | null
}

export function buildQuorumApprovalRequestEmail(data: QuorumApprovalRequestData) {
  const subject = `[ACTION REQUIRED] Guardian Approval Requested by ${data.ownerName}`
  const preheader = `${data.ownerName} requests your authorization for sensitive action '${data.actionType}' on their lost device.`

  const headline = `Guardian Authorization Requested`

  const bodyHtml = `
    <p>Hello <strong>${escapeHtml(data.contactName)}</strong>,</p>
    <p>Your friend <strong>${escapeHtml(data.ownerName)}</strong> has initiated a sensitive security action on their lost device (<strong>${escapeHtml(data.deviceName)}</strong>) that requires Trusted Circle guardian quorum.</p>

    <table role="presentation" width="100%" style="background-color: #1f2937; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px;">
      <tr><td style="color: #9ca3af; padding: 4px 0;">Device:</td><td style="color: #ffffff; font-weight: 600;">${escapeHtml(data.deviceName)}</td></tr>
      <tr><td style="color: #9ca3af; padding: 4px 0;">Action Requested:</td><td style="color: #f59e0b; font-weight: 700;">${escapeHtml(data.actionType)}</td></tr>
      <tr><td style="color: #9ca3af; padding: 4px 0;">Requesting User:</td><td style="color: #ffffff;">${escapeHtml(data.ownerName)}</td></tr>
      ${data.notes ? `<tr><td style="color: #9ca3af; padding: 4px 0;">Reason / Notes:</td><td style="color: #e5e7eb;">${escapeHtml(data.notes)}</td></tr>` : ''}
    </table>

    <p>As a verified guardian, your vote is required to validate or reject this security action. This cryptographic voting token will expire in 24 hours.</p>
  `

  const plainText = `Hello ${data.contactName},\n${data.ownerName} requests your guardian approval for '${data.actionType}' on their lost ${data.deviceName}.\nPlease review and submit your vote.`

  const { html, text } = renderBaseLayout({
    title: subject,
    preheader,
    badgeText: 'Guardian Quorum',
    badgeColor: '#f59e0b',
    headline,
    bodyHtml,
    ctaLabel: 'Review & Cast Guardian Vote',
    ctaUrl: data.voteUrl,
    securityWarning:
      'Only approve if you recognize this request from your friend. If you suspect your friend did not initiate this or if a third party pressured you, select REJECT.',
    plainTextContent: plainText,
  })

  return { subject, html, text }
}

// ============================================================================
// TEMPLATE 4: Recovery Approval or Rejection
// ============================================================================

export interface QuorumDecisionData {
  ownerName: string
  contactName: string
  deviceName: string
  actionType: string
  decision: 'approve' | 'reject'
  quorumStatus: string
  comment?: string | null
}

export function buildQuorumDecisionEmail(data: QuorumDecisionData) {
  const isApproved = data.decision === 'approve'
  const subject = `[GUARDIAN UPDATE] ${data.contactName} ${isApproved ? 'APPROVED' : 'REJECTED'} '${data.actionType}'`
  const preheader = `Guardian ${data.contactName} has voted ${data.decision.toUpperCase()}. Quorum Status: ${data.quorumStatus}.`

  const headline = `Guardian Decision: ${isApproved ? 'Approved' : 'Rejected'}`

  const bodyHtml = `
    <p>A response has been submitted for your guardian authorization request:</p>

    <table role="presentation" width="100%" style="background-color: #1f2937; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px;">
      <tr><td style="color: #9ca3af; padding: 4px 0;">Guardian Contact:</td><td style="color: #ffffff; font-weight: 600;">${escapeHtml(data.contactName)}</td></tr>
      <tr><td style="color: #9ca3af; padding: 4px 0;">Security Action:</td><td style="color: #ffffff;">${escapeHtml(data.actionType)}</td></tr>
      <tr><td style="color: #9ca3af; padding: 4px 0;">Decision:</td><td style="color: ${isApproved ? '#10b981' : '#ef4444'}; font-weight: 700; text-transform: uppercase;">${escapeHtml(data.decision.toUpperCase())}</td></tr>
      <tr><td style="color: #9ca3af; padding: 4px 0;">Quorum Status:</td><td style="color: #60a5fa; font-weight: 600; text-transform: uppercase;">${escapeHtml(data.quorumStatus.toUpperCase())}</td></tr>
      ${data.comment ? `<tr><td style="color: #9ca3af; padding: 4px 0;">Guardian Comment:</td><td style="color: #e5e7eb;">${escapeHtml(data.comment)}</td></tr>` : ''}
    </table>

    <p>${isApproved ? 'Authorization has progressed.' : 'One of your guardians rejected this authorization. If this action was legitimate, verify with your contact.'}</p>
  `

  const plainText = `Guardian ${data.contactName} voted ${data.decision.toUpperCase()} for '${data.actionType}'.\nQuorum Status: ${data.quorumStatus}.`

  const { html, text } = renderBaseLayout({
    title: subject,
    preheader,
    badgeText: isApproved ? 'Vote Approved' : 'Vote Rejected',
    badgeColor: isApproved ? '#10b981' : '#ef4444',
    headline,
    bodyHtml,
    ctaLabel: 'View Incident Quorum',
    ctaUrl: '/dashboard',
    securityWarning:
      'Guardian voting is single-use and tamper-evident. Contact decisions are permanently stored in your incident audit logs.',
    plainTextContent: plainText,
  })

  return { subject, html, text }
}

// ============================================================================
// TEMPLATE 5: Suspicious Activity Detected
// ============================================================================

export interface SuspiciousActivityData {
  ownerName: string
  deviceName: string
  activityType: 'sighting' | 'theft_signal' | 'auth_spike'
  summary: string
  details?: string
  locationApprox?: string | null
}

export function buildSuspiciousActivityEmail(data: SuspiciousActivityData) {
  const isSighting = data.activityType === 'sighting'
  const subject = isSighting
    ? `[COMMUNITY SIGHTING] New Location Reported for ${data.deviceName}`
    : `[SECURITY WARNING] Suspicious Activity Detected on ${data.deviceName}`

  const preheader = isSighting
    ? `An unverified crowd sighting was reported for your lost ${data.deviceName}.`
    : `AI Theft Detection identified an anomalous signal on ${data.deviceName}.`

  const headline = isSighting
    ? `Unverified Community Sighting: ${escapeHtml(data.deviceName)}`
    : `Suspicious Security Alert: ${escapeHtml(data.deviceName)}`

  const bodyHtml = isSighting
    ? `<p>A member of the public scanned the Community Recovery QR Beacon for your lost device <strong>${escapeHtml(data.deviceName)}</strong> and submitted a sighting location.</p>
       <div style="background-color: #1f2937; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 4px; font-size: 13px;">
         <strong style="color: #60a5fa;">UNVERIFIED COMMUNITY REPORT:</strong><br>
         ${escapeHtml(data.summary)}
         ${data.locationApprox ? `<br>Approximate Area: <strong>${escapeHtml(data.locationApprox)}</strong>` : ''}
       </div>
       <p style="font-size: 13px; color: #9ca3af;">
         <em>Important Safety & Integrity Notice:</em> This is a crowd-sourced report and has not been verified by internal device hardware. Never confront unknown parties or retrieve devices alone.
       </p>`
    : `<p>RETRACE AI Theft Detection detected unusual activity on <strong>${escapeHtml(data.deviceName)}</strong>.</p>
       <div style="background-color: #1f2937; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px; font-size: 13px;">
         <strong style="color: #fbbf24;">DETECTED ANOMALY:</strong><br>
         ${escapeHtml(data.summary)}
         ${data.details ? `<br><span style="color: #9ca3af;">${escapeHtml(data.details)}</span>` : ''}
       </div>
       <p>Check your timeline and verify if your device is safe in your possession.</p>`

  const plainText = `${headline}\n${data.summary}\n${data.details || ''}`

  const { html, text } = renderBaseLayout({
    title: subject,
    preheader,
    badgeText: isSighting ? 'Crowd Sighting' : 'Suspicious Signal',
    badgeColor: isSighting ? '#3b82f6' : '#f59e0b',
    headline,
    bodyHtml,
    ctaLabel: 'View Activity Timeline',
    ctaUrl: '/dashboard',
    securityWarning:
      'Never attempt to confront individuals or recover property from private residences alone. Share sighting details with local police authorities.',
    plainTextContent: plainText,
  })

  return { subject, html, text }
}

// ============================================================================
// TEMPLATE 6: Recovery Completed
// ============================================================================

export interface RecoveryCompletedData {
  ownerName: string
  deviceName: string
  action: 'recover' | 'cancel'
  isContactRecipient?: boolean
}

export function buildRecoveryCompletedEmail(data: RecoveryCompletedData) {
  const isRecovered = data.action === 'recover'
  const isContact = Boolean(data.isContactRecipient)

  const subject = isRecovered
    ? `[RESOLVED] ${data.deviceName} Marked as Recovered`
    : `[CLOSED] Recovery Incident for ${data.deviceName} Cancelled`

  const preheader = isRecovered
    ? `${data.deviceName} is safely recovered. Active tracking closed and protection restored.`
    : `Recovery incident for ${data.deviceName} was cancelled.`

  const headline = isRecovered
    ? `${escapeHtml(data.deviceName)} Safely Recovered`
    : `Recovery Incident Cancelled`

  const bodyHtml = isContact
    ? `<p>Hello,</p>
       <p>Good news! <strong>${escapeHtml(data.ownerName)}</strong> has ${isRecovered ? 'safely recovered their device' : 'cancelled the recovery incident for'} <strong>${escapeHtml(data.deviceName)}</strong>.</p>
       <p>The emergency status has been deactivated, and the device has returned to normal protected status. No further guardian action is needed. Thank you for being a part of their Trusted Circle!</p>`
    : `<p>Your device <strong>${escapeHtml(data.deviceName)}</strong> has been ${isRecovered ? 'marked as recovered' : 'restored to nominal status'}.</p>
       <p>The recovery incident has been officially closed, offline emergency flags have been cleared, and your baseline telemetry monitoring is active.</p>`

  const plainText = `${data.deviceName} recovery incident has been ${isRecovered ? 'RESOLVED (Recovered)' : 'CANCELLED'}.\nStatus restored to Protected.`

  const { html, text } = renderBaseLayout({
    title: subject,
    preheader,
    badgeText: isRecovered ? 'Incident Resolved' : 'Incident Closed',
    badgeColor: '#10b981',
    headline,
    bodyHtml,
    ctaLabel: 'Open Dashboard',
    ctaUrl: '/dashboard',
    securityWarning:
      'If you still do not have physical possession of your device, immediately re-open Recovery Mode from the RETRACE dashboard.',
    plainTextContent: plainText,
  })

  return { subject, html, text }
}

// ============================================================================
// TEMPLATE 7: Important Account Security Events
// ============================================================================

export interface AccountSecurityEventData {
  ownerName: string
  eventType: 'pin_configured' | 'pin_updated' | 'recovery_session_started' | 'contact_verified'
  detail: string
  ipAddress?: string | null
}

export function buildAccountSecurityEmail(data: AccountSecurityEventData) {
  const eventTitles = {
    pin_configured: 'Recovery PIN Configured',
    pin_updated: 'Recovery PIN Changed',
    recovery_session_started: 'Emergency Recovery Session Authenticated',
    contact_verified: 'Trusted Contact Verified',
  }

  const headline = eventTitles[data.eventType] || 'Security Credentials Updated'
  const subject = `[SECURITY ALERT] ${headline}`
  const preheader = `A sensitive security event occurred on your RETRACE account: ${headline}.`

  const bodyHtml = `
    <p>A critical security event occurred on your RETRACE AI account:</p>

    <table role="presentation" width="100%" style="background-color: #1f2937; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px;">
      <tr><td style="color: #9ca3af; padding: 4px 0;">Event:</td><td style="color: #60a5fa; font-weight: 700;">${escapeHtml(headline)}</td></tr>
      <tr><td style="color: #9ca3af; padding: 4px 0;">Details:</td><td style="color: #ffffff;">${escapeHtml(data.detail)}</td></tr>
      <tr><td style="color: #9ca3af; padding: 4px 0;">Date & Time:</td><td style="color: #d1d5db;">${escapeHtml(new Date().toUTCString())}</td></tr>
    </table>

    <p style="color: #fca5a5; font-size: 13px;">
      <strong>Did not perform this action?</strong> If you did not initiate this change, someone may be attempting to access your emergency credentials. Sign in immediately to change your credentials and review active sessions.
    </p>
  `

  const plainText = `SECURITY ALERT: ${headline}\n${data.detail}\nIf you did not do this, secure your account immediately at ${getAppBaseUrl()}`

  const { html, text } = renderBaseLayout({
    title: subject,
    preheader,
    badgeText: 'Security Notice',
    badgeColor: '#3b82f6',
    headline,
    bodyHtml,
    ctaLabel: 'Review Security Settings',
    ctaUrl: '/settings',
    securityWarning:
      'RETRACE will never ask you to confirm your Recovery PIN via email or phone. Keep your PIN confidential.',
    plainTextContent: plainText,
  })

  return { subject, html, text }
}
