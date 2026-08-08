'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// Dynamic imports for leaflet (avoid SSR issues)
let L: typeof import('leaflet') | null = null

async function loadLeaflet() {
  if (L) return L
  const leaflet = await import('leaflet')
  L = leaflet.default
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
  return L
}

// 3-segment color based on Active/Capacity percentage
// Merah: 75-100%, Kuning: 50-74%, Biru: 0-49%
function getUsageColor(active: number, capacity: number): string {
  if (capacity <= 0) return '#3b82f6' // Biru - no capacity data
  const pct = (active / capacity) * 100
  if (pct >= 75) return '#ef4444' // Merah - tingkat penggunaan tinggi
  if (pct >= 50) return '#eab308' // Kuning - tingkat penggunaan sedang
  return '#3b82f6'               // Biru - tingkat penggunaan rendah
}

const LABEL_SHOW_ZOOM = 13
const MAX_LABELS = 500

interface ODPData {
  id: string
  code: string
  name: string
  kelurahan: string
  kecamatan: string
  city: string
  region: string
  province: string
  status: string
  availability: string
  capacity: number
  totalAssigned: number
  active: number
  terminate: number
  undetected: number
  availableCnt: number
  oltIp: string
  onuCard: string
  locationType: string
  odcCode: string
  odcName: string
  odcPortNo: string
  rfsDate: string
  address: string
  coordinate: string
  latitude: number
  longitude: number
  installStatus: string
  usageFor: string
  vendor: string
  description: string
  odpOwner: string
  provider: string
  modifyDate: string
  modifyBy: string
  createDate: string
  createBy: string
}

interface ODPMapProps {
  odps: ODPData[]
  loading: boolean
  selectedOdp: ODPData | null
  onSelectOdp: (odp: ODPData | null) => void
  searchQuery: string
  activeUsers: number
}

