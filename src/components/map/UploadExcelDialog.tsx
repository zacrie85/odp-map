'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface UploadExcelDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onUploadComplete: () => void
}

export default function UploadExcelDialog({ open, onOpenChange, onUploadComplete }: UploadExcelDialogProps) {
  const [mode, setMode] = useState<'append' | 'replace'>('append')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      if (!f.name.match(/\.xlsx?$/i) && !f.name.match(/\.csv$/i)) {
        toast.error('Hanya file .xls, .xlsx, atau .csv yang didukung')
        return
      }
      setFile(f)
      setResult(null)
      setConfirmReplace(false)
    }
  }

  const handleUpload = async () => {
    if (!file) { toast.error('Pilih file Excel terlebih dahulu'); return }
    if (mode === 'replace' && !confirmReplace) { toast.error('Konfirmasi penggantian data terlebih dahulu'); return }

    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/odp/upload?mode=${mode}`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Gagal upload')
        return
      }

      setResult(data)
      toast.success(data.message)
      onUploadComplete()
    } catch (err) {
      toast.error('Gagal upload file')
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setConfirmReplace(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ zIndex: 10000 }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-emerald-100 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Upload Data Excel / CSV</h2>
              <p className="text-[11px] text-slate-400">Import data ODP dari file Excel atau CSV</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode Selection */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-2 block">Pilih Mode Upload</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setMode('append'); reset() }}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  mode === 'append'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Upload className={`w-4 h-4 mb-1 ${mode === 'append' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div className={`text-xs font-bold ${mode === 'append' ? 'text-emerald-800' : 'text-slate-600'}`}>Tambah / Update</div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  Data baru ditambahkan, kode yang sudah ada akan diupdate (upsert)
                </div>
              </button>
              <button
                onClick={() => { setMode('replace'); reset() }}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  mode === 'replace'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Database className={`w-4 h-4 mb-1 ${mode === 'replace' ? 'text-orange-600' : 'text-slate-400'}`} />
                <div className={`text-xs font-bold ${mode === 'replace' ? 'text-orange-800' : 'text-slate-600'}`}>Replace Semua</div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  Hapus semua data lama, import ulang dari Excel
                </div>
              </button>
            </div>
          </div>

          {/* Warning for replace mode */}
          {mode === 'replace' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-red-700">Perhatian!</div>
                <div className="text-[11px] text-red-600 mt-0.5">
                  Mode ini akan <b>menghapus semua data ODP yang ada</b> dan menggantinya dengan data dari Excel. Tindakan ini tidak bisa dibatalkan.
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmReplace}
                    onChange={(e) => setConfirmReplace(e.target.checked)}
                    className="rounded border-red-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-[11px] text-red-700 font-medium">Ya, saya yakin ingin replace semua data</span>
                </label>
              </div>
            </div>
          )}

          {/* File Input */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">Pilih File Excel</label>
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                file ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
              } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xls,.xlsx,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <div className="text-left">
                    <div className="text-xs font-semibold text-emerald-700">{file.name}</div>
                    <div className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); reset() }}
                    className="ml-2 w-5 h-5 rounded-full hover:bg-red-100 flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <div className="text-xs text-slate-500">Klik untuk pilih file .xls, .xlsx, atau .csv</div>
                  <div className="text-[10px] text-slate-400 mt-1">File besar? Pecah jadi beberapa bagian (max 4MB per file)</div>
                </>
              )}
            </div>
          </div>

          {/* Upload Button */}
          <Button
            className="w-full"
            disabled={!file || uploading || (mode === 'replace' && !confirmReplace)}
            onClick={handleUpload}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses data...
              </span>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                {mode === 'replace' ? 'Replace Semua Data' : 'Upload & Update Data'}
              </>
            )}
          </Button>

          {/* Result */}
          {result && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <div className="text-xs font-bold text-slate-700 mb-2">Hasil Upload</div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-slate-500">Total baris di file</span><span className="font-semibold">{result.totalRows?.toLocaleString()}</span></div>
                {mode === 'replace' ? (
                  <div className="flex justify-between"><span className="text-slate-500">Data di-replace</span><span className="font-semibold text-emerald-600">{result.inserted?.toLocaleString()}</span></div>
                ) : (
                  <div className="flex justify-between"><span className="text-slate-500">Data ditambahkan</span><span className="font-semibold text-emerald-600">{result.inserted?.toLocaleString()}</span></div>
                )}
                <div className="border-t border-slate-200 pt-1 mt-1 flex justify-between"><span className="text-slate-700 font-medium">Total di database</span><span className="font-bold text-slate-800">{result.totalInDb?.toLocaleString()}</span></div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="text-[10px] text-slate-400 space-y-0.5">
            <div className="font-semibold text-slate-500 text-xs mb-1">Ketentuan file Excel:</div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Format file harus sama dengan template ODP List asli</li>
              <li>Baris pertama = header (akan dilewati)</li>
              <li>Kolom koordinat harus format: <span className="font-mono">lat, lng</span></li>
              <li>Mode &quot;Tambah/Update&quot;: kode ODP yang sama akan diupdate datanya</li>
              <li>Mode &quot;Replace&quot;: semua data lama dihapus, diganti data dari Excel</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
