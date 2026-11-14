import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerServiceClient } from '@/lib/supabase/server-auth'
import { resolveSupabaseCredentials } from '@/lib/supabase/client'
import { notifySuspiciousActivity } from '@/lib/email/notifications'
import type { Database } from '@/lib/supabase/types'

// In-memory rate limiting map for edge / Node instance defense-in-depth:
// Key: beaconToken, Value: timestamp of last recorded sighting submission
const sightingCooldownMap = new Map<string, number>()
const COOLDOWN_MS = 60 * 1000 // 60 seconds

function getCommunityServiceClient() {
  const serviceClient = getServerServiceClient()
  if (serviceClient) return serviceClient

  const { url: supabaseUrl, key: supabaseKey } = resolveSupabaseCredentials()

  if (!supabaseUrl || !supabaseKey) return null

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const beaconToken = searchParams.get('beacon')

    if (!beaconToken || beaconToken.trim().length < 8) {
      return NextResponse.json(
        { error: 'Valid community beacon token is required.' },
        { status: 400 }
      )
    }

    const trimmedToken = beaconToken.trim()
    const client = getCommunityServiceClient()
    if (!client) {
      console.error('[Community Sighting GET] Database client unavailable: missing Supabase credentials.')
      return NextResponse.json({ error: 'Database service unavailable.' }, { status: 503 })
    }

    // 1. Attempt direct lookup on devices by public beacon_token
    const { data: device, error: devError } = await client
      .from('devices')
      .select('id, name, type, status, last_seen_at')
      .eq('beacon_token', trimmedToken)
      .maybeSingle()

    if (device) {
      if (device.status !== 'lost') {
        return NextResponse.json({
          active: false,
          deviceType: device.type,
          message: 'This device is currently marked protected and is not reported lost.',
        })
      }

      // Return zero personal information: only anonymous incident confirmation
      return NextResponse.json({
        active: true,
        deviceType: device.type,
        deviceName: (device.name ? device.name.split(' ')[0] : 'Device') + ' Device',
        reportedLostAt: device.last_seen_at,
        message: 'This device is flagged lost. You can submit an anonymous GPS sighting to help the owner recover it.',
      })
    }

    // 2. Fallback verification via SECURITY DEFINER RPC
    // When running under an unprivileged connection (e.g. publishable key without service_role),
    // direct table SELECT on devices is restricted by PostgreSQL RLS to protect owner coordinates.
    // The SECURITY DEFINER RPC verifies beacon existence and protected status securely.
    if (devError) {
      console.warn(
        `[Community Sighting GET] Direct devices select unavailable (${devError.code}: ${devError.message}). Verifying beacon via RPC...`
      )

      const { data: rpcCheck, error: rpcErr } = await client.rpc('submit_anonymous_sighting', {
        p_beacon_token: trimmedToken,
        p_latitude: 0,
        p_longitude: 0,
      })

      if (!rpcErr && rpcCheck) {
        const checkResult = rpcCheck as { success?: boolean; error?: string }
        if (checkResult.error === 'Device is not currently reported as lost.') {
          return NextResponse.json({
            active: false,
            message: 'This device is currently marked protected and is not reported lost.',
          })
        }
        if (checkResult.error === 'Device beacon not found.') {
          return NextResponse.json(
            { active: false, message: 'No registered device corresponds to this beacon token.' },
            { status: 404 }
          )
        }
      } else if (rpcErr) {
        console.error('[Community Sighting GET] RPC verification error:', rpcErr.message)
      }
    }

    if (!devError && !device) {
      return NextResponse.json(
        { active: false, message: 'No registered device corresponds to this beacon token.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Unable to verify community beacon status at this time.' },
      { status: 500 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error resolving community beacon.'
    console.error('[Community Sighting GET] Unexpected exception:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { beaconToken, latitude, longitude, accuracy, notes } = body

    if (!beaconToken || typeof beaconToken !== 'string' || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: 'Missing required parameters: beaconToken, latitude, longitude.' },
        { status: 400 }
      )
    }

    const trimmedToken = beaconToken.trim()

    // Geographic boundary validation
    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: 'Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180.' },
        { status: 400 }
      )
    }

    if (accuracy !== undefined && accuracy !== null && (typeof accuracy !== 'number' || accuracy < 0)) {
      return NextResponse.json({ error: 'Invalid accuracy parameter: must be non-negative.' }, { status: 400 })
    }

    // Quick in-memory rate check before hitting database
    const now = Date.now()
    const lastAttempt = sightingCooldownMap.get(trimmedToken)
    if (lastAttempt && now - lastAttempt < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now - lastAttempt)) / 1000)
      return NextResponse.json(
        {
          error: `Rate limit: A sighting was already reported for this beacon recently. Please wait ${waitSec}s before submitting again.`,
          cooldown: true,
        },
        { status: 429 }
      )
    }

    const client = getCommunityServiceClient()
    if (!client) {
      return NextResponse.json({ error: 'Database service unavailable.' }, { status: 503 })
    }

    // 1. Primary execution: call the SECURITY DEFINER RPC
    // Enforces PostgreSQL row-level locks, 64-bit advisory locks, and search_path = ''
    const { data: rpcResult, error: rpcError } = await client.rpc('submit_anonymous_sighting', {
      p_beacon_token: trimmedToken,
      p_latitude: latitude,
      p_longitude: longitude,
      p_accuracy: typeof accuracy === 'number' ? accuracy : null,
      p_notes: typeof notes === 'string' ? notes.trim() : null,
    })

    if (!rpcError && rpcResult) {
      const resultObj = rpcResult as { success?: boolean; error?: string; cooldown?: boolean; message?: string }
      if (resultObj.cooldown) {
        return NextResponse.json(resultObj, { status: 429 })
      }
      if (resultObj.success) {
        sightingCooldownMap.set(trimmedToken, now)
        return NextResponse.json(resultObj)
      }
      return NextResponse.json(resultObj, { status: 400 })
    }

    // 2. Server-side service-role fallback (only if RPC is not yet migrated in Supabase)
    const serviceClient = getServerServiceClient()
    if (!serviceClient) {
      return NextResponse.json(
        { error: rpcError?.message || 'Failed to submit sighting via RPC and service credentials unavailable.' },
        { status: 500 }
      )
    }

    // CRITICAL: NEVER overwrite devices.latitude, devices.longitude, or devices.last_seen_at!
    const { data: device, error: devError } = await serviceClient
      .from('devices')
      .select('id, user_id, name, status')
      .eq('beacon_token', trimmedToken)
      .single()

    if (devError || !device) {
      return NextResponse.json(
        { error: 'Device beacon not found.' },
        { status: 404 }
      )
    }

    if (device.status !== 'lost') {
      return NextResponse.json(
        { error: 'Device is not currently reported as lost.' },
        { status: 400 }
      )
    }

    // Check latest sighting from anonymous_sightings table for rate limiting
    const { data: recentSightings } = await serviceClient
      .from('anonymous_sightings')
      .select('reported_at')
      .eq('device_id', device.id)
      .order('reported_at', { ascending: false })
      .limit(1)

    if (recentSightings && recentSightings.length > 0) {
      const lastReportedTime = new Date(recentSightings[0].reported_at).getTime()
      if (now - lastReportedTime < COOLDOWN_MS) {
        sightingCooldownMap.set(trimmedToken, now)
        return NextResponse.json(
          {
            error: 'Rate limit: A sighting was already reported for this device in the last 60 seconds.',
            cooldown: true,
          },
          { status: 429 }
        )
      }
    }

    // Store sighting strictly in anonymous_sightings via service client
    const { data: newSighting, error: insertError } = await serviceClient
      .from('anonymous_sightings')
      .insert({
        device_id: device.id,
        beacon_token: trimmedToken,
        latitude,
        longitude,
        accuracy: typeof accuracy === 'number' ? accuracy : null,
        notes: typeof notes === 'string' ? notes.trim() : 'Community Network Sighting',
      })
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || 'Failed to record community sighting.' },
        { status: 500 }
      )
    }

    // Append unverified sighting alert to owner's activity log timeline
    await serviceClient.from('activity_logs').insert({
      user_id: device.user_id,
      device_id: device.id,
      title: 'Unverified Community Sighting Reported',
      description: `An anonymous good Samaritan recorded an unverified location sighting in the community network. Coordinates: [${latitude.toFixed(4)}, ${longitude.toFixed(4)}]. This is a crowd report and has not been verified by device hardware.`,
      category: 'Recovery',
    })

    // Dispatch email notification to device owner
    notifySuspiciousActivity({
      client: serviceClient,
      userId: device.user_id,
      deviceId: device.id,
      activityType: 'sighting',
      summary: `A community member submitted an unverified location sighting for your device. Coordinates: [${latitude.toFixed(4)}, ${longitude.toFixed(4)}].`,
      details: typeof notes === 'string' && notes.trim() ? `Reporter notes: ${notes.trim()}` : undefined,
    }).catch((err) => {
      console.error('[Community Sighting Notification Error]', err)
    })

    sightingCooldownMap.set(trimmedToken, now)

    return NextResponse.json({
      success: true,
      verified: false,
      sightingId: newSighting?.id,
      message: 'Community sighting recorded securely. Unverified location logged to device audit timeline.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error submitting sighting.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
