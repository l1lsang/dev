import { LocateFixed, MapPin } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { currentPosition, searchPlaces, type Place } from '../lib/geocode'
import { roundCoord, type LatLng } from '../lib/meeting/geo'
import { searchHubs } from '../lib/meeting/hubs'
import { MapView } from './MapView'
import { Button } from './ui'

export type PickedPlace = LatLng & { label: string }

/**
 * 출발지 고르기: 역 이름(즉시) · 주소 검색(버튼) · 현재 위치 · 지도 클릭
 * privacyDigits: 저장 전에 좌표를 반올림할 자릿수 (2 ≈ 1km)
 */
export function LocationPicker({
  value,
  onSelect,
  inputLabel = '역이나 동네 이름',
  privacyDigits = 3,
  mapHeight = 240,
}: {
  value: PickedPlace | null
  onSelect: (place: PickedPlace) => void
  inputLabel?: string
  privacyDigits?: number
  mapHeight?: number
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState<Place[] | null>(null)
  const [status, setStatus] = useState<'idle' | 'searching' | 'locating' | 'error' | 'denied'>('idle')
  const abortRef = useRef<AbortController | null>(null)

  const hubs = searchHubs(query)

  const pick = (p: PickedPlace) => {
    onSelect({ label: p.label, lat: roundCoord(p.lat, privacyDigits), lng: roundCoord(p.lng, privacyDigits) })
    setRemote(null)
    setQuery('')
  }

  const runSearch = async () => {
    const q = query.trim()
    if (!q) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStatus('searching')
    try {
      setRemote(await searchPlaces(q, ctrl.signal))
      setStatus('idle')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setStatus('error')
    }
  }

  const useMine = async () => {
    setStatus('locating')
    try {
      const pos = await currentPosition()
      pick({ ...pos, label: '현재 위치 근처' })
      setStatus('idle')
    } catch {
      setStatus('denied')
    }
  }

  const showResults = hubs.length > 0 || remote !== null

  return (
    <div className="loc-picker">
      <div className="field">
        <label className="field-label" htmlFor={`${id}-q`}>
          {inputLabel}
        </label>
        <div className="loc-search-row">
          <input
            id={`${id}-q`}
            className="input"
            value={query}
            placeholder="합정, 판교역, 망원동"
            autoComplete="off"
            aria-describedby={`${id}-hint`}
            onChange={(e) => {
              setQuery(e.target.value)
              setRemote(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (hubs.length === 1) pick({ ...hubs[0], label: hubs[0].name })
                else runSearch()
              }
            }}
          />
          <Button onClick={runSearch} loading={status === 'searching'}>
            주소 검색
          </Button>
        </div>
        <p className="field-hint" id={`${id}-hint`}>
          {status === 'error'
            ? '주소 검색이 잠시 안 돼요. 역 이름으로 고르거나 지도를 눌러 주세요.'
            : status === 'denied'
              ? '위치 권한이 꺼져 있어요. 브라우저 설정에서 허용하거나 이름으로 검색해 주세요.'
              : '역 이름은 바로 나오고, 동네·주소는 검색 버튼으로 찾아요. 지도를 눌러도 돼요.'}
        </p>
      </div>

      {showResults && (
        <ul className="loc-results" aria-live="polite">
          {hubs.map((h) => (
            <li key={h.id}>
              <button type="button" className="loc-result" onClick={() => pick({ ...h, label: h.name })}>
                <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{h.name}</span>
                <span className="meta">{h.region}</span>
              </button>
            </li>
          ))}
          {remote?.map((p, i) => (
            <li key={`${p.lat},${p.lng},${i}`}>
              <button type="button" className="loc-result" onClick={() => pick(p)}>
                <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{p.label}</span>
                <span className="meta">{p.detail}</span>
              </button>
            </li>
          ))}
          {remote && remote.length === 0 && hubs.length === 0 && (
            <li className="loc-empty secondary">검색 결과가 없어요. 더 큰 지역 이름으로 찾거나 지도를 눌러 주세요.</li>
          )}
        </ul>
      )}

      <div className="loc-actions">
        <Button variant="ghost" onClick={useMine} loading={status === 'locating'}>
          <LocateFixed size={16} strokeWidth={1.75} aria-hidden="true" />
          현재 위치 쓰기
        </Button>
        {value && (
          <p className="secondary loc-current">
            고른 곳: <strong>{value.label}</strong>
          </p>
        )}
      </div>

      <MapView
        label="출발지를 고르는 지도"
        height={mapHeight}
        markers={value ? [{ id: 'pick', kind: 'pick', label: value.label, lat: value.lat, lng: value.lng }] : []}
        onPick={(p) => pick({ ...p, label: '지도에서 고른 곳' })}
      />
    </div>
  )
}
