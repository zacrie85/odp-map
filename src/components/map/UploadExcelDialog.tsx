'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

const COLUMN_MAP: Record<string, string> = {
  'code': 'code', 'name': 'name', 'kelurahan': 'kelurahan',
  'kecamatan': 'kecamatan', 'city': 'city', 'region': 'region', 'province': 'province',
  'address_match': 'addressMatch', 'addressmatch': 'addressMatch',
  'district_name': 'districtName', 'districtname': 'districtName',
  'partner_name': 'partnerName', 'partnername': 'partnerName',
  'check_status': 'checkStatus', 'checkstatus': 'checkStatus',
  'capacity': 'capacity', 'total_assigned': 'totalAssigned', 'totalassigned': 'totalAssigned',
  'active': 'active', 'terminate': 'terminate', 'undetected': 'undetected',
  'availability': 'availability', 'available_cnt': 'availableCnt', 'availablecnt': 'availableCnt',
  'olt_ip': 'oltIp', 'oltip': 'oltIp', 'onu_card': 'onuCard', 'onucard': 'onuCard',
  'status': 'status', 'location_type': 'locationType', 'locationtype': 'locationType',
  'odc_code': 'odcCode', 'odccode': 'odcCode', 'odc_name': 'odcName', 'odcname': 'odcName',
  'odc_port_no': 'odcPortNo', 'odcportno': 'odcPortNo',
  'rfs_date': 'rfsDate', 'rfsdate': 'rfsDate',
  'address': 'address', 'coordinate': 'coordinate',
  'latitude': 'latitude', 'longitude': 'longitude',
  'install_status': 'installStatus', 'installstatus': 'installStatus',
  'usage_for': 'usageFor', 'usagefor': 'usageFor',
  'vendor': 'vendor', 'description': 'description',
  'odp_owner': 'odpOwner', 'odpowner': 'odpOwner', 'provider': 'provider',
  'modify_date': 'modifyDate', 'modifydate': 'modifyDate',
  'modify_by': 'modifyBy', 'modifyby': 'modifyBy',
  'create_date': 'createDate', 'createdate': 'createDate',
  'create_by': 'createBy', 'createby': 'createBy',
  'created_at': 'createdAt', 'createdat': 'createdAt',
  'updated_at': 'updatedAt', 'updatedat': 'updatedAt',
}
const INT_FIELDS = new Set(['capacity', 'totalAssigned', 'active', 'terminate', 'undetected', 'availableCnt'])
const FLOAT_FIELDS = new Set(['latitude', 'longitude'])

function parseRow(row: Record<string, any>): Record<string, any> {
  const record: Record<string, any> = {}
  for (const [excelCol, value] of Object.entries(row)) {
    const key = excelCol.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const dbField = COLUMN_MAP[key]
    if (dbField && value !== undefined && value !== null && String(value).trim() !== '') {
      if (INT_FIELDS.has(dbField)) record[dbField] = parseInt(String(value)) || 0
      else if (FLOAT_FIELDS.has(dbField)) record[dbField] = parseFloat(String(value)) || 0
      else record[dbField] = String(value).trim()
    }
  }
  if (!record.id) record.id = 'imp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10)
  return record
}

