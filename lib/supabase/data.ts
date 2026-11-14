import { supabase } from './client'
import { getSession, updateAuthFullName } from './auth'
import type {
  ActivityCategory,
  ActivityLog,
  AnonymousSighting,
  Device,
  DeviceStatus,
  RecoveryRequest,
  TrustedContact,
} from './types'

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 4)
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return 'TC'
}

async function getAccessTokenOrThrow(): Promise<string> {
  const session = await getSession()
  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.')
  }
  return session.access_token
}

export async function logActivity(
  userId: string,
  entry: {
    title: string
    description: string
    category: ActivityCategory
    deviceId?: string | null
  }
) {
  const { error } = await supabase.from('activity_logs').insert({
    user_id: userId,
    device_id: entry.deviceId ?? null,
    title: entry.title,
    description: entry.description,
    category: entry.category,
  })
  if (error) {
    throw new Error(error.message || 'Failed to record activity log.')
  }
}

export async function getActivityLogs(userId: string, limit = 50): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message || 'Unable to load activity history.')
  }
  return data ?? []
}

// ============================================================================
// Profile & Security Settings
// ============================================================================

export async function updateProfileDetails(
  userId: string,
  updates: { fullName?: string; backupPhone?: string | null }
) {
  const payload: { full_name?: string; backup_phone?: string | null } = {}

  if (updates.fullName !== undefined) {
    const cleanName = updates.fullName.trim()
    if (!cleanName) {
      throw new Error('Full name cannot be empty.')
    }
    payload.full_name = cleanName
  }

  if (updates.backupPhone !== undefined) {
    const cleanPhone = updates.backupPhone?.trim() || null
    payload.backup_phone = cleanPhone
  }

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)

  if (error) {
    throw new Error(error.message || 'Failed to update profile.')
  }

  if (payload.full_name) {
    await updateAuthFullName(payload.full_name).catch(() => {})
  }

  await logActivity(userId, {
    title: payload.backup_phone !== undefined ? 'Backup phone updated' : 'Profile information updated',
    description:
      payload.backup_phone !== undefined
        ? payload.backup_phone
          ? 'Backup recovery phone number was updated.'
          : 'Backup recovery phone number was cleared.'
        : `Account profile name updated to ${payload.full_name}.`,
    category: 'Security',
  })
}

export async function saveRecoveryPinServer(pin: string) {
  const token = await getAccessTokenOrThrow()
  const res = await fetch('/api/security/pin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pin }),
  })

  const json = (await res.json().catch(() => ({}))) as { error?: string; hasRecoveryPin?: boolean }
  if (!res.ok) {
    throw new Error(json.error || 'Failed to save Recovery PIN.')
  }
  return json
}

export async function verifyRecoveryPinServer(pin: string): Promise<boolean> {
  const token = await getAccessTokenOrThrow()
  const res = await fetch('/api/security/pin', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pin }),
  })

  const json = (await res.json().catch(() => ({}))) as { verified?: boolean; error?: string }
  if (!res.ok) {
    throw new Error(json.error || 'Verification failed.')
  }
  return Boolean(json.verified)
}

// ============================================================================
// Devices
// ============================================================================

export async function getDevices(userId: string): Promise<Device[]> {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message || 'Unable to load devices.')
  }
  return data ?? []
}

