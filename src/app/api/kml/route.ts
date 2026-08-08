import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

const ACTIVE_RANGES: Record<string, [number, number]> = {
  '0': [0, 0], '1 - 5': [1, 5], '6 - 10': [6, 10],
  '11 - 20': [11, 20], '21 - 50': [21, 50], '51 +': [51, Infinity],
}

const CAPACITY_RANGES: Record<string, [number, number]> = {
  'Kosong (0%)': [0, 0], 'Rendah (1-50%)': [1, 50],
  'Sedang (51-80%)': [51, 80], 'Tinggi (81-99%)': [81, 99], 'Penuh (100%)': [100, 100],
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// 3-segment KML color based on Active/Capacity: Merah 75-100%, Kuning 50-74%, Biru 0-49%
// KML uses AABBGGRR format
function getKmlUsageColor(active: number, capacity: number): string {
  if (capacity <= 0) return 'ff4444ef' // default
  const pct = (active / capacity) * 100
  if (pct >= 75) return 'ff4444ef' // Merah #ef4444 → AABBGGRR
  if (pct >= 50) return 'ff08b3ea' // Kuning #eab308 → AABBGGRR
  return 'fff6823b'               // Biru #3b82f6 → AABBGGRR
}

function getHexUsageColor(active: number, capacity: number): string {
  if (capacity <= 0) return '#ef4444'
  const pct = (active / capacity) * 100
  if (pct >= 75) return '#ef4444' // Merah
  if (pct >= 50) return '#eab308' // Kuning
  return '#3b82f6'               // Biru
}

function buildPlacemark(o: any): string {
  const activePct = o.capacity > 0 ? Math.round((o.active / o.capacity) * 100) : 0
  const usagePct = o.capacity > 0 ? Math.round((o.totalAssigned / o.capacity) * 100) : 0
  const segColor = getHexUsageColor(o.active, o.capacity)
  const kmlColor = getKmlUsageColor(o.active, o.capacity)
  const statusColor = o.status === 'ENABLE' ? '#22c55e' : '#ef4444'
  const availColor = o.availability === 'AVAILABLE' ? '#22c55e' : o.availability === 'FULL' ? '#ef4444' : '#f59e0b'

  return `    <Placemark>
      <name>${escapeXml(o.code)} - ${o.active}/${o.capacity}</name>
      <description><![CDATA[
<div style="font-family:Arial,sans-serif;font-size:12px;min-width:280px;">
  <div style="font-size:15px;font-weight:bold;margin-bottom:4px;color:#1e293b;">${escapeXml(o.code)} <span style="font-size:13px;color:${segColor};">(${o.active}/${o.capacity} = ${activePct}%)</span></div>
  <div style="font-size:11px;color:#64748b;margin-bottom:8px;">${escapeXml(o.name || '-')}</div>
  <table style="font-size:11px;border-collapse:collapse;width:100%;">
    <tr><td style="padding:2px 8px 2px 0;color:#64748b;"><b>Status</b></td><td style="color:${statusColor};font-weight:600;">${escapeXml(o.status)}</td><td style="padding:2px 8px 2px 0;color:#64748b;"><b>Avail</b></td><td style="color:${availColor};font-weight:600;">${escapeXml(o.availability)}</td></tr>
    <tr><td style="padding:2px 8px 2px 0;color:#64748b;"><b>Kecamatan</b></td><td colspan="3">${escapeXml(o.kecamatan || '-')}</td></tr>
    <tr><td style="padding:2px 8px 2px 0;color:#64748b;"><b>Region</b></td><td colspan="3">${escapeXml(o.region || '-')}</td></tr>
    <tr><td style="padding:2px 8px 2px 0;color:#64748b;"><b>Vendor</b></td><td colspan="3">${escapeXml(o.vendor || '-')}</td></tr>
    <tr><td style="padding:2px 8px 2px 0;color:#64748b;"><b>Pemilik</b></td><td colspan="3">${escapeXml(o.odpOwner || '-')}</td></tr>
    <tr><td style="padding:2px 8px 2px 0;color:#64748b;"><b>Instalasi</b></td><td colspan="3">${escapeXml(o.installStatus || '-')}</td></tr>
    <tr><td style="padding:2px 8px 2px 0;color:#64748b;"><b>Tipe Lokasi</b></td><td colspan="3">${escapeXml(o.locationType || '-')}</td></tr>
    <tr><td style="padding:2px 8px 2px 0;color:#64748b;"><b>ODC</b></td><td colspan="3">${escapeXml(o.odcCode || '-')} / ${escapeXml(o.odcName || '-')}</td></tr>
    <tr><td style="padding:2px 8px 2px 0;color:#64748b;"><b>Koordinat</b></td><td colspan="3">${escapeXml(o.coordinate || '-')}</td></tr>
  </table>
  <div style="margin-top:8px;padding:6px 8px;background:#f1f5f9;border-radius:6px;">
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
      <span>Active/Cap: ${o.active}/${o.capacity}</span>
      <span style="font-weight:600;color:${segColor};">${activePct}%</span>
    </div>
    <div style="background:#e2e8f0;border-radius:3px;height:8px;overflow:hidden;">
      <div style="background:${segColor};height:100%;width:${activePct}%;border-radius:3px;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:3px;">
      <span>Assigned: ${o.totalAssigned} | Terminate: ${o.terminate}</span>
      <span>Tersedia: ${o.availableCnt}</span>
    </div>
  </div>
  ${o.modifyDate ? `<div style="margin-top:6px;font-size:9px;color:#cbd5e1;">Diubah: ${escapeXml(o.modifyDate)}</div>` : ''}
</div>]]></description>
      <Style>
        <IconStyle><color>${kmlColor}</color><scale>0.6</scale></IconStyle>
        <LabelStyle><scale>1</scale></LabelStyle>
      </Style>
      <Point>
        <coordinates>${o.longitude},${o.latitude},0</coordinates>
      </Point>
    </Placemark>
`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const status = searchParams.get('status') || ''
  const kecamatan = searchParams.get('kecamatan') || ''
  const region = searchParams.get('region') || ''
  const odpOwner = searchParams.get('odpOwner') || ''
  const installStatus = searchParams.get('installStatus') || ''
  const codeSearch = searchParams.get('codeSearch') || ''
  const activeRanges = searchParams.get('activeRanges') || ''
  const capacityRanges = searchParams.get('capacityRanges') || ''
  const hasCoord = searchParams.get('hasCoord') || ''
  const customField = searchParams.get('customField') || ''
  const customValues = searchParams.get('customValues') || ''
  const search = searchParams.get('search') || ''

  const where: Prisma.OdpWhereInput = {}
  const andConditions: Prisma.OdpWhereInput[] = []

  const addMultiFilter = (field: string, values: string) => {
    const arr = values.split(',').map(v => v.trim()).filter(Boolean)
    if (arr.length === 1) (where as any)[field] = arr[0]
    else if (arr.length > 1) (where as any)[field] = { in: arr }
  }

  if (status) addMultiFilter('status', status)
  if (kecamatan) addMultiFilter('kecamatan', kecamatan)
  if (region) addMultiFilter('region', region)
  if (odpOwner) addMultiFilter('odpOwner', odpOwner)
  if (installStatus) addMultiFilter('installStatus', installStatus)
  if (codeSearch) andConditions.push({ code: { contains: codeSearch } })
  if (search) andConditions.push({ OR: [{ code: { contains: search } }, { name: { contains: search } }, { address: { contains: search } }] })

  if (activeRanges) {
    const ors: Prisma.OdpWhereInput[] = []
    for (const rl of activeRanges.split(',').map(v => v.trim()).filter(Boolean)) {
      const [min, max] = ACTIVE_RANGES[rl] || []
      if (min !== undefined) ors.push(max === Infinity ? { active: { gte: min } } : { active: { gte: min, lte: max } })
    }
    if (ors.length) andConditions.push({ OR: ors })
  }

  if (hasCoord === 'true') {
    andConditions.push({ latitude: { not: 0 } }, { longitude: { not: 0 } })
  } else if (hasCoord === 'false') {
    andConditions.push({ OR: [{ latitude: 0 }, { longitude: 0 }] })
  }

  if (customField && customValues) {
    const allowed = ['status', 'availability', 'kecamatan', 'city', 'region', 'locationType', 'vendor', 'odpOwner', 'provider', 'installStatus', 'checkStatus', 'kelurahan']
    if (allowed.includes(customField)) {
      const vals = customValues.split(',').map(v => v.trim()).filter(Boolean)
      if (vals.length === 1) (where as any)[customField] = vals[0]
      else if (vals.length > 1) (where as any)[customField] = { in: vals }
    }
  }

  if (andConditions.length) where.AND = andConditions

  try {
    const odps = await db.odp.findMany({
      where,
      select: {
        code: true, name: true, kecamatan: true, city: true, region: true,
        status: true, availability: true, capacity: true, totalAssigned: true,
        active: true, terminate: true, availableCnt: true, latitude: true,
        longitude: true, coordinate: true, odcCode: true, odcName: true,
        vendor: true, installStatus: true, locationType: true, odpOwner: true,
        address: true, modifyDate: true,
      },
      take: 25000,
      orderBy: { code: 'asc' },
    })

    // Client-side capacity filter
    let filtered = odps
    if (capacityRanges) {
      const sel = capacityRanges.split(',').map(v => v.trim()).filter(Boolean)
      filtered = odps.filter(o => {
        const usage = o.capacity > 0 ? Math.round((o.totalAssigned / o.capacity) * 100) : 0
        return sel.some(rl => {
          const [min, max] = CAPACITY_RANGES[rl] || []
          return min !== undefined && usage >= min && usage <= max
        })
      })
    }

    // Only points with coordinates
    const points = filtered.filter(o => o.latitude !== 0 && o.longitude !== 0)

    const now = new Date().toISOString()

    // Group points by region
    const regionGroups = new Map<string, typeof points>()
    for (const p of points) {
      const key = p.region || 'Tanpa Region'
      if (!regionGroups.has(key)) regionGroups.set(key, [])
      regionGroups.get(key)!.push(p)
    }

    // Sort regions alphabetically
    const sortedRegions = Array.from(regionGroups.entries()).sort(([a], [b]) => a.localeCompare(b))

    // Build KML with Folders per region
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document>
  <name>ODP Data - Real-time</name>
  <description>Data ODP terbaru dari ODP Map Viewer. Diperbarui: ${now}. Total: ${points.length} titik.</description>
  <open>1</open>
`

    // Shared styles - 3 segment colors
    kml += `  <Style id="style_blue">
    <IconStyle><color>fff6823b</color><scale>0.7</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle>
    <LabelStyle><scale>1</scale></LabelStyle>
  </Style>
  <Style id="style_yellow">
    <IconStyle><color>ff08b3ea</color><scale>0.7</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle>
    <LabelStyle><scale>1</scale></LabelStyle>
  </Style>
  <Style id="style_red">
    <IconStyle><color>ff4444ef</color><scale>0.7</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle>
    <LabelStyle><scale>1</scale></LabelStyle>
  </Style>
`

    // Create a Folder for each region, with sub-folders per color segment
    for (const [regionName, regionPoints] of sortedRegions) {
      const redPoints = regionPoints.filter(p => p.capacity > 0 && (p.active / p.capacity) * 100 >= 75)
      const yellowPoints = regionPoints.filter(p => { if (p.capacity <= 0) return false; const pct = (p.active / p.capacity) * 100; return pct >= 50 && pct < 75 })
      const bluePoints = regionPoints.filter(p => p.capacity <= 0 || (p.active / p.capacity) * 100 < 50)

      kml += `  <Folder>
    <name>${escapeXml(regionName)}</name>
    <description>Region: ${escapeXml(regionName)} | ${regionPoints.length} ODP (Merah: ${redPoints.length}, Kuning: ${yellowPoints.length}, Biru: ${bluePoints.length})</description>
    <open>1</open>
    <Style>
      <ListStyle>
        <listItemType>check</listItemType>
        <bgColor>ffeeeeee</bgColor>
        <maxSnippetLines>2</maxSnippetLines>
      </ListStyle>
    </Style>
`

      // Sub-folder: Merah (75-100%)
      if (redPoints.length > 0) {
        kml += `    <Folder>
      <name>Merah (75-100%) - ${redPoints.length} ODP</name>
      <description>Active/Capacity 75% sampai 100%</description>
      <open>0</open>
      <Style>
        <ListStyle>
          <listItemType>check</listItemType>
          <bgColor>fffef2f2</bgColor>
          <maxSnippetLines>2</maxSnippetLines>
        </ListStyle>
      </Style>
`
        for (const o of redPoints) {
          kml += buildPlacemark(o)
        }
        kml += `    </Folder>
`
      }

      // Sub-folder: Kuning (50-74%)
      if (yellowPoints.length > 0) {
        kml += `    <Folder>
      <name>Kuning (50-74%) - ${yellowPoints.length} ODP</name>
      <description>Active/Capacity 50% sampai 74%</description>
      <open>0</open>
      <Style>
        <ListStyle>
          <listItemType>check</listItemType>
          <bgColor>fffefce8</bgColor>
          <maxSnippetLines>2</maxSnippetLines>
        </ListStyle>
      </Style>
`
        for (const o of yellowPoints) {
          kml += buildPlacemark(o)
        }
        kml += `    </Folder>
`
      }

      // Sub-folder: Biru (0-49%)
      if (bluePoints.length > 0) {
        kml += `    <Folder>
      <name>Biru (0-49%) - ${bluePoints.length} ODP</name>
      <description>Active/Capacity 0% sampai 49%</description>
      <open>0</open>
      <Style>
        <ListStyle>
          <listItemType>check</listItemType>
          <bgColor>ffeff6ff</bgColor>
          <maxSnippetLines>2</maxSnippetLines>
        </ListStyle>
      </Style>
`
        for (const o of bluePoints) {
          kml += buildPlacemark(o)
        }
        kml += `    </Folder>
`
      }

      kml += `  </Folder>
`
    }

    kml += `</Document>
</kml>`

    return new NextResponse(kml, {
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml',
        'Content-Disposition': 'attachment; filename="odp-data.kml"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('KML generation error:', error)
    return NextResponse.json({ error: 'Failed to generate KML' }, { status: 500 })
  }
}
