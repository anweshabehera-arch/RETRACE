import { NextResponse } from 'next/server'
import { getAuthenticatedServerClient, getServerServiceClient } from '@/lib/supabase/server-auth'
import { canSendOtp, generateAndStoreOtp, verifyOtp } from '@/lib/security/otp'
import { isSmsConfigured, sendSms } from '@/lib/sms'
import { notifyAccountSecurityEvent } from '@/lib/email/notifications'

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedServerClient(request)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = (await request.json().catch(() => null)) as {
      contactId?: unknown
    } | null

    const contactId = typeof body?.contactId === 'string' ? body.contactId.trim() : ''
    if (!contactId) {
      return NextResponse.json({ error: 'Contact ID is required.' }, { status: 400 })
    }

    // Verify contact belongs to the authenticated user under RLS
    const { data: contact, error: fetchError } = await auth.supabase
      .from('trusted_contacts')
      .select('id, name, phone, approved')
      .eq('id', contactId)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (fetchError || !contact) {
      return NextResponse.json({ error: 'Trusted contact not found.' }, { status: 404 })
    }

    if (contact.approved) {
      return NextResponse.json({ error: 'This contact is already verified.' }, { status: 400 })
    }

    // Check cooldown
    const cooldown = canSendOtp(contact.id)
    if (!cooldown.allowed) {
      return NextResponse.json(
        { error: `Please wait ${cooldown.waitSeconds} seconds before requesting a new code.` },
        { status: 429 }
      )
    }

    // Check if SMS provider is configured
    if (!isSmsConfigured()) {
      return NextResponse.json(
        {
          error:
            'SMS provider credentials are not configured. To enable live SMS OTP verification, add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env.local.',
          configured: false,
        },
        { status: 503 }
      )
    }

    const { otp, expiresAt } = generateAndStoreOtp(contact.id)

    const smsResult = await sendSms({
      to: contact.phone,
      body: `RETRACE: Your security verification code for ${contact.name} is ${otp}. Valid for 10 minutes. Do not share this code.`,
    })

    if (!smsResult.success) {
      return NextResponse.json({ error: smsResult.error, configured: smsResult.configured }, { status: 502 })
    }

    await auth.supabase.from('activity_logs').insert({
      user_id: auth.user.id,
      title: 'Verification code sent',
      description: `Verification SMS dispatched to ${contact.name}'s phone.`,
      category: 'Security',
    })

    return NextResponse.json({
      success: true,
      expiresAt,
      message: `Verification code sent to ${contact.phone}.`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await getAuthenticatedServerClient(request)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = (await request.json().catch(() => null)) as {
      contactId?: unknown
      otp?: unknown
    } | null

    const contactId = typeof body?.contactId === 'string' ? body.contactId.trim() : ''
    const otp = typeof body?.otp === 'string' ? body.otp.trim() : ''

    if (!contactId || !otp) {
      return NextResponse.json({ error: 'Contact ID and 6-digit code are required.' }, { status: 400 })
    }

    const { data: contact, error: fetchError } = await auth.supabase
      .from('trusted_contacts')
      .select('id, name, phone, approved')
      .eq('id', contactId)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (fetchError || !contact) {
      return NextResponse.json({ error: 'Trusted contact not found.' }, { status: 404 })
    }

    const check = verifyOtp(contactId, otp)
    if (!check.success) {
      return NextResponse.json({ error: check.error || 'Verification failed.' }, { status: 400 })
    }

    // Try service client first (to bypass column-level restrictions), or call database function
    const serviceClient = getServerServiceClient()
    let updateOk = false

    if (serviceClient) {
      const { error: updErr } = await serviceClient
        .from('trusted_contacts')
        .update({
          approved: true,
          approved_at: new Date().toISOString(),
        })
        .eq('id', contactId)
        .eq('user_id', auth.user.id)

      if (!updErr) updateOk = true
    }

    if (!updateOk) {
      // Call public.verify_trusted_contact_internal RPC
      const { data: rpcRes, error: rpcErr } = await auth.supabase.rpc('verify_trusted_contact_internal', {
        p_contact_id: contactId,
        p_user_id: auth.user.id,
      })

      if (rpcErr || !rpcRes) {
        // Fallback update directly if RPC not yet migrated
        const { error: directErr } = await auth.supabase
          .from('trusted_contacts')
          .update({
            approved: true,
            approved_at: new Date().toISOString(),
          })
          .eq('id', contactId)
          .eq('user_id', auth.user.id)

        if (directErr) {
          return NextResponse.json(
            { error: directErr.message || 'Verification succeeded, but failed to update status.' },
            { status: 500 }
          )
        }
      }
    }

    await auth.supabase.from('activity_logs').insert({
      user_id: auth.user.id,
      title: 'Trusted contact verified',
      description: `${contact.name}'s phone number was verified via SMS OTP.`,
      category: 'Security',
    })

    // Dispatch email notification to owner confirming contact verification
    notifyAccountSecurityEvent({
      client: auth.supabase,
      userId: auth.user.id,
      eventType: 'contact_verified',
      detail: `Trusted contact ${contact.name} was successfully verified and added to your active Trusted Circle.`,
      userEmail: auth.user.email,
    }).catch((err) => {
      console.error('[Contact Verified Email Error]', err)
    })

    return NextResponse.json({
      verified: true,
      message: `${contact.name} has been verified and added to your active Trusted Circle.`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
