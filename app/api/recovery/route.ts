import { NextResponse } from 'next/server'
import { getAuthenticatedServerClient } from '@/lib/supabase/server-auth'

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedServerClient(request)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = (await request.json().catch(() => null)) as {
      deviceId?: unknown
      notes?: unknown
    } | null

    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : ''
    const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 500) : null

    if (!deviceId) {
      return NextResponse.json({ error: 'A valid device must be selected.' }, { status: 400 })
    }

    // Verify device ownership under RLS
    const { data: device, error: deviceError } = await auth.supabase
      .from('devices')
      .select('id, name, status')
      .eq('id', deviceId)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (deviceError) {
      return NextResponse.json(
        { error: deviceError.message || 'Unable to verify device ownership.' },
        { status: 500 }
      )
    }

    if (!device) {
      return NextResponse.json({ error: 'Device not found for your account.' }, { status: 404 })
    }

    // Prevent duplicate active recovery requests for the same device
    const { data: existingActive, error: existingError } = await auth.supabase
      .from('recovery_requests')
      .select('id')
      .eq('user_id', auth.user.id)
      .eq('device_id', deviceId)
      .eq('status', 'active')
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message || 'Unable to check existing recovery requests.' },
        { status: 500 }
      )
    }

    if (existingActive) {
      return NextResponse.json(
        { error: `An active recovery request already exists for ${device.name}.` },
        { status: 409 }
      )
    }

    const { count: contactCount } = await auth.supabase
      .from('trusted_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .eq('approved', true)

    const approvalsRequired = contactCount && contactCount >= 2 ? 2 : 1

    const { data: createdRequest, error: insertError } = await auth.supabase
      .from('recovery_requests')
      .insert({
        user_id: auth.user.id,
        device_id: deviceId,
        status: 'active',
        approvals_required: approvalsRequired,
        approvals_received: 0,
        notes: notes || null,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || 'Failed to create recovery request.' },
        { status: 500 }
      )
    }

    // Mark the device as lost
    const { error: updateDeviceError } = await auth.supabase
      .from('devices')
      .update({ status: 'lost', is_online: false })
      .eq('id', deviceId)
      .eq('user_id', auth.user.id)

    if (updateDeviceError) {
      return NextResponse.json(
        { error: updateDeviceError.message || 'Recovery request created, but failed to update device status.' },
        { status: 500 }
      )
    }

    await auth.supabase.from('activity_logs').insert({
      user_id: auth.user.id,
      device_id: deviceId,
      title: 'Recovery request started',
      description: `${device.name} was marked as lost and an incident session was opened.`,
      category: 'Recovery',
    })

    return NextResponse.json({ recoveryRequest: createdRequest })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedServerClient(request)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = (await request.json().catch(() => null)) as {
      requestId?: unknown
      action?: unknown
    } | null

    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : ''
    const action = body?.action === 'recover' || body?.action === 'cancel' ? body.action : null

    if (!requestId || !action) {
      return NextResponse.json(
        { error: 'Valid recovery request ID and action (recover or cancel) are required.' },
        { status: 400 }
      )
    }

    const { data: reqRow, error: fetchError } = await auth.supabase
      .from('recovery_requests')
      .select('id, device_id, status')
      .eq('id', requestId)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message || 'Failed to load recovery request.' },
        { status: 500 }
      )
    }

    if (!reqRow) {
      return NextResponse.json({ error: 'Recovery request not found.' }, { status: 404 })
    }

    if (reqRow.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot update a recovery request that is already ${reqRow.status}.` },
        { status: 409 }
      )
    }

    const nextReqStatus = action === 'recover' ? 'recovered' : 'cancelled'
    const nextDeviceStatus = 'protected'

    const { data: updatedRequest, error: updateReqError } = await auth.supabase
      .from('recovery_requests')
      .update({ status: nextReqStatus })
      .eq('id', requestId)
      .eq('user_id', auth.user.id)
      .select()
      .single()

    if (updateReqError) {
      return NextResponse.json(
        { error: updateReqError.message || 'Failed to update recovery request.' },
        { status: 500 }
      )
    }

    const { data: updatedDevice } = await auth.supabase
      .from('devices')
      .update({ status: nextDeviceStatus, is_online: true })
      .eq('id', reqRow.device_id)
      .eq('user_id', auth.user.id)
      .select('name')
      .maybeSingle()

    const deviceName = updatedDevice?.name ?? 'Device'

    await auth.supabase.from('activity_logs').insert({
      user_id: auth.user.id,
      device_id: reqRow.device_id,
      title: action === 'recover' ? 'Device marked as recovered' : 'Recovery request cancelled',
      description:
        action === 'recover'
          ? `${deviceName} was marked as recovered, incident closed, and protection restored.`
          : `Recovery incident for ${deviceName} was cancelled and status restored to protected.`,
      category: 'Recovery',
    })

    return NextResponse.json({ recoveryRequest: updatedRequest })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

