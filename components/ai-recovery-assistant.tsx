'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { requestAiRecoveryPlaybook } from '@/lib/supabase/data'
import type { Device } from '@/lib/supabase/types'

interface PlaybookItem {
  id: string
  category: string
  title: string
  priority: string
  why: string
  steps: string[]
  helplines?: { name: string; number: string; url?: string }[]
  directUrl?: string
}

interface AssistantResponse {
  engine: string
  isEmergency: boolean
  theftScore: number
  theftLevel: string
  deviceStatus: string
  summary: string
  playbook: PlaybookItem[]
  disclaimer: string
}

export default function AiRecoveryAssistant({
  device,
  theftScore,
  theftLevel,
  recoveryToken,
}: {
  device?: Device | null
  theftScore?: number
  theftLevel?: string
  recoveryToken?: string | null
}) {
  const [data, setData] = useState<AssistantResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadPlaybook = async () => {
    if (!device) return
    setLoading(true)
    setError(null)
    try {
      const res = (await requestAiRecoveryPlaybook({
        deviceId: device.id,
        deviceName: device.name,
        deviceType: device.type,
        theftScore,
        theftLevel,
        recoveryToken,
      })) as AssistantResponse
      setData(res)
      if (res.playbook && res.playbook.length > 0) {
        setExpandedId(res.playbook[0].id)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to generate recovery assistant playbook.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlaybook()
  }, [device?.id, device?.status, theftScore, theftLevel])

  if (!device) return null

  const isEmergency = Boolean(data?.isEmergency)

  return (
    <div className="rounded-2xl border border-[#e2eaf4] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`grid size-9 place-items-center rounded-xl ${
              isEmergency ? 'bg-[#fff3e0] text-[#ea580c]' : 'bg-[#edf4ff] text-[#1463ff]'
            }`}
          >
            {isEmergency ? <AlertTriangle className="size-5" /> : <Sparkles className="size-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[#0e2341]">
                {isEmergency ? 'AI Emergency Recovery Assistant' : 'AI Security & Recovery Assistant'}
              </h3>
              {data && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isEmergency
                      ? 'bg-[#ffebee] text-[#c62828]'
                      : 'bg-[#e8f5e9] text-[#2e7d32]'
                  }`}
                >
                  {isEmergency ? (
                    <>
                      <ShieldAlert className="size-3" />
                      Incident Active ({data.theftScore}/100 · {data.theftLevel})
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3" />
                      Protected · Low Risk (0/100)
                    </>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-[#71839a]">
              {isEmergency
                ? `Prioritized emergency incident countermeasures tailored for ${device.name}`
                : `Digital preparedness & preventative defense guide for ${device.name}`}
            </p>
          </div>
        </div>

        <button
          onClick={loadPlaybook}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf4] px-2.5 py-1.5 text-xs font-medium text-[#486581] hover:bg-[#f6f9fd] disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && !data ? (
        <div className="py-8 text-center text-xs text-[#71839a]">
          Evaluating device security status, active incidents, and countermeasures...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-[#fcdada] bg-[#fff5f5] p-3 text-xs text-[#c53030]">
          {error}
        </div>
      ) : data ? (
        <div className="mt-5 space-y-4">
          {/* Situation Assessment Box */}
          <div
            className={`rounded-xl border p-4 text-xs leading-5 ${
              isEmergency
                ? 'border-[#fed7aa] bg-[#fff7ed] text-[#7c2d12]'
                : 'border-[#dce8f6] bg-[#f8fbff] text-[#334e68]'
            }`}
          >
            <p
              className={`font-semibold ${
                isEmergency ? 'text-[#c2410c]' : 'text-[#1463ff]'
              }`}
            >
              {isEmergency ? 'Emergency Incident Assessment:' : 'Security & Preparedness Status:'}
            </p>
            <p className="mt-1">{data.summary}</p>
          </div>

          {/* Action Cards */}
          <div className="space-y-3">
            {data.playbook.map((item) => {
              const isExpanded = expandedId === item.id
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#e2eaf4] bg-white transition hover:border-[#cbd5e1]"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[#0e2341] px-2 py-0.5 text-[10px] font-bold tracking-wider text-white">
                        {item.category}
                      </span>
                      <span className="text-xs font-bold text-[#0e2341]">{item.title}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          item.priority.includes('CRITICAL')
                            ? 'bg-[#ffebee] text-[#c62828]'
                            : item.priority.includes('HIGH')
                            ? 'bg-[#fff3e0] text-[#e65100]'
                            : item.priority.includes('PREVENTATIVE')
                            ? 'bg-[#e8f5e9] text-[#2e7d32]'
                            : 'bg-[#edf4ff] text-[#1463ff]'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="size-4 text-[#71839a]" />
                    ) : (
                      <ChevronDown className="size-4 text-[#71839a]" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[#edf2f9] p-4 text-xs space-y-3">
                      {/* Why Section */}
                      <div
                        className={`rounded-lg p-3 ${
                          isEmergency ? 'bg-[#fff8e1] text-[#5d4037]' : 'bg-[#f0fdf4] text-[#166534]'
                        }`}
                      >
                        <p
                          className={`font-semibold ${
                            isEmergency ? 'text-[#e65100]' : 'text-[#15803d]'
                          }`}
                        >
                          {isEmergency ? 'Why this is critical:' : 'Why this protection matters:'}
                        </p>
                        <p className="mt-0.5 leading-5">{item.why}</p>
                      </div>

                      {/* Steps */}
                      <div>
                        <p className="font-semibold text-[#0e2341]">
                          {isEmergency ? 'Immediate Emergency Action Steps:' : 'Recommended Action Steps:'}
                        </p>
                        <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[#486581]">
                          {item.steps.map((step, idx) => (
                            <li key={idx} className="leading-5">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Helplines & Links */}
                      {(item.helplines?.length || item.directUrl) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {item.helplines?.map((hl, i) => (
                            <a
                              key={i}
                              href={hl.number.startsWith('http') ? hl.number : `tel:${hl.number.replace(/\D/g, '')}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf4] bg-[#f6f9fd] px-2.5 py-1 text-[11px] font-semibold text-[#0e2341] hover:bg-[#edf4ff]"
                            >
                              <PhoneCall className="size-3 text-[#1463ff]" />
                              {hl.name}: {hl.number}
                            </a>
                          ))}
                          {item.directUrl && (
                            <a
                              href={item.directUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1463ff] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0b54e9]"
                            >
                              <ExternalLink className="size-3" />
                              Official Portal
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legal / Functional Disclaimer */}
          <p className="text-[11px] text-[#8192a8] italic">{data.disclaimer}</p>
        </div>
      ) : null}
    </div>
  )
}
