'use client'

import { useState } from 'react'
import { X, Copy, Navigation, Pencil, Save, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

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

interface ODPDetailPanelProps {
  odp: ODPData
  onClose: () => void
  onUpdated?: () => void
}

// Editable field definitions
const EDITABLE_FIELDS = [
  { key: 'status', label: 'Status', type: 'select', options: ['ENABLE', 'DISABLE', ''] },
  { key: 'availability', label: 'Ketersediaan', type: 'select', options: ['AVAILABLE', 'FULL', 'NOT AVAILABLE', ''] },
  { key: 'vendor', label: 'Vendor', type: 'text' },
  { key: 'odpOwner', label: 'Pemilik ODP', type: 'text' },
  { key: 'installStatus', label: 'Status Instalasi', type: 'text' },
  { key: 'locationType', label: 'Tipe Lokasi', type: 'text' },
  { key: 'address', label: 'Alamat', type: 'text' },
  { key: 'kelurahan', label: 'Kelurahan', type: 'text' },
  { key: 'kecamatan', label: 'Kecamatan', type: 'text' },
  { key: 'city', label: 'Kota', type: 'text' },
  { key: 'region', label: 'Region', type: 'text' },
  { key: 'odcCode', label: 'ODC Code', type: 'text' },
  { key: 'odcName', label: 'ODC Name', type: 'text' },
  { key: 'oltIp', label: 'OLT IP', type: 'text' },
  { key: 'onuCard', label: 'ONU Card', type: 'text' },
  { key: 'capacity', label: 'Kapasitas', type: 'number' },
  { key: 'totalAssigned', label: 'Total Assigned', type: 'number' },
  { key: 'active', label: 'Aktif', type: 'number' },
  { key: 'terminate', label: 'Terminate', type: 'number' },
  { key: 'availableCnt', label: 'Tersedia', type: 'number' },
  { key: 'description', label: 'Deskripsi', type: 'text' },
]

export default function ODPDetailPanel({ odp, onClose, onUpdated }: ODPDetailPanelProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState<Record<string, any>>({})

  const usagePercent = odp.capacity > 0 ? Math.round((odp.totalAssigned / odp.capacity) * 100) : 0
  const statusColor = odp.status === 'ENABLE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
  const availColor = odp.availability === 'AVAILABLE' ? 'bg-green-100 text-green-700' : odp.availability === 'FULL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Koordinat disalin!')
  }

  const openInGoogleMaps = () => {
    if (odp.latitude && odp.longitude) {
      window.open(`https://www.google.com/maps?q=${odp.latitude},${odp.longitude}`, '_blank')
    }
  }

  const startEdit = () => {
    const initial: Record<string, any> = {}
    for (const f of EDITABLE_FIELDS) {
      initial[f.key] = odp[f.key as keyof ODPData]
    }
    setEditData(initial)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditData({})
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updatePayload: Record<string, any> = { id: odp.id, changedBy: 'web-user' }
      for (const f of EDITABLE_FIELDS) {
        const newVal = editData[f.key]
        const oldVal = odp[f.key as keyof ODPData]
        if (f.type === 'number') {
          if (Number(newVal) !== Number(oldVal)) updatePayload[f.key] = Number(newVal)
        } else {
          if (String(newVal) !== String(oldVal)) updatePayload[f.key] = String(newVal)
        }
      }
      // Only send changed fields
      delete updatePayload.id
      const { id, ...changes } = updatePayload
      if (Object.keys(changes).length === 0) {
        toast.info('Tidak ada perubahan')
        setSaving(false)
        return
      }

      const res = await fetch('/api/odp/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: odp.id, ...changes }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Berhasil update ${data.changes?.length || 0} field`)
        setEditing(false)
        onUpdated?.()
      } else {
        toast.error(data.error || 'Gagal update')
      }
    } catch {
      toast.error('Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const InfoRow = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => {
    if (!value) return null
    return (
      <div className="flex items-start gap-2 py-1">
        <span className="text-xs text-slate-400 min-w-[100px] shrink-0">{label}</span>
        <span className={`text-xs text-slate-700 ${mono ? 'font-mono' : ''}`}>{value}</span>
      </div>
    )
  }

  // Edit mode
  if (editing) {
    return (
      <div className="w-80 xl:w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-xl">
        <div className="p-4 border-b border-slate-200 bg-amber-50">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-800 truncate">Edit: {odp.code}</h2>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">Ubah data lalu klik Simpan</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {EDITABLE_FIELDS.map(f => (
              <div key={f.key}>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    className="w-full h-8 px-2 text-xs border border-slate-200 rounded-md bg-white"
                    value={editData[f.key] || ''}
                    onChange={e => setEditData(p => ({ ...p, [f.key]: e.target.value }))}
                  >
                    <option value="">-- Kosong --</option>
                    {f.options?.filter(Boolean).map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={f.type}
                    className="h-8 text-xs"
                    value={editData[f.key] ?? ''}
                    onChange={e => setEditData(p => ({ ...p, [f.key]: f.type === 'number' ? e.target.value : e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-slate-200 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-9" onClick={cancelEdit} disabled={saving}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Batal
          </Button>
          <Button size="sm" className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
            {saving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </div>
    )
  }

  // View mode
  return (
    <div className="w-80 xl:w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-bold text-slate-800 truncate">{odp.code} <span className="text-sm font-semibold text-slate-500">{odp.active}/{odp.capacity}</span></h2>
              <Badge className={statusColor} variant="secondary">{odp.status}</Badge>
            </div>
            <p className="text-xs text-slate-500 line-clamp-2">{odp.name}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEdit} title="Edit ODP">
              <Pencil className="w-3.5 h-3.5 text-slate-500" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Badge className={availColor} variant="secondary">{odp.availability}</Badge>
          {odp.vendor && <Badge variant="outline">{odp.vendor}</Badge>}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Capacity Section */}
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-slate-600 mb-2">Kapasitas & Penggunaan</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <div className="text-lg font-bold text-slate-800">{odp.totalAssigned}</div>
                <div className="text-[10px] text-slate-400">Terpasang</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-600">{odp.availableCnt}</div>
                <div className="text-[10px] text-slate-400">Tersedia</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-800">{odp.capacity}</div>
                <div className="text-[10px] text-slate-400">Total</div>
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Aktif: {odp.active} | Terminate: {odp.terminate}</span>
              <span className="font-semibold">{usagePercent}%</span>
            </div>
          </div>

          {/* Location Info */}
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2">Lokasi</div>
            <div className="space-y-0.5">
              <InfoRow label="Alamat" value={odp.address} />
              <InfoRow label="Kelurahan" value={odp.kelurahan} />
              <InfoRow label="Kecamatan" value={odp.kecamatan} />
              <InfoRow label="Kota" value={odp.city} />
              <InfoRow label="Region" value={odp.region} />
              <InfoRow label="Tipe Lokasi" value={odp.locationType} />
              <InfoRow label="Koordinat" value={odp.coordinate} mono />
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => copyToClipboard(odp.coordinate)}>
                <Copy className="w-3 h-3 mr-1" /> Salin Koordinat
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={openInGoogleMaps}>
                <Navigation className="w-3 h-3 mr-1" /> Google Maps
              </Button>
            </div>
          </div>

          <Separator />

          {/* ODC Info */}
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2">Info ODC & OLT</div>
            <div className="space-y-0.5">
              <InfoRow label="ODC Code" value={odp.odcCode} mono />
              <InfoRow label="ODC Name" value={odp.odcName} />
              <InfoRow label="ODC Port" value={odp.odcPortNo} />
              <InfoRow label="OLT IP" value={odp.oltIp} mono />
              <InfoRow label="ONU Card" value={odp.onuCard} mono />
            </div>
          </div>

          <Separator />

          {/* Other Info */}
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2">Info Lainnya</div>
            <div className="space-y-0.5">
              <InfoRow label="Install Status" value={odp.installStatus} />
              <InfoRow label="Usage For" value={odp.usageFor} />
              <InfoRow label="ODP Owner" value={odp.odpOwner} />
              <InfoRow label="Provider" value={odp.provider} />
              <InfoRow label="RFS Date" value={odp.rfsDate} />
              {odp.description && <InfoRow label="Deskripsi" value={odp.description} />}
            </div>
          </div>

          <Separator />

          {/* Audit Info */}
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2">Riwayat Perubahan</div>
            <div className="space-y-0.5">
              <InfoRow label="Dibuat" value={odp.createDate} />
              <InfoRow label="Oleh" value={odp.createBy} />
              <InfoRow label="Diubah" value={odp.modifyDate} />
              <InfoRow label="Oleh" value={odp.modifyBy} />
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
