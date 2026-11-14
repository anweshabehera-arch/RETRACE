import { NextResponse } from 'next/server'
import {
  getAuthenticatedServerClient,
  getRecoverySessionFromRequest,
  getServerServiceClient,
} from '@/lib/supabase/server-auth'

interface AssistantRequest {
  deviceId: string
  deviceName?: string
  deviceType?: string
  theftScore?: number
  theftLevel?: string
  lastSeenLocation?: string
}

interface ActionPlaybookItem {
  id: string
  category: 'Telecom' | 'Financial & UPI' | 'Primary Accounts' | 'Messaging & Social' | 'Law Enforcement'
  title: string
  priority: string
  why: string
  steps: string[]
  helplines?: { name: string; number: string; url?: string }[]
  directUrl?: string
}

function getPreventativePlaybook(params: {
  deviceName: string
  deviceType: string
  theftScore: number
  theftLevel: string
}): {
  engine: string
  isEmergency: boolean
  theftScore: number
  theftLevel: string
  deviceStatus: string
  summary: string
  playbook: ActionPlaybookItem[]
} {
  const isApple =
    params.deviceType.toLowerCase().includes('iphone') ||
    params.deviceName.toLowerCase().includes('apple')

  return {
    engine: 'Deterministic Expert Rulebook (Zero-latency)',
    isEmergency: false,
    theftScore: params.theftScore,
    theftLevel: params.theftLevel,
    deviceStatus: 'protected',
    summary: `${params.deviceName} is currently Protected with no active security incidents. Routine digital preparedness and preventative protection guidelines are active.`,
    playbook: [
      {
        id: 'sim_pin_lock',
        category: 'Telecom',
        title: 'Configure SIM Card PIN Protection',
        priority: 'PREVENTATIVE (Best Practice)',
        why: 'Enabling a 4-digit SIM PIN prevents anyone from ejecting your physical SIM card and placing it into another device to intercept incoming banking OTPs, UPI authorizations, and Google 2FA codes.',
        steps: [
          isApple
            ? 'Open iOS Settings > Cellular / Mobile Data > SIM PIN and toggle ON.'
            : 'Open Android Settings > Security & Privacy > More Security Settings > SIM Card Lock and toggle ON.',
          'Set a unique 4-digit PIN (carrier default is typically 0000 or 1234).',
          'Keep your carrier PUK code stored safely in your home paper records in case of lockout.',
        ],
        helplines: [
          { name: 'Jio Customer Care', number: '198 / 1800 889 9999', url: 'https://www.jio.com' },
          { name: 'Airtel Customer Care', number: '198 / 98490 98490', url: 'https://www.airtel.in' },
          { name: 'Vi Customer Care', number: '199 / 96542 97000', url: 'https://www.myvi.in' },
        ],
      },
      {
        id: 'upi_biometrics',
        category: 'Financial & UPI',
        title: 'Enforce Biometric & Transaction Limits on UPI',
        priority: 'RECOMMENDED',
        why: 'Ensures that even if an observer observes your device passcode in a crowded space, payment applications (Google Pay, PhonePe, Paytm, NetBanking) cannot be opened without biometric authentication.',
        steps: [
          'Enable Fingerprint / Face Unlock inside Google Pay (Settings > Privacy & Security > Enable App Lock).',
          'Enable Biometric Lock inside PhonePe (Profile > Screen Lock).',
          'Log in to your bank’s NetBanking portal and lower daily per-transaction UPI transfer limits.',
        ],
        helplines: [
          { name: 'National Cyber Helpline', number: '1930', url: 'https://cybercrime.gov.in' },
        ],
      },
      {
        id: 'offline_find_network',
        category: 'Primary Accounts',
        title: isApple ? 'Verify "Find My Network" Offline Finding' : 'Enable "Find My Device Offline Network"',
        priority: 'RECOMMENDED',
        why: 'Allows your device to be securely located through nearby encrypted mesh relays even when your phone is powered off, out of battery, or disconnected from cellular service.',
        steps: isApple
          ? [
              'Open Settings > [Your Name] > Find My > Find My iPhone.',
              'Ensure both "Find My network" and "Send Last Location" are toggled ON.',
            ]
          : [
              'Open Android Settings > Google > Find My Device.',
              'Ensure "Find your offline devices" is set to "With network in all areas".',
              'Keep Google Location Accuracy toggled ON.',
            ],
        directUrl: isApple ? 'https://www.icloud.com/find' : 'https://www.google.com/android/find',
      },
      {
        id: 'trusted_circle_audit',
        category: 'Law Enforcement',
        title: 'Maintain Verified Contacts in Trusted Circle',
        priority: 'MAINTENANCE',
        why: 'In an emergency when your primary phone is lost or snatched, verified trusted contacts hold cryptographic quorum keys to authorize device locking and assist recovery without passwords.',
        steps: [
          'Confirm at least 1 verified contact is approved in your RETRACE Trusted Circle.',
          'Store their phone numbers in alternate offline notes so you can reach them without your device.',
        ],
      },
    ],
  }
}

