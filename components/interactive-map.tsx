'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  MapPin,
  Maximize2,
  Navigation,
  Radio,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { formatTimestamp } from '@/lib/supabase/data'
import type { AnonymousSighting, Device } from '@/lib/supabase/types'

interface InteractiveMapProps {
  device: Device | null
  sightings?: AnonymousSighting[]
  className?: string
  onCheckInRequested?: () => void
  isCheckingIn?: boolean
}

export default function InteractiveMap({
  device,
  sightings = [],
  className = '',
  onCheckInRequested,
  isCheckingIn = false,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const primaryMarkerRef = useRef<any>(null)
  const sightingMarkersRef = useRef<any[]>([])

  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSightings, setShowSightings] = useState(true)

  const hasDeviceCoordinates =
    device?.latitude !== null &&
    device?.latitude !== undefined &&
    device?.longitude !== null &&
    device?.longitude !== undefined

  const hasSightingCoordinates = sightings.length > 0
  const hasAnyCoordinates = hasDeviceCoordinates || hasSightingCoordinates

  // Default focus: primary device GPS, else first sighting
  const lat = hasDeviceCoordinates
    ? device!.latitude!
    : hasSightingCoordinates
    ? sightings[0].latitude
    : 0

  const lng = hasDeviceCoordinates
    ? device!.longitude!
    : hasSightingCoordinates
    ? sightings[0].longitude
    : 0

  // Determine if verified device location is outdated (> 24 hours)
  const isOutdated = (() => {
    if (!device?.last_seen_at) return false
    const diffHours = (Date.now() - new Date(device.last_seen_at).getTime()) / (1000 * 60 * 60)
    return diffHours > 24
  })()

  // Dynamically load Leaflet script & CSS on the client
  useEffect(() => {
    let mounted = true
    if (typeof window === 'undefined') return

    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
      link.crossOrigin = ''
      document.head.appendChild(link)
    }

    // Load Leaflet JS
    const loadScript = () => {
      if ((window as any).L) {
        if (mounted) setMapLoaded(true)
        return
      }

      const script = document.createElement('script')
      script.id = 'leaflet-js'
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
      script.crossOrigin = ''
      script.onload = () => {
        if (mounted) setMapLoaded(true)
      }
      script.onerror = () => {
        if (mounted) setMapError('Unable to load OpenStreetMap tiles. Check your network connection.')
      }
      document.body.appendChild(script)
    }

    loadScript()

    return () => {
      mounted = false
    }
  }, [])

  // Initialize or update Leaflet map
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || !(window as any).L || !hasAnyCoordinates) {
      return
    }

    const L = (window as any).L

    try {
      // 1. Initialize map instance if not already created
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 14,
          zoomControl: false,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map)

        mapInstanceRef.current = map
      } else {
        mapInstanceRef.current.setView([lat, lng], 14)
      }

      const map = mapInstanceRef.current

      // 2. Manage Primary Device Marker (Verified Hardware Location)
      if (hasDeviceCoordinates) {
        const verifiedIcon = L.divIcon({
          className: 'retrace-map-marker-verified',
          html: `
            <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
              <span style="position:absolute; width:36px; height:36px; border-radius:50%; background:rgba(20,99,255,0.25); animation:ping 2s cubic-bezier(0,0,.2,1) infinite;"></span>
              <span style="position:relative; width:28px; height:28px; border-radius:50%; background:#1463ff; color:white; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(20,99,255,0.4); border:2px solid white;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              </span>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -18],
        })

        const verifiedPopupContent = `
          <div style="font-family:inherit; min-width:200px; padding:2px;">
            <div style="display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; color:#1463ff; background:#edf4ff; border-radius:4px; padding:2px 6px; margin-bottom:5px; text-transform:uppercase;">
              <span>●</span> Verified Device Check-In
            </div>
            <p style="font-weight:700; font-size:13px; color:#0b1b35; margin:0 0 2px 0;">${device?.name ?? 'Device'}</p>
            <p style="font-size:11px; color:#60738c; margin:0 0 6px 0;">${device?.last_location_name ?? 'Hardware check-in'}</p>
            <div style="font-size:10px; color:#8192a8; border-top:1px solid #eef3f9; padding-top:4px;">
              Coordinates: ${device!.latitude!.toFixed(5)}, ${device!.longitude!.toFixed(5)}<br/>
              Hardware Check-in: ${formatTimestamp(device?.last_seen_at)}
            </div>
          </div>
        `

        if (!primaryMarkerRef.current) {
          primaryMarkerRef.current = L.marker([device!.latitude!, device!.longitude!], { icon: verifiedIcon }).addTo(map)
          primaryMarkerRef.current.bindPopup(verifiedPopupContent)
        } else {
          primaryMarkerRef.current.setLatLng([device!.latitude!, device!.longitude!])
          primaryMarkerRef.current.setPopupContent(verifiedPopupContent)
        }
      } else if (primaryMarkerRef.current) {
        map.removeLayer(primaryMarkerRef.current)
        primaryMarkerRef.current = null
      }

      // 3. Manage Sighting Markers (Unverified Community Reports)
      // Clear old sighting markers
      sightingMarkersRef.current.forEach((marker) => map.removeLayer(marker))
      sightingMarkersRef.current = []

      if (showSightings && hasSightingCoordinates) {
        const sightingIcon = L.divIcon({
          className: 'retrace-map-marker-sighting',
          html: `
            <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
              <span style="position:absolute; width:34px; height:34px; border-radius:50%; background:rgba(234,88,12,0.25); animation:ping 2.5s cubic-bezier(0,0,.2,1) infinite;"></span>
              <span style="position:relative; width:26px; height:26px; border-radius:50%; background:#ea580c; color:white; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(234,88,12,0.4); border:2px solid white;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19.1"/></svg>
              </span>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -17],
        })

        sightings.forEach((sighting) => {
          const popupContent = `
            <div style="font-family:inherit; min-width:210px; padding:2px;">
              <div style="display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; color:#ea580c; background:#fff7ed; border-radius:4px; padding:2px 6px; margin-bottom:5px; text-transform:uppercase;">
                <span>⚠️</span> Unverified Community Sighting
              </div>
              <p style="font-weight:700; font-size:13px; color:#0b1b35; margin:0 0 2px 0;">Third-Party Finder Report</p>
              <p style="font-size:11px; color:#60738c; margin:0 0 6px 0;">${sighting.notes || 'Reported via anonymous QR beacon'}</p>
              <div style="font-size:10px; color:#8192a8; border-top:1px solid #eef3f9; padding-top:4px;">
                Coordinates: ${sighting.latitude.toFixed(5)}, ${sighting.longitude.toFixed(5)}<br/>
                Reported: ${formatTimestamp(sighting.reported_at)}<br/>
                Accuracy: ${sighting.accuracy ? `${sighting.accuracy}m` : 'Standard'}
              </div>
              <p style="margin-top:6px; font-size:9px; color:#9a3412; font-style:italic;">
                Notice: This location was submitted by a third party and is not verified by device hardware.
              </p>
            </div>
          `

          const marker = L.marker([sighting.latitude, sighting.longitude], { icon: sightingIcon }).addTo(map)
          marker.bindPopup(popupContent)
          sightingMarkersRef.current.push(marker)
        })
      }
    } catch (err) {
      console.error('Leaflet map rendering error:', err)
    }
  }, [mapLoaded, hasAnyCoordinates, hasDeviceCoordinates, hasSightingCoordinates, lat, lng, device, sightings, showSightings])

  const handleRecenter = () => {
    if (mapInstanceRef.current && hasAnyCoordinates) {
      mapInstanceRef.current.setView([lat, lng], 15, { animate: true })
    }
  }

  const handleFitAll = () => {
    if (!mapInstanceRef.current || !(window as any).L) return
    const L = (window as any).L
    const points: [number, number][] = []

    if (hasDeviceCoordinates) {
      points.push([device!.latitude!, device!.longitude!])
    }
    if (showSightings) {
      sightings.forEach((s) => points.push([s.latitude, s.longitude]))
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points)
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    }
  }

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn()
  }

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut()
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#dce8f6] bg-[#f8fbff] ${className} ${
        isFullscreen ? 'fixed inset-4 z-50 rounded-2xl shadow-2xl' : ''
      }`}
    >
      {/* Top Header Bar */}
      <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/80 bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-lg bg-[#edf4ff] text-[#1463ff]">
            <MapPin className="size-3.5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#0b1b35]">
                {device?.name ?? 'Device Location Map'}
              </span>
              {hasDeviceCoordinates ? (
                <span className="inline-flex items-center gap-1 rounded bg-[#e8f5e9] px-1.5 py-0.5 text-[10px] font-bold text-[#2e7d32]">
                  <ShieldCheck className="size-2.5" /> Hardware GPS Verified
                </span>
              ) : hasSightingCoordinates ? (
                <span className="inline-flex items-center gap-1 rounded bg-[#fff7ed] px-1.5 py-0.5 text-[10px] font-bold text-[#c2410c]">
                  <ShieldAlert className="size-2.5" /> Unverified Sighting Only
                </span>
              ) : null}
            </div>
            <span className="text-[#71839a]">
              {hasDeviceCoordinates
                ? device?.last_location_name
                : hasSightingCoordinates
                ? 'No hardware GPS — displaying crowd sighting'
                : 'No GPS coordinates recorded'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {sightings.length > 0 && (
            <button
              onClick={() => setShowSightings((v) => !v)}
              title={showSightings ? 'Hide unverified sightings' : 'Show unverified sightings'}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                showSightings
                  ? 'bg-[#fff7ed] text-[#c2410c] hover:bg-[#ffedd5]'
                  : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
              }`}
            >
              {showSightings ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
              <span>{sightings.length} Sighting{sightings.length > 1 ? 's' : ''}</span>
            </button>
          )}

          {hasAnyCoordinates && (
            <button
              onClick={handleRecenter}
              title="Recenter Map"
              className="rounded-lg p-1.5 text-[#60738c] hover:bg-[#edf4ff] hover:text-[#1463ff]"
            >
              <Navigation className="size-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="rounded-lg p-1.5 text-[#60738c] hover:bg-[#edf4ff] hover:text-[#1463ff]"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Outdated Device GPS Alert Banner */}
      {hasDeviceCoordinates && isOutdated && (
        <div className="absolute left-3 right-3 top-16 z-10 flex items-center gap-2 rounded-xl border border-[#fed7d7] bg-[#fff5f5]/95 px-3 py-1.5 text-[11px] font-medium text-[#c53030] shadow-sm backdrop-blur">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>
            Verified hardware GPS is over 24 hours old. Live updates require the phone to be online and checked in.
          </span>
        </div>
      )}

      {/* Map Canvas / Container */}
      {hasAnyCoordinates ? (
        <div ref={mapContainerRef} className="h-full min-h-[280px] w-full" />
      ) : (
        /* Empty / Unavailable State */
        <div className="flex h-full min-h-[280px] flex-col items-center justify-center p-6 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-[#edf4ff] text-[#1463ff]">
            <MapPin className="size-7" />
          </div>
          <h3 className="mt-4 font-semibold text-[#0b1b35]">Location Unavailable</h3>
          <p className="mt-1.5 max-w-sm text-xs leading-5 text-[#71839a]">
            {device
              ? `No check-in coordinates have been recorded for ${device.name} yet. RETRACE only captures location when you explicitly check in or when a good Samaritan scans your QR beacon.`
              : 'Select a registered device to view its last known location.'}
          </p>
          {onCheckInRequested && (
            <button
              onClick={onCheckInRequested}
              disabled={isCheckingIn}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1463ff] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0f4fd8] disabled:opacity-60"
            >
              <Navigation className={`size-3.5 ${isCheckingIn ? 'animate-spin' : ''}`} />
              {isCheckingIn ? 'Checking in...' : 'Check in current location (Browser GPS)'}
            </button>
          )}
        </div>
      )}

      {/* Floating Zoom Controls (when coordinates exist) */}
      {hasAnyCoordinates && (
        <div className="absolute bottom-4 right-4 z-10 flex flex-col overflow-hidden rounded-xl border border-[#dce8f6] bg-white shadow-md">
          <button
            onClick={handleZoomIn}
            className="px-2.5 py-1.5 text-xs font-bold text-[#27405e] hover:bg-[#f4f8ff]"
            aria-label="Zoom in"
          >
            +
          </button>
          <div className="h-px bg-[#eef3f9]" />
          <button
            onClick={handleZoomOut}
            className="px-2.5 py-1.5 text-xs font-bold text-[#27405e] hover:bg-[#f4f8ff]"
            aria-label="Zoom out"
          >
            &minus;
          </button>
        </div>
      )}

      {/* Bottom Legend & Coordinates Bar */}
      {hasAnyCoordinates && (
        <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2 rounded-lg bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-[#27405e] shadow-sm backdrop-blur">
          {hasDeviceCoordinates && (
            <span className="inline-flex items-center gap-1 text-[#1463ff]">
              <span className="size-2 rounded-full bg-[#1463ff]" />
              Verified GPS: {device!.latitude!.toFixed(4)}, {device!.longitude!.toFixed(4)}
            </span>
          )}
          {hasDeviceCoordinates && sightings.length > 0 && <span className="text-[#cbd5e1]">|</span>}
          {sightings.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[#ea580c]">
              <span className="size-2 rounded-full bg-[#ea580c]" />
              {sightings.length} Unverified Sighting{sightings.length > 1 ? 's' : ''} (Third-Party)
            </span>
          )}
          <span className="text-[#cbd5e1]">·</span>
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#1463ff] hover:underline"
          >
            OpenStreetMap <ExternalLink className="size-2.5" />
          </a>
        </div>
      )}
    </div>
  )
}
