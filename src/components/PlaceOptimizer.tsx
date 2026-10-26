import { ExternalLink, Route } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { formatMinutes } from '../lib/format'
import { mapLinks, planMeeting, type Participant, type PlaceResult } from '../lib/meeting/optimize'
import { MapView, type MapMarker } from './MapView'
import { EmptyState } from './states'

export function FairnessControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const id = useId()
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        무엇을 더 중요하게 볼까요
      </label>
      <input
        id={id}
        type="range"
        className="range"
        min={0}
        max={1}
        step={0.1}
        value={value}
        aria-valuetext={value < 0.35 ? '전체 이동시간 우선' : value > 0.65 ? '가장 먼 사람 우선' : '균형'}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="range-labels meta" aria-hidden="true">
        <span>전체 이동시간 줄이기</span>
        <span>가장 먼 사람 배려하기</span>
      </div>
    </div>
  )
}

export function PlaceResults({
  participants,
  fairness,
  renderAction,
  mapHeight = 400,
}: {
  participants: Participant[]
  fairness: number
  renderAction?: (result: PlaceResult) => ReactNode
  mapHeight?: number
}) {
  const plan = useMemo(
    () => (participants.length >= 2 ? planMeeting(participants, { fairness, limit: 5 }) : null),
    [participants, fairness],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = plan?.results.find((r) => r.hub.id === selectedId) ?? plan?.results[0] ?? null

  const markers: MapMarker[] = [
    ...participants.map((p) => ({ id: `p-${p.id}`, kind: 'person' as const, label: p.name, lat: p.lat, lng: p.lng })),
    ...(plan
      ? plan.results.map((r, i) => ({
          id: r.hub.id,
          kind: 'result' as const,
          rank: i + 1,
          active: r.hub.id === selected?.hub.id,
          label: `${i + 1}. ${r.hub.name}`,
          lat: r.hub.lat,
          lng: r.hub.lng,
        }))
      : []),
    ...(plan ? [{ id: 'center', kind: 'center' as const, label: '모두의 가운데', ...plan.fairCenter }] : []),
  ]

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? ''

  return (
    <div className="place-results">
      <MapView
        label="참가자와 추천 장소 지도"
        markers={markers}
        height={mapHeight}
        onMarkerClick={(id) => {
          if (plan?.results.some((r) => r.hub.id === id)) setSelectedId(id)
        }}
      />

      <div className="panel">
        <div className="panel-header">
          <h2>추천 장소</h2>
          <span className="meta">직선거리 기반 추정</span>
        </div>

        {!plan ? (
          <EmptyState
            icon={<Route size={24} strokeWidth={1.75} />}
            title="두 명 이상 넣으면 바로 계산해요"
            body="각자 출발하는 곳을 넣으면 모두에게 공평한 역을 순서대로 보여 드려요."
          />
        ) : plan.results.length === 0 ? (
          <EmptyState
            icon={<Route size={24} strokeWidth={1.75} />}
            title="이 지역은 아직 후보 역 데이터가 없어요"
            body="가운데 지점은 계산했어요. 지도 앱에서 근처 카페를 찾아보세요."
            actions={
              <a className="btn btn-secondary" href={mapLinks.kakaoPoint('모두의 가운데', plan.fairCenter)} target="_blank" rel="noreferrer">
                카카오맵에서 가운데 지점 보기
              </a>
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col" className="col-rank">순위</th>
                    <th scope="col">장소</th>
                    <th scope="col">평균</th>
                    <th scope="col">가장 오래</th>
                    <th scope="col" className="col-selected">
                      <span className="visually-hidden">선택</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plan.results.map((r, i) => {
                    const isSelected = r.hub.id === selected?.hub.id
                    return (
                      <tr
                        key={r.hub.id}
                        className={`is-link${isSelected ? ' is-selected' : ''}`}
                        onClick={() => setSelectedId(r.hub.id)}
                      >
                        <td className="num col-rank">{i + 1}</td>
                        <td>
                          <button
                            type="button"
                            className="row-title row-button"
                            aria-pressed={isSelected}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedId(r.hub.id)
                            }}
                          >
                            {r.hub.name}
                          </button>
                          <span className="row-sub">{r.hub.region}</span>
                        </td>
                        <td className="num">{formatMinutes(r.meanMinutes)}</td>
                        <td className="num">{formatMinutes(r.maxMinutes)}</td>
                        <td className="row-chevron col-selected">{isSelected && <span className="selected-mark">보는 중</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {selected && (
              <section className="leg-detail" aria-labelledby="leg-title">
                <div className="leg-head">
                  <h3 id="leg-title">{selected.hub.name}까지 각자 걸리는 시간</h3>
                  <div className="leg-links">
                    <a
                      className="btn btn-ghost"
                      href={mapLinks.kakaoSearch(`${selected.hub.name} 카페`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      카카오맵에서 카페 보기
                      <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
                    </a>
                    <a
                      className="btn btn-ghost"
                      href={mapLinks.naverSearch(`${selected.hub.name} 스터디룸`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      네이버 지도에서 스터디룸 보기
                      <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
                    </a>
                  </div>
                </div>
                <ul className="legs">
                  {[...selected.legs]
                    .sort((a, b) => b.minutes - a.minutes)
                    .map((leg) => (
                      <li key={leg.participantId} className="leg">
                        <span className="leg-name">{nameOf(leg.participantId)}</span>
                        <span className="leg-bar" aria-hidden="true">
                          <span style={{ width: `${Math.max(4, (leg.minutes / selected.maxMinutes) * 100)}%` }} />
                        </span>
                        <span className="num leg-time">{formatMinutes(leg.minutes)}</span>
                      </li>
                    ))}
                </ul>
                {renderAction && <div className="leg-action">{renderAction(selected)}</div>}
              </section>
            )}
          </>
        )}
      </div>

      <details className="method">
        <summary>계산 방식</summary>
        <p>
          각자 출발지에서 후보 역까지의 직선거리를 대중교통 시간으로 바꿔 추정해요(역까지 걷기·대기 10분, 도시철도
          km당 2.2분, 25km를 넘는 구간은 광역급행 속도). 노선이 많은 환승역은 갈아타는 시간을 덜 잡고, 카페·스터디룸이
          많은 상권은 조금 더 높게 쳐요. 위 슬라이더로 &lsquo;모두의 이동시간 합&rsquo;과 &lsquo;가장 먼 사람의 시간&rsquo;
          중 무엇을 더 중요하게 볼지 정할 수 있어요. 정확한 경로는 지도 앱에서 확인해 주세요.
        </p>
      </details>
    </div>
  )
}
