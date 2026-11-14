import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  getAuthenticatedServerClient,
  getRecoverySessionFromRequest,
  getServerServiceClient,
} from '@/lib/supabase/server-auth'
import { sendSms } from '@/lib/sms'
import {
  notifyQuorumApprovalRequested,
  notifyQuorumDecisionSubmitted,
} from '@/lib/email/notifications'

const QUORUM_SECRET =
  process.env.RETRACE_QUORUM_SECRET ||
  process.env.RETRACE_SESSION_SECRET ||
  'retrace-quorum-signature-secret-2026'

interface QuorumTokenPayload {
  requestId: string
  contactId: string
  actionType: string
  userId: string
  issuedAt: number
  expiresAt: number
}

function createQuorumVoteToken(params: {
  requestId: string
  contactId: string
  actionType: string
  userId: string
}): string {
  const issuedAt = Date.now()
  const expiresAt = issuedAt + 24 * 60 * 60 * 1000 // 24 hours validity
  const payload: QuorumTokenPayload = { ...params, issuedAt, expiresAt }
  const bodyB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', QUORUM_SECRET).update(bodyB64).digest('base64url')
  return `${bodyB64}.${sig}`
}

function verifyQuorumVoteToken(token: string): QuorumTokenPayload | null {
  try {
    const [bodyB64, sig] = token.split('.')
    if (!bodyB64 || !sig) return null
    const expectedSig = createHmac('sha256', QUORUM_SECRET).update(bodyB64).digest('base64url')
    const sigBuf = Buffer.from(sig)
    const expBuf = Buffer.from(expectedSig)
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null
    }
    const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as QuorumTokenPayload
    if (Date.now() > payload.expiresAt) return null
    return payload
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (token) {
      // Guardian is viewing the approval portal via link
      const payload = verifyQuorumVoteToken(token)
      if (!payload) {
        return NextResponse.json({ valid: false, error: 'Voting token has expired or is invalid.' }, { status: 400 })
      }

      const client = getServerServiceClient()
      if (!client) {
        return NextResponse.json({ valid: false, error: 'Database service unavailable.' }, { status: 503 })
      }

      const { data: requestRecord } = await client
        .from('recovery_requests')
        .select('id, status, notes, created_at, action_quorum_approvals')
        .eq('id', payload.requestId)
        .single()

      const { data: contactRecord } = await client
        .from('trusted_contacts')
        .select('id, name, relation, approved, user_id')
        .eq('id', payload.contactId)
        .single()

      if (!contactRecord || !contactRecord.approved || contactRecord.user_id !== payload.userId) {
        return NextResponse.json(
          { valid: false, error: 'Guardian status is no longer active or contact was revoked by the device owner.' },
          { status: 403 }
        )
      }

      return NextResponse.json({
        valid: true,
        actionType: payload.actionType,
        request: requestRecord,
        contact: {
          id: contactRecord.id,
          name: contactRecord.name,
          relation: contactRecord.relation,
          approved: contactRecord.approved,
        },
      })
    }

    return NextResponse.json({ error: 'Token parameter is required.' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error resolving quorum request.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    let userId: string | null = null
    let client: any = null

    const authRes = await getAuthenticatedServerClient(request).catch(() => null)
    if (authRes && 'user' in authRes && authRes.user) {
      userId = authRes.user.id
      client = authRes.supabase
    } else {
      const recoverySession = getRecoverySessionFromRequest(request)
      if (recoverySession) {
        userId = recoverySession.userId
        client = getServerServiceClient() || authRes?.supabase
      }
    }

    if (!userId || !client) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { requestId, actionType, notes } = body

    if (!requestId || !actionType) {
      return NextResponse.json({ error: 'Missing requestId or actionType.' }, { status: 400 })
    }

    // 1. Fetch recovery request ensuring ownership
    const { data: incident, error: incError } = await client
      .from('recovery_requests')
      .select('*')
      .eq('id', requestId)
      .eq('user_id', userId)
      .single()

    if (incError || !incident) {
      return NextResponse.json({ error: 'Recovery incident not found or unauthorized.' }, { status: 404 })
    }

    // 2. Fetch verified contacts
    const { data: contacts } = await client
      .from('trusted_contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('approved', true)

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: 'You need at least 1 verified contact in your Trusted Circle to initiate guardian quorum.' },
        { status: 400 }
      )
    }

    const votesRequired = Math.min(2, contacts.length)

    // 3. Generate token links for each verified contact
    const inviteLinks = contacts.map((c: any) => {
      const voteToken = createQuorumVoteToken({
        requestId,
        contactId: c.id,
        actionType,
        userId: userId!,
      })
      return {
        contactId: c.id,
        contactName: c.name,
        contactPhone: c.phone,
        voteToken,
        voteUrl: `/verify-contact?token=${voteToken}&action=${actionType}`,
      }
    })

    const quorumRecord = {
      actionType,
      initiatedAt: new Date().toISOString(),
      votesRequired,
      votesReceived: 0,
      approvedContactIds: [],
      rejectedContactIds: [],
      status: 'pending',
      notes: notes || 'Sensitive recovery action requested.',
    }

    await client
      .from('recovery_requests')
      .update({ action_quorum_approvals: quorumRecord })
      .eq('id', requestId)

    // Notify contacts via SMS if configured
    let smsSent = 0
    for (const link of inviteLinks) {
      if (link.contactPhone) {
        const smsText = `[RETRACE GUARDIAN] Security action '${actionType}' requested on your friend's lost phone. Review and approve at: ${link.voteUrl}`
        sendSms({ to: link.contactPhone, body: smsText })
          .then((res) => {
            if (res.success) smsSent++
          })
          .catch(() => {})
      }
    }

    // Dispatch email authorization requests to verified guardians
    notifyQuorumApprovalRequested({
      client,
      userId,
      requestId,
      actionType,
      inviteLinks,
      notes: notes || null,
    }).catch((err) => {
      console.error('[Quorum Email Notification Error]', err)
    })

    return NextResponse.json({
      success: true,
      message: `Guardian authorization initiated. ${votesRequired} approval(s) required.`,
      quorum: quorumRecord,
      inviteLinks,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error initiating quorum.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { voteToken, decision, comment } = body

    if (!voteToken || (decision !== 'approve' && decision !== 'reject')) {
      return NextResponse.json({ error: 'Valid voteToken and decision (approve/reject) required.' }, { status: 400 })
    }

    const payload = verifyQuorumVoteToken(voteToken)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired authorization token.' }, { status: 401 })
    }

    const client = getServerServiceClient()
    if (!client) {
      return NextResponse.json({ error: 'Database service unavailable.' }, { status: 503 })
    }

    // 1. Verify that the contact is still active, approved, and belongs to the owner
    const { data: contact, error: contactError } = await client
      .from('trusted_contacts')
      .select('id, name, approved, user_id')
      .eq('id', payload.contactId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Guardian contact record no longer exists.' }, { status: 403 })
    }

    if (!contact.approved || contact.user_id !== payload.userId) {
      return NextResponse.json(
        { error: 'Guardian status is inactive or was revoked by the device owner.' },
        { status: 403 }
      )
    }

    // 2. Fetch the incident
    const { data: incident, error: incError } = await client
      .from('recovery_requests')
      .select('*')
      .eq('id', payload.requestId)
      .single()

    if (incError || !incident) {
      return NextResponse.json({ error: 'Incident not found.' }, { status: 404 })
    }

    const existingQuorum = (incident.action_quorum_approvals as any) || {
      actionType: payload.actionType,
      votesRequired: 1,
      votesReceived: 0,
      approvedContactIds: [],
      rejectedContactIds: [],
      status: 'pending',
    }

    const approvedSet = new Set<string>(existingQuorum.approvedContactIds || [])
    const rejectedSet = new Set<string>(existingQuorum.rejectedContactIds || [])

    // 3. Strict ONE-TIME VOTING check
    if (approvedSet.has(payload.contactId) || rejectedSet.has(payload.contactId)) {
      return NextResponse.json(
        { error: 'You have already submitted your decision for this authorization request. One-time voting is enforced.' },
        { status: 400 }
      )
    }

    // Record decision
    if (decision === 'approve') {
      approvedSet.add(payload.contactId)
    } else {
      rejectedSet.add(payload.contactId)
    }

    const approvedList = Array.from(approvedSet)
    const rejectedList = Array.from(rejectedSet)
    const votesReceived = approvedList.length

    let status = existingQuorum.status
    if (votesReceived >= (existingQuorum.votesRequired || 1)) {
      status = 'authorized'
    } else if (rejectedList.length > 0 && existingQuorum.votesRequired > 1) {
      status = 'disputed'
    }

    const updatedQuorum = {
      ...existingQuorum,
      votesReceived,
      approvedContactIds: approvedList,
      rejectedContactIds: rejectedList,
      status,
      lastDecisionAt: new Date().toISOString(),
      lastComment: comment || null,
    }

    await client
      .from('recovery_requests')
      .update({ action_quorum_approvals: updatedQuorum })
      .eq('id', payload.requestId)

    // Log security activity entry
    await client.from('activity_logs').insert({
      user_id: payload.userId,
      device_id: incident.device_id,
      title: decision === 'approve' ? 'Guardian Authorization Approved' : 'Guardian Authorization Rejected',
      description: `Trusted contact ${contact.name} voted ${decision.toUpperCase()} for sensitive action '${payload.actionType}'. Quorum status: ${status.toUpperCase()}.`,
      category: 'Security',
    })

    // Dispatch email notification to owner regarding guardian decision
    notifyQuorumDecisionSubmitted({
      client,
      userId: payload.userId,
      requestId: payload.requestId,
      contactId: payload.contactId,
      actionType: payload.actionType,
      decision,
      quorumStatus: status,
      comment: comment || null,
    }).catch((err) => {
      console.error('[Quorum Decision Email Error]', err)
    })

    return NextResponse.json({
      success: true,
      message: `Your vote has been recorded: ${decision.toUpperCase()}.`,
      quorumStatus: status,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error recording guardian vote.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