function getEmergencyPlaybook(params: {
  deviceName: string
  deviceType: string
  theftScore: number
  theftLevel: string
}): {
  engine: string
  isEmergency: boolean
  theftScore: number
  theftLevel: string
  deviceStatus: string
  summary: string
  playbook: ActionPlaybookItem[]
} {
  const isApple =
    params.deviceType.toLowerCase().includes('iphone') ||
    params.deviceName.toLowerCase().includes('apple')

  return {
    engine: 'Deterministic Expert Rulebook (Zero-latency)',
    isEmergency: true,
    theftScore: params.theftScore,
    theftLevel: params.theftLevel,
    deviceStatus: 'lost',
    summary: `Active incident response for ${params.deviceName}. Theft Risk is evaluated as ${params.theftLevel} (Score ${params.theftScore}/100). Focus immediately on preventing SIM swap OTP interception and securing mobile payment handles.`,
    playbook: [
      {
        id: 'telecom_sim',
        category: 'Telecom',
        title: 'Block Physical SIM / Deactivate eSIM',
        priority: 'CRITICAL (First 30 min)',
        why: 'Thieves move physical SIM cards into another device within 15–30 minutes to receive OTPs for UPI transactions, net banking password resets, and Google 2-Factor Authentication.',
        steps: [
          'Call your telecom carrier immediately from a trusted or alternate phone.',
          'Request an urgent SIM card deactivation / lost phone block.',
          'Request a replacement duplicate SIM with the same number at your nearest telecom gallery with valid photo ID.',
        ],
        helplines: [
          { name: 'Jio Emergency Block', number: '1800 889 9999', url: 'https://www.jio.com' },
          { name: 'Airtel Emergency Block', number: '198 / 98490 98490', url: 'https://www.airtel.in' },
          { name: 'Vodafone Idea (Vi)', number: '199 / 96542 97000', url: 'https://www.myvi.in' },
          { name: 'BSNL Helpline', number: '1503 / 1800-180-1503', url: 'https://www.bsnl.co.in' },
          { name: 'US: AT&T / Verizon / T-Mo', number: '611 (from carrier phone)', url: '' },
        ],
      },
      {
        id: 'financial_upi',
        category: 'Financial & UPI',
        title: 'Freeze Mobile UPI & Notify Bank Branches',
        priority: 'CRITICAL (First 30 min)',
        why: 'Even with lockscreen protection, incoming SMS alerts and unlocked payment notifications can be exploited. Freezing UPI prevents unauthorized debits from linked bank accounts.',
        steps: [
          'Call the National Cyber Fraud Reporting Helpline (1930) to report financial loss risk immediately.',
          'Block UPI accounts directly via respective 24x7 customer support lines.',
          'Log in to your bank’s official NetBanking portal on a computer and temporarily disable UPI / Mobile Banking permissions.',
        ],
        helplines: [
          { name: 'National Cyber Crime Helpline', number: '1930', url: 'https://cybercrime.gov.in' },
          { name: 'Google Pay 24x7 Help', number: '1800 419 0157', url: 'https://support.google.com/pay' },
          { name: 'PhonePe Emergency Support', number: '080 6872 7374', url: 'https://support.phonepe.com' },
          { name: 'Paytm Payments Bank Fraud Desk', number: '0120 4456 456', url: 'https://paytm.com/care' },
        ],
      },
      {
        id: 'primary_accounts',
        category: 'Primary Accounts',
        title: isApple ? 'Sign Out Apple ID & Lock via Find My' : 'Revoke Google Sessions & Lock via Android Find',
        priority: 'HIGH (Within 2 hrs)',
        why: 'Revoking active device sessions prevents anyone from reading saved emails, Chrome autofill passwords, Google Drive files, or Apple Photos.',
        steps: isApple
          ? [
              'Visit icloud.com/find from a computer browser.',
              'Select your iPhone and mark as "Lost Mode" to lock it with a custom passcode and display contact details.',
              'Do NOT remove the device from your Apple ID account, as removing it turns off Activation Lock.',
            ]
          : [
              'Visit myaccount.google.com/device-activity from another browser.',
              'Click your lost device and select "Sign Out" to invalidate all browser, Gmail, and Google Drive tokens.',
              'Keep google.com/android/find active to track location without restoring full account privileges.',
            ],
        directUrl: isApple ? 'https://www.icloud.com/find' : 'https://myaccount.google.com/device-activity',
      },
      {
        id: 'messaging_social',
        category: 'Messaging & Social',
        title: 'Deactivate WhatsApp & Social Sessions',
        priority: 'HIGH (Within 2 hrs)',
        why: 'Criminals frequently message family and friends pretending to be the victim in an emergency asking for immediate money transfers.',
        steps: [
          'Send an email to support@whatsapp.com with the subject: "Lost/Stolen: Please deactivate my account" and include your phone number in full international format (+91...).',
          'Once your duplicate SIM is issued, register WhatsApp on your new phone to automatically log out the stolen device.',
          'Log in to Instagram, Facebook, and Twitter/X from a desktop and click "Log out of all other sessions".',
        ],
        helplines: [{ name: 'WhatsApp Support Email', number: 'support@whatsapp.com' }],
      },
      {
        id: 'ceir_legal',
        category: 'Law Enforcement',
        title: 'Block IMEI on CEIR Portal & File Police e-FIR',
        priority: 'MEDIUM (Within 24 hrs)',
        why: 'The Central Equipment Identity Register (CEIR) blocks the device IMEI across all Indian cellular networks (Airtel, Jio, Vi, BSNL). If anyone inserts any SIM card, telecom towers reject the signal and notify police.',
        steps: [
          'Obtain your police lost phone report or e-FIR acknowledgement number from your state police portal.',
          'Visit ceir.gov.in and click "Block Stolen/Lost Mobile".',
          'Enter device IMEI 1, IMEI 2 (from device box or bill), your police complaint number, and your ID proof.',
        ],
        directUrl: 'https://www.ceir.gov.in',
        helplines: [{ name: 'CEIR Official Portal', number: 'ceir.gov.in', url: 'https://www.ceir.gov.in' }],
      },
    ],
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

    const body = (await request.json().catch(() => ({}))) as AssistantRequest
    const { deviceId, deviceName, deviceType, theftScore, theftLevel } = body

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required.' }, { status: 400 })
    }

    // 1. Fetch authoritative device record from database
    const { data: device, error: devError } = await client
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', userId)
      .single()

    if (devError || !device) {
      return NextResponse.json({ error: 'Device not found or unauthorized.' }, { status: 404 })
    }

    // 2. Fetch active recovery requests for this device
    const { data: activeIncidents } = await client
      .from('recovery_requests')
      .select('id, status')
      .eq('device_id', deviceId)
      .eq('user_id', userId)
      .eq('status', 'active')

    const hasActiveIncident = Boolean(activeIncidents && activeIncidents.length > 0)
    const isDeviceLost = device.status === 'lost'
    const isEmergencyActive = isDeviceLost || hasActiveIncident

    const resolvedName = deviceName || device.name || 'Mobile Device'
    const resolvedType = deviceType || device.type || 'Smartphone'

    // 3. Resolve theft score and risk level without hardcoded fabrication
    let resolvedScore = 0
    let resolvedLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low'

    if (typeof theftScore === 'number' && theftLevel) {
      resolvedScore = theftScore
      resolvedLevel = theftLevel as any
    } else if (isEmergencyActive) {
      resolvedScore = 35
      resolvedLevel = 'Medium'
    } else {
      resolvedScore = 0
      resolvedLevel = 'Low'
    }

    const geminiApiKey = process.env.GEMINI_API_KEY

    // 4. If Gemini API Key is configured, attempt model-guided summary; otherwise use deterministic rulebook
    if (geminiApiKey) {
      try {
        const prompt = isEmergencyActive
          ? `You are RETRACE AI, an emergency phone recovery assistant.
The user lost their ${resolvedName} (${resolvedType}). Theft Risk Score is ${resolvedScore}/100 (${resolvedLevel}).
Provide a clear, urgent 2-sentence summary of the immediate risk and the first action they must take within 30 minutes.`
          : `You are RETRACE AI, a digital device security assistant.
The user's ${resolvedName} (${resolvedType}) is safe and Protected with 0/100 risk and no active recovery incident.
Provide a clear, reassuring 2-sentence summary confirming the device is protected, followed by one top preventative habit to stay secure. Do NOT claim the device is lost or in danger.`

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        )

        if (geminiRes.ok) {
          const geminiJson = await geminiRes.json()
          const aiText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || ''

          if (aiText) {
            const basePlaybook = isEmergencyActive
              ? getEmergencyPlaybook({
                  deviceName: resolvedName,
                  deviceType: resolvedType,
                  theftScore: resolvedScore,
                  theftLevel: resolvedLevel,
                })
              : getPreventativePlaybook({
                  deviceName: resolvedName,
                  deviceType: resolvedType,
                  theftScore: resolvedScore,
                  theftLevel: resolvedLevel,
                })

            return NextResponse.json({
              engine: 'Gemini 1.5 Flash (AI Enhanced)',
              isEmergency: isEmergencyActive,
              theftScore: resolvedScore,
              theftLevel: resolvedLevel,
              deviceStatus: device.status,
              summary: aiText.trim(),
              playbook: basePlaybook.playbook,
              disclaimer:
                'Notice: RETRACE AI provides strategic instructions and direct official portals. External accounts (Google, Apple, Banks) must be secured through their respective platforms.',
            })
          }
        }
      } catch {
        // Fallback to deterministic expert rulebook if API call fails
      }
    }

    // 5. Deterministic Expert Rulebook
    const result = isEmergencyActive
      ? getEmergencyPlaybook({
          deviceName: resolvedName,
          deviceType: resolvedType,
          theftScore: resolvedScore,
          theftLevel: resolvedLevel,
        })
      : getPreventativePlaybook({
          deviceName: resolvedName,
          deviceType: resolvedType,
          theftScore: resolvedScore,
          theftLevel: resolvedLevel,
        })

    return NextResponse.json({
      ...result,
      disclaimer:
        'Notice: RETRACE AI provides strategic instructions and direct official portals. External accounts (Google, Apple, Banks) must be secured through their respective platforms.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error in AI Assistant.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
