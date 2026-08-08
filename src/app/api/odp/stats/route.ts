import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET() {
  try {
    const [
      total,
      statusStats,
      kecamatanList,
      regionList,
      odpOwnerList,
      installStatusList,
    ] = await Promise.all([
      db.odp.count(),
      db.odp.groupBy({ by: ['status'], _count: { status: true } }),
      db.odp.groupBy({ by: ['kecamatan'], _count: { kecamatan: true }, orderBy: { kecamatan: 'asc' } }),
      db.odp.groupBy({ by: ['region'], _count: { region: true }, orderBy: { region: 'asc' } }),
      db.odp.groupBy({ by: ['odpOwner'], _count: { odpOwner: true }, orderBy: { odpOwner: 'asc' } }),
      db.odp.groupBy({ by: ['installStatus'], _count: { installStatus: true }, orderBy: { installStatus: 'asc' } }),
    ])

    // Coordinate stats
    const withCoord = await db.odp.count({ where: { latitude: { not: 0 }, longitude: { not: 0 } } })
    const withoutCoord = total - withCoord

    // Active distribution ranges
    const allOdps = await db.odp.findMany({ select: { active: true, capacity: true, totalAssigned: true } })
    
    const activeRanges = [
      { label: '0', min: 0, max: 0, count: 0 },
      { label: '1 - 5', min: 1, max: 5, count: 0 },
      { label: '6 - 10', min: 6, max: 10, count: 0 },
      { label: '11 - 20', min: 11, max: 20, count: 0 },
      { label: '21 - 50', min: 21, max: 50, count: 0 },
      { label: '51 +', min: 51, max: Infinity, count: 0 },
    ]
    
    const capacityRanges = [
      { label: 'Kosong (0%)', min: 0, max: 0, count: 0 },
      { label: 'Rendah (1-50%)', min: 1, max: 50, count: 0 },
      { label: 'Sedang (51-80%)', min: 51, max: 80, count: 0 },
      { label: 'Tinggi (81-99%)', min: 81, max: 99, count: 0 },
      { label: 'Penuh (100%)', min: 100, max: 100, count: 0 },
    ]

    for (const o of allOdps) {
      // Active ranges
      for (const r of activeRanges) {
        if (o.active >= r.min && o.active <= r.max) { r.count++; break }
      }
      // Capacity usage ranges
      const usage = o.capacity > 0 ? Math.round((o.totalAssigned / o.capacity) * 100) : 0
      for (const r of capacityRanges) {
        if (usage >= r.min && usage <= r.max) { r.count++; break }
      }
    }

    const capacityStats = await db.odp.aggregate({
      _sum: { capacity: true, totalAssigned: true, active: true, terminate: true, availableCnt: true },
    })

    return NextResponse.json({
      total,
      withCoord,
      withoutCoord,
      statusStats: statusStats.map(s => ({ value: s.status, count: s._count.status })),
      kecamatanList: kecamatanList.map(k => ({ value: k.kecamatan, count: k._count.kecamatan })),
      regionList: regionList.map(r => ({ value: r.region, count: r._count.region })),
      odpOwnerList: odpOwnerList.map(o => ({ value: o.odpOwner, count: o._count.odpOwner })),
      installStatusList: installStatusList.map(i => ({ value: i.installStatus, count: i._count.installStatus })),
      activeRangeList: activeRanges.map(r => ({ value: r.label, count: r.count })),
      capacityRangeList: capacityRanges.map(r => ({ value: r.label, count: r.count })),
      capacityStats,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
