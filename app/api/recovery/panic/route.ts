import { NextResponse } from 'next/server'
import {
  getAuthenticatedServerClient,
  getRecoverySessionFromRequest,
  getServerServiceClient,
} from '@/lib/supabase/server-auth'
import { sendSms } from '@/lib/sms'
import { notifyPanicModeActivated } from '@/lib/email/notifications'

interface PanicPayload {
  deviceId: string
  incidentId?: string | null
  latitude?: number | null
  longitude?: number | null
  locationName?: string | null
  accuracy?: number | null
}

const DEFAULT_PANIC_STEPS = [
  {
    id: 'sim_block',
    title: 'Deactivate SIM Card & Block Mobile Number',
    priority: 'Immediate (0-30 min)',
    description: 'Thieves immediately move SIM cards to another phone to intercept banking OTPs and reset Google/Apple passwords.',
    completed: false,
    actionUrl: 'tel:198',
    actionLabel: 'Call Carrier Helpline',
  },
  {
    id: 'upi_freeze',
    title: 'Freeze UPI Apps & Report Cyber Cell',
    priority: 'Immediate (0-60 min)',
    description: 'Block PhonePe, Google Pay, and Paytm by calling respective helplines and dial National Cyber Helpline 1930.',
    completed: false,
    actionUrl: 'tel:1930',
    actionLabel: 'Dial 1930 Helpline',
  },
  {
    id: 'session_purge',
    title: 'Purge Active Google & Apple ID Sessions',
    priority: 'Within 2 hours',
    description: 'Revoke active browser and mobile tokens from Google Account Device Activity or Apple ID Devices list.',
    completed: false,
    actionUrl: 'https://myaccount.google.com/device-activity',
    actionLabel: 'Open Google Devices',
  },
  {
    id: 'ceir_imei_block',
    title: 'Block IMEI on Central Equipment Identity Register',
    priority: 'Within 24 hours',
    description: 'Submit an IMEI blocking request on CEIR (ceir.gov.in) to render the device completely unusable on Indian telecom networks.',
    completed: false,
    actionUrl: 'https://www.ceir.gov.in',
    actionLabel: 'Open CEIR Portal',
  },
  {
    id: 'police_fir',
    title: 'Register Online Police Lost Phone Report (e-FIR)',
    priority: 'Within 24 hours',
    description: 'Keep the police complaint / digital acknowledgement number handy for insurance claims and CEIR validation.',
    completed: false,
    actionUrl: '',
    actionLabel: 'File Complaint',
  },
]

// In-memory panic activation cooldown tracking (per deviceId, 60 seconds)
const panicCooldownMap = new Map<string, number>()
const PANIC_COOLDOWN_MS = 60 * 1000

