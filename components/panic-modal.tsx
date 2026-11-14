'use client'

import { useEffect, useState } from 'react'
import {
  AlertOctagon, Check, CheckCircle2, ChevronRight, ExternalLink,
  Flame, Lock, PhoneCall, RefreshCw, ShieldAlert, X
} from 'lucide-react'
import {
  activatePanicRecoveryMode,
  updatePanicChecklistStep,
  type PanicChecklistStep,
} from '@/lib/supabase/data'
import type { Device } from '@/lib/supabase/types'

interface PanicModalProps {
  device: Device
  isOpen: boolean
  onClose: () => void
  onActivated?: () => void
  recoveryToken?: string | null
}

export default function PanicModal({
  device,
  isOpen,
  onClose,
  onActivated,
  recoveryToken,
}: PanicModalProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activated, setActivated] = useState(device.status === 'lost')
  const [notifiedCount, setNotifiedCount] = useState<number | null>(null)
  const [steps, setSteps] = useState<PanicChecklistStep[]>([])

  useEffect(() => {
    setActivated(device.status === 'lost')
  }, [device.status])

  if (!isOpen) return null

  const handleTriggerPanic = () => {
    setBusy(true)
    setError(null)

    const executeActivation = async (lat?: number | null, lng?: number | null) => {
      try {
        const res = await activatePanicRecoveryMode({
          deviceId: device.id,
          latitude: lat,
          longitude: lng,
          locationName: lat ? `Emergency Snapshot (${lat.toFixed(4)}, ${lng?.toFixed(4)})` : undefined,
          recoveryToken,
        })
        setActivated(true)
        if (res.notificationsDispatched !== undefined) {
          setNotifiedCount(res.notificationsDispatched)
        }
        if (res.checklist) {
          setSteps(res.checklist)
        }
        onActivated?.()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to activate Panic Mode.')
      } finally {
        setBusy(false)
      }
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          executeActivation(pos.coords.latitude, pos.coords.longitude)
        },
        () => {
          executeActivation(null, null)
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
      )
    } else {
      executeActivation(null, null)
    }
  }

  const handleToggleStep = async (stepId: string, currentCompleted: boolean) => {
    const nextCompleted = !currentCompleted
    // Optimistic UI update
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, completed: nextCompleted } : s)))

    try {
      await updatePanicChecklistStep(device.id, stepId, nextCompleted, recoveryToken)
    } catch {
      // Revert if API fails
      setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, completed: currentCompleted } : s)))
    }
  }

  const completedCount = steps.filter((s) => s.completed).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-[#ffcdd2] bg-white p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-[#71839a] hover:bg-[#f0f4f8]"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-[#ffebee] text-[#d32f2f]">
            <AlertOctagon className="size-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#b71c1c]">PANIC RECOVERY MODE</h2>
            <p className="text-xs text-[#71839a]">Immediate emergency protocol for {device.name}</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-[#fcdada] bg-[#fff5f5] p-3 text-xs text-[#c53030]">
            {error}
          </div>
        )}

        {!activated ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-[#ffe0b2] bg-[#fff8e1] p-4 text-xs leading-5 text-[#8d6e63]">
              <p className="font-semibold text-[#e65100]">What happens in One-Action Panic Activation:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-[#5d4037]">
                <li>Device status is immediately marked <strong>LOST</strong> across all networks.</li>
                <li>Your current browser GPS snapshot is locked as the last known location.</li>
                <li>Emergency notification SMS is dispatched to your <strong>Verified Trusted Contacts</strong>.</li>
                <li>A prioritized emergency response playbook is generated for SIM, UPI, and Google/Apple sessions.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[#60738c] hover:bg-[#f0f4f8]"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerPanic}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-[#d32f2f] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-500/25 transition hover:bg-[#b71c1c] disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    Engaging Emergency Mode...
                  </>
                ) : (
                  <>
                    <Flame className="size-4" />
                    Activate Panic Mode Now
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#ffebee] p-3 text-xs text-[#c62828]">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="size-4 text-[#d32f2f]" />
                Panic Mode Active · Incident Open
              </div>
              {notifiedCount !== null && (
                <span className="rounded bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-[#b71c1c]">
                  {notifiedCount} guardian(s) alerted via SMS
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#71839a]">
                  Emergency Action Playbook ({completedCount}/{steps.length || 5} Completed)
                </h4>
              </div>

              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {(steps.length > 0 ? steps : [
                  {
                    id: 'sim_block',
                    title: 'Deactivate SIM Card & Block Mobile Number',
                    priority: 'Immediate (0-30 min)',
                    description: 'Prevent SMS OTP interception for UPI and Google/Apple account password resets.',
                    completed: false,
                    actionUrl: 'tel:198',
                    actionLabel: 'Call Carrier Helpline',
                  },
                  {
                    id: 'upi_freeze',
                    title: 'Freeze UPI Apps & Report Cyber Cell (1930)',
                    priority: 'Immediate (0-60 min)',
                    description: 'Block PhonePe, Google Pay, Paytm, and dial National Cyber Helpline 1930.',
                    completed: false,
                    actionUrl: 'tel:1930',
                    actionLabel: 'Dial 1930',
                  },
                  {
                    id: 'session_purge',
                    title: 'Purge Active Google & Apple ID Sessions',
                    priority: 'Within 2 hours',
                    description: 'Revoke active mobile credentials from Google Account Device Activity or Apple ID.',
                    completed: false,
                    actionUrl: 'https://myaccount.google.com/device-activity',
                    actionLabel: 'Open Google Devices',
                  },
                  {
                    id: 'ceir_imei_block',
                    title: 'Block IMEI on CEIR Portal (ceir.gov.in)',
                    priority: 'Within 24 hours',
                    description: 'Renders the handset completely unusable on all cellular networks across India.',
                    completed: false,
                    actionUrl: 'https://www.ceir.gov.in',
                    actionLabel: 'Open CEIR Portal',
                  },
                  {
                    id: 'police_fir',
                    title: 'File Online Police e-FIR / Lost Report',
                    priority: 'Within 24 hours',
                    description: 'Essential for official insurance claim verification and legal documentation.',
                    completed: false,
                    actionUrl: '',
                    actionLabel: 'File Report',
                  },
                ]).map((step) => (
                  <div
                    key={step.id}
                    onClick={() => handleToggleStep(step.id, step.completed)}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      step.completed
                        ? 'border-[#c8e6c9] bg-[#f1f8e9] opacity-75'
                        : 'border-[#e2eaf4] bg-white hover:border-[#1463ff]'
                    }`}
                  >
                    <div
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border transition ${
                        step.completed
                          ? 'border-[#388e3c] bg-[#388e3c] text-white'
                          : 'border-[#cfd8dc] bg-white text-transparent'
                      }`}
                    >
                      <Check className="size-3 stroke-[3]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <p
                          className={`text-xs font-semibold ${
                            step.completed ? 'text-[#2e7d32] line-through' : 'text-[#0e2341]'
                          }`}
                        >
                          {step.title}
                        </p>
                        <span className="text-[10px] font-semibold text-[#e65100]">
                          {step.priority}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#60738c]">{step.description}</p>
                      {step.actionUrl && (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={step.actionUrl}
                            target={step.actionUrl.startsWith('http') ? '_blank' : undefined}
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-[#edf4ff] px-2 py-1 text-[11px] font-semibold text-[#1463ff] hover:bg-[#dbeafe]"
                          >
                            {step.actionLabel || 'Take Action'}
                            <ExternalLink className="size-2.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="rounded-xl bg-[#0e2341] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1a365d]"
              >
                Close & Return to Command Center
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
