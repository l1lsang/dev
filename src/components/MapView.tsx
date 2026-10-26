import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { LatLng } from '../lib/meeting/geo'

export type MapMarker = LatLng & {
  id: string
  kind: 'person' | 'result' | 'center' | 'pick'
  label: string
  /** 결과 순위(1부터) */
  rank?: number
  active?: boolean
}

const SEOUL: LatLng = { lat: 37.5547, lng: 126.9707 }

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 키 없이 쓸 수 있는 OSM 기본 타일. 색은 CSS 필터로 흑백(다크 모드는 반전) 처리한다.
// 트래픽이 늘면 OSM 타일 정책에 맞게 MapTiler·Stadia 같은 제공자 URL로 바꿔 주세요.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자'

function iconFor(m: MapMarker) {
  const cls = `pin pin-${m.kind}${m.active ? ' is-active' : ''}`
  const html = m.kind === 'result' ? `<span>${m.rank ?? ''}</span>` : '<span></span>'
  const size = m.kind === 'result' ? 28 : m.kind === 'center' ? 18 : 14
  return L.divIcon({ className: cls, html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

function FitBounds({ points, fitKey }: { points: LatLng[]; fitKey: string }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14, { animate: !prefersReducedMotion() })
      return
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15, animate: !prefersReducedMotion() })
    // fitKey가 바뀔 때만 다시 맞춘다 (선택만 바뀔 때는 화면 유지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey])
  return null
}

function AttributionPrefix() {
  const map = useMap()
  useEffect(() => {
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
  }, [map])
  return null
}

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  })
  return null
}

export function MapView({
  markers,
  onPick,
  onMarkerClick,
  height = 420,
  label,
}: {
  markers: MapMarker[]
  onPick?: (p: LatLng) => void
  onMarkerClick?: (id: string) => void
  height?: number
  /** 지도 영역의 접근성 이름 */
  label: string
}) {
  const fitKey = useMemo(
    () =>
      markers
        .filter((m) => m.kind !== 'center')
        .map((m) => `${m.id}:${m.lat.toFixed(4)},${m.lng.toFixed(4)}`)
        .join('|'),
    [markers],
  )
  const fitPoints = markers.filter((m) => m.kind !== 'center')
  const reduce = prefersReducedMotion()

  return (
    <div className="map" style={{ height }} role="region" aria-label={label}>
      <MapContainer
        center={[SEOUL.lat, SEOUL.lng]}
        zoom={11}
        scrollWheelZoom={false}
        zoomAnimation={!reduce}
        fadeAnimation={!reduce}
        markerZoomAnimation={!reduce}
        style={{ height: '100%' }}
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} maxZoom={19} />
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={iconFor(m)}
            zIndexOffset={m.kind === 'result' ? (m.active ? 1000 : 500) : 0}
            keyboard={Boolean(onMarkerClick && m.kind === 'result')}
            title={m.label}
            eventHandlers={onMarkerClick ? { click: () => onMarkerClick(m.id) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              {m.label}
            </Tooltip>
          </Marker>
        ))}
        <AttributionPrefix />
        <FitBounds points={fitPoints} fitKey={fitKey} />
        {onPick && <ClickHandler onPick={onPick} />}
      </MapContainer>
    </div>
  )
}
