import { NextResponse } from 'next/server'
import {
  getAuthenticatedServerClient,
  hashRecoveryPin,
  isValidRecoveryPinFormat,
  verifyRecoveryPinHash,
} from '@/lib/supabase/server-auth'

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedServerClient(request)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = (await request.json().catch(() => null)) as { pin?: unknown } | null
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''

    if (!isValidRecoveryPinFormat(pin)) {
      return NextResponse.json(
        { error: 'Recovery PIN must be 4 to 6 numeric digits.' },
        { status: 400 }
      )
    }

    const pinHash = hashRecoveryPin(pin)

    const { error: updateError } = await auth.supabase
      .from('profiles')
      .update({
        recovery_pin_hash: pinHash,
        has_recovery_pin: true,
      })
      .eq('id', auth.user.id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Unable to save recovery PIN.' },
        { status: 500 }
      )
    }

    await auth.supabase.from('activity_logs').insert({
      user_id: auth.user.id,
      title: 'Recovery PIN configured',
      description: 'Recovery PIN was securely hashed and saved to your identity.',
      category: 'Security',
    })

    return NextResponse.json({ success: true, hasRecoveryPin: true })
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

    const body = (await request.json().catch(() => null)) as { pin?: unknown } | null
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''

    if (!isValidRecoveryPinFormat(pin)) {
      return NextResponse.json(
        { error: 'Enter a valid 4 to 6 digit Recovery PIN.' },
        { status: 400 }
      )
    }

    const { data: profile, error: fetchError } = await auth.supabase
      .from('profiles')
      .select('recovery_pin_hash, has_recovery_pin, is_verified')
      .eq('id', auth.user.id)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message || 'Failed to check security profile.' },
        { status: 500 }
      )
    }

    if (!profile || !profile.has_recovery_pin || !profile.recovery_pin_hash) {
      return NextResponse.json(
        { error: 'No recovery PIN is configured yet. Set one in Settings first.' },
        { status: 400 }
      )
    }

    const verified = verifyRecoveryPinHash(pin, profile.recovery_pin_hash)

    if (!verified) {
      await auth.supabase.from('activity_logs').insert({
        user_id: auth.user.id,
        title: 'Recovery PIN check failed',
        description: 'An incorrect Recovery PIN was entered during verification.',
        category: 'Security',
      })
      return NextResponse.json({ verified: false, error: 'Incorrect Recovery PIN.' }, { status: 401 })
    }

    if (!profile.is_verified) {
      await auth.supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', auth.user.id)
    }

    await auth.supabase.from('activity_logs').insert({
      user_id: auth.user.id,
      title: 'Security verification completed',
      description: 'Recovery identity verified using your Recovery PIN.',
      category: 'Security',
    })

    return NextResponse.json({ verified: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