export async function createDevice(
  userId: string,
  input: {
    name: string
    type: string
    serialEnding?: string
    lastLocationName?: string
  }
): Promise<Device> {
  const name = input.name.trim()
  const type = input.type.trim()
  const serialEnding = input.serialEnding?.trim().slice(0, 12) || null
  const locationName = input.lastLocationName?.trim() || 'Unknown location'

  if (!name) throw new Error('Device name is required.')
  if (!type) throw new Error('Device type is required.')

  const { data, error } = await supabase
    .from('devices')
    .insert({
      user_id: userId,
      name,
      type,
      serial_ending: serialEnding,
      status: 'protected',
      battery_level: null,
      is_online: true,
      last_location_name: locationName,
      latitude: null,
      longitude: null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Unable to register device.')
  }

  await logActivity(userId, {
    deviceId: data.id,
    title: 'Device registered',
    description: `${data.name} (${data.type}) added to your recovery identity.`,
    category: 'Device',
  })

  return data
}

export async function updateDeviceStatus(
  userId: string,
  deviceId: string,
  deviceName: string,
  status: DeviceStatus
): Promise<Device> {
  const { data, error } = await supabase
    .from('devices')
    .update({
      status,
      is_online: status === 'lost' ? false : true,
    })
    .eq('id', deviceId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Unable to update device status.')
  }

  await logActivity(userId, {
    deviceId: data.id,
    title:
      status === 'lost'
        ? 'Device marked as lost'
        : status === 'recovered'
        ? 'Device marked as recovered'
        : 'Device protection restored',
    description: `${deviceName} status changed to ${status}.`,
    category: status === 'protected' ? 'Device' : 'Recovery',
  })

  return data
}

export async function updateDeviceLocation(
  userId: string,
  deviceId: string,
  deviceName: string,
  location: {
    locationName: string
    latitude?: number | null
    longitude?: number | null
  }
): Promise<Device> {
  const cleanName = location.locationName.trim()
  if (!cleanName) {
    throw new Error('Location description cannot be empty.')
  }

  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('devices')
    .update({
      last_location_name: cleanName,
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
      last_seen_at: nowIso,
      is_online: true,
    })
    .eq('id', deviceId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Unable to save device location.')
  }

  await logActivity(userId, {
    deviceId: data.id,
    title: 'Location updated',
    description: `${deviceName} check-in recorded at ${cleanName}.`,
    category: 'Device',
  })

  return data
}

export async function deleteDevice(userId: string, deviceId: string, deviceName: string) {
  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('id', deviceId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message || 'Unable to remove device.')
  }

  await logActivity(userId, {
    title: 'Device removed',
    description: `${deviceName} was removed from your registered devices.`,
    category: 'Device',
  })
}

// ============================================================================
// Trusted Contacts
// ============================================================================

export async function getTrustedContacts(userId: string): Promise<TrustedContact[]> {
  const { data, error } = await supabase
    .from('trusted_contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Unable to load trusted contacts.')
  }
  return data ?? []
}

export async function createTrustedContact(
  userId: string,
  input: {
    name: string
    relation: string
    phone: string
    email?: string
  }
): Promise<TrustedContact> {
  const name = input.name.trim()
  const relation = input.relation.trim()
  const phone = input.phone.trim()
  const email = input.email?.trim() || null

  if (!name) throw new Error('Contact name is required.')
  if (!relation) throw new Error('Relationship is required.')
  if (!phone) throw new Error('Phone number is required.')

  const { data, error } = await supabase
    .from('trusted_contacts')
    .insert({
      user_id: userId,
      name,
      relation,
      phone,
      email,
      // Honest default: contacts cannot be marked verified/approved until actually verified.
      approved: false,
      avatar_initials: computeInitials(name),
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Unable to add trusted contact.')
  }

  await logActivity(userId, {
    title: 'Trusted contact added',
    description: `${data.name} (${data.relation}) added to your Trusted Circle (pending verification).`,
    category: 'Security',
  })

  return data
}

export async function updateTrustedContact(
  userId: string,
  contactId: string,
  input: {
    name: string
    relation: string
    phone: string
    email?: string
  }
): Promise<TrustedContact> {
  const name = input.name.trim()
  const relation = input.relation.trim()
  const phone = input.phone.trim()
  const email = input.email?.trim() || null

  if (!name) throw new Error('Contact name is required.')
  if (!relation) throw new Error('Relationship is required.')
  if (!phone) throw new Error('Phone number is required.')

  const { data, error } = await supabase
    .from('trusted_contacts')
    .update({
      name,
      relation,
      phone,
      email,
      avatar_initials: computeInitials(name),
    })
    .eq('id', contactId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Unable to update trusted contact.')
  }

  await logActivity(userId, {
    title: 'Trusted contact updated',
    description: `Updated Trusted Circle details for ${data.name}.`,
    category: 'Security',
  })

  return data
}

export async function deleteTrustedContact(
  userId: string,
  contactId: string,
  contactName: string
) {
  const { error } = await supabase
    .from('trusted_contacts')
    .delete()
    .eq('id', contactId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message || 'Unable to remove trusted contact.')
  }

  await logActivity(userId, {
    title: 'Trusted contact removed',
    description: `${contactName} was removed from your Trusted Circle.`,
    category: 'Security',
  })
}

export async function requestContactVerificationOtp(contactId: string) {
  const token = await getAccessTokenOrThrow()
  const res = await fetch('/api/contacts/otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ contactId }),
  })

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean
    error?: string
    message?: string
    expiresAt?: number
    configured?: boolean
  }

  if (!res.ok) {
    throw new Error(json.error || 'Failed to dispatch verification code.')
  }

  return json
}

