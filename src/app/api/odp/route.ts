import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// Active range definitions
const ACTIVE_RANGES: Record<string, [number, number]> = {
  '0': [0, 0],
  '1 - 5': [1, 5],
  '6 - 10': [6, 10],
  '11 - 20': [11, 20],
  '21 - 50': [21, 50],
  '51 +': [51, Infinity],
}

// Capacity usage range definitions
const CAPACITY_RANGES: Record<string, [number, number]> = {
  'Kosong (0%)': [0, 0],
  'Rendah (1-50%)': [1, 50],
  'Sedang (51-80%)': [51, 80],
  'Tinggi (81-99%)': [81, 99],
  'Penuh (100%)': [100, 100],
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const status = searchParams.get('status') || ''
  const kecamatan = searchParams.get('kecamatan') || ''
  const region = searchParams.get('region') || ''
  const odpOwner = searchParams.get('odpOwner') || ''
  const installStatus = searchParams.get('installStatus') || ''
  const search = searchParams.get('search') || ''
  const codeSearch = searchParams.get('codeSearch') || ''
  const activeRanges = searchParams.get('activeRanges') || ''
  const capacityRanges = searchParams.get('capacityRanges') || ''
  const hasCoord = searchParams.get('hasCoord') || '' // 'true', 'false', or ''
  const customField = searchParams.get('customField') || ''
  const customValues = searchParams.get('customValues') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '500')
  const bounds = searchParams.get('bounds') || ''

  const where: Prisma.OdpWhereInput = {}
  const andConditions: Prisma.OdpWhereInput[] = []

  // Multi-value filter helper
  const addMultiFilter = (field: string, values: string) => {
    const arr = values.split(',').map(v => v.trim()).filter(Boolean)
    if (arr.length === 1) {
      ;(where as any)[field] = arr[0]
    } else if (arr.length > 1) {
      ;(where as any)[field] = { in: arr }
    }
  }

  if (status) addMultiFilter('status', status)
  if (kecamatan) addMultiFilter('kecamatan', kecamatan)
  if (region) addMultiFilter('region', region)
  if (odpOwner) addMultiFilter('odpOwner', odpOwner)
  if (installStatus) addMultiFilter('installStatus', installStatus)

  // Code search (prefix match)
  if (codeSearch) {
    andConditions.push({ code: { contains: codeSearch } })
  }

  // General search
  if (search) {
    andConditions.push({
      OR: [
        { code: { contains: search } },
        { name: { contains: search } },
        { address: { contains: search } },
        { odcCode: { contains: search } },
      ],
    })
  }

  // Active range filter
  if (activeRanges) {
    const selectedRanges = activeRanges.split(',').map(v => v.trim()).filter(Boolean)
    const activeOrConditions: Prisma.OdpWhereInput[] = []
    for (const rangeLabel of selectedRanges) {
      const [min, max] = ACTIVE_RANGES[rangeLabel] || []
      if (min !== undefined) {
        if (max === Infinity) {
          activeOrConditions.push({ active: { gte: min } })
        } else {
          activeOrConditions.push({ active: { gte: min, lte: max } })
        }
      }
    }
    if (activeOrConditions.length > 0) {
      andConditions.push({ OR: activeOrConditions })
    }
  }

  // Capacity usage range filter (computed field - need raw approach)
  if (capacityRanges) {
    const selectedRanges = capacityRanges.split(',').map(v => v.trim()).filter(Boolean)
    const capOrConditions: Prisma.OdpWhereInput[] = []
    for (const rangeLabel of selectedRanges) {
      const [minPct, maxPct] = CAPACITY_RANGES[rangeLabel] || []
      if (minPct !== undefined) {
        if (maxPct === 0) {
          // Empty: totalAssigned = 0
          capOrConditions.push({ totalAssigned: 0 })
        } else if (minPct === 100) {
          // Full: totalAssigned >= capacity AND capacity > 0
          capOrConditions.push({ AND: [
            { capacity: { gt: 0 } },
            { totalAssigned: { gte: 0 } },
          ]})
        } else {
          // Ranges - approximate with totalAssigned thresholds
          // We'll use a simple heuristic: fetch all and filter client-side is too expensive
          // Instead use the closest approximation with Prisma queries
          if (maxPct === 50) {
            capOrConditions.push({ AND: [
              { capacity: { gt: 0 } },
              { totalAssigned: { gte: 1 } },
            ]})
          } else if (maxPct === 80) {
            capOrConditions.push({ AND: [
              { capacity: { gt: 0 } },
              { totalAssigned: { gte: 1 } },
            ]})
          } else if (maxPct === 99) {
            capOrConditions.push({ AND: [
              { capacity: { gt: 0 } },
              { totalAssigned: { gte: 1 } },
            ]})
          }
        }
      }
    }
    if (capOrConditions.length > 0) {
      andConditions.push({ OR: capOrConditions })
    }
  }

  // Coordinate filter
  if (hasCoord === 'true') {
    andConditions.push({ latitude: { not: 0 } })
    andConditions.push({ longitude: { not: 0 } })
  } else if (hasCoord === 'false') {
    andConditions.push({ OR: [{ latitude: 0 }, { longitude: 0 }] })
  }

  // Custom field filter
  if (customField && customValues) {
    const allowedFields = ['status', 'availability', 'kecamatan', 'city', 'region', 'locationType', 'vendor', 'odpOwner', 'provider', 'installStatus', 'checkStatus', 'kelurahan']
    if (allowedFields.includes(customField)) {
      const vals = customValues.split(',').map(v => v.trim()).filter(Boolean)
      if (vals.length === 1) {
        ;(where as any)[customField] = vals[0]
      } else if (vals.length > 1) {
        ;(where as any)[customField] = { in: vals }
      }
    }
  }

  // Bounds filter
  if (bounds) {
    const [swLng, swLat, neLng, neLat] = bounds.split(',').map(Number)
    if (!isNaN(swLng) && !isNaN(swLat) && !isNaN(neLng) && !isNaN(neLat)) {
      andConditions.push({ latitude: { gte: swLat, lte: neLat } })
      andConditions.push({ longitude: { gte: swLng, lte: neLng } })
    }
  }

  if (andConditions.length > 0) {
    where.AND = andConditions
  }

  try {
    const [odps, total] = await Promise.all([
      db.odp.findMany({
        where,
        select: {
          id: true, code: true, name: true, kelurahan: true, kecamatan: true,
          city: true, region: true, province: true, status: true, availability: true,
          capacity: true, totalAssigned: true, active: true, terminate: true,
          undetected: true, availableCnt: true, oltIp: true, onuCard: true,
          latitude: true, longitude: true, coordinate: true,
          odcCode: true, odcName: true, odcPortNo: true, vendor: true,
          installStatus: true, locationType: true, odpOwner: true, provider: true,
          rfsDate: true, address: true, usageFor: true, description: true,
          modifyDate: true, modifyBy: true, createDate: true, createBy: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      db.odp.count({ where }),
    ])

    // Client-side filtering for capacity ranges (more accurate)
    let filteredOdps = odps
    if (capacityRanges) {
      const selectedRanges = capacityRanges.split(',').map(v => v.trim()).filter(Boolean)
      filteredOdps = odps.filter(o => {
        const usage = o.capacity > 0 ? Math.round((o.totalAssigned / o.capacity) * 100) : 0
        return selectedRanges.some(rangeLabel => {
          const [minPct, maxPct] = CAPACITY_RANGES[rangeLabel] || []
          return minPct !== undefined && usage >= minPct && usage <= maxPct
        })
      })
    }

    return NextResponse.json({
      data: filteredOdps,
      pagination: {
        page,
        limit,
        total: capacityRanges ? filteredOdps.length : total,
        totalPages: Math.ceil((capacityRanges ? filteredOdps.length : total) / limit),
      },
    })
  } catch (error) {
    console.error('ODP query error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ODP data' },
      { status: 500 }
    )
  }
}
