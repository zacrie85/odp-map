import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
    const body = await req.json()
    const { action, records } = body

    if (action === 'delete') {
      await db.$executeRawUnsafe('DELETE FROM "Odp"')
      return NextResponse.json({ success: true, message: 'Semua data lama dihapus' })
    }

    if (action === 'insert') {
      if (!Array.isArray(records) || records.length === 0) {
        return NextResponse.json({ error: 'Tidak ada data' }, { status: 400 })
      }

      const SUB_BATCH = 1000
      let inserted = 0

      for (let i = 0; i < records.length; i += SUB_BATCH) {
        const batch = records.slice(i, i + SUB_BATCH)
        const sql = buildInsertSql(batch)
        await db.$executeRawUnsafe(sql)
        inserted += batch.length
      }

      return NextResponse.json({ success: true, inserted })
    }

    if (action === 'count') {
      const total = await db.$executeRawUnsafe('SELECT COUNT(*)::int as c FROM "Odp"') as any
      const totalCount = total?.[0]?.c ?? 0
      return NextResponse.json({ success: true, total: totalCount })
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 })
  } catch (error: any) {
    console.error('Chunk upload error:', error)
    return NextResponse.json({ error: 'Gagal: ' + (error.message || 'Unknown error') }, { status: 500 })
  }
}
