import { NextResponse } from 'next/server'
import {
  getAuthenticatedServerClient,
  getRecoverySessionFromRequest,
  getServerServiceClient,
} from '@/lib/supabase/server-auth'
import { notifySuspiciousActivity } from '@/lib/email/notifications'

function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

interface TheftRiskReport {
  score: number // 0 - 100
  level: 'Low' | 'Medium' | 'High' | 'Critical'
  analyzedAt: string
  deviceId: string
  deviceName: string
  signals: {
    name: string
    severity: 'info' | 'warning' | 'alert'
    scoreContribution: number
    detail: string
  }[]
  recommendations: string[]
  telemetryScopeNotice: string
}

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('deviceId')

    // Fetch user devices
    let deviceQuery = client.from('devices').select('*').eq('user_id', userId)
    if (deviceId) {
      deviceQuery = deviceQuery.eq('id', deviceId)
    }
    const { data: devices } = await deviceQuery

    if (!devices || devices.length === 0) {
      return NextResponse.json({ error: 'No devices found to evaluate.' }, { status: 404 })
    }

    const targetDevice = devices[0]

    // Fetch recent activity logs (past 7 days)
    const { data: logs } = await client
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)

    // Fetch active recovery incidents
    const { data: activeIncidents } = await client
      .from('recovery_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('device_id', targetDevice.id)
      .eq('status', 'active')

    // Fetch anonymous sightings if table exists
    let sightings: any[] = []
    try {
      const { data, error } = await client
        .from('anonymous_sightings')
        .select('*')
        .eq('device_id', targetDevice.id)
        .order('reported_at', { ascending: false })
        .limit(5)

      if (!error && Array.isArray(data)) {
        sightings = data
      }
    } catch {
      sightings = []
    }

    let totalScore = 0
    const signals: TheftRiskReport['signals'] = []
    const recommendations: string[] = []

    // SIGNAL 1: Device Lost Status / Incident State
    const hasActiveIncident = (activeIncidents && activeIncidents.length > 0) || targetDevice.status === 'lost'
    if (hasActiveIncident) {
      totalScore += 35
      signals.push({
        name: 'Device Flagged as Lost',
        severity: 'alert',
        scoreContribution: 35,
        detail: `Device is actively flagged as lost in the recovery registry.`,
      })
      recommendations.push('Keep Panic Recovery Mode engaged and monitor verified community sightings.')
    }

    // SIGNAL 2: Authentication / Verification Failure Spikes
    const failedAuthLogs = (logs || []).filter(
      (l: any) =>
        l.title.toLowerCase().includes('fail') ||
        l.description.toLowerCase().includes('failed') ||
        l.title.toLowerCase().includes('attempt')
    )
    if (failedAuthLogs.length > 0) {
      const authPenalty = Math.min(30, failedAuthLogs.length * 10)
      totalScore += authPenalty
      signals.push({
        name: 'Suspicious Authentication Challenges',
        severity: failedAuthLogs.length >= 3 ? 'alert' : 'warning',
        scoreContribution: authPenalty,
        detail: `${failedAuthLogs.length} failed PIN or credential challenge(s) recorded in audit logs.`,
      })
      recommendations.push('Ensure your 6-digit Recovery PIN is known only to you. Do not share codes over phone calls.')
    }

    // SIGNAL 3: Stale Check-in / Abrupt Offline Window
    const lastSeenTime = targetDevice.last_seen_at ? new Date(targetDevice.last_seen_at).getTime() : 0
    const hoursSinceLastSeen = lastSeenTime > 0 ? (Date.now() - lastSeenTime) / (1000 * 60 * 60) : 999

    if (hoursSinceLastSeen > 48) {
      totalScore += 20
      signals.push({
        name: 'Telemetry Signal Stale (>48 Hours)',
        severity: 'warning',
        scoreContribution: 20,
        detail: `No GPS check-in received for ${Math.round(hoursSinceLastSeen)} hours.`,
      })
      recommendations.push('Perform a GPS Check-In from your device browser to refresh telemetry.')
    } else if (hoursSinceLastSeen > 24) {
      totalScore += 10
      signals.push({
        name: 'Telemetry Signal Stale (>24 Hours)',
        severity: 'info',
        scoreContribution: 10,
        detail: `Device has not checked in for ${Math.round(hoursSinceLastSeen)} hours.`,
      })
    } else {
      signals.push({
        name: 'Fresh Heartbeat Telemetry',
        severity: 'info',
        scoreContribution: 0,
        detail: `Recent check-in recorded ${Math.round(hoursSinceLastSeen * 60)} minutes ago.`,
      })
    }

    // SIGNAL 4: Location Velocity / Impossible Travel Analysis
    if (sightings && sightings.length > 0 && targetDevice.latitude && targetDevice.longitude) {
      const latestSighting = sightings[0]
      const distKm = calculateHaversineDistanceKm(
        targetDevice.latitude,
        targetDevice.longitude,
        latestSighting.latitude,
        latestSighting.longitude
      )
      const timeDiffHours = Math.max(
        0.05,
        (Date.now() - new Date(latestSighting.reported_at).getTime()) / (1000 * 60 * 60)
      )
      const velocityKmH = distKm / timeDiffHours

      if (velocityKmH > 350) {
        totalScore += 30
        signals.push({
          name: 'Impossible Physical Travel Velocity',
          severity: 'alert',
          scoreContribution: 30,
          detail: `Calculated displacement of ${Math.round(distKm)} km at ${Math.round(velocityKmH)} km/h exceeds ground transport speed thresholds.`,
        })
        recommendations.push('Immediate SIM deactivation advised: device appears in transit or operating under mismatched GPS coordinates.')
      } else if (distKm > 50) {
        totalScore += 15
        signals.push({
          name: 'Significant Location Relocation',
          severity: 'warning',
          scoreContribution: 15,
          detail: `Device spotted ${Math.round(distKm)} km away from home base location.`,
        })
      }
    }

    // SIGNAL 5: Battery Drain / Low Power Alert
    if (targetDevice.battery_level !== null && targetDevice.battery_level <= 15) {
      totalScore += 10
      signals.push({
        name: 'Critical Battery Level (<15%)',
        severity: 'warning',
        scoreContribution: 10,
        detail: `Device battery is at ${targetDevice.battery_level}%. Network disconnect imminent.`,
      })
      recommendations.push('Device may shut down soon. Prioritize locking digital accounts immediately before connection terminates.')
    }

    // Normalize final score between 0 and 100
    const finalScore = Math.min(100, Math.max(0, totalScore))
    let level: TheftRiskReport['level'] = 'Low'
    if (finalScore >= 75) level = 'Critical'
    else if (finalScore >= 50) level = 'High'
    else if (finalScore >= 25) level = 'Medium'

    if (recommendations.length === 0) {
      recommendations.push('Device status is nominal. Continue regular check-ins and maintain verified contacts in your Trusted Circle.')
    }

    if (finalScore >= 75) {
      const alertSignal = signals.find((s) => s.severity === 'alert')
      if (alertSignal) {
        notifySuspiciousActivity({
          client,
          userId,
          deviceId: targetDevice.id,
          activityType: alertSignal.name.includes('Velocity') ? 'theft_signal' : 'auth_spike',
          summary: `${alertSignal.name}: ${alertSignal.detail}`,
          details: recommendations.join(' '),
          userEmail: (authRes && 'user' in authRes && authRes.user?.email) ? authRes.user.email : null,
        }).catch((err) => {
          console.error('[Theft Anomaly Email Error]', err)
        })
      }
    }

    const report: TheftRiskReport = {
      score: finalScore,
      level,
      analyzedAt: new Date().toISOString(),
      deviceId: targetDevice.id,
      deviceName: targetDevice.name,
      signals,
      recommendations,
      telemetryScopeNotice:
        'Architectural Transparency Notice: Web-based security applications analyze mathematically grounded telemetry (geographical displacement velocity, authentication challenge spikes, and signal timestamps). OS-level hardware events (e.g. physical SIM ejector pins or lockscreen hardware brute-force) require a native mobile application.',
    }

    return NextResponse.json(report)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error evaluating theft risk.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
