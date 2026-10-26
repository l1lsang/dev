/**
 * GET /api/places?lat=37.5612&lng=127.0371
 *
 * 역 주변의 카페 · 스터디 공간 · 회의실 · 주차장을 카카오 로컬 API로 찾아 돌려준다.
 * REST API 키는 서버에만 두고(KAKAO_REST_API_KEY), 응답은 CDN에 하루 캐시한다.
 * 순위 매기기는 화면 쪽(src/lib/meeting/nearby.ts)에서 한다.
 *
 * 로컬 개발에서는 vite.config.ts의 미들웨어가 이 파일을 그대로 불러 쓴다.
 * Vercel 배포에서 따로 번들되지 않도록 다른 파일을 import하지 않는다.
 */

export type NearbyKind = 'cafe' | 'study' | 'meeting' | 'parking'

export type NearbyPlace = {
  id: string
  name: string
  category: string
  address: string
  phone: string
  lat: number
  lng: number
  /** 검색 기준점에서의 직선거리(m) */
  distance: number
  url: string
}

export type NearbyResponse = Record<NearbyKind, NearbyPlace[]> & { partial: boolean }

type KakaoDocument = {
  id: string
  place_name: string
  category_name: string
  phone: string
  address_name: string
  road_address_name: string
  x: string
  y: string
  place_url: string
  distance: string
}

type Search = { kind: NearbyKind; radius: number } & ({ category: string } | { query: string })

// 종류마다 두 번까지만 부른다 (호출량 = 역 하나당 6번, 그것도 캐시된다)
const SEARCHES: Search[] = [
  { kind: 'cafe', category: 'CE7', radius: 500 },
  { kind: 'study', query: '스터디룸', radius: 800 },
  { kind: 'study', query: '스터디카페', radius: 800 },
  { kind: 'meeting', query: '회의실', radius: 1000 },
  { kind: 'meeting', query: '공유오피스', radius: 1000 },
  { kind: 'parking', category: 'PK6', radius: 600 },
]

const KAKAO = 'https://dapi.kakao.com/v2/local/search'

class UpstreamError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function json(body: unknown, status: number, cache = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache
        ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
        : 'no-store',
    },
  })
}

function toPlace(d: KakaoDocument): NearbyPlace {
  return {
    id: d.id,
    name: d.place_name,
    category: d.category_name,
    address: d.road_address_name || d.address_name,
    phone: d.phone,
    lat: Number(d.y),
    lng: Number(d.x),
    distance: Number(d.distance) || 0,
    url: d.place_url,
  }
}

async function search(key: string, s: Search, lat: number, lng: number): Promise<NearbyPlace[]> {
  const params = new URLSearchParams({
    x: String(lng),
    y: String(lat),
    radius: String(s.radius),
    sort: 'distance',
    size: '15',
  })
  let endpoint: string
  if ('category' in s) {
    params.set('category_group_code', s.category)
    endpoint = `${KAKAO}/category.json`
  } else {
    params.set('query', s.query)
    endpoint = `${KAKAO}/keyword.json`
  }

  const res = await fetch(`${endpoint}?${params}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new UpstreamError(res.status, text.slice(0, 200))
  }
  const body = (await res.json()) as { documents: KakaoDocument[] }
  return body.documents.map(toPlace)
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const lat = Number(url.searchParams.get('lat'))
  const lng = Number(url.searchParams.get('lng'))

  // 국내 좌표만 받는다
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 33 || lat > 39 || lng < 124 || lng > 132) {
    return json({ error: 'invalid_location' }, 400)
  }

  const key = process.env.KAKAO_REST_API_KEY
  if (!key) return json({ error: 'not_configured' }, 501)

  const results = await Promise.allSettled(SEARCHES.map((s) => search(key, s, lat, lng)))

  const out: NearbyResponse = { cafe: [], study: [], meeting: [], parking: [], partial: false }
  const seen: Record<NearbyKind, Set<string>> = {
    cafe: new Set(),
    study: new Set(),
    meeting: new Set(),
    parking: new Set(),
  }
  let failures = 0
  let authFailed = false

  results.forEach((r, i) => {
    const kind = SEARCHES[i].kind
    if (r.status === 'rejected') {
      failures++
      if (r.reason instanceof UpstreamError && (r.reason.status === 401 || r.reason.status === 403)) authFailed = true
      return
    }
    for (const place of r.value) {
      if (seen[kind].has(place.id)) continue
      seen[kind].add(place.id)
      out[kind].push(place)
    }
  })

  if (failures === SEARCHES.length) {
    // 401/403은 대개 키가 틀렸거나 카카오맵 사용 설정이 꺼진 경우
    return json({ error: authFailed ? 'kakao_auth' : 'upstream' }, 502)
  }
  out.partial = failures > 0
  for (const kind of Object.keys(seen) as NearbyKind[]) out[kind].sort((a, b) => a.distance - b.distance)

  return json(out, 200, !out.partial)
}
