'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, CheckCircle2, ChevronRight, Compass, Globe,
  MapPin, Navigation, Radio, RefreshCw, Send, ShieldCheck
} from 'lucide-react'
import { fetchCommunityBeaconStatus, submitAnonymousCommunitySighting } from '@/lib/supabase/data'

export default function SightingPortal() {
  const [beaconToken, setBeaconToken] = useState<string>('')
  const [beaconStatus, setBeaconStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('beacon') || ''
      setBeaconToken(token)

      if (token) {
        setLoading(true)
        fetchCommunityBeaconStatus(token)
          .then((data) => {
            setBeaconStatus(data)
            setError(null)
          })
          .catch((err) => {
            setError(err instanceof Error ? err.message : 'Invalid or expired beacon.')
          })
          .finally(() => setLoading(false))
      } else {
        setLoading(false)
        setError('No beacon token provided in the URL. Please scan the QR code on the physical device.')
      }
    }
  }, [])

  const handleCaptureLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }

    setGeoBusy(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
        })
        setGeoBusy(false)
      },
      (geoErr) => {
        setGeoBusy(false)
        setError('Location permission was denied. Please allow location access to report coordinates.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!beaconToken || !coords) {
      setError('Please record your GPS location before submitting.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await submitAnonymousCommunitySighting({
        beaconToken,
        latitude: coords.lat,
        longitude: coords.lng,
        notes: notes.trim() || undefined,
      })
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit sighting.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7faff] p-4 text-[#0e2341]">
      <div className="w-full max-w-lg rounded-2xl border border-[#e2eaf4] bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-[#edf4ff] text-[#1463ff]">
            <Radio className="size-5" />
          </span>
          <span className="text-[15px] font-semibold tracking-[0.22em] text-[#0e2341]">RETRACE AI</span>
        </div>

        <div className="mt-5">
          <h1 className="text-xl font-bold tracking-tight text-[#0e2341]">
            Anonymous Sighting Portal
          </h1>
          <p className="mt-1 text-xs text-[#71839a]">
            Community Recovery Network · Zero-Knowledge Privacy Protected
          </p>
        </div>

        {error && beaconStatus && (
          <div className="mt-4 rounded-xl border border-[#fcdada] bg-[#fff5f5] p-3 text-xs text-[#c53030]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-[#71839a]">
            Verifying community beacon token...
          </div>
        ) : submitted ? (
          <div className="mt-6 rounded-xl border border-[#c8e6c9] bg-[#e8f5e9] p-5 text-center">
            <CheckCircle2 className="mx-auto size-10 text-[#2e7d32]" />
            <h3 className="mt-3 text-sm font-bold text-[#1b5e20]">Sighting Successfully Reported!</h3>
            <p className="mt-1 text-xs text-[#2e7d32] leading-5">
              Thank you for being a good Samaritan. The device owner has received an encrypted notification with your coordinates. No personal identity or browser information was saved.
            </p>
            <div className="mt-5">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2e7d32] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1b5e20]"
              >
                Return to RETRACE Home
              </Link>
            </div>
          </div>
        ) : error && !beaconStatus ? (
          <div className="mt-6 rounded-xl border border-[#fcdada] bg-[#fff5f5] p-5 text-center text-xs text-[#c53030]">
            <AlertCircle className="mx-auto size-8 text-[#e53e3e]" />
            <h3 className="mt-2 font-semibold text-[#9b2c2c]">Unable to Verify Device Beacon</h3>
            <p className="mt-1 text-[#c53030]">{error}</p>
            <div className="mt-4">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#c53030] px-4 py-2 text-xs font-semibold text-white hover:bg-[#9b2c2c]"
              >
                Return to RETRACE Home
              </Link>
            </div>
          </div>
        ) : beaconStatus?.active ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs">
            <div className="rounded-xl border border-[#ffe0b2] bg-[#fff8e1] p-4 text-[#8d6e63] leading-5">
              <div className="flex items-center gap-1.5 font-bold text-[#e65100]">
                <AlertCircle className="size-4" />
                Lost Device Flagged: {beaconStatus.deviceName || 'Smartphone'}
              </div>
              <p className="mt-1">
                The owner has reported this device as missing. By sharing your current GPS coordinates, you help them locate it accurately on their recovery map.
              </p>
            </div>

            <div>
              <label className="font-semibold text-[#0e2341]">Your GPS Location (Required)</label>
              {coords ? (
                <div className="mt-2 flex items-center justify-between rounded-xl border border-[#c8e6c9] bg-[#f1f8e9] p-3 text-[#2e7d32]">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4" />
                    <span className="font-mono font-medium">
                      {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCaptureLocation}
                    disabled={geoBusy}
                    className="text-[11px] font-semibold text-[#1b5e20] underline"
                  >
                    Recalibrate
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCaptureLocation}
                  disabled={geoBusy}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#1463ff] bg-[#f8fbff] py-4 text-xs font-semibold text-[#1463ff] hover:bg-[#edf4ff]"
                >
                  <Navigation className={`size-4 ${geoBusy ? 'animate-spin' : ''}`} />
                  {geoBusy ? 'Determining GPS Coordinates...' : 'Record My Current Location (1-Click)'}
                </button>
              )}
            </div>

            <div>
              <label className="font-semibold text-[#0e2341]">Helpful Sighting Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Found on desk at library 2nd floor, left with security desk..."
                className="mt-1.5 h-20 w-full rounded-xl border border-[#cbd5e1] p-3 font-normal text-[#0e2341] outline-none focus:border-[#1463ff]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !coords}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1463ff] py-3 text-xs font-semibold text-white shadow-md hover:bg-[#0b54e9] disabled:opacity-50"
              >
                {submitting && <RefreshCw className="size-3.5 animate-spin" />}
                Submit Anonymous Sighting
              </button>
            </div>

            <p className="text-center text-[11px] text-[#8192a8]">
              Zero-knowledge architecture: neither your name, email, nor IP address is stored or shared with the owner.
            </p>
          </form>
        ) : (
          <div className="mt-6 rounded-xl bg-[#f0f4f8] p-5 text-center text-xs text-[#486581]">
            <ShieldCheck className="mx-auto size-8 text-[#1463ff]" />
            <h3 className="mt-2 font-semibold">Device is not reported lost</h3>
            <p className="mt-1 text-[#627d98]">
              {beaconStatus?.message || 'This device is currently marked protected by its owner.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
