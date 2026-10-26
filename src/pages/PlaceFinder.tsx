import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { fetchMyLocation } from '../api/profiles'
import { LocationPicker, type PickedPlace } from '../components/LocationPicker'
import { FairnessControl, PlaceResults } from '../components/PlaceOptimizer'
import { Button, IconButton, PageHeader } from '../components/ui'
import { useAuth, useConfirm } from '../lib/contexts'
import { useLocalState } from '../lib/hooks'
import { HUBS } from '../lib/meeting/hubs'
import { DEFAULT_FAIRNESS, type Participant } from '../lib/meeting/optimize'

type Entry = Participant & { place: string }

const SAMPLE: [string, string][] = [
  ['민지', 'hapjeong'],
  ['준호', 'jamsil'],
  ['서연', 'nowon'],
  ['도윤', 'pangyo'],
]

export default function PlaceFinder() {
  const { user, profile } = useAuth()
  const confirm = useConfirm()
  const nameId = useId()
  const [entries, setEntries] = useLocalState<Entry[]>('place-finder:entries', [])
  const [fairness, setFairness] = useLocalState('place-finder:fairness', DEFAULT_FAIRNESS)
  const [name, setName] = useState('')

  const myLocation = useQuery({
    queryKey: ['my-location', user?.id],
    queryFn: () => fetchMyLocation(user!.id),
    enabled: Boolean(user),
  })

  const add = (place: PickedPlace, who?: string) => {
    const label = (who ?? name).trim() || `참가자 ${entries.length + 1}`
    setEntries((prev) => [...prev, { id: crypto.randomUUID(), name: label, lat: place.lat, lng: place.lng, place: place.label }])
    setName('')
  }

  const fillSample = () => {
    setEntries(
      SAMPLE.map(([n, hubId]) => {
        const h = HUBS.find((x) => x.id === hubId)!
        return { id: crypto.randomUUID(), name: n, lat: h.lat, lng: h.lng, place: h.name }
      }),
    )
  }

  const clearAll = async () => {
    const ok = await confirm({
      title: `참가자 ${entries.length}명을 모두 지울까요?`,
      body: '이 브라우저에만 저장된 목록이라 지우면 되돌릴 수 없어요.',
      confirmLabel: '참가자 모두 지우기',
    })
    if (ok) setEntries([])
  }

  const hasMe = entries.some((e) => e.id === 'me')

  return (
    <div className="page">
      <PageHeader
        title="만날 장소 찾기"
        description="각자 출발하는 곳을 넣으면 이동시간이 고르게 나오는 역을 추천해요. 모임 멤버로 계산하려면 모임 페이지의 장소 찾기 탭을 쓰세요."
      />

      <div className="planner">
        <div className="planner-params">
          <section className="panel" aria-labelledby="who-title">
            <div className="panel-header">
              <h2 id="who-title">
                참가자 <span className="num tab-count">{entries.length}</span>
              </h2>
              {entries.length > 0 && (
                <Button variant="ghost" onClick={clearAll}>
                  모두 지우기
                </Button>
              )}
            </div>
            {entries.length === 0 ? (
              <div className="participant-empty">
                <p className="secondary">아래에서 출발지를 하나씩 넣어 주세요.</p>
                <Button variant="secondary" onClick={fillSample}>
                  예시 4명으로 채우기
                </Button>
              </div>
            ) : (
              <ul className="divided">
                {entries.map((e) => (
                  <li key={e.id} className="participant">
                    <span className="participant-dot" aria-hidden="true" />
                    <span className="list-row-main">
                      <span className="row-title">{e.name}</span>
                      <span className="row-sub meta">{e.place}</span>
                    </span>
                    <IconButton
                      label={`${e.name} 빼기`}
                      icon={<X size={18} strokeWidth={1.75} />}
                      tooltipAlign="end"
                      onClick={() => setEntries((prev) => prev.filter((x) => x.id !== e.id))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel panel-body add-participant" aria-labelledby="add-title">
            <h2 id="add-title" className="side-title">
              참가자 추가
            </h2>
            <div className="field">
              <label className="field-label" htmlFor={nameId}>
                이름 <span className="field-optional">(선택)</span>
              </label>
              <input
                id={nameId}
                className="input"
                value={name}
                maxLength={20}
                placeholder={`참가자 ${entries.length + 1}`}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <LocationPicker value={null} onSelect={(p) => add(p)} inputLabel="출발지" mapHeight={200} />
            {user && myLocation.data && !hasMe && (
              <Button
                variant="secondary"
                onClick={() =>
                  setEntries((prev) => [
                    ...prev,
                    {
                      id: 'me',
                      name: profile?.display_name ?? '나',
                      lat: myLocation.data!.lat,
                      lng: myLocation.data!.lng,
                      place: profile?.area_label ?? '내 위치',
                    },
                  ])
                }
              >
                내 등록 위치 넣기
              </Button>
            )}
            {user && myLocation.isSuccess && !myLocation.data && (
              <p className="meta">
                프로필에 위치를 등록해 두면 여기서 바로 넣을 수 있어요.{' '}
                <Link to="/me/edit#location" className="text-link">
                  위치 등록하기
                </Link>
              </p>
            )}
          </section>

          <div className="panel panel-body">
            <FairnessControl value={fairness} onChange={setFairness} />
          </div>
        </div>

        <div className="planner-results">
          <PlaceResults participants={entries} fairness={fairness} />
        </div>
      </div>
    </div>
  )
}