export default function ODPMap({ odps, loading, selectedOdp, onSelectOdp, searchQuery, activeUsers }: ODPMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const dotLayerRef = useRef<any>(null)
  const labelLayerRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())

  const [mapError, setMapError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const odpsRef = useRef(odps)
  useEffect(() => { odpsRef.current = odps }, [odps])

  const stableSelectOdp = useCallback((odp: ODPData | null) => {
    onSelectOdp(odp)
  }, [onSelectOdp])

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let destroyed = false

    async function initMap() {
      try {
        const leaflet = await loadLeaflet()
        if (destroyed || !containerRef.current) return

        if (!document.querySelector('link[data-leaflet-css]')) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          link.setAttribute('data-leaflet-css', 'true')
          document.head.appendChild(link)
          await new Promise(r => setTimeout(r, 100))
        }

        if (destroyed || !containerRef.current) return

        const map = leaflet.map(containerRef.current, {
          center: [-6.2, 106.45],
          zoom: 11,
          zoomControl: false,
          preferCanvas: true,
        })

        leaflet.control.zoom({ position: 'topright' }).addTo(map)

        leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          maxZoom: 19,
        }).addTo(map)

        const dotLayer = leaflet.layerGroup().addTo(map)
        const labelLayer = leaflet.layerGroup().addTo(map)

        map.fitBounds([[-6.4, 106.2], [-6.0, 106.7]])

        if (!destroyed) {
          mapRef.current = map
          dotLayerRef.current = dotLayer
          labelLayerRef.current = labelLayer
          setMapReady(true)
        }
      } catch (err) {
        console.error('Map init error:', err)
        if (!destroyed) setMapError('Gagal memuat peta')
      }
    }

    initMap()

    return () => {
      destroyed = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        dotLayerRef.current = null
        labelLayerRef.current = null
        markersRef.current.clear()
      }
    }
  }, [])

  // Firebase presence is handled by parent (page.tsx)
  // Socket.io removed for Vercel compatibility

  // Update dot markers when ODPs change
  useEffect(() => {
    if (!mapReady || !dotLayerRef.current || !L) return

    const layer = dotLayerRef.current
    layer.clearLayers()
    markersRef.current.clear()

    for (const odp of odpsRef.current) {
      if (odp.latitude === 0 && odp.longitude === 0) continue

      const color = getUsageColor(odp.active, odp.capacity)
      const isSelected = selectedOdp?.id === odp.id
      const radius = isSelected ? 7 : 4

      const marker = L!.circleMarker([odp.latitude, odp.longitude], {
        radius,
        fillColor: color,
        color: isSelected ? '#ffffff' : color,
        weight: isSelected ? 3 : 1,
        opacity: 1,
        fillOpacity: isSelected ? 1 : 0.7,
      })

      const usagePercent = odp.capacity > 0 ? Math.round((odp.totalAssigned / odp.capacity) * 100) : 0
      const activePercent = odp.capacity > 0 ? Math.round((odp.active / odp.capacity) * 100) : 0
      const availColor = odp.availability === 'AVAILABLE' ? '#22c55e' : odp.availability === 'FULL' ? '#ef4444' : '#f59e0b'
      const statusColor = odp.status === 'ENABLE' ? '#22c55e' : '#ef4444'

      marker.bindPopup(
        `<div style="min-width:220px;font-family:system-ui,-apple-system,sans-serif;">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#1e293b;">${odp.code} <span style="font-size:12px;color:${color};font-weight:700;">${odp.active}/${odp.capacity} (${activePercent}%)</span></div>
          <div style="font-size:11px;color:#64748b;margin-bottom:8px;line-height:1.4;">${odp.name}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;font-size:11px;">
            <div><b>Status:</b> <span style="color:${statusColor};font-weight:600;">${odp.status}</span></div>
            <div><b>Avail:</b> <span style="color:${availColor};font-weight:600;">${odp.availability}</span></div>
            <div><b>Kecamatan:</b> ${odp.kecamatan}</div>
            <div><b>Vendor:</b> ${odp.vendor}</div>
          </div>
          <div style="margin-top:8px;background:#f1f5f9;border-radius:6px;padding:6px 8px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
              <span>Active/Cap: ${odp.active}/${odp.capacity}</span>
              <span style="font-weight:600;color:${color};">${activePercent}%</span>
            </div>
            <div style="background:#e2e8f0;border-radius:3px;height:6px;overflow:hidden;">
              <div style="background:${color};height:100%;width:${activePercent}%;border-radius:3px;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:3px;">
              <span>Assigned: ${odp.totalAssigned} | Terminate: ${odp.terminate}</span>
              <span>Tersedia: ${odp.availableCnt}</span>
            </div>
          </div>
          <div style="margin-top:6px;font-size:10px;color:#94a3b8;">${odp.coordinate}</div>
        </div>`,
        { maxWidth: 300 }
      )

      marker.on('click', () => stableSelectOdp(odp))
      layer.addLayer(marker)
      markersRef.current.set(odp.code, marker)
    }
  }, [mapReady, selectedOdp, stableSelectOdp, odps.length])

  // Manage label layer based on zoom
  useEffect(() => {
    if (!mapReady || !mapRef.current || !labelLayerRef.current || !L) return
    const map = mapRef.current
    const labelLayer = labelLayerRef.current

    const updateLabelVisibility = () => {
      const z = map.getZoom()
      const shouldShow = z >= LABEL_SHOW_ZOOM
      setShowLabels(shouldShow)

      if (!shouldShow) {
        labelLayer.clearLayers()
        return
      }

      // Only show labels for markers in viewport (with padding)
      const bounds = map.getBounds().pad(0.2)
      labelLayer.clearLayers()

      let count = 0
      for (const odp of odpsRef.current) {
        if (odp.latitude === 0 && odp.longitude === 0) continue
        if (count >= MAX_LABELS) break
        if (!bounds.contains([odp.latitude, odp.longitude])) continue

        const color = getUsageColor(odp.active, odp.capacity)
        const html = `<div style="position:relative;white-space:nowrap;font-size:9px;font-weight:600;color:#1e293b;text-shadow:1px 1px 1px #fff,-1px -1px 1px #fff,1px -1px 1px #fff,-1px 1px 1px #fff,0 0 3px #fff,0 0 5px #fff;pointer-events:none;line-height:1;">${odp.code} <span style="color:${color};font-weight:700;">${odp.active}/${odp.capacity}</span></div>`

        const icon = L!.divIcon({
          html,
          className: '',
          iconSize: [0, 0],
          iconAnchor: [0, -6],
        })

        const labelMarker = L!.marker([odp.latitude, odp.longitude], {
          icon,
          interactive: false,
          keyboard: false,
        })

        labelLayer.addLayer(labelMarker)
        count++
      }
    }

    updateLabelVisibility()
    map.on('zoomend', updateLabelVisibility)
    map.on('moveend', updateLabelVisibility)

    return () => {
      map.off('zoomend', updateLabelVisibility)
      map.off('moveend', updateLabelVisibility)
      labelLayer.clearLayers()
    }
  }, [mapReady, odps.length])

  // Highlight selected ODP
  useEffect(() => {
    if (!mapRef.current || !selectedOdp) return
    const marker = markersRef.current.get(selectedOdp.code)
    if (marker) {
      mapRef.current.setView([selectedOdp.latitude, selectedOdp.longitude], 16, { animate: true })
      setTimeout(() => marker.openPopup(), 300)
    }
  }, [selectedOdp])

  // Search: fly to first result
  useEffect(() => {
    if (!searchQuery || !odpsRef.current.length || !mapRef.current) return
    const first = odpsRef.current[0]
    if (first && first.latitude !== 0) {
      mapRef.current.setView([first.latitude, first.longitude], 15, { animate: true })
    }
  }, [searchQuery])

  if (mapError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
        <div className="text-center p-8">
          <div className="text-4xl mb-3">🗺️</div>
          <p className="text-slate-500">{mapError}</p>
          <button 
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
            onClick={() => window.location.reload()}
          >
            Muat Ulang
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="w-full h-full" />

      {/* Zoom hint for labels */}
      {!showLabels && mapReady && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-sm rounded-full shadow-lg px-4 py-1.5 text-xs text-slate-500 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
          Zoom in untuk melihat label ODP
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs">
        <div className="font-semibold text-slate-700 mb-2">Active / Capacity</div>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" />
          <span className="text-slate-600">0% - 49% (Rendah)</span>
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm" />
          <span className="text-slate-600">50% - 74% (Sedang)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
          <span className="text-slate-600">75% - 100% (Tinggi)</span>
        </div>
      </div>

      {/* Active users indicator */}
      <div className="absolute top-4 right-14 z-[1000] flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-full shadow-lg px-3 py-1.5 text-xs">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-slate-600 font-medium">{activeUsers} online</span>
      </div>

      {/* Loading overlay */}
      {loading && !mapReady && (
        <div className="absolute inset-0 z-[1001] bg-white/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-600 font-medium">Memuat data ODP...</span>
          </div>
        </div>
      )}
    </div>
  )
}
