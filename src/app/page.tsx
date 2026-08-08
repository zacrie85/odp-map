'use client'

import { useState, useEffect, useCallback } from 'react'
import { Menu, MapPin, X, PanelRightClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import FilterSidebar from '@/components/map/FilterSidebar'
import ODPDetailPanel from '@/components/map/ODPDetailPanel'
import GoogleEarthDialog from '@/components/map/GoogleEarthDialog'
import UploadExcelDialog from '@/components/map/UploadExcelDialog'
import { useFirebasePresence, useFirebaseCleanup } from '@/lib/useFirebasePresence'

const ODPMap = dynamic(() => import('@/components/map/ODPMap'), { ssr: false })

interface ODPData {
  id: string; code: string; name: string; kelurahan: string; kecamatan: string
  city: string; region: string; province: string; status: string; availability: string
  capacity: number; totalAssigned: number; active: number; terminate: number
  undetected: number; availableCnt: number; oltIp: string; onuCard: string
  locationType: string; odcCode: string; odcName: string; odcPortNo: string
  rfsDate: string; address: string; coordinate: string; latitude: number; longitude: number
  installStatus: string; usageFor: string; vendor: string; description: string
  odpOwner: string; provider: string; modifyDate: string; modifyBy: string
  createDate: string; createBy: string
}

interface FilterConfig {
  region: string[]
  codeSearch: string
  activeRanges: string[]
  capacityRanges: string[]
  kecamatan: string[]
  hasCoord: string      // '' | 'true' | 'false'
  odpOwner: string[]
  installStatus: string[]
  customField: string  // selected field name for custom column
  customValues: string[]
  search: string
}

interface Stats {
  total: number
  withCoord: number
  withoutCoord: number
  statusStats: { value: string; count: number }[]
  kecamatanList: { value: string; count: number }[]
  regionList: { value: string; count: number }[]
  odpOwnerList: { value: string; count: number }[]
  installStatusList: { value: string; count: number }[]
  activeRangeList: { value: string; count: number }[]
  capacityRangeList: { value: string; count: number }[]
  capacityStats: { _sum: { capacity: number; totalAssigned: number; active: number; terminate: number; availableCnt: number } }
}

const defaultFilters: FilterConfig = {
  region: [],
  codeSearch: '',
  activeRanges: [],
  capacityRanges: [],
  kecamatan: [],
  hasCoord: '',
  odpOwner: [],
  installStatus: [],
  customField: '',
  customValues: [],
  search: '',
}

export default function Home() {
  const [odps, setOdps] = useState<ODPData[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedOdp, setSelectedOdp] = useState<ODPData | null>(null)
  const [activeUsers, setActiveUsers] = useState(1)

  // Firebase Realtime Database: pengguna online
  const firebasePresence = useFirebasePresence()
  useFirebaseCleanup() // auto-cleanup stale users

  // Sync Firebase presence count ke state
  useEffect(() => {
    if (firebasePresence.activeUsers > 0) {
      setActiveUsers(firebasePresence.activeUsers)
    }
  }, [firebasePresence.activeUsers])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [earthDialogOpen, setEarthDialogOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [filters, setFilters] = useState<FilterConfig>(defaultFilters)

  const refreshData = useCallback(() => {
    // Re-fetch ODP data and stats
    fetch('/api/odp/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {})
    const params = new URLSearchParams()
    params.set('limit', '20000')
    if (filters.region.length > 0) params.set('region', filters.region.join(','))
    if (filters.codeSearch) params.set('codeSearch', filters.codeSearch)
    if (filters.activeRanges.length > 0) params.set('activeRanges', filters.activeRanges.join(','))
    if (filters.capacityRanges.length > 0) params.set('capacityRanges', filters.capacityRanges.join(','))
    if (filters.kecamatan.length > 0) params.set('kecamatan', filters.kecamatan.join(','))
    if (filters.hasCoord) params.set('hasCoord', filters.hasCoord)
    if (filters.odpOwner.length > 0) params.set('odpOwner', filters.odpOwner.join(','))
    if (filters.installStatus.length > 0) params.set('installStatus', filters.installStatus.join(','))
    if (filters.customField && filters.customValues.length > 0) {
      params.set('customField', filters.customField)
      params.set('customValues', filters.customValues.join(','))
    }
    if (filters.search) params.set('search', filters.search)
    fetch(`/api/odp?${params}`)
      .then(r => r.json())
      .then(data => setOdps(data.data || []))
      .catch(() => {})
  }, [filters])

  useEffect(() => {
    fetch('/api/odp/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(err => console.error('Stats error:', err))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '20000')
    if (filters.region.length > 0) params.set('region', filters.region.join(','))
    if (filters.codeSearch) params.set('codeSearch', filters.codeSearch)
    if (filters.activeRanges.length > 0) params.set('activeRanges', filters.activeRanges.join(','))
    if (filters.capacityRanges.length > 0) params.set('capacityRanges', filters.capacityRanges.join(','))
    if (filters.kecamatan.length > 0) params.set('kecamatan', filters.kecamatan.join(','))
    if (filters.hasCoord) params.set('hasCoord', filters.hasCoord)
    if (filters.odpOwner.length > 0) params.set('odpOwner', filters.odpOwner.join(','))
    if (filters.installStatus.length > 0) params.set('installStatus', filters.installStatus.join(','))
    if (filters.customField && filters.customValues.length > 0) {
      params.set('customField', filters.customField)
      params.set('customValues', filters.customValues.join(','))
    }
    if (filters.search) params.set('search', filters.search)

    fetch(`/api/odp?${params}`)
      .then(r => r.json())
      .then(data => {
        setOdps(data.data || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('ODP fetch error:', err)
        setLoading(false)
        toast.error('Gagal memuat data ODP')
      })
  }, [filters])

  const handleSelectOdp = useCallback((odp: ODPData | null) => setSelectedOdp(odp), [])
  const handleFiltersChange = useCallback((newFilters: FilterConfig) => {
    setFilters(newFilters)
    setSelectedOdp(null)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      <div className="lg:hidden flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">ODP Map Viewer</h1>
            <p className="text-[10px] text-slate-400">Real-time KMZ Viewer</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileSidebar(!mobileSidebar)}>
          <Menu className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {mobileSidebar && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileSidebar(false)} />
            <div className="relative z-50 w-80 h-full">
              <FilterSidebar filters={filters} onFiltersChange={(f) => { handleFiltersChange(f); setMobileSidebar(false) }} stats={stats} totalResults={odps.length} activeUsers={activeUsers} onClose={() => setMobileSidebar(false)} onOpenEarthDialog={() => setEarthDialogOpen(true)} onOpenUploadDialog={() => setUploadDialogOpen(true)} />
            </div>
          </div>
        )}

        {sidebarOpen && (
          <div className="hidden lg:block shrink-0">
            <FilterSidebar filters={filters} onFiltersChange={handleFiltersChange} stats={stats} totalResults={odps.length} activeUsers={activeUsers} onOpenEarthDialog={() => setEarthDialogOpen(true)} onOpenUploadDialog={() => setUploadDialogOpen(true)} />
          </div>
        )}

        <div className="flex-1 relative min-h-0 min-w-0">
          {!sidebarOpen && (
            <Button variant="outline" size="icon" className="absolute top-4 left-4 z-[1000] h-9 w-9 bg-white shadow-lg" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-4 h-4" />
            </Button>
          )}
          {sidebarOpen && (
            <Button variant="outline" size="icon" className="hidden lg:flex absolute top-4 left-[calc(24rem+1rem)] xl:left-[calc(26rem+1rem)] z-[1000] h-9 w-9 bg-white shadow-lg" onClick={() => setSidebarOpen(false)}>
              <PanelRightClose className="w-4 h-4" />
            </Button>
          )}

          <ODPMap odps={odps} loading={loading} selectedOdp={selectedOdp} onSelectOdp={handleSelectOdp} searchQuery={filters.search} activeUsers={activeUsers} />

          {selectedOdp && (
            <div className="hidden md:block absolute right-0 top-0 h-full z-[999]">
              <ODPDetailPanel odp={selectedOdp} onClose={() => setSelectedOdp(null)} onUpdated={refreshData} />
            </div>
          )}
          {selectedOdp && (
            <div className="md:hidden absolute bottom-0 left-0 right-0 z-[999] max-h-[60vh] overflow-y-auto rounded-t-2xl shadow-2xl bg-white">
              <div className="flex justify-center py-2"><div className="w-10 h-1 rounded-full bg-slate-300" /></div>
              <ODPDetailPanel odp={selectedOdp} onClose={() => setSelectedOdp(null)} onUpdated={refreshData} />
            </div>
          )}
        </div>
      </div>

      {/* Google Earth Dialog */}
      <GoogleEarthDialog
        open={earthDialogOpen}
        onOpenChange={setEarthDialogOpen}
        filters={filters}
        filteredCount={odps.length}
        totalCount={stats?.total ?? 0}
      />

      {/* Upload Excel Dialog */}
      <UploadExcelDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={refreshData}
      />
    </div>
  )
}