export default function UploadExcelDialog({ open, onOpenChange, onUploadComplete }: { open: boolean; onOpenChange: (v: boolean) => void; onUploadComplete: () => void }) {
  const [mode, setMode] = useState<'append' | 'replace'>('append')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number; phase: string } | null>(null)
  const [result, setResult] = useState<any>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      if (!f.name.match(/\.xlsx?$/i) && !f.name.match(/\.csv$/i)) { toast.error('Hanya file .xls, .xlsx, atau .csv'); return }
      setFile(f); setResult(null); setConfirmReplace(false)
    }
  }

  const handleUpload = async () => {
    if (!file) { toast.error('Pilih file Excel terlebih dahulu'); return }
    if (mode === 'replace' && !confirmReplace) { toast.error('Konfirmasi penggantian data terlebih dahulu'); return }
    setUploading(true); setResult(null)
    try {
      setProgress({ current: 0, total: 0, phase: 'Membaca file Excel...' })
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      if (rows.length === 0) { toast.error('File kosong'); setUploading(false); setProgress(null); return }
      const records = rows.map(parseRow)
      const CHUNK = 200, totalChunks = Math.ceil(records.length / CHUNK)
      let totalInserted = 0

      if (mode === 'replace') {
        setProgress({ current: 0, total: totalChunks, phase: 'Menghapus data lama...' })
        const del = await fetch('/api/odp/upload-chunk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete' }) })
        if (!del.ok) { const e = await del.json(); toast.error('Gagal hapus: ' + e.error); setUploading(false); setProgress(null); return }
      }

      for (let i = 0; i < records.length; i += CHUNK) {
        const chunkNum = Math.floor(i / CHUNK) + 1
        setProgress({ current: chunkNum, total: totalChunks, phase: `Upload chunk ${chunkNum}/${totalChunks}...` })
        const res = await fetch('/api/odp/upload-chunk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'insert', records: records.slice(i, i + CHUNK) }) })
        const data = await res.json()
        if (!res.ok) { toast.error(`Gagal chunk ${chunkNum}: ${data.error}`); setUploading(false); setProgress(null); return }
        totalInserted += data.inserted || 0
      }

      const cnt = await (await fetch('/api/odp/upload-chunk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'count' }) })).json()
      const r = { totalRows: rows.length, inserted: totalInserted, totalInDb: cnt.total ?? 0, message: `Berhasil! ${totalInserted} data diimport. Total: ${cnt.total ?? 0}` }
      setResult(r); toast.success(r.message); onUploadComplete()
    } catch (err: any) { toast.error('Gagal: ' + (err.message || '')) } finally { setUploading(false); setProgress(null) }
  }

  const reset = () => { setFile(null); setResult(null); setConfirmReplace(false); setProgress(null); if (fileRef.current) fileRef.current.value = '' }
  const handleClose = () => { reset(); onOpenChange(false) }
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ zIndex: 10000 }}>
        <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-emerald-100 flex items-center justify-center"><FileSpreadsheet className="w-4 h-4 text-emerald-600" /></div>
            <div><h2 className="text-sm font-bold text-slate-800">Upload Data Excel / CSV</h2><p className="text-[11px] text-slate-400">File besar? Tidak masalah, otomatis di-chunk</p></div>
          </div>
          <button onClick={handleClose} className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-700 mb-2 block">Pilih Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setMode('append'); reset() }} className={`p-3 rounded-lg border-2 text-left ${mode === 'append' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                <Upload className={`w-4 h-4 mb-1 ${mode === 'append' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div className={`text-xs font-bold ${mode === 'append' ? 'text-emerald-800' : 'text-slate-600'}`}>Tambah / Update</div>
              </button>
              <button onClick={() => { setMode('replace'); reset() }} className={`p-3 rounded-lg border-2 text-left ${mode === 'replace' ? 'border-orange-500 bg-orange-50' : 'border-slate-200'}`}>
                <Database className={`w-4 h-4 mb-1 ${mode === 'replace' ? 'text-orange-600' : 'text-slate-400'}`} />
                <div className={`text-xs font-bold ${mode === 'replace' ? 'text-orange-800' : 'text-slate-600'}`}>Replace Semua</div>
              </button>
            </div>
          </div>
          {mode === 'replace' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-red-700">Perhatian!</div>
                <div className="text-[11px] text-red-600">Mode ini akan <b>menghapus semua data ODP</b> dan menggantinya dengan data dari Excel.</div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} className="rounded border-red-300" />
                  <span className="text-[11px] text-red-700 font-medium">Ya, saya yakin ingin replace semua data</span>
                </label>
              </div>
            </div>
          )}
          <div>
            <div onClick={() => !uploading && fileRef.current?.click()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${file ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-slate-400'} ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
              <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" onChange={handleFileChange} className="hidden" />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <div className="text-left"><div className="text-xs font-semibold text-emerald-700">{file.name}</div><div className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div></div>
                  <button onClick={(e) => { e.stopPropagation(); reset() }} className="ml-2 w-5 h-5 rounded-full hover:bg-red-100 flex items-center justify-center"><X className="w-3 h-3 text-red-400" /></button>
                </div>
              ) : (<><Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" /><div className="text-xs text-slate-500">Klik untuk pilih file Excel/CSV</div><div className="text-[10px] text-slate-400 mt-1">File besar tidak masalah!</div></>)}
            </div>
          </div>
          {progress && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2"><Loader2 className="w-4 h-4 text-blue-600 animate-spin" /><span className="text-xs font-medium text-blue-700">{progress.phase}</span></div>
              {progress.total > 0 && (<><div className="w-full bg-blue-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }} /></div><div className="text-[10px] text-blue-600 mt-1 text-right">{progress.current}/{progress.total}</div></>)}
            </div>
          )}
          <Button className="w-full" disabled={!file || uploading || (mode === 'replace' && !confirmReplace)} onClick={handleUpload}>
            {uploading ? (<span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Memproses...</span>) : (<><Upload className="w-4 h-4 mr-2" />{mode === 'replace' ? 'Replace Semua Data' : 'Upload & Update Data'}</>)}
          </Button>
          {result && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <div className="text-xs font-bold text-slate-700 mb-2">Hasil Upload</div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-slate-500">Total baris</span><span className="font-semibold">{result.totalRows?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Data diimport</span><span className="font-semibold text-emerald-600">{result.inserted?.toLocaleString()}</span></div>
                <div className="border-t pt-1 mt-1 flex justify-between"><span className="text-slate-700 font-medium">Total di database</span><span className="font-bold text-slate-800">{result.totalInDb?.toLocaleString()}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
