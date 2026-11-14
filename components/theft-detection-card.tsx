'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, RefreshCw, ShieldAlert, ShieldCheck, Zap } from 'lucide-react'
import { fetchTheftRiskAnalysis } from '@/lib/supabase/data'

interface Signal {
  name: string
  severity: 'info' | 'warning' | 'alert'
  scoreContribution: number
  detail: string
}

interface TheftReport {
  score: number
  level: 'Low' | 'Medium' | 'High' | 'Critical'
  analyzedAt: string
  deviceId: string
  deviceName: string
  signals: Signal[]
  recommendations: string[]
  telemetryScopeNotice: string
}

export default function TheftDetectionCard({
  deviceId,
  recoveryToken,
}: {
  deviceId?: string
  recoveryToken?: string | null
}) {
  const [report, setReport] = useState<TheftReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTheftRiskAnalysis(deviceId, recoveryToken)
      setReport(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to analyze theft risk.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalysis()
  }, [deviceId, recoveryToken])

  const levelColor =
    report?.level === 'Critical'
      ? 'border-[#ffcdd2] bg-[#ffebee] text-[#c62828]'
      : report?.level === 'High'
      ? 'border-[#ffe0b2] bg-[#fff3e0] text-[#e65100]'
      : report?.level === 'Medium'
      ? 'border-[#fff9c4] bg-[#fffde7] text-[#f57f17]'
      : 'border-[#c8e6c9] bg-[#e8f5e9] text-[#2e7d32]'

  const gaugeBg =
    report?.level === 'Critical'
      ? 'bg-[#d32f2f]'
      : report?.level === 'High'
      ? 'bg-[#f57c00]'
      : report?.level === 'Medium'
      ? 'bg-[#fbc02d]'
      : 'bg-[#388e3c]'

  return (
    <div className="rounded-2xl border border-[#e2eaf4] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
            <Zap className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[#0e2341]">AI Theft Detection & Anomaly Analysis</h3>
            <p className="text-xs text-[#71839a]">Real-time telemetry evaluating physical displacement & access challenges</p>
          </div>
        </div>
        <button
          onClick={loadAnalysis}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf4] px-2.5 py-1.5 text-xs font-medium text-[#486581] hover:bg-[#f6f9fd]"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && !report ? (
        <div className="py-8 text-center text-xs text-[#71839a]">
          Evaluating telemetry signals and location velocity...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-[#fcdada] bg-[#fff5f5] p-3 text-xs text-[#c53030]">
          {error}
        </div>
      ) : report ? (
        <div className="mt-5 space-y-5">
          {/* Risk Score Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#f6f9fd] p-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold tracking-tight text-[#0e2341]">{report.score}</div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#71839a]">Theft Risk Index (0-100)</p>
                <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-[#e2eaf4]">
                  <div
                    className={`h-full transition-all duration-500 ${gaugeBg}`}
                    style={{ width: `${report.score}%` }}
                  />
                </div>
              </div>
            </div>
            <div className={`rounded-lg border px-3 py-1 text-xs font-semibold ${levelColor}`}>
              {report.level} Risk
            </div>
          </div>

          {/* Signals Breakdown */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#71839a]">
              Evaluated Telemetry Signals
            </h4>
            <div className="mt-2.5 space-y-2">
              {report.signals.map((sig, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[#edf2f9] p-3 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    {sig.severity === 'alert' ? (
                      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#d32f2f]" />
                    ) : sig.severity === 'warning' ? (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#f57c00]" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#388e3c]" />
                    )}
                    <div>
                      <p className="font-semibold text-[#0e2341]">{sig.name}</p>
                      <p className="mt-0.5 text-[#60738c]">{sig.detail}</p>
                    </div>
                  </div>
                  {sig.scoreContribution > 0 && (
                    <span className="shrink-0 rounded bg-[#f0f4f8] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#486581]">
                      +{sig.scoreContribution} pts
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Counter-Measures */}
          {report.recommendations.length > 0 && (
            <div className="rounded-xl border border-[#e2eaf4] bg-[#fafcff] p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1463ff]">
                Recommended Counter-Measures
              </h4>
              <ul className="mt-2 space-y-1.5 text-xs text-[#334e68]">
                {report.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#1463ff]">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Architectural Transparency Notice */}
          <div className="flex items-start gap-2 rounded-xl bg-[#f0f4f8] p-3 text-[11px] text-[#627d98]">
            <Info className="mt-0.5 size-3.5 shrink-0 text-[#627d98]" />
            <p>{report.telemetryScopeNotice}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
