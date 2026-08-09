import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

// Column mapping: Excel header -> DB field
const COLUMN_MAP: Record<string, string> = {
  'id': 'id',
  'code': 'code',
  'name': 'name',
  'kelurahan': 'kelurahan',
  'kecamatan': 'kecamatan',
  'city': 'city',
  'region': 'region',
  'province': 'province',
  'address_match': 'addressMatch',
  'addressmatch': 'addressMatch',
  'district_name': 'districtName',
  'districtname': 'districtName',
  'partner_name': 'partnerName',
  'partnername': 'partnerName',
  'check_status': 'checkStatus',
  'checkstatus': 'checkStatus',
  'capacity': 'capacity',
  'total_assigned': 'totalAssigned',
  'totalassigned': 'totalAssigned',
  'active': 'active',
  'terminate': 'terminate',
  'undetected': 'undetected',
  'availability': 'availability',
  'available_cnt': 'availableCnt',
  'availablecnt': 'availableCnt',
  'olt_ip': 'oltIp',
  'oltip': 'oltIp',
  'onu_card': 'onuCard',
  'onucard': 'onuCard',
  'status': 'status',
  'location_type': 'locationType',
  'locationtype': 'locationType',
  'odc_code': 'odcCode',
  'odccode': 'odcCode',
  'odc_name': 'odcName',
  'odcname': 'odcName',
  'odc_port_no': 'odcPortNo',
  'odcportno': 'odcPortNo',
  'rfs_date': 'rfsDate',
  'rfsdate': 'rfsDate',
  'address': 'address',
  'coordinate': 'coordinate',
  'latitude': 'latitude',
  'longitude': 'longitude',
  'install_status': 'installStatus',
  'installstatus': 'installStatus',
  'usage_for': 'usageFor',
  'usagefor': 'usageFor',
  'vendor': 'vendor',
  'description': 'description',
  'odp_owner': 'odpOwner',
  'odpowner': 'odpOwner',
  'provider': 'provider',
  'modify_date': 'modifyDate',
  'modifydate': 'modifyDate',
  'modify_by': 'modifyBy',
  'modifyby': 'modifyBy',
  'create_date': 'createDate',
  'createdate': 'createDate',
  'create_by': 'createBy',
  'createby': 'createBy',
  'created_at': 'createdAt',
  'createdat': 'createdAt',
  'updated_at': 'updatedAt',
  'updatedat': 'updatedAt',
}

// Integer fields
const INT_FIELDS = new Set(['capacity', 'totalAssigned', 'active', 'terminate', 'undetected', 'availableCnt'])
// Float fields
const FLOAT_FIELDS = new Set(['latitude', 'longitude'])

function parseRow(row: Record<string, any>): Record<string, any> {
  const record: Record<string, any> = {}
  for (const [excelCol, value] of Object.entries(row)) {
    const key = excelCol.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const dbField = COLUMN_MAP[key]
    if (dbField && value !== undefined && value !== null && String(value).trim() !== '') {
      if (INT_FIELDS.has(dbField)) {
        const num = parseInt(String(value)) || 0
        record[dbField] = isNaN(num) ? 0 : num
      } else if (FLOAT_FIELDS.has(dbField)) {
        const num = parseFloat(String(value)) || 0
        record[dbField] = isNaN(num) ? 0 : num
      } else {
        record[dbField] = String(value).trim()
      }
    }
  }
  // Ensure id exists
  if (!record.id) {
    record.id = String(Date.now()) + '_' + Math.random().toString(36).substring(2, 10)
  }
  return record
}

export async function POST(req: NextRequest) {
  try {
    const mode = req.nextUrl.searchParams.get('mode') || 'append'
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    if (!file.name.match(/\.xlsx?$/i)) {
      return NextResponse.json({ error: 'Hanya file .xls atau .xlsx' }, { status: 400 })
    }

    // Parse Excel
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[]

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 })
    }

    const records = rows.map(parseRow)

    if (mode === 'replace') {
      // Delete all existing data
      const deleteResult = await db.odp.deleteMany()
      console.log(`Deleted ${deleteResult.count} existing ODP records`)
    }

    // Insert in batches of 100
    const BATCH_SIZE = 100
    let inserted = 0
    let updated = 0

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)

      if (mode === 'append') {
        // Upsert: update if exists (by id), create if not
        for (const record of batch) {
          try {
            const existing = await db.odp.findUnique({ where: { id: record.id } })
            if (existing) {
              await db.odp.update({ where: { id: record.id }, data: record })
              updated++
            } else {
              await db.odp.create({ data: record })
              inserted++
            }
          } catch (err) {
            console.error(`Error upserting record ${record.id}:`, err)
            // Try create if update fails
            try {
              await db.odp.create({ data: record })
              inserted++
            } catch (e) {
              console.error(`Failed to create record ${record.id}:`, e)
            }
          }
        }
      } else {
        // Replace mode: just insert all
        try {
          await db.odp.createMany({ data: batch, skipDuplicates: true })
          inserted += batch.length
        } catch (err) {
          console.error(`Error inserting batch ${i}:`, err)
          // Fallback: insert one by one
          for (const record of batch) {
            try {
              await db.odp.create({ data: record })
              inserted++
            } catch (e) {
              console.error(`Failed to create record ${record.id}:`, e)
            }
          }
        }
      }
    }

    const total = await db.odp.count()

    return NextResponse.json({
      message: mode === 'replace'
        ? `Data berhasil di-replace! ${inserted} data diimport. Total: ${total}`
        : `Upload selesai! ${inserted} baru, ${updated} diupdate. Total: ${total}`,
      mode,
      totalRows: rows.length,
      inserted,
      updated,
      totalInDb: total,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({
      error: 'Gagal memproses file: ' + (error.message || 'Unknown error'),
    }, { status: 500 })
  }
}
