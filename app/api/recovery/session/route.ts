import { NextResponse } from 'next/server'
import {
  createClient as createSupabaseClient
} from '@supabase/supabase-js'
import {
  getRecoverySessionFromRequest,
  getServerServiceClient,
} from '@/lib/supabase/server-auth'
import { resolveSupabaseCredentials } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

function getServiceClientOrFallback() {
  const service = getServerServiceClient()
  if (service) return service

  const { url, key } = resolveSupabaseCredentials()

  if (!url || !key) return null
  return createSupabaseClient<Database>(url, key, { auth: { persistSession: false } })
}

export async function GET(request: Request) {
  try {
    const session = getRecoverySessionFromRequest(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid, missing, or expired recovery session token. Please re-authenticate.' },
        { status: 401 }
      )
    }

    const client = getServiceClientOrFallback()
    if (!client) {
      return NextResponse.json({ error: 'Database service configuration missing.' }, { status: 500 })
    }

    // Fetch recovery profile, devices, contacts, and requests
    const [profileRes, devicesRes, contactsRes, requestsRes, logsRes] = await Promise.all([
      client
        .from('profiles')
        .select('id, full_name, recovery_id, backup_phone, has_recovery_pin, is_verified, created_at, updated_at')
        .eq('id', session.userId)
        .maybeSingle(),
      client
        .from('devices')
        .select('*')
        .eq('user_id', session.userId)
        .order('created_at', { ascending: false }),
      client
        .from('trusted_contacts')
        .select('*')
        .eq('user_id', session.userId)
        .order('created_at', { ascending: true }),
      client
        .from('recovery_requests')
        .select('*')
        .eq('user_id', session.userId)
        .order('created_at', { ascending: false }),
      client
        .from('activity_logs')
        .select('*')
        .eq('user_id', session.userId)
        .order('created_at', { ascending: false })
        .limit(25),
    ])

    return NextResponse.json({
      session: {
        userId: session.userId,
        recoveryId: session.recoveryId,
        fullName: session.fullName,
        expiresAt: session.expiresAt,
      },
      profile: profileRes.data,
      devices: devicesRes.data ?? [],
      contacts: contactsRes.data ?? [],
      recoveryRequests: requestsRes.data ?? [],
      activityLogs: logsRes.data ?? [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = getRecoverySessionFromRequest(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired recovery session. Please sign in with your Recovery ID and PIN.' },
        { status: 401 }
      )
    }

    const client = getServiceClientOrFallback()
    if (!client) {
      return NextResponse.json({ error: 'Database configuration missing.' }, { status: 500 })
    }

    const body = (await request.json().catch(() => null)) as {
      action?: unknown
      deviceId?: unknown
      requestId?: unknown
      notes?: unknown
    } | null

    const action = typeof body?.action === 'string' ? body.action.trim() : ''
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : ''
    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : ''
    const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 500) : ''

    if (action === 'start_recovery' && deviceId) {
      // Mark device lost and create recovery request
      const { data: device } = await client
        .from('devices')
        .select('name')
        .eq('id', deviceId)
        .eq('user_id', session.userId)
        .maybeSingle()

      if (!device) {
        return NextResponse.json({ error: 'Device not found.' }, { status: 404 })
      }

      await client
        .from('recovery_requests')
        .insert({
          user_id: session.userId,
          device_id: deviceId,
          status: 'active',
          approvals_required: 1,
          approvals_received: 0,
          notes: notes || 'Opened via independent recovery session',
        })

      await client
        .from('devices')
        .update({ status: 'lost', is_online: false })
        .eq('id', deviceId)
        .eq('user_id', session.userId)

      await client
        .from('activity_logs')
        .insert({
          user_id: session.userId,
          device_id: deviceId,
          title: 'Recovery incident started',
          description: `${device.name} was marked as lost via independent recovery session.`,
          category: 'Recovery',
        })

      return NextResponse.json({ success: true, message: `${device.name} marked as lost.` })
    }

    if (action === 'resolve_recovery' && requestId) {
      const { data: req } = await client
        .from('recovery_requests')
        .select('device_id')
        .eq('id', requestId)
        .eq('user_id', session.userId)
        .maybeSingle()

      if (!req) {
        return NextResponse.json({ error: 'Recovery request not found.' }, { status: 404 })
      }

      await client
        .from('recovery_requests')
        .update({ status: 'recovered' })
        .eq('id', requestId)
        .eq('user_id', session.userId)

      await client
        .from('devices')
        .update({ status: 'protected', is_online: true })
        .eq('id', req.device_id)
        .eq('user_id', session.userId)

      await client
        .from('activity_logs')
        .insert({
          user_id: session.userId,
          device_id: req.device_id,
          title: 'Device recovered',
          description: 'Device marked as recovered and protection restored via recovery session.',
          category: 'Recovery',
        })

      return NextResponse.json({ success: true, message: 'Device marked as recovered and incident closed.' })
    }

    return NextResponse.json({ error: 'Invalid recovery action requested.' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = getRecoverySessionFromRequest(request)
  if (session) {
    const client = getServiceClientOrFallback()
    if (client) {
      try {
        await client.from('activity_logs').insert({
          user_id: session.userId,
          title: 'Independent recovery session ended',
          description: 'Recovery session was safely terminated by the user.',
          category: 'Recovery',
        })
      } catch {
        // Non-blocking log failure
      }
    }
  }

  return NextResponse.json({ success: true, message: 'Recovery session terminated.' })
}
