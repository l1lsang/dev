import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { fetchNearby, NearbyUnavailableError } from '../api/nearby'
import type { Hub } from '../lib/meeting/hubs'
import { NEARBY_KINDS, rankNearby, type NearbyKind, type RankedPlace } from '../lib/meeting/nearby'
import { mapLinks } from '../lib/meeting/optimize'
import { TabPanel, Tabs } from './list'
import { MapView, type MapMarker } from './MapView'
import { ErrorState, ListSkeleton } from './states'

const SEARCH_WORDS: Record<NearbyKind, string> = {
  cafe: '카페',
  study: '스터디룸',
  meeting: '회의실 대여',
  parking: '공영주차장',
}

const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`)

const directions = (p: RankedPlace) =>
  `https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.lat},${p.lng}`

function MapAppLinks({ hub }: { hub: Hub }) {
  return (
    <ul className="nearby-fallback-links">
      {NEARBY_KINDS.map((k) => (
        <li key={k.id}>
          <a className="btn btn-secondary" href={mapLinks.kakaoSearch(`${hub.name} ${SEARCH_WORDS[k.id]}`)} target="_blank" rel="noreferrer">
            카카오맵에서 {k.id === 'study' ? '스터디룸' : k.label} 찾기
            <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * 추천 역 주변의 카페 · 스터디 공간 · 회의실 · 주차장.
 * renderPlaceAction: 모임장에게 "여기로 일정 잡기" 같은 버튼을 붙일 때
 */
export function NearbyPlaces({
  hub,
  renderPlaceAction,
}: {
  hub: Hub
  renderPlaceAction?: (place: RankedPlace, kind: NearbyKind) => ReactNode
}) {
  const [kind, setKind] = useState<NearbyKind>('cafe')
  const [activeId, setActiveId] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['nearby', hub.id],
    queryFn: () => fetchNearby(hub),
    staleTime: 60 * 60 * 1000,
    retry: (count, error) => !(error instanceof NearbyUnavailableError) && count < 1,
  })

  const ranked = useMemo(() => {
    if (!q.data) return null
    const out = {} as Record<NearbyKind, RankedPlace[]>
    for (const k of NEARBY_KINDS) out[k.id] = rankNearby(k.id, q.data[k.id] ?? [])
    return out
  }, [q.data])

  const kindInfo = NEARBY_KINDS.find((k) => k.id === kind)!
  const places = ranked?.[kind] ?? []

  const markers: MapMarker[] = [
    { id: 'hub', kind: 'pick', label: hub.name, lat: hub.lat, lng: hub.lng },
    ...places.map((p, i) => ({
      id: p.id,
      kind: 'poi' as const,
      rank: i + 1,
      active: p.id === activeId,
      label: `${i + 1}. ${p.name}`,
      lat: p.lat,
      lng: p.lng,
    })),
  ]

  return (
    <section className="nearby" aria-labelledby="nearby-title">
      <div className="nearby-head">
        <h3 id="nearby-title">{hub.name} 근처에서 모일 곳</h3>
        <span className="meta">카카오 장소 정보 · 역 중심에서 잰 거리</span>
      </div>

      {q.isError && q.error instanceof NearbyUnavailableError ? (
        <div className="nearby-fallback">
          <p className="secondary">주변 장소 추천을 지금 불러올 수 없어요. 지도 앱에서 바로 찾아보세요.</p>
          {import.meta.env.DEV && (
            <p className="meta">개발 안내: .env에 KAKAO_REST_API_KEY를 넣고 개발 서버를 다시 켜면 여기서 추천해요. README 참고.</p>
          )}
          <MapAppLinks hub={hub} />
        </div>
      ) : (
        <>
          <Tabs<NearbyKind>
            label="장소 종류"
            value={kind}
            onChange={(k) => {
              setKind(k)
              setActiveId(null)
            }}
            tabs={NEARBY_KINDS.map((k) => ({ id: k.id, label: k.label, count: ranked?.[k.id].length }))}
          />
          <TabPanel id={kind}>
            {q.isPending ? (
              <ListSkeleton rows={3} />
            ) : q.isError ? (
              <>
                <ErrorState error={q.error} onRetry={() => q.refetch()} title="주변 장소를 불러오지 못했어요" />
                {import.meta.env.DEV && (q.error as { code?: string }).code === 'kakao_auth' && (
                  <p className="meta nearby-dev-hint">
                    개발 안내: 카카오 REST API 키가 맞는지, 카카오 개발자 콘솔에서 카카오맵 사용 설정이 켜져 있는지 확인해 주세요.
                  </p>
                )}
              </>
            ) : (
              <div className="nearby-body">
                <div className="nearby-list-wrap">
                  {places.length === 0 ? (
                    <div className="nearby-empty">
                      <p className="secondary">역에서 {formatDistance(kindInfo.radius)} 안에서는 찾은 곳이 없어요.</p>
                      <a
                        className="text-link"
                        href={mapLinks.kakaoSearch(`${hub.name} ${SEARCH_WORDS[kind]}`)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        카카오맵에서 더 넓게 찾아보기
                      </a>
                    </div>
                  ) : (
                    <ol className="nearby-list">
                      {places.map((p, i) => (
                        <li
                          key={p.id}
                          id={`nearby-${p.id}`}
                          className={`nearby-row${p.id === activeId ? ' is-active' : ''}`}
                          onMouseEnter={() => setActiveId(p.id)}
                          onFocus={() => setActiveId(p.id)}
                        >
                          <span className="nearby-rank num" aria-hidden="true">
                            {i + 1}
                          </span>
                          <div className="nearby-main">
                            <a href={p.url} target="_blank" rel="noreferrer" className="row-title nearby-name">
                              {p.name}
                              <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
                              <span className="visually-hidden"> (카카오맵에서 열기)</span>
                            </a>
                            <p className="meta dot-sep">
                              {p.kindLabel && <span>{p.kindLabel}</span>}
                              <span>
                                도보 {p.walkMinutes}분 · {formatDistance(p.distance)}
                              </span>
                              {p.phone && <span>{p.phone}</span>}
                            </p>
                            {p.note && <p className="secondary nearby-note">{p.note}</p>}
                          </div>
                          <div className="nearby-actions">
                            {renderPlaceAction?.(p, kind)}
                            <a className="btn btn-ghost" href={directions(p)} target="_blank" rel="noreferrer">
                              길찾기
                            </a>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                  {q.data?.partial && <p className="meta nearby-partial">일부 검색 결과를 불러오지 못했어요. 잠시 뒤 다시 열면 채워져요.</p>}
                </div>
                <div className="nearby-map">
                  <MapView
                    label={`${hub.name} 근처 ${kindInfo.label} 지도`}
                    markers={markers}
                    height={320}
                    onMarkerClick={(id) => {
                      if (id === 'hub') return
                      setActiveId(id)
                      document.getElementById(`nearby-${id}`)?.scrollIntoView({ block: 'nearest' })
                    }}
                  />
                </div>
              </div>
            )}
          </TabPanel>
          <details className="method nearby-method">
            <summary>추천 기준</summary>
            <p>
              역에서 걷는 시간이 짧은 순으로 보여 줘요. 여럿이 노트북을 펴고 이야기하기 좋은 곳(단체석이 많은 브랜드 카페,
              방을 통째로 빌리는 스터디룸, 시간 단위 회의실, 요금이 싼 공영주차장)은 조금 앞에 두고, 1인석 위주인
              스터디카페는 뒤로 보냈어요. 테마카페·독서실·거주자 전용 주차장은 뺐어요. 영업시간과 예약 가능 여부는
              카카오맵에서 확인해 주세요.
            </p>
          </details>
        </>
      )}
    </section>
  )
}
