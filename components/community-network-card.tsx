'use client'

import { useState } from 'react'
import {
  Bluetooth, Check, Copy, ExternalLink, Globe, Info, QrCode,
  Radio, Shield, Smartphone, Users
} from 'lucide-react'
import type { Device } from '@/lib/supabase/types'

export default function CommunityNetworkCard({ device }: { device?: Device | null }) {
  const [copied, setCopied] = useState(false)

  if (!device) return null

  const beaconToken = device.beacon_token || 'anon-beacon-demo-token'
  const sightingUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/sighting?beacon=${beaconToken}`
      : `/sighting?beacon=${beaconToken}`

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(sightingUrl).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div className="rounded-2xl border border-[#e2eaf4] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
            <Radio className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[#0e2341]">Community Recovery Network</h3>
            <p className="text-xs text-[#71839a]">
              Privacy-preserving crowd-sourced sightings & technical capability evaluation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[#e8f5e9] px-3 py-1 text-xs font-semibold text-[#2e7d32]">
          <Shield className="size-3.5" />
          Zero-Knowledge Active
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {/* Public Beacon Token Box */}
        <div className="rounded-xl border border-[#e2eaf4] bg-[#f8fbff] p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-[#0e2341]">Public Discovery Beacon</p>
              <p className="mt-0.5 text-[#60738c]">
                Anyone scanning your device’s Emergency QR code can report sightings without seeing your personal identity.
              </p>
            </div>
            <a
              href={`/sighting?beacon=${beaconToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1463ff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b54e9]"
            >
              <ExternalLink className="size-3" />
              Test Sighting Portal
            </a>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#e2eaf4] bg-white p-2">
            <span className="font-mono text-[11px] text-[#486581] truncate">{sightingUrl}</span>
            <button
              onClick={handleCopyLink}
              className="ml-auto inline-flex items-center gap-1 rounded bg-[#f0f4f8] px-2 py-1 text-[11px] font-semibold text-[#334e68] hover:bg-[#e2e8f0]"
            >
              {copied ? <Check className="size-3 text-[#2e7d32]" /> : <Copy className="size-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Technical Architecture Matrix: Web vs Native Mobile */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#71839a]">
            Technical Realities: Web Application vs Native Mobile OS
          </h4>
          <div className="mt-2.5 overflow-hidden rounded-xl border border-[#e2eaf4] text-xs">
            <div className="grid grid-cols-2 border-b border-[#e2eaf4] bg-[#f8fafd] p-2.5 font-bold text-[#0e2341]">
              <div className="flex items-center gap-1.5 text-[#1463ff]">
                <Globe className="size-3.5" />
                Active in Web RETRACE Today
              </div>
              <div className="flex items-center gap-1.5 text-[#e65100]">
                <Smartphone className="size-3.5" />
                Requires Native Mobile App (iOS / Android)
              </div>
            </div>

            <div className="divide-y divide-[#edf2f9]">
              <div className="grid grid-cols-2 p-3 text-[#334e68]">
                <div className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[#2e7d32]" />
                  <span><strong>Anonymous QR Sighting Portal:</strong> Zero-knowledge GPS reporting by finders.</span>
                </div>
                <div className="flex items-start gap-1.5 text-[#60738c]">
                  <Bluetooth className="mt-0.5 size-3.5 shrink-0 text-[#e65100]" />
                  <span><strong>Screen-Off BLE Beaconing:</strong> Web Bluetooth is restricted when phone is locked.</span>
                </div>
              </div>

              <div className="grid grid-cols-2 p-3 text-[#334e68]">
                <div className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[#2e7d32]" />
                  <span><strong>On-Demand Geolocation Snapshots:</strong> Instant browser-level GPS coordinates.</span>
                </div>
                <div className="flex items-start gap-1.5 text-[#60738c]">
                  <Radio className="mt-0.5 size-3.5 shrink-0 text-[#e65100]" />
                  <span><strong>Background Mesh Relays:</strong> Apple Find My / Google Find Hub native protocol.</span>
                </div>
              </div>

              <div className="grid grid-cols-2 p-3 text-[#334e68]">
                <div className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[#2e7d32]" />
                  <span><strong>Independent Cloud Recovery:</strong> Zero-password recovery from any external laptop or phone.</span>
                </div>
                <div className="flex items-start gap-1.5 text-[#60738c]">
                  <Shield className="mt-0.5 size-3.5 shrink-0 text-[#e65100]" />
                  <span><strong>SIM-Card Ejection Detection:</strong> Requires native Android/iOS kernel events.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
