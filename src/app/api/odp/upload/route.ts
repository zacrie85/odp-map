import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

const DB_COLUMNS = [
  'id','code','name','kelurahan','kecamatan','city','region','province',
  'addressMatch','districtName','partnerName','checkStatus',
  'capacity','totalAssigned','active','terminate','undetected',
  'availability','availableCnt','oltIp','onuCard','status',
  'locationType','odcCode','odcName','odcPortNo','rfsDate',
  'address','coordinate','latitude','longitude','installStatus',
  'usageFor','vendor','description','odpOwner','provider',
  'modifyDate','modifyBy','createDate','createBy','createdAt','updatedAt'
]

function parseRow(row: Record<string, any>): Record<string, any> {
  const record: Record<string, any> = {}
  for (const [excelCol, value] of Object.entries(row)) {
    const key = excelCol.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const dbField = COLUMN_MAP[key]
    if (dbField && value !== undefined && value !== null && String(value).trim() !== '') {
      if (INT_FIELDS.has(dbField)) {
        record[dbField] = parseInt(String(value)) || 0
      } else if (FLOAT_FIELDS.has(dbField)) {
        record[dbField] = parseFloat(String(value)) || 0
      } else {
        record[dbField] = String(value).trim()
      }
    }
  }
  if (!record.id) {
    record.id = 'imp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10)
  }
  return record
}

function escapeStr(val: string): string {
  return val.replace(/'/g, "''")
}

function buildInsertSql(records: Record<string, any>[]): string {
  const rows: string[] = []
  for (const r of records) {
    const vals = DB_COLUMNS.map(col => {
      const v = r[col]
      if (v === undefined || v === null) return "''"
      if (INT_FIELDS.has(col) || FLOAT_FIELDS.has(col)) return String(v)
      return `'${escapeStr(String(v))}'`
    })
    rows.push(`(${vals.join(',')})`)
  }
  const cols = DB_COLUMNS.map(c => `"${c}"`).join(',')
  return `INSERT INTO "Odp" (${cols}) VALUES ${rows.join(',')}`
}

export async function POST(req: NextRequest) {
  try {
    const mode = req.nextUrl.searchParams.get('mode') || 'append'
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })

    const isExcel = file.name.match(/\.xlsx?$/i)
    const isCsv = file.name.match(/\.csv$/i)
    if (!isExcel && !isCsv) return NextResponse.json({ error: 'Hanya file .xls, .xlsx, atau .csv' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    let rows: Record<string, any>[]

    if (isCsv) {
      // Parse CSV using XLSX
      const wb = XLSX.read(buffer, { type: 'buffer' })
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
    } else {
      const wb = XLSX.read(buffer, { type: 'buffer' })
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
    }

    if (rows.length === 0) return NextResponse.json({ error: 'File kosong' }, { status: 400 })

    const records = rows.map(parseRow)

    if (mode === 'replace') {
      await db.$executeRawUnsafe('DELETE FROM "Odp"')
    }

    // Bulk insert using raw SQL in batches
    const BATCH = 2000
    let inserted = 0

    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)
      const sql = buildInsertSql(batch)
      await db.$executeRawUnsafe(sql)
      inserted += batch.length
    }

    const total = await db.$executeRawUnsafe('SELECT COUNT(*)::int as c FROM "Odp"') as any
    const totalCount = total?.[0]?.c ?? 0

    return NextResponse.json({
      message: mode === 'replace'
        ? `Data di-replace! ${inserted} data diimport. Total: ${totalCount}`
        : `Upload selesai! ${inserted} data ditambahkan. Total: ${totalCount}`,
      mode, totalRows: rows.length, inserted, totalInDb: totalCount,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({
      error: 'Gagal: ' + (error.message || 'Unknown error'),
    }, { status: 500 })
  }
}
