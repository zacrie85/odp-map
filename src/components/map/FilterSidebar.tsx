'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Search, X, ChevronDown, ChevronUp, Users, MapPin, Activity,
  Database, Globe, UserCircle, Wrench, Hash, BarChart3, Crosshair, Settings2, ArrowUpFromLine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

interface FilterConfig {
  region: string[]
  codeSearch: string
  activeRanges: string[]
  capacityRanges: string[]
  kecamatan: string[]
  hasCoord: string
  odpOwner: string[]
  installStatus: string[]
  customField: string
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

interface FilterSidebarProps {
  filters: FilterConfig
  onFiltersChange: (filters: FilterConfig) => void
  stats: Stats | null
  totalResults: number
  activeUsers: number
  onClose?: () => void
  onOpenEarthDialog?: () => void
  onOpenUploadDialog?: () => void
}

// ─── Reusable sub-components ───

function FilterItem({ value, count, checked, onToggle, colorDot }: {
  value: string; count: number; checked: boolean; onToggle: () => void; colorDot?: string
}) {
  return (
    <label className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${checked ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-600'}`}>
      <Checkbox checked={checked} onCheckedChange={onToggle} className="h-3.5 w-3.5 border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
      {colorDot && <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorDot}`} />}
      <span className="truncate flex-1 text-left">{value || 'Tidak Diketahui'}</span>
      <span className={`text-[11px] shrink-0 tabular-nums ${checked ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>{count.toLocaleString()}</span>
    </label>
  )
}

function SectionHeader({ icon, label, count, expanded, onToggle }: {
  icon: React.ReactNode; label: string; count: number; expanded: boolean; onToggle: () => void
}) {
  return (
    <button className="flex items-center justify-between w-full text-sm font-semibold text-slate-700 mb-2" onClick={onToggle}>
      <div className="flex items-center gap-2">
        {icon}
        {label}
        {count > 0 && <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-emerald-100 text-emerald-700 border-0">{count}</Badge>}
      </div>
      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  )
}

function SearchableList({ placeholder, searchValue, onSearchChange, children }: {
  placeholder: string; searchValue: string; onSearchChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <div>
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <Input placeholder={placeholder} className="pl-8 h-7 text-xs" value={searchValue} onChange={(e) => onSearchChange(e.target.value)} />
      </div>
      <div className="max-h-44 overflow-y-auto space-y-0.5">{children}</div>
    </div>
  )
}

// ─── Color maps ───
const activeColorMap: Record<string, string> = {
  '0': 'bg-slate-400', '1 - 5': 'bg-blue-500', '6 - 10': 'bg-cyan-500',
  '11 - 20': 'bg-amber-500', '21 - 50': 'bg-orange-500', '51 +': 'bg-red-500',
}
const capacityColorMap: Record<string, string> = {
  'Kosong (0%)': 'bg-slate-400', 'Rendah (1-50%)': 'bg-green-500',
  'Sedang (51-80%)': 'bg-amber-500', 'Tinggi (81-99%)': 'bg-orange-500', 'Penuh (100%)': 'bg-red-500',
}

// ─── Main Component ───

export default function FilterSidebar({ filters, onFiltersChange, stats, totalResults, activeUsers, onClose, onOpenEarthDialog, onOpenUploadDialog }: FilterSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    region: true, code: true, active: true, capacity: false,
    kecamatan: true, coordinate: false, odpOwner: false,
    installStatus: false, custom: false, search: false,
  })
  const [sectionSearch, setSectionSearch] = useState<Record<string, string>>({})
  // Custom field data
  const [customFields, setCustomFields] = useState<{ value: string; label: string }[]>([])
  const [customFieldData, setCustomFieldData] = useState<{ value: string; count: number }[]>([])
  const [customLoading, setCustomLoading] = useState(false)

  // Load available custom fields on mount
  useEffect(() => {
    fetch('/api/odp/field-values')
      .then(r => r.json())
      .then(data => setCustomFields(data))
      .catch(() => {})
  }, [])

  // Load custom field values when field changes
  useEffect(() => {
    if (!filters.customField) {
      setCustomFieldData([])
      return
    }
    setCustomLoading(true)
    fetch(`/api/odp/field-values?field=${filters.customField}`)
      .then(r => r.json())
      .then(data => {
        setCustomFieldData(Array.isArray(data) ? data : [])
        setCustomLoading(false)
      })
      .catch(() => setCustomLoading(false))
  }, [filters.customField])

  const toggleSection = (s: string) => setExpandedSections(p => ({ ...p, [s]: !p[s] }))

  const clearFilters = () => {
    onFiltersChange({
      region: [], codeSearch: '', activeRanges: [], capacityRanges: [],
      kecamatan: [], hasCoord: '', odpOwner: [], installStatus: [],
      customField: '', customValues: [], search: '',
    })
    setSectionSearch({})
  }

  const activeFilterCount = useMemo(() => {
    let c = 0
    if (filters.region.length) c++
    if (filters.codeSearch) c++
    if (filters.activeRanges.length) c++
    if (filters.capacityRanges.length) c++
    if (filters.kecamatan.length) c++
    if (filters.hasCoord) c++
    if (filters.odpOwner.length) c++
    if (filters.installStatus.length) c++
    if (filters.customValues.length) c++
    if (filters.search) c++
    return c
  }, [filters])

  const totalSelectedItems = useMemo(() =>
    filters.region.length + filters.activeRanges.length + filters.capacityRanges.length +
    filters.kecamatan.length + filters.odpOwner.length + filters.installStatus.length + filters.customValues.length
  , [filters])

  const toggleArrayFilter = (field: keyof FilterConfig, value: string) => {
    const current = filters[field] as string[]
    const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    onFiltersChange({ ...filters, [field]: updated })
  }

  const filterBySearch = (data: { value: string; count: number }[], key: string) => {
    const q = sectionSearch[key]?.toLowerCase() || ''
    if (!q) return data
    return data.filter(d => d.value.toLowerCase().includes(q))
  }

  const cap = stats?.capacityStats?._sum

  return (
    <div className="w-full lg:w-80 xl:w-96 bg-white border-r border-slate-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">ODP Map Viewer</h1>
              <p className="text-[10px] text-slate-400">Real-time KMZ Viewer</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {activeFilterCount > 0 && <Badge className="h-5 px-1.5 text-[10px] bg-emerald-500 text-white border-0">{activeFilterCount}</Badge>}
            {onClose && <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={onClose}><X className="w-4 h-4" /></Button>}
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2">
          <div className="flex -space-x-1.5">
            <div className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white" />
            {activeUsers > 1 && <div className="w-5 h-5 rounded-full bg-teal-500 border-2 border-white" />}
          </div>
          <span className="text-xs text-emerald-700 font-medium">{activeUsers} pengguna online</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-auto" />
        </div>

        {/* Google Earth Button */}
        <div className="mt-2 flex gap-2">
          <button
            onClick={onOpenEarthDialog}
            className="flex-1 flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left"
          >
            <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center shrink-0">
              <Globe className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-blue-800">Google Earth</div>
              <div className="text-[10px] text-blue-500">KML auto-refresh</div>
            </div>
          </button>
          <button
            onClick={onOpenUploadDialog}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors text-left"
          >
            <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center shrink-0">
              <ArrowUpFromLine className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-emerald-800">Upload</div>
              <div className="text-[10px] text-emerald-500">Excel</div>
            </div>
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1"><Database className="w-3 h-3 text-slate-400" /><span className="text-[10px] text-slate-400 uppercase tracking-wide">Total ODP</span></div>
                <div className="text-lg font-bold text-slate-800">{stats.total.toLocaleString()}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1"><MapPin className="w-3 h-3 text-slate-400" /><span className="text-[10px] text-slate-400 uppercase tracking-wide">Ditampilkan</span></div>
                <div className="text-lg font-bold text-emerald-600">{totalResults.toLocaleString()}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1"><Activity className="w-3 h-3 text-slate-400" /><span className="text-[10px] text-slate-400 uppercase tracking-wide">Aktif</span></div>
                <div className="text-lg font-bold text-blue-600">{cap?.active?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1"><Users className="w-3 h-3 text-slate-400" /><span className="text-[10px] text-slate-400 uppercase tracking-wide">Kapasitas</span></div>
                <div className="text-sm font-bold text-slate-800">{cap?.totalAssigned?.toLocaleString() || 0}/{cap?.capacity?.toLocaleString() || 0}</div>
              </div>
            </div>
          )}

          {cap && cap.capacity > 0 && (
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-500">Penggunaan Kapasitas</span>
                <span className="font-semibold text-slate-700">{Math.round((cap.totalAssigned / cap.capacity) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div className="h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all" style={{ width: `${Math.min(100, (cap.totalAssigned / cap.capacity) * 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Terpakai: {cap.totalAssigned?.toLocaleString()}</span>
                <span>Tersedia: {cap.availableCnt?.toLocaleString()}</span>
              </div>
            </div>
          )}

          <Separator />

          {/* ═══════════════════════════════════════════════
              1. REGION FILTER
          ═══════════════════════════════════════════════ */}
          <div>
            <SectionHeader icon={<Globe className="w-4 h-4" />} label="Region" count={filters.region.length} expanded={expandedSections.region} onToggle={() => toggleSection('region')} />
            {expandedSections.region && (
              <SearchableList placeholder="Cari region..." searchValue={sectionSearch.region || ''} onSearchChange={(v) => setSectionSearch(p => ({ ...p, region: v }))}>
                {filterBySearch(stats?.regionList || [], 'region').map(r => (
                  <FilterItem key={r.value || '_empty'} value={r.value} count={r.count} checked={filters.region.includes(r.value)} onToggle={() => toggleArrayFilter('region', r.value)} />
                ))}
              </SearchableList>
            )}
          </div>

          <Separator />

          {/* ═══════════════════════════════════════════════
              2. CODE SEARCH FILTER
          ═══════════════════════════════════════════════ */}
          <div>
            <SectionHeader icon={<Hash className="w-4 h-4" />} label="Code" count={filters.codeSearch ? 1 : 0} expanded={expandedSections.code} onToggle={() => toggleSection('code')} />
            {expandedSections.code && (
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Cari kode ODP..." className="pl-9 h-9 text-sm" value={filters.codeSearch} onChange={(e) => onFiltersChange({ ...filters, codeSearch: e.target.value })} />
                {filters.codeSearch && (
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => onFiltersChange({ ...filters, codeSearch: '' })}><X className="w-3.5 h-3.5" /></button>
                )}
                <p className="text-[10px] text-slate-400 mt-1.5">Ketik kode ODP untuk memfilter</p>
              </div>
            )}
          </div>

          <Separator />

          {/* ═══════════════════════════════════════════════
              3. ACTIVE RANGE FILTER
          ═══════════════════════════════════════════════ */}
          <div>
            <SectionHeader icon={<Activity className="w-4 h-4" />} label="Active" count={filters.activeRanges.length} expanded={expandedSections.active} onToggle={() => toggleSection('active')} />
            {expandedSections.active && (
              <div className="space-y-0.5">
                {(stats?.activeRangeList || []).map(a => (
                  <FilterItem key={a.value} value={a.value} count={a.count} checked={filters.activeRanges.includes(a.value)} onToggle={() => toggleArrayFilter('activeRanges', a.value)} colorDot={activeColorMap[a.value]} />
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* ═══════════════════════════════════════════════
              4. CAPACITY RANGE FILTER
          ═══════════════════════════════════════════════ */}
          <div>
            <SectionHeader icon={<BarChart3 className="w-4 h-4" />} label="Capacity" count={filters.capacityRanges.length} expanded={expandedSections.capacity} onToggle={() => toggleSection('capacity')} />
            {expandedSections.capacity && (
              <div className="space-y-0.5">
                {(stats?.capacityRangeList || []).map(c => (
                  <FilterItem key={c.value} value={c.value} count={c.count} checked={filters.capacityRanges.includes(c.value)} onToggle={() => toggleArrayFilter('capacityRanges', c.value)} colorDot={capacityColorMap[c.value]} />
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* ═══════════════════════════════════════════════
              5. KECAMATAN FILTER
          ═══════════════════════════════════════════════ */}
          <div>
            <SectionHeader icon={<MapPin className="w-4 h-4" />} label="Kecamatan" count={filters.kecamatan.length} expanded={expandedSections.kecamatan} onToggle={() => toggleSection('kecamatan')} />
            {expandedSections.kecamatan && (
              <SearchableList placeholder="Cari kecamatan..." searchValue={sectionSearch.kecamatan || ''} onSearchChange={(v) => setSectionSearch(p => ({ ...p, kecamatan: v }))}>
                {filterBySearch(stats?.kecamatanList || [], 'kecamatan').map(k => (
                  <FilterItem key={k.value || '_empty'} value={k.value} count={k.count} checked={filters.kecamatan.includes(k.value)} onToggle={() => toggleArrayFilter('kecamatan', k.value)} />
                ))}
              </SearchableList>
            )}
          </div>

          <Separator />

          {/* ═══════════════════════════════════════════════
              6. COORDINATE FILTER
          ═══════════════════════════════════════════════ */}
          <div>
            <SectionHeader icon={<Crosshair className="w-4 h-4" />} label="Coordinate" count={filters.hasCoord ? 1 : 0} expanded={expandedSections.coordinate} onToggle={() => toggleSection('coordinate')} />
            {expandedSections.coordinate && stats && (
              <div className="space-y-0.5">
                <FilterItem
                  value="Ada Koordinat"
                  count={stats.withCoord}
                  checked={filters.hasCoord === 'true'}
                  onToggle={() => onFiltersChange({ ...filters, hasCoord: filters.hasCoord === 'true' ? '' : 'true' })}
                  colorDot="bg-green-500"
                />
                <FilterItem
                  value="Tanpa Koordinat"
                  count={stats.withoutCoord}
                  checked={filters.hasCoord === 'false'}
                  onToggle={() => onFiltersChange({ ...filters, hasCoord: filters.hasCoord === 'false' ? '' : 'false' })}
                  colorDot="bg-slate-400"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* ═══════════════════════════════════════════════
              7. PEMILIK ODP FILTER
          ═══════════════════════════════════════════════ */}
          <div>
            <SectionHeader icon={<UserCircle className="w-4 h-4" />} label="Pemilik ODP" count={filters.odpOwner.length} expanded={expandedSections.odpOwner} onToggle={() => toggleSection('odpOwner')} />
            {expandedSections.odpOwner && (
              <div className="space-y-0.5">
                {(stats?.odpOwnerList || []).map(o => (
                  <FilterItem key={o.value || '_empty'} value={o.value} count={o.count} checked={filters.odpOwner.includes(o.value)} onToggle={() => toggleArrayFilter('odpOwner', o.value)} />
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* ═══════════════════════════════════════════════
              8. STATUS INSTALASI FILTER
          ═══════════════════════════════════════════════ */}
          <div>
            <SectionHeader icon={<Wrench className="w-4 h-4" />} label="Status Instalasi" count={filters.installStatus.length} expanded={expandedSections.installStatus} onToggle={() => toggleSection('installStatus')} />
            {expandedSections.installStatus && (
              <div className="space-y-0.5">
                {(stats?.installStatusList || []).map(i => (
                  <FilterItem key={i.value || '_empty'} value={i.value} count={i.count} checked={filters.installStatus.includes(i.value)} onToggle={() => toggleArrayFilter('installStatus', i.value)} />
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* ═══════════════════════════════════════════════
              9. CUSTOM COLUMN PICKER
          ═══════════════════════════════════════════════ */}
          <div>
            <SectionHeader icon={<Settings2 className="w-4 h-4" />} label="Filter Kustom" count={filters.customValues.length} expanded={expandedSections.custom} onToggle={() => toggleSection('custom')} />
            {expandedSections.custom && (
              <div>
                {/* Field selector dropdown */}
                <div className="mb-2">
                  <select
                    className="w-full h-8 px-3 text-xs border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    value={filters.customField}
                    onChange={(e) => onFiltersChange({ ...filters, customField: e.target.value, customValues: [] })}
                  >
                    <option value="">-- Pilih Kolom --</option>
                    {customFields.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>

                {/* Show values for selected field */}
                {filters.customField && (
                  customLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span className="ml-2 text-xs text-slate-400">Memuat...</span>
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-0.5">
                      {customFieldData.slice(0, 50).map(d => (
                        <FilterItem
                          key={d.value}
                          value={d.value}
                          count={d.count}
                          checked={filters.customValues.includes(d.value)}
                          onToggle={() => {
                            const current = filters.customValues
                            const updated = current.includes(d.value)
                              ? current.filter(v => v !== d.value)
                              : [...current, d.value]
                            onFiltersChange({ ...filters, customValues: updated })
                          }}
                        />
                      ))}
                      {customFieldData.length > 50 && (
                        <p className="px-3 py-1 text-[10px] text-slate-400 italic">+ {customFieldData.length - 50} lainnya...</p>
                      )}
                      {customFieldData.length === 0 && !customLoading && (
                        <p className="px-3 py-2 text-xs text-slate-400">Tidak ada data</p>
                      )}
                    </div>
                  )
                )}

                {!filters.customField && (
                  <p className="text-[10px] text-slate-400 px-1">Pilih kolom di atas untuk menampilkan data yang bisa difilter</p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* SEARCH (at bottom) */}
          <div>
            <SectionHeader icon={<Search className="w-4 h-4" />} label="Pencarian Umum" count={filters.search ? 1 : 0} expanded={expandedSections.search} onToggle={() => toggleSection('search')} />
            {expandedSections.search && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Cari kode, nama, alamat..." className="pl-9 h-9 text-sm" value={filters.search} onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })} />
                {filters.search && (
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => onFiltersChange({ ...filters, search: '' })}><X className="w-3.5 h-3.5" /></button>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer clear button */}
      {activeFilterCount > 0 && (
        <div className="p-4 border-t border-slate-200">
          <Button variant="outline" size="sm" className="w-full" onClick={clearFilters}>
            <X className="w-3 h-3 mr-2" />
            Hapus Semua Filter ({totalSelectedItems} item)
          </Button>
        </div>
      )}
    </div>
  )
}
