import { roundCoord } from './meeting/geo'

export type Place = { label: string; detail: string; lat: number; lng: number }

type NominatimItem = {
  lat: string
  lon: string
  name?: string
  display_name: string
}

/**
 * OpenStreetMap Nominatim 검색 (키 불필요).
 * 사용 정책상 자동완성용으로 쓰면 안 되므로, 사용자가 검색 버튼을 눌렀을 때만 호출한다.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'kr',
    'accept-language': 'ko',
    limit: '5',
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal })
  if (!res.ok) throw new Error(`geocode ${res.status}`)
  const items = (await res.json()) as NominatimItem[]
  return items.map((item) => {
    const parts = item.display_name.split(',').map((s) => s.trim())
    return {
      label: item.name || parts[0],
      // 대한민국 · 우편번호는 빼고 시/구/동 정도만 남긴다
      detail: parts
        .slice(1)
        .filter((p) => p !== '대한민국' && !/^\d{5}$/.test(p))
        .reverse()
        .slice(0, 3)
        .join(' '),
      lat: roundCoord(Number(item.lat), 4),
      lng: roundCoord(Number(item.lon), 4),
    }
  })
}

export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  })
}