export async function submitContactVerificationOtp(contactId: string, otp: string) {
  const token = await getAccessTokenOrThrow()
  const res = await fetch('/api/contacts/otp', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ contactId, otp }),
  })

  const json = (await res.json().catch(() => ({}))) as {
    verified?: boolean
    error?: string
    message?: string
  }

  if (!res.ok) {
    throw new Error(json.error || 'Verification failed. Please check the code.')
  }

  return json
}

// ============================================================================
// Recovery Requests
// ============================================================================

export async function getRecoveryRequests(userId: string): Promise<RecoveryRequest[]> {
  const { data, error } = await supabase
    .from('recovery_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message || 'Unable to load recovery requests.')
  }
  return data ?? []
}

export async function createRecoveryRequestServer(deviceId: string, notes?: string): Promise<RecoveryRequest> {
  const token = await getAccessTokenOrThrow()
  const res = await fetch('/api/recovery', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ deviceId, notes }),
  })

  const json = (await res.json().catch(() => ({}))) as {
    recoveryRequest?: RecoveryRequest
    error?: string
  }

  if (!res.ok || !json.recoveryRequest) {
    throw new Error(json.error || 'Unable to start recovery request.')
  }

  return json.recoveryRequest
}

export async function resolveRecoveryRequestServer(
  requestId: string,
  action: 'recover' | 'cancel'
): Promise<RecoveryRequest> {
  const token = await getAccessTokenOrThrow()
  const res = await fetch('/api/recovery', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ requestId, action }),
  })

  const json = (await res.json().catch(() => ({}))) as {
    recoveryRequest?: RecoveryRequest
    error?: string
  }

  if (!res.ok || !json.recoveryRequest) {
    throw new Error(json.error || 'Unable to update recovery request.')
  }

  return json.recoveryRequest
}

// ============================================================================
// Formatting Helpers
// ============================================================================

export function formatTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return 'Unknown'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatShortDate(isoString: string | null | undefined): string {
  if (!isoString) return 'Unknown'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

// ============================================================================
// Consistent Device & Recovery Status Helpers
// ============================================================================

/**
 * Determine a device's effective protection state using both `devices.status`
 * and active `recovery_requests`. Historical `'recovered'` device rows with
 * no open incident resolve to `'protected'`.
 */
export function getEffectiveDeviceStatus(
  device: Pick<Device, 'id' | 'status'>,
  activeRecoveryDeviceIds?: Set<string>
): 'protected' | 'lost' {
  if (device.status === 'lost' || activeRecoveryDeviceIds?.has(device.id)) {
    return 'lost'
  }
  return 'protected'
}

export function getRecoveryOverview(
  devices: Device[],
  recoveryRequests: RecoveryRequest[]
) {
  const activeRequests = recoveryRequests.filter((r) => r.status === 'active')
  const activeDeviceIds = new Set(activeRequests.map((r) => r.device_id))

  const lostDevices = devices.filter(
    (d) => getEffectiveDeviceStatus(d, activeDeviceIds) === 'lost'
  )
  const protectedDevices = devices.filter(
    (d) => getEffectiveDeviceStatus(d, activeDeviceIds) === 'protected'
  )

  const recoveryStatus: 'Alert' | 'Ready' =
    activeRequests.length > 0 || lostDevices.length > 0 ? 'Alert' : 'Ready'

  return {
    activeRequests,
    activeDeviceIds,
    lostDevices,
    protectedDevices,
    protectedCount: protectedDevices.length,
    recoveryStatus,
  }
}

// ============================================================================
// Independent Account Recovery API Client
// ============================================================================

export interface IndependentRecoverySession {
  userId: string
  recoveryId: string
  fullName: string
  expiresAt: number
}

export async function loginWithRecoveryCredentials(recoveryId: string, recoveryPin: string) {
  const res = await fetch('/api/recovery/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recoveryId, recoveryPin }),
  })

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean
    recoveryToken?: string
    user?: { id: string; recoveryId: string; fullName: string }
    expiresIn?: string
    error?: string
    remainingAttempts?: number
  }

  if (!res.ok || !json.recoveryToken) {
    throw new Error(json.error || 'Recovery verification failed.')
  }

  return json
}

export async function fetchRecoverySessionData(token: string) {
  const res = await fetch('/api/recovery/session', {
    method: 'GET',
    headers: {
      Authorization: `RecoveryToken ${token}`,
    },
  })

  const json = (await res.json().catch(() => ({}))) as {
    session?: IndependentRecoverySession
    profile?: any
    devices?: Device[]
    contacts?: TrustedContact[]
    recoveryRequests?: RecoveryRequest[]
    activityLogs?: ActivityLog[]
    error?: string
  }

  if (!res.ok) {
    throw new Error(json.error || 'Failed to load recovery session records.')
  }

  return json
}