export async function POST(request: Request) {
  try {
    let userId: string | null = null
    let client: any = null

    // Check standard authenticated user
    const authRes = await getAuthenticatedServerClient(request).catch(() => null)
    if (authRes && 'user' in authRes && authRes.user) {
      userId = authRes.user.id
      client = authRes.supabase
    } else {
      // Check independent recovery session
      const recoverySession = getRecoverySessionFromRequest(request)
      if (recoverySession) {
        userId = recoverySession.userId
        client = getServerServiceClient() || authRes?.supabase
      }
    }

    if (!userId || !client) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in or authenticate your recovery session.' },
        { status: 401 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as PanicPayload
    const { deviceId, latitude, longitude, locationName } = body

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required to activate panic mode.' }, { status: 400 })
    }

    // Rate-limiting cooldown per device
    const now = Date.now()
    const lastPanic = panicCooldownMap.get(deviceId)
    if (lastPanic && now - lastPanic < PANIC_COOLDOWN_MS) {
      const waitSec = Math.ceil((PANIC_COOLDOWN_MS - (now - lastPanic)) / 1000)
      return NextResponse.json(
        {
          error: `Panic mode was recently triggered for this device. Please wait ${waitSec}s before re-triggering.`,
          cooldown: true,
        },
        { status: 429 }
      )
    }

    // 1. Fetch the target device ensuring ownership
    const { data: device, error: devError } = await client
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', userId)
      .single()

    if (devError || !device) {
      return NextResponse.json({ error: 'Device not found or unauthorized.' }, { status: 404 })
    }

    const nowIso = new Date().toISOString()
    const resolvedLocationName = locationName?.trim() || device.last_location_name || 'Emergency GPS Snapshot'

    // 2. Mark device as lost and lock last known verified location
    const { error: updateError } = await client
      .from('devices')
      .update({
        status: 'lost',
        is_online: false,
        latitude: typeof latitude === 'number' ? latitude : device.latitude,
        longitude: typeof longitude === 'number' ? longitude : device.longitude,
        last_location_name: resolvedLocationName,
        last_seen_at: nowIso,
      })
      .eq('id', deviceId)
      .eq('user_id', userId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message || 'Failed to update device status.' }, { status: 500 })
    }

    // 3. Find existing active recovery request or create new one
    let incidentId: string | null = null
    const { data: activeRequests } = await client
      .from('recovery_requests')
      .select('id')
      .eq('device_id', deviceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)

    if (activeRequests && activeRequests.length > 0) {
      incidentId = activeRequests[0].id
    } else {
      const { data: newIncident } = await client
        .from('recovery_requests')
        .insert({
          user_id: userId,
          device_id: deviceId,
          status: 'active',
          approvals_required: 2,
          approvals_received: 0,
          approved_contact_ids: [],
          notes: `Panic Recovery Mode activated at ${new Date().toLocaleString()}.`,
        })
        .select()
        .single()

      if (newIncident) {
        incidentId = newIncident.id
      }
    }

    // 4. Dispatch emergency alerts to verified trusted contacts
    const { data: contacts } = await client
      .from('trusted_contacts')
      .select('*')
      .eq('user_id', userId)

    let notificationsDispatched = 0
    let notificationsAttempted = 0
    const hasSmsConfig = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
    const alertPromises: Promise<any>[] = []

    if (contacts && contacts.length > 0) {
      const verifiedContacts = contacts.filter((c: any) => c.approved)
      notificationsAttempted = verifiedContacts.length
      for (const contact of verifiedContacts) {
        if (contact.phone) {
          const emergencyMessage = `[RETRACE EMERGENCY] Panic Mode activated for ${device.name}. If you hold a recovery backup for this user, please be on alert. Do not share codes with unknown callers.`
          alertPromises.push(
            sendSms({ to: contact.phone, body: emergencyMessage })
              .then((res) => {
                if (res.success) notificationsDispatched++
              })
              .catch(() => {})
          )
        }
      }
    }

    await Promise.allSettled(alertPromises)

    // 5. Initialize or fetch persistent Panic Checklist (incident-aware)
    let checklistSteps = DEFAULT_PANIC_STEPS
    let existingChecklist: any = null

    if (incidentId) {
      const { data } = await client
        .from('panic_checklists')
        .select('*')
        .eq('incident_id', incidentId)
        .eq('user_id', userId)
        .limit(1)
      if (data && data.length > 0) existingChecklist = data[0]
    }

    if (!existingChecklist) {
      const { data } = await client
        .from('panic_checklists')
        .select('*')
        .eq('device_id', deviceId)
        .eq('user_id', userId)
        .is('incident_id', null)
        .limit(1)
      if (data && data.length > 0) existingChecklist = data[0]
    }

    if (existingChecklist) {
      checklistSteps = (existingChecklist.completed_steps as any) || DEFAULT_PANIC_STEPS
    } else {
      await client
        .from('panic_checklists')
        .insert({
          user_id: userId,
          device_id: deviceId,
          incident_id: incidentId,
          completed_steps: DEFAULT_PANIC_STEPS,
          notes: 'Emergency Panic Playbook generated.',
        })
        .catch(() => {})
    }

    // 6. Log high-priority activity log entry with HONEST dispatch status
    const dispatchSummary = !hasSmsConfig
      ? 'SMS alert gateway not configured in server environment; no SMS delivered.'
      : notificationsDispatched > 0
      ? `${notificationsDispatched} of ${notificationsAttempted} verified contact(s) notified via SMS.`
      : `0 of ${notificationsAttempted} SMS alerts could be delivered.`

    await client
      .from('activity_logs')
      .insert({
        user_id: userId,
        device_id: deviceId,
        title: 'PANIC RECOVERY MODE ACTIVATED',
        description: `Emergency incident initiated for ${device.name}. Device marked lost, location locked at ${resolvedLocationName}. ${dispatchSummary}`,
        category: 'Recovery',
      })
      .catch(() => {})

    // 7. Dispatch Panic Mode emergency emails to owner and verified Trusted Circle
    notifyPanicModeActivated({
      client,
      userId,
      deviceId,
      locationName: resolvedLocationName,
      userEmail: (authRes && 'user' in authRes && authRes.user?.email) ? authRes.user.email : null,
    }).catch((err) => {
      console.error('[Panic Email Notification Error]', err)
    })

    panicCooldownMap.set(deviceId, now)

    return NextResponse.json({
      success: true,
      message: 'Panic Recovery Mode activated successfully.',
      incidentId,
      notificationsDispatched,
      notificationsAttempted,
      smsGatewayConfigured: hasSmsConfig,
      checklist: checklistSteps,
      device: {
        id: device.id,
        name: device.name,
        status: 'lost',
        lastLocationName: resolvedLocationName,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error activating panic mode.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
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
    const { deviceId, incidentId, stepId, completed } = body

    if (!deviceId || !stepId) {
      return NextResponse.json({ error: 'Missing deviceId or stepId.' }, { status: 400 })
    }

    // Verify user owns the device
    const { data: device } = await client
      .from('devices')
      .select('id')
      .eq('id', deviceId)
      .eq('user_id', userId)
      .single()

    if (!device) {
      return NextResponse.json({ error: 'Device not found or unauthorized.' }, { status: 404 })
    }

    // If incidentId is provided, verify it belongs to user and device
    if (incidentId) {
      const { data: incident } = await client
        .from('recovery_requests')
        .select('id')
        .eq('id', incidentId)
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .single()

      if (!incident) {
        return NextResponse.json({ error: 'Recovery incident not found or unauthorized.' }, { status: 404 })
      }
    }

    // Fetch matching checklist: incident-specific first, fallback to device
    let checklist: any = null
    if (incidentId) {
      const { data } = await client
        .from('panic_checklists')
        .select('*')
        .eq('incident_id', incidentId)
        .eq('user_id', userId)
        .limit(1)
      if (data && data.length > 0) checklist = data[0]
    }

    if (!checklist) {
      const { data } = await client
        .from('panic_checklists')
        .select('*')
        .eq('device_id', deviceId)
        .eq('user_id', userId)
        .limit(1)
      if (data && data.length > 0) checklist = data[0]
    }

    let steps = DEFAULT_PANIC_STEPS
    if (checklist && Array.isArray(checklist.completed_steps)) {
      steps = checklist.completed_steps as any
    }

    steps = steps.map((s) => (s.id === stepId ? { ...s, completed: Boolean(completed) } : s))

    if (checklist) {
      await client
        .from('panic_checklists')
        .update({ completed_steps: steps, updated_at: new Date().toISOString() })
        .eq('id', checklist.id)
        .eq('user_id', userId)
    } else {
      await client.from('panic_checklists').insert({
        user_id: userId,
        device_id: deviceId,
        incident_id: incidentId || null,
        completed_steps: steps,
      })
    }

    return NextResponse.json({ success: true, steps })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating checklist.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
