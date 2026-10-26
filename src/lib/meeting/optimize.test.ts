import { describe, expect, it } from 'vitest'
import { geometricMedian, haversineKm, minimaxCenter } from './geo'
import { HUBS } from './hubs'
import { estimateMinutes, planMeeting, scoreHub, type Participant } from './optimize'

const hub = (id: string) => {
  const h = HUBS.find((x) => x.id === id)
  if (!h) throw new Error(`unknown hub ${id}`)
  return h
}

const at = (id: string, name = id): Participant => ({ id: name, name, lat: hub(id).lat, lng: hub(id).lng })

describe('geo', () => {
  it('haversine: 서울역-부산역 직선거리는 약 325km', () => {
    const km = haversineKm(hub('seoul'), hub('busan'))
    expect(km).toBeGreaterThan(315)
    expect(km).toBeLessThan(335)
  })

  it('대칭 배치의 기하 중앙값은 가운데', () => {
    const c = { lat: 37.55, lng: 127.0 }
    const pts = [
      { lat: c.lat + 0.05, lng: c.lng },
      { lat: c.lat - 0.05, lng: c.lng },
      { lat: c.lat, lng: c.lng + 0.05 },
      { lat: c.lat, lng: c.lng - 0.05 },
    ]
    const m = geometricMedian(pts)
    expect(haversineKm(m, c)).toBeLessThan(0.01)
  })

  it('기하 중앙값은 이상치에 끌려가지 않는다', () => {
    const cluster = [
      { lat: 37.55, lng: 126.92 },
      { lat: 37.551, lng: 126.921 },
      { lat: 37.549, lng: 126.919 },
    ]
    const outlier = { lat: 37.2, lng: 127.1 }
    const m = geometricMedian([...cluster, outlier])
    expect(haversineKm(m, cluster[0])).toBeLessThan(0.5)
  })

  it('두 점의 최소 포함 원 중심은 중점', () => {
    const a = { lat: 37.5, lng: 126.9 }
    const b = { lat: 37.6, lng: 127.1 }
    const c = minimaxCenter([a, b])
    expect(Math.abs(haversineKm(c, a) - haversineKm(c, b))).toBeLessThan(0.01)
  })

  it('최소 포함 원 중심은 가장 먼 거리를 줄인다', () => {
    const pts = [hub('hapjeong'), hub('jamsil'), hub('nowon'), hub('sadang')]
    const fair = minimaxCenter(pts)
    const med = geometricMedian(pts)
    const worst = (c: { lat: number; lng: number }) => Math.max(...pts.map((p) => haversineKm(p, c)))
    expect(worst(fair)).toBeLessThanOrEqual(worst(med) + 1e-6)
  })
})

describe('estimateMinutes', () => {
  it('가까우면 걷는 시간으로 계산', () => {
    expect(estimateMinutes(0.4, 1)).toBeCloseTo(0.4 * 13)
  })

  it('거리가 늘면 시간도 늘어난다', () => {
    let prev = 0
    for (const km of [0.5, 2, 5, 10, 20, 40, 120]) {
      const t = estimateMinutes(km, 2)
      expect(t).toBeGreaterThan(prev)
      prev = t
    }
  })

  it('환승역일수록 같은 거리에서 덜 걸린다', () => {
    expect(estimateMinutes(10, 4)).toBeLessThan(estimateMinutes(10, 1))
  })

  it('서울 시내 10km는 30~40분 수준', () => {
    const t = estimateMinutes(10, 2)
    expect(t).toBeGreaterThan(28)
    expect(t).toBeLessThan(42)
  })
})

describe('planMeeting', () => {
  const group = [at('hapjeong', '합정'), at('jamsil', '잠실'), at('nowon', '노원')]

  it('흩어진 세 사람에게 서울 안쪽 후보를 준다', () => {
    const plan = planMeeting(group)
    expect(plan.results.length).toBeGreaterThan(0)
    const best = plan.results[0]
    // 셋 중 한 사람의 동네가 아니라 가운데 쪽이어야 한다
    expect(['hapjeong', 'jamsil', 'nowon']).not.toContain(best.hub.id)
    expect(best.maxMinutes).toBeLessThan(scoreHub(hub('hapjeong'), group, 0.5).maxMinutes)
  })

  it('공평함 가중치를 올리면 가장 오래 걸리는 사람의 시간이 줄거나 같다', () => {
    const efficient = planMeeting(group, { fairness: 0 }).results[0]
    const fair = planMeeting(group, { fairness: 1 }).results[0]
    expect(fair.maxMinutes).toBeLessThanOrEqual(efficient.maxMinutes + 1e-9)
  })

  it('결과 후보끼리는 최소 간격 이상 떨어져 있다', () => {
    const plan = planMeeting(group, { limit: 5, minSeparationKm: 1.5 })
    for (let i = 0; i < plan.results.length; i++) {
      for (let j = i + 1; j < plan.results.length; j++) {
        expect(haversineKm(plan.results[i].hub, plan.results[j].hub)).toBeGreaterThanOrEqual(1.5)
      }
    }
  })

  it('점수 순으로 정렬된다', () => {
    const { results } = planMeeting(group)
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i - 1].score)
    }
  })

  it('모두 같은 동네면 그 동네 역이 1순위', () => {
    const plan = planMeeting([at('pangyo', 'a'), at('pangyo', 'b'), at('pangyo', 'c')])
    expect(plan.results[0].hub.id).toBe('pangyo')
  })

  it('후보 역이 없는 지역이면 결과를 비우고 중심 좌표만 준다', () => {
    const jeju: Participant[] = [
      { id: 'a', name: 'a', lat: 33.4996, lng: 126.5312 },
      { id: 'b', name: 'b', lat: 33.2541, lng: 126.56 },
    ]
    const plan = planMeeting(jeju)
    expect(plan.results).toHaveLength(0)
    expect(plan.center.lat).toBeGreaterThan(33)
    expect(plan.center.lat).toBeLessThan(34)
  })

  it('참가자가 없으면 오류', () => {
    expect(() => planMeeting([])).toThrow()
  })
})
