// api/places.ts 응답과 같은 모양 (서버 파일은 다른 파일을 import하지 않아서 여기 따로 둔다)
export type NearbyKind = 'cafe' | 'study' | 'meeting' | 'parking'

export type NearbyPlace = {
  id: string
  name: string
  category: string
  address: string
  phone: string
  lat: number
  lng: number
  distance: number
  url: string
}

export type NearbyResult = Record<NearbyKind, NearbyPlace[]> & { partial: boolean }

export type RankedPlace = NearbyPlace & {
  walkMinutes: number
  /** 카테고리 경로의 마지막 부분 (예: 커피전문점) */
  kindLabel: string
  /** 추천 이유나 주의할 점 */
  note: string | null
  score: number
}

export const NEARBY_KINDS: { id: NearbyKind; label: string; radius: number }[] = [
  { id: 'cafe', label: '카페', radius: 500 },
  { id: 'study', label: '스터디', radius: 800 },
  { id: 'meeting', label: '회의실', radius: 1000 },
  { id: 'parking', label: '주차장', radius: 600 },
]

const WALK_M_PER_MIN = 67 // 시속 4km
const DETOUR = 1.3 // 직선거리 대비 실제 걷는 거리

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * DETOUR) / WALK_M_PER_MIN))
}

// 단체석이 있는 넓은 매장이 많은 브랜드
const ROOMY_CAFES = ['스타벅스', '투썸플레이스', '할리스', '탐앤탐스', '커피빈', '폴바셋', '엔제리너스', '파스쿠찌']

const has = (text: string, words: string[]) => words.some((w) => text.includes(w))

type Judgement = { exclude?: boolean; bonus?: number; note?: string }

/** 개발자 모임(3~8명이 노트북 펴고 이야기하는 자리)에 맞는지 판단한다 */
function judge(kind: NearbyKind, p: NearbyPlace): Judgement {
  const text = `${p.name} ${p.category}`
  switch (kind) {
    case 'cafe':
      // 보드게임·만화·동물 카페 같은 테마카페와 스터디카페는 카페 목록에서 뺀다
      if (has(p.category, ['테마카페', '스터디카페']) || has(p.name, ['스터디카페'])) return { exclude: true }
      if (has(p.name, ROOMY_CAFES)) return { bonus: 3, note: '단체석이 있는 넓은 매장이 많은 브랜드예요' }
      if (has(p.name, ['24시', '24H', '24h'])) return { bonus: 1, note: '24시간 운영' }
      return {}
    case 'study':
      if (has(text, ['독서실'])) return { exclude: true }
      if (has(text, ['스터디룸', '세미나', '회의실', '모임공간', '파티룸'])) {
        return { bonus: 4, note: '방을 통째로 빌려서 소리 내 이야기할 수 있어요' }
      }
      return { bonus: -2, note: '1인석 위주라 대화가 어려울 수 있어요. 스터디룸이 있는지 확인해 보세요' }
    case 'meeting':
      if (has(text, ['공유오피스', '오피스'])) return { note: '회의실을 시간 단위로 빌려주는지 확인해 보세요' }
      if (has(text, ['회의실', '세미나', '스터디룸'])) return { bonus: 2, note: '시간 단위로 예약하는 회의 공간' }
      return {}
    case 'parking':
      if (has(p.name, ['거주자', '전용', '사원', '직원'])) return { exclude: true }
      if (has(p.name, ['공영'])) return { bonus: 3, note: '공영주차장이라 요금이 저렴한 편이에요' }
      return {}
  }
}

/** 걷는 시간이 짧을수록, 모임에 맞을수록 앞에 둔다 */
export function rankNearby(kind: NearbyKind, places: NearbyPlace[], limit = 6): RankedPlace[] {
  return places
    .map((p) => ({ p, j: judge(kind, p) }))
    .filter(({ j }) => !j.exclude)
    .map(({ p, j }) => {
      const minutes = walkMinutes(p.distance)
      const parts = p.category.split('>').map((s) => s.trim())
      return {
        ...p,
        walkMinutes: minutes,
        kindLabel: parts[parts.length - 1] || '',
        note: j.note ?? null,
        score: minutes - (j.bonus ?? 0),
      }
    })
    .sort((a, b) => a.score - b.score || a.distance - b.distance)
    .slice(0, limit)
}
