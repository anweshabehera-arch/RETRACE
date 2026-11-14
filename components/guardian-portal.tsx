'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, Check, CheckCircle2, KeyRound, RefreshCw,
  ShieldAlert, ShieldCheck, UsersRound, X, XCircle
} from 'lucide-react'
import { submitGuardianVote } from '@/lib/supabase/data'

export default function GuardianPortal() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quorumData, setQuorumData] = useState<any>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [votedDecision, setVotedDecision] = useState<'approve' | 'reject' | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const t = params.get('token') || ''
      setToken(t)

      if (t) {
        setLoading(true)
        fetch(`/api/contacts/quorum?token=${encodeURIComponent(t)}`)
          .then(async (res) => {
            const json = await res.json()
            if (!res.ok || !json.valid) {
              throw new Error(json.error || 'Invalid or expired authorization token.')
            }
            setQuorumData(json)
            setError(null)
          })
          .catch((err) => {
            setError(err instanceof Error ? err.message : 'Failed to verify token.')
          })
          .finally(() => setLoading(false))
      } else {
        setLoading(false)
        setError('No authorization token provided in the URL.')
      }
    }
  }, [])

  const handleCastVote = async (decision: 'approve' | 'reject') => {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      await submitGuardianVote(token, decision, comment.trim() || undefined)
      setVotedDecision(decision)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record vote.')
    } finally {
      setBusy(false)
    }
  }

  const actionLabels: Record<string, string> = {
    remote_lock: 'Authorize Remote Device Factory Lockout',
    ceir_blacklist: 'Authorize CEIR Central IMEI Blacklist',
    credential_revocation: 'Authorize Emergency Digital Session Invalidation',
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7faff] p-4 text-[#0e2341]">
      <div className="w-full max-w-lg rounded-2xl border border-[#e2eaf4] bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
            <UsersRound className="size-5" />
          </span>
          <span className="text-[15px] font-semibold tracking-[0.22em] text-[#0e2341]">RETRACE AI</span>
        </div>

        <div className="mt-5">
          <h1 className="text-xl font-bold tracking-tight text-[#0e2341]">
            Guardian Quorum Portal
          </h1>
          <p className="mt-1 text-xs text-[#71839a]">
            Multi-Party Trusted Circle Authorization
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-[#fcdada] bg-[#fff5f5] p-3 text-xs text-[#c53030]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-[#71839a]">
            Verifying cryptographic guardian token...
          </div>
        ) : votedDecision ? (
          <div className="mt-6 rounded-xl border border-[#c8e6c9] bg-[#e8f5e9] p-5 text-center">
            {votedDecision === 'approve' ? (
              <CheckCircle2 className="mx-auto size-10 text-[#2e7d32]" />
            ) : (
              <XCircle className="mx-auto size-10 text-[#c62828]" />
            )}
            <h3 className="mt-3 text-sm font-bold text-[#1b5e20]">
              Vote Successfully Recorded: {votedDecision.toUpperCase()}
            </h3>
            <p className="mt-1 text-xs text-[#2e7d32] leading-5">
              Your decision has been logged to the recovery quorum ledger. The user’s audit log has been updated with your cryptographic signature.
            </p>
            <div className="mt-5">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2e7d32] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1b5e20]"
              >
                Close & Return Home
              </Link>
            </div>
          </div>
        ) : quorumData?.valid ? (
          <div className="mt-6 space-y-4 text-xs">
            <div className="rounded-xl border border-[#ffe0b2] bg-[#fff8e1] p-4 text-[#8d6e63] leading-5">
              <p className="font-bold text-[#e65100]">Guardian Authorization Requested</p>
              <p className="mt-1">
                Your contact <strong>{quorumData.contact?.name || 'Friend'}</strong> is requesting guardian authorization for a sensitive recovery action on their lost device:
              </p>
              <p className="mt-2 font-mono text-sm font-bold text-[#b71c1c]">
                {actionLabels[quorumData.actionType] || quorumData.actionType}
              </p>
            </div>

            {quorumData.request?.notes && (
              <div className="rounded-xl border border-[#e2eaf4] bg-[#f8fbff] p-3 text-[#334e68]">
                <span className="font-semibold text-[#0e2341]">User Note: </span>
                <span>{quorumData.request.notes}</span>
              </div>
            )}

            <div>
              <label className="font-semibold text-[#0e2341]">Guardian Comment (Optional)</label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g. Verified by phone call with owner"
                className="mt-1.5 w-full rounded-xl border border-[#cbd5e1] p-2.5 font-normal text-[#0e2341] outline-none focus:border-[#1463ff]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleCastVote('reject')}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#fcdada] bg-[#fff5f5] py-2.5 text-xs font-bold text-[#c53030] hover:bg-[#ffebee] disabled:opacity-50"
              >
                <X className="size-4" />
                Reject Action
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleCastVote('approve')}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#2e7d32] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#1b5e20] disabled:opacity-50"
              >
                {busy ? <RefreshCw className="size-3.5 animate-spin" /> : <Check className="size-4" />}
                Approve Action
              </button>
            </div>

            <p className="text-center text-[11px] text-[#8192a8]">
              Your approval is verified via cryptographically signed token. Only verified Trusted Circle contacts can cast votes.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
