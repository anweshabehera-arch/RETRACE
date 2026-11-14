'use client'

import { useState } from 'react'
import {
  Check, CheckCircle2, Copy, ExternalLink, KeyRound,
  RefreshCw, ShieldAlert, UsersRound, X
} from 'lucide-react'
import { initiateGuardianQuorum } from '@/lib/supabase/data'
import type { RecoveryRequest, TrustedContact } from '@/lib/supabase/types'

interface QuorumModalProps {
  isOpen: boolean
  onClose: () => void
  recoveryRequest?: RecoveryRequest | null
  contacts: TrustedContact[]
  recoveryToken?: string | null
}

export default function QuorumModal({
  isOpen,
  onClose,
  recoveryRequest,
  contacts,
  recoveryToken,
}: QuorumModalProps) {
  const [actionType, setActionType] = useState<'remote_lock' | 'ceir_blacklist' | 'credential_revocation'>('remote_lock')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  if (!isOpen) return null

  const verifiedContacts = contacts.filter((c) => c.approved)

  const handleInitiate = async () => {
    if (!recoveryRequest?.id) {
      setError('An active recovery incident is required before requesting guardian authorization.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await initiateGuardianQuorum(recoveryRequest.id, actionType, notes, recoveryToken)
      setResult(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initiate guardian quorum.')
    } finally {
      setBusy(false)
    }
  }

  const handleCopyLink = (url: string, idx: number) => {
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-[#e2eaf4] bg-white p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-[#71839a] hover:bg-[#f0f4f8]"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
            <UsersRound className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0e2341]">Guardian Quorum Authorization</h2>
            <p className="text-xs text-[#71839a]">Multi-party consensus for sensitive emergency actions</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-[#fcdada] bg-[#fff5f5] p-3 text-xs text-[#c53030]">
            {error}
          </div>
        )}

        {!result ? (
          <div className="mt-5 space-y-4 text-xs">
            <div>
              <label className="font-semibold text-[#0e2341]">Sensitive Operation</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as any)}
                className="mt-1.5 w-full rounded-xl border border-[#cbd5e1] p-2.5 font-medium text-[#0e2341] outline-none focus:border-[#1463ff]"
              >
                <option value="remote_lock">Authorize Remote Device Factory Lockout</option>
                <option value="ceir_blacklist">Authorize CEIR IMEI Central Blacklist</option>
                <option value="credential_revocation">Authorize Total Emergency Session Revocation</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-[#0e2341]">Incident Context / Reason</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Explain why this high-privilege action is required..."
                className="mt-1.5 h-20 w-full rounded-xl border border-[#cbd5e1] p-2.5 font-normal text-[#0e2341] outline-none focus:border-[#1463ff]"
              />
            </div>

            <div className="rounded-xl border border-[#e2eaf4] bg-[#f8fafd] p-3 leading-5 text-[#486581]">
              <p className="font-semibold text-[#0e2341]">Available Verified Guardians: {verifiedContacts.length}</p>
              <p className="mt-0.5">
                {verifiedContacts.length === 0
                  ? 'No verified contacts in your Trusted Circle. You must verify at least 1 contact via SMS OTP before requesting quorum.'
                  : `Requires approval from ${Math.min(2, verifiedContacts.length)} guardian(s) before this action is authorized.`}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[#60738c] hover:bg-[#f0f4f8]"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiate}
                disabled={busy || verifiedContacts.length === 0 || !recoveryRequest}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1463ff] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0b54e9] disabled:opacity-50"
              >
                {busy && <RefreshCw className="size-3.5 animate-spin" />}
                Dispatch Quorum Request
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4 text-xs">
            <div className="rounded-xl bg-[#e8f5e9] p-3 text-[#2e7d32]">
              <p className="font-semibold">Guardian Quorum Dispatched!</p>
              <p className="mt-0.5">{result.message}</p>
            </div>

            <div>
              <p className="font-semibold text-[#0e2341]">Share Authorization Links with Your Guardians:</p>
              <p className="mt-0.5 text-[#71839a]">
                Guardians can open these links on any browser to cast their vote:
              </p>

              <div className="mt-3 space-y-2">
                {result.inviteLinks?.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e2eaf4] bg-[#f8fbff] p-3"
                  >
                    <div>
                      <p className="font-semibold text-[#0e2341]">{item.contactName}</p>
                      <p className="text-[11px] text-[#71839a]">{item.contactPhone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyLink(item.voteUrl, i)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white border border-[#cbd5e1] px-2.5 py-1 text-[11px] font-semibold text-[#0e2341] hover:bg-[#f0f4f8]"
                      >
                        {copiedIdx === i ? <Check className="size-3 text-[#2e7d32]" /> : <Copy className="size-3" />}
                        {copiedIdx === i ? 'Copied' : 'Copy Link'}
                      </button>
                      <a
                        href={item.voteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-[#1463ff] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0b54e9]"
                      >
                        Open Portal
                        <ExternalLink className="size-2.5" />
                      </a>
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
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