export async function executeRecoverySessionAction(
  token: string,
  action: 'start_recovery' | 'resolve_recovery',
  payload: { deviceId?: string; requestId?: string; notes?: string }
) {
  const res = await fetch('/api/recovery/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `RecoveryToken ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  })

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean
    message?: string
    error?: string
  }

  if (!res.ok) {
    throw new Error(json.error || 'Failed to update recovery action.')
  }

  return json
}

export async function logoutRecoverySession(token: string) {
  await fetch('/api/recovery/session', {
    method: 'DELETE',
    headers: {
      Authorization: `RecoveryToken ${token}`,
    },
  }).catch(() => {})
}

// ============================================================================
// Onboarding Data Persistence Helpers (survives email confirmation)
// NOTE: Recovery PIN is NEVER stored in localStorage/sessionStorage.
// ============================================================================

export interface PendingOnboardingData {
  email: string
  backupPhone?: string
  deviceName?: string
  deviceType?: string
  contactName?: string
  contactPhone?: string
  savedAt: number
}

const ONBOARDING_KEY_PREFIX = 'retrace_pending_onboarding_'

export function savePendingOnboarding(data: Omit<PendingOnboardingData, 'savedAt'>) {
  if (typeof window === 'undefined') return
  try {
    const key = `${ONBOARDING_KEY_PREFIX}${data.email.trim().toLowerCase()}`
    const payload: PendingOnboardingData = {
      ...data,
      savedAt: Date.now(),
    }
    // Explicit security check: never store recovery PIN in browser storage
    delete (payload as any).recoveryPin
    localStorage.setItem(key, JSON.stringify(payload))
  } catch {}
}

export function getPendingOnboarding(email: string): PendingOnboardingData | null {
  if (typeof window === 'undefined' || !email) return null
  try {
    const key = `${ONBOARDING_KEY_PREFIX}${email.trim().toLowerCase()}`
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingOnboardingData
    // Sanitize any legacy cached PIN if found in storage
    if ((parsed as any).recoveryPin) {
      delete (parsed as any).recoveryPin
      try {
        localStorage.setItem(key, JSON.stringify(parsed))
      } catch {}
    }
    // Keep valid for 48 hours
    if (Date.now() - parsed.savedAt > 48 * 60 * 60 * 1000) {
      localStorage.removeItem(key)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPendingOnboarding(email: string) {
  if (typeof window === 'undefined' || !email) return
  try {
    const key = `${ONBOARDING_KEY_PREFIX}${email.trim().toLowerCase()}`
    localStorage.removeItem(key)
  } catch {}
}

export async function applyPendingOnboardingIfAny(userId: string, email: string) {
  const pending = getPendingOnboarding(email)
  if (!pending) return false

  let appliedAny = false

  try {
    // 1. Backup phone
    if (pending.backupPhone?.trim()) {
      await updateProfileDetails(userId, { backupPhone: pending.backupPhone.trim() }).catch(() => {})
      appliedAny = true
    }

    // 2. Device (check for duplicate before creating)
    if (pending.deviceName?.trim() && pending.deviceType?.trim()) {
      const existing = await getDevices(userId).catch(() => [])
      const alreadyHas = existing.some(
        (d) => d.name.toLowerCase() === pending.deviceName!.trim().toLowerCase()
      )
      if (!alreadyHas) {
        await createDevice(userId, {
          name: pending.deviceName.trim(),
          type: pending.deviceType.trim(),
        }).catch(() => {})
        appliedAny = true
      }
    }

    // 3. Trusted Contact (check for duplicate before creating)
    if (pending.contactName?.trim() && pending.contactPhone?.trim()) {
      const existing = await getTrustedContacts(userId).catch(() => [])
      const alreadyHas = existing.some(
        (c) => c.phone.replace(/\D/g, '') === pending.contactPhone!.replace(/\D/g, '')
      )
      if (!alreadyHas) {
        await createTrustedContact(userId, {
          name: pending.contactName.trim(),
          relation: 'Emergency Contact',
          phone: pending.contactPhone.trim(),
        }).catch(() => {})
        appliedAny = true
      }
    }
  } finally {
    clearPendingOnboarding(email)
  }

  return appliedAny
}

// ============================================================================
// Upgraded RETRACE AI Capabilities Client Methods
// ============================================================================

export interface PanicChecklistStep {
  id: string
  title: string
  priority: string
  description: string
  completed: boolean
  actionUrl?: string
  actionLabel?: string
}

export async function activatePanicRecoveryMode(params: {
  deviceId: string
  latitude?: number | null
  longitude?: number | null
  locationName?: string | null
  accuracy?: number | null
  recoveryToken?: string | null
}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (params.recoveryToken) {
    headers['Authorization'] = `RecoveryToken ${params.recoveryToken}`
  } else {
    const session = await getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  }

  const res = await fetch('/api/recovery/panic', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  })

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean
    error?: string
    incidentId?: string
    checklist?: PanicChecklistStep[]
    notificationsDispatched?: number
  }

  if (!res.ok) {
    throw new Error(json.error || 'Failed to activate panic mode.')
  }

  return json
}

export async function updatePanicChecklistStep(
  deviceId: string,
  stepId: string,
  completed: boolean,
  recoveryToken?: string | null
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (recoveryToken) {
    headers['Authorization'] = `RecoveryToken ${recoveryToken}`
  } else {
    const session = await getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  }

  const res = await fetch('/api/recovery/panic', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ deviceId, stepId, completed }),
  })

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean
    steps?: PanicChecklistStep[]
    error?: string
  }

  if (!res.ok) {
    throw new Error(json.error || 'Failed to update checklist step.')
  }

  return json
}

