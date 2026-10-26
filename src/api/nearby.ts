import type { LatLng } from '../lib/meeting/geo'
import type { NearbyResult } from '../lib/meeting/nearby'

/** 서버에 카카오 키가 없을 때 — 지도 앱 링크로 대신한다 */
export class NearbyUnavailableError extends Error {
  constructor() {
    super('주변 장소 검색이 설정되지 않았어요.')
    this.name = 'NearbyUnavailableError'
  }
}

export async function fetchNearby(p: LatLng): Promise<NearbyResult> {
  // 소수 넷째 자리로 맞춰서 같은 역은 같은 주소 → CDN 캐시를 같이 쓴다
  const res = await fetch(`/api/places?lat=${p.lat.toFixed(4)}&lng=${p.lng.toFixed(4)}`)
  if (res.status === 501) throw new NearbyUnavailableError()
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw Object.assign(new Error(`주변 장소 검색 실패 (${res.status})`), { code: body.error ?? String(res.status) })
  }
  // 정적 호스팅처럼 /api가 없는 곳에서는 index.html이 돌아온다
  if (!res.headers.get('content-type')?.includes('application/json')) throw new NearbyUnavailableError()
  return (await res.json()) as NearbyResult
}
