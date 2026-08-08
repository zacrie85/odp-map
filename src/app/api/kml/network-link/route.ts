import { NextRequest, NextResponse } from 'next/server'

// Returns a KML file with a NetworkLink that Google Earth can open.
// Google Earth will auto-refresh this link periodically.
// Usage: Download this file and open in Google Earth, or add as NetworkLink.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // Get the base URL (use the referer or a provided host param)
  const host = searchParams.get('host') || ''
  const protocol = searchParams.get('protocol') || 'http'
  const refreshMinutes = parseInt(searchParams.get('refresh') || '5')

  // Human-readable refresh interval
  const refreshLabel = refreshMinutes >= 60
    ? `${refreshMinutes / 60} jam`
    : `${refreshMinutes} menit`

  // Build the KML data URL - include any filter params passed through
  const filterParams = ['status', 'kecamatan', 'region', 'odpOwner', 'installStatus', 'codeSearch', 'activeRanges', 'capacityRanges', 'hasCoord', 'customField', 'customValues', 'search']
  const paramsParts: string[] = []
  for (const p of filterParams) {
    const v = searchParams.get(p)
    if (v) paramsParts.push(`${p}=${encodeURIComponent(v)}`)
  }
  const filterStr = paramsParts.length > 0 ? '?' + paramsParts.join('&') : ''

  // Determine the KML data URL
  let kmlDataUrl: string
  if (host) {
    kmlDataUrl = `${protocol}://${host}/api/kml${filterStr}`
  } else {
    // Fallback: use request headers
    const reqHost = req.headers.get('host') || 'localhost:3000'
    const reqProto = req.headers.get('x-forwarded-proto') || 'http'
    kmlDataUrl = `${reqProto}://${reqHost}/api/kml${filterStr}`
  }

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <NetworkLink>
    <name>ODP Map Viewer - Real-time</name>
    <description>Data ODP realtime. Auto-refresh setiap ${refreshLabel}. Terakhir diunduh oleh Google Earth secara otomatis.</description>
    <refreshVisibility>0</refreshVisibility>
    <flyToView>0</flyToView>
    <Link>
      <href>${kmlDataUrl}</href>
      <refreshMode>onInterval</refreshMode>
      <refreshInterval>${refreshMinutes * 60}</refreshInterval>
      <viewRefreshMode>never</viewRefreshMode>
    </Link>
  </NetworkLink>
</kml>`

  return new NextResponse(kml, {
    headers: {
      'Content-Type': 'application/vnd.google-earth.kml+xml',
      'Content-Disposition': 'attachment; filename="odp-realtime.kml"',
    },
  })
}