export async function fetchTheftRiskAnalysis(deviceId?: string, recoveryToken?: string | null) {
  const headers: Record<string, string> = {}
  if (recoveryToken) {
    headers['Authorization'] = `RecoveryToken ${recoveryToken}`
  } else {
    const session = await getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  }

  const url = deviceId ? `/api/theft-detection?deviceId=${encodeURIComponent(deviceId)}` : '/api/theft-detection'
  const res = await fetch(url, { method: 'GET', headers })
  const json = (await res.json().catch(() => ({}))) as any

  if (!res.ok) {
    throw new Error(json.error || 'Failed to analyze theft risk.')
  }

  return json
}

export async function fetchCommunityBeaconStatus(beaconToken: string) {
  const res = await fetch(`/api/community/sighting?beacon=${encodeURIComponent(beaconToken)}`)
  const json = (await res.json().catch(() => ({}))) as any
  if (!res.ok) {
    throw new Error(json.error || json.message || 'Beacon not found.')
  }
  return json
}

export async function submitAnonymousCommunitySighting(params: {
  beaconToken: string
  latitude: number
  longitude: number
  accuracy?: number | null
  notes?: string | null
}) {
  const res = await fetch('/api/community/sighting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const json = (await res.json().catch(() => ({}))) as any
  if (!res.ok) {
    throw new Error(json.error || 'Failed to submit sighting.')
  }
  return json
}

export async function requestAiRecoveryPlaybook(params: {
  deviceId: string
  deviceName?: string
  deviceType?: string
  theftScore?: number
  theftLevel?: string
  recoveryToken?: string | null
}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (params.recoveryToken) {
    headers['Authorization'] = `RecoveryToken ${params.recoveryToken}`
  } else {
    const session = await getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  }

  const res = await fetch('/api/ai-assistant', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  })

  const json = (await res.json().catch(() => ({}))) as any
  if (!res.ok) {
    throw new Error(json.error || 'Failed to generate AI recovery playbook.')
  }
  return json
}

export async function initiateGuardianQuorum(
  requestId: string,
  actionType: string,
  notes?: string,
  recoveryToken?: string | null
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (recoveryToken) {
    headers['Authorization'] = `RecoveryToken ${recoveryToken}`
  } else {
    const session = await getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  }

  const res = await fetch('/api/contacts/quorum', {
    method: 'POST',
    headers,
    body: JSON.stringify({ requestId, actionType, notes }),
  })

  const json = (await res.json().catch(() => ({}))) as any
  if (!res.ok) {
    throw new Error(json.error || 'Failed to initiate guardian quorum.')
  }
  return json
}

export async function submitGuardianVote(voteToken: string, decision: 'approve' | 'reject', comment?: string) {
  const res = await fetch('/api/contacts/quorum', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voteToken, decision, comment }),
  })
  const json = (await res.json().catch(() => ({}))) as any
  if (!res.ok) {
    throw new Error(json.error || 'Failed to submit guardian vote.')
  }
  return json
}

export async function fetchDeviceSightings(deviceId: string): Promise<AnonymousSighting[]> {
  try {
    const { data, error } = await supabase
      .from('anonymous_sightings')
      .select('*')
      .eq('device_id', deviceId)
      .order('reported_at', { ascending: false })

    if (error || !data) return []
    return data as AnonymousSighting[]
  } catch {
    return []
  }
}
