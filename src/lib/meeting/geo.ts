export type LatLng = { lat: number; lng: number }

const EARTH_RADIUS_KM = 6371.0088
const KM_PER_DEG_LAT = 110.574
const KM_PER_DEG_LNG_EQUATOR = 111.32

const toRad = (deg: number) => (deg * Math.PI) / 180

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

type Point = { x: number; y: number }

/**
 * 도시 규모(수십 km)에서는 등장방형 투영이 충분히 정확하다.
 * 기준 위도를 점들의 평균으로 잡아 x/y를 km 단위 평면 좌표로 바꾼다.
 */
function makeProjection(points: LatLng[]) {
  const lat0 = points.reduce((sum, p) => sum + p.lat, 0) / points.length
  const kx = KM_PER_DEG_LNG_EQUATOR * Math.cos(toRad(lat0))
  return {
    project: (p: LatLng): Point => ({ x: p.lng * kx, y: p.lat * KM_PER_DEG_LAT }),
    unproject: (p: Point): LatLng => ({ lat: p.y / KM_PER_DEG_LAT, lng: p.x / kx }),
  }
}

/**
 * 기하 중앙값(Weiszfeld 알고리즘): 모든 사람까지의 직선거리 합이 최소인 지점.
 */
export function geometricMedian(points: LatLng[], maxIterations = 200, epsilonKm = 1e-6): LatLng {
  if (points.length === 0) throw new Error('points must not be empty')
  if (points.length === 1) return { ...points[0] }

  const { project, unproject } = makeProjection(points)
  const xs = points.map(project)
  let current: Point = {
    x: xs.reduce((s, p) => s + p.x, 0) / xs.length,
    y: xs.reduce((s, p) => s + p.y, 0) / xs.length,
  }

  for (let i = 0; i < maxIterations; i++) {
    let numX = 0
    let numY = 0
    let denom = 0
    let coincident: Point | null = null

    for (const p of xs) {
      const d = Math.hypot(p.x - current.x, p.y - current.y)
      if (d < 1e-12) {
        coincident = p
        continue
      }
      numX += p.x / d
      numY += p.y / d
      denom += 1 / d
    }

    // 현재 추정치가 입력점과 겹치면 그 점이 최적인지 확인하고 멈춘다
    if (denom === 0) break
    const next = { x: numX / denom, y: numY / denom }
    if (coincident && Math.hypot(next.x - current.x, next.y - current.y) < epsilonKm) break

    const moved = Math.hypot(next.x - current.x, next.y - current.y)
    current = next
    if (moved < epsilonKm) break
  }

  return unproject(current)
}

type Circle = { c: Point; r: number }

const inCircle = (circle: Circle, p: Point) =>
  Math.hypot(p.x - circle.c.x, p.y - circle.c.y) <= circle.r + 1e-9

function circleFrom2(a: Point, b: Point): Circle {
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  return { c, r: Math.hypot(a.x - c.x, a.y - c.y) }
}

function circleFrom3(a: Point, b: Point, c: Point): Circle | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
  if (Math.abs(d) < 1e-12) return null
  const a2 = a.x ** 2 + a.y ** 2
  const b2 = b.x ** 2 + b.y ** 2
  const c2 = c.x ** 2 + c.y ** 2
  const center = {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  }
  return { c: center, r: Math.hypot(a.x - center.x, a.y - center.y) }
}

/**
 * 최소 포함 원의 중심: 가장 멀리 사는 사람의 거리가 최소가 되는 지점.
 * 인원이 많지 않으므로(최대 수십 명) 단순 증분 알고리즘으로 충분하다.
 */
export function minimaxCenter(points: LatLng[]): LatLng {
  if (points.length === 0) throw new Error('points must not be empty')
  if (points.length === 1) return { ...points[0] }

  const { project, unproject } = makeProjection(points)
  const ps = points.map(project)
  let circle: Circle = { c: ps[0], r: 0 }

  for (let i = 1; i < ps.length; i++) {
    if (inCircle(circle, ps[i])) continue
    circle = { c: ps[i], r: 0 }
    for (let j = 0; j < i; j++) {
      if (inCircle(circle, ps[j])) continue
      circle = circleFrom2(ps[i], ps[j])
      for (let k = 0; k < j; k++) {
        if (inCircle(circle, ps[k])) continue
        circle = circleFrom3(ps[i], ps[j], ps[k]) ?? circle
      }
    }
  }

  return unproject(circle.c)
}

export function roundCoord(value: number, digits = 3): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}
