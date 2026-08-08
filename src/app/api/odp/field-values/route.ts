import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Allowed fields for custom column filtering (prevent injection)
const ALLOWED_FIELDS: Record<string, { label: string; orderBy?: string }> = {
  status: { label: 'Status' },
  availability: { label: 'Ketersediaan' },
  kecamatan: { label: 'Kecamatan', orderBy: 'asc' },
  city: { label: 'Kota', orderBy: 'asc' },
  region: { label: 'Region', orderBy: 'asc' },
  locationType: { label: 'Tipe Lokasi', orderBy: 'asc' },
  vendor: { label: 'Vendor', orderBy: 'asc' },
  odpOwner: { label: 'Pemilik ODP', orderBy: 'asc' },
  provider: { label: 'Provider', orderBy: 'asc' },
  installStatus: { label: 'Status Instalasi', orderBy: 'asc' },
  checkStatus: { label: 'Check Status', orderBy: 'asc' },
  kelurahan: { label: 'Kelurahan', orderBy: 'asc' },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const field = searchParams.get('field') || ''

  // Return available fields list if no field specified
  if (!field) {
    return NextResponse.json(
      Object.entries(ALLOWED_FIELDS).map(([key, val]) => ({ value: key, label: val.label }))
    )
  }

  // Validate field
  if (!ALLOWED_FIELDS[field]) {
    return NextResponse.json({ error: 'Field not allowed' }, { status: 400 })
  }

  try {
    const config = ALLOWED_FIELDS[field]
    const orderBy: any = config.orderBy ? { [field]: config.orderBy } : undefined

    const result = await db.odp.groupBy({
      by: [field as any],
      _count: { [field]: true },
      orderBy,
    })

    const values = result
      .map((r: any) => ({
        value: r[field] as string,
        count: r._count[field] as number,
      }))
      .filter((v: any) => v.value) // exclude empty strings
      .sort((a: any, b: any) => b.count - a.count) // sort by count desc

    return NextResponse.json(values)
  } catch (error) {
    console.error('Field values error:', error)
    return NextResponse.json({ error: 'Failed to fetch field values' }, { status: 500 })
  }
}
