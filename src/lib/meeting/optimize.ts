import { geometricMedian, haversineKm, minimaxCenter, type LatLng } from './geo'
import { HUBS, type Hub } from './hubs'

export type Participant = LatLng & { id: string; name: string }

export type Leg = { participantId: string; km: number; minutes: number }

export type PlaceResult = {
  hub: Hub
  legs: Leg[]
  meanMinutes: number
  maxMinutes: number
  minMinutes: number
  score: number
}

export type MeetingPlan = {
  /** 직선거리 합이 가장 작은 지점 */
  center: LatLng
  /** 가장 먼 사람의 거리가 가장 작은 지점 */
  fairCenter: LatLng
  results: PlaceResult[]
}

export type PlanOptions = {
  /** 0이면 평균 이동시간만, 1이면 가장 오래 걸리는 사람만 본다 */
  fairness?: number
  limit?: number
  hubs?: Hub[]
  /** 더 좋은 후보가 이 거리 안에 있으면 건너뛴다 (같은 동네 중복 방지) */
  minSeparationKm?: number
}

// 이동시간 모델: 직선거리를 대중교통 시간으로 바꾸는 단순 추정치
const WALK_MIN_PER_KM = 13
const ACCESS_MIN = 10 // 역까지 걷기 + 열차 대기
const METRO_MIN_PER_KM = 2.2 // 도시철도 평균 (정차·우회 포함)
const EXPRESS_MIN_PER_KM = 0.9 // 25km 넘는 구간은 광역급행·KTX 속도로 본다
const METRO_RANGE_KM = 25
const TRANSFER_MIN = 5
const VENUE_BONUS_MIN = 1.5 // 카페·스터디룸이 많은 상권에 주는 가산점

export const DEFAULT_FAIRNESS = 0.6

export function estimateMinutes(km: number, hubLines: number): number {
  const walk = km * WALK_MIN_PER_KM
  const rail =
    Math.min(km, METRO_RANGE_KM) * METRO_MIN_PER_KM +
    Math.max(0, km - METRO_RANGE_KM) * EXPRESS_MIN_PER_KM
  const expectedTransfers = km < 4 ? 0 : km < 15 ? 1 : 1.5
  // 노선이 많은 역일수록 갈아탈 일이 줄어든다
  const transferFactor = hubLines >= 3 ? 0.4 : hubLines === 2 ? 0.7 : 1
  const transit = ACCESS_MIN + rail + expectedTransfers * TRANSFER_MIN * transferFactor
  return Math.min(walk, transit)
}

export function scoreHub(hub: Hub, participants: Participant[], fairness: number): PlaceResult {
  const legs = participants.map((p) => {
    const km = haversineKm(p, hub)
    return { participantId: p.id, km, minutes: estimateMinutes(km, hub.lines) }
  })
  const minutes = legs.map((l) => l.minutes)
  const meanMinutes = minutes.reduce((s, m) => s + m, 0) / minutes.length
  const maxMinutes = Math.max(...minutes)
  const minMinutes = Math.min(...minutes)
  const score =
    (1 - fairness) * meanMinutes + fairness * maxMinutes - (hub.venues - 1) * VENUE_BONUS_MIN
  return { hub, legs, meanMinutes, maxMinutes, minMinutes, score }
}

export function planMeeting(participants: Participant[], options: PlanOptions = {}): MeetingPlan {
  if (participants.length === 0) throw new Error('participants must not be empty')
  const { limit = 5, hubs = HUBS, minSeparationKm = 1.5 } = options
  const fairness = Math.min(1, Math.max(0, options.fairness ?? DEFAULT_FAIRNESS))

  const center = geometricMedian(participants)
  const fairCenter = minimaxCenter(participants)

  // 모두를 감싸는 원보다 바깥에 있는 역은 후보가 될 이유가 없다.
  // 후보가 하나도 없으면(예: 데이터에 없는 지역) 결과를 비워 두고 중심 좌표만 돌려준다.
  const spread = Math.max(...participants.map((p) => haversineKm(p, fairCenter)))
  const searchRadiusKm = Math.max(10, spread * 1.2)

  const scored = hubs
    .filter((h) => haversineKm(h, fairCenter) <= searchRadiusKm)
    .map((h) => scoreHub(h, participants, fairness))
    .sort((a, b) => a.score - b.score || a.hub.name.localeCompare(b.hub.name, 'ko'))

  const results: PlaceResult[] = []
  for (const candidate of scored) {
    if (results.length >= limit) break
    if (results.some((r) => haversineKm(r.hub, candidate.hub) < minSeparationKm)) continue
    results.push(candidate)
  }

  return { center, fairCenter, results }
}

export const mapLinks = {
  kakaoSearch: (query: string) => `https://map.kakao.com/link/search/${encodeURIComponent(query)}`,
  naverSearch: (query: string) => `https://map.naver.com/p/search/${encodeURIComponent(query)}`,
  kakaoPoint: (name: string, p: LatLng) =>
    `https://map.kakao.com/link/map/${encodeURIComponent(name)},${p.lat},${p.lng}`,
}
