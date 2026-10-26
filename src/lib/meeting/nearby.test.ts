import { describe, expect, it } from 'vitest'
import { rankNearby, walkMinutes, type NearbyPlace } from './nearby'

const place = (name: string, distance: number, category = '음식점 > 카페 > 커피전문점'): NearbyPlace => ({
  id: name,
  name,
  category,
  address: '',
  phone: '',
  lat: 37.56,
  lng: 127.03,
  distance,
  url: '',
})

describe('walkMinutes', () => {
  it('최소 1분, 거리에 비례', () => {
    expect(walkMinutes(0)).toBe(1)
    expect(walkMinutes(500)).toBe(10)
  })
})

describe('rankNearby', () => {
  it('카페: 넓은 매장 브랜드는 조금 멀어도 앞에, 테마카페·스터디카페는 뺀다', () => {
    const ranked = rankNearby('cafe', [
      place('동네커피', 100),
      place('스타벅스 왕십리역점', 200),
      place('보드게임카페', 50, '음식점 > 카페 > 테마카페 > 보드카페'),
      place('집중 스터디카페', 60, '음식점 > 카페 > 테마카페 > 스터디카페'),
    ])
    expect(ranked.map((r) => r.name)).toEqual(['스타벅스 왕십리역점', '동네커피'])
    expect(ranked[0].note).toContain('단체석')
    expect(ranked[1].kindLabel).toBe('커피전문점')
  })

  it('스터디: 대화할 수 있는 스터디룸을 1인석 스터디카페보다 앞에, 독서실은 뺀다', () => {
    const ranked = rankNearby('study', [
      place('집중 스터디카페', 100, '서비스 > 스터디카페'),
      place('왕십리 스터디룸', 300, '서비스 > 스터디룸'),
      place('행복독서실', 50, '교육 > 독서실'),
    ])
    expect(ranked.map((r) => r.name)).toEqual(['왕십리 스터디룸', '집중 스터디카페'])
    expect(ranked[1].note).toContain('1인석')
  })

  it('주차장: 공영주차장 우선, 거주자 전용은 뺀다', () => {
    const ranked = rankNearby('parking', [
      place('민영주차장', 100, '교통 > 주차장'),
      place('행당동 공영주차장', 200, '교통 > 주차장 > 공영주차장'),
      place('거주자우선주차구역', 30, '교통 > 주차장'),
    ])
    expect(ranked.map((r) => r.name)).toEqual(['행당동 공영주차장', '민영주차장'])
  })

  it('보너스가 같으면 가까운 순, 개수 제한', () => {
    const many = Array.from({ length: 10 }, (_, i) => place(`카페${i}`, 900 - i * 80))
    const ranked = rankNearby('cafe', many, 6)
    expect(ranked).toHaveLength(6)
    for (let i = 1; i < ranked.length; i++) expect(ranked[i].distance).toBeGreaterThanOrEqual(ranked[i - 1].distance)
  })
})
