import { supabase } from './client'
import { getSession, updateAuthFullName } from './auth'
import type {
  ActivityCategory,
  ActivityLog,
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
