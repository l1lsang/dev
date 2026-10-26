// 파일명이 _로 시작하면 Vercel이 함수로 배포하지 않는다
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, type NearbyResponse } from './places.ts'

const doc = (id: string, name: string, distance: number, category = '카페') => ({
  id,
  place_name: name,
  category_name: category,
  phone: '',
  address_name: '서울 성동구 행당동 1',
  road_address_name: '',
  x: '127.037',
  y: '37.561',
  place_url: `http://place.map.kakao.com/${id}`,
  distance: String(distance),
})

const call = (qs: string) => GET(new Request(`http://localhost/api/places?${qs}`))

describe('/api/places', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('KAKAO_REST_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    fetchMock.mockReset()
  })

  it('국내 좌표가 아니면 400', async () => {
    expect((await call('lat=0&lng=0')).status).toBe(400)
    expect((await call('lat=abc&lng=127')).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('키가 없으면 501', async () => {
    vi.stubEnv('KAKAO_REST_API_KEY', '')
    const res = await call('lat=37.5612&lng=127.0371')
    expect(res.status).toBe(501)
    expect(await res.json()).toEqual({ error: 'not_configured' })
  })

  it('종류별로 모으고, 중복을 빼고, 가까운 순으로 정렬하고, 캐시 헤더를 단다', async () => {
    fetchMock.mockImplementation(async (input: string) => {
      const url = new URL(input)
      expect(url.searchParams.get('x')).toBe('127.0371')
      expect(url.searchParams.get('y')).toBe('37.5612')
      expect(url.searchParams.get('sort')).toBe('distance')
      const q = url.searchParams.get('query') ?? url.searchParams.get('category_group_code')
      const docs: Record<string, unknown[]> = {
        CE7: [doc('1', '스타벅스 왕십리역점', 120), doc('2', '동네커피', 80)],
        스터디룸: [doc('3', '왕십리 스터디룸', 300)],
        스터디카페: [doc('3', '왕십리 스터디룸', 300), doc('4', '집중 스터디카페', 200)],
        회의실: [],
        공유오피스: [doc('5', '패스트파이브 왕십리점', 400)],
        PK6: [doc('6', '행당동 공영주차장', 250)],
      }
      return new Response(JSON.stringify({ documents: docs[q ?? ''] ?? [] }), { status: 200 })
    })

    const res = await call('lat=37.5612&lng=127.0371')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('s-maxage=86400')
    const body = (await res.json()) as NearbyResponse
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('KakaoAK test-key')
    expect(body.cafe.map((p) => p.name)).toEqual(['동네커피', '스타벅스 왕십리역점'])
    expect(body.study.map((p) => p.id)).toEqual(['4', '3'])
    expect(body.meeting).toHaveLength(1)
    expect(body.parking[0]).toMatchObject({ name: '행당동 공영주차장', lat: 37.561, lng: 127.037, distance: 250 })
    expect(body.partial).toBe(false)
  })

  it('일부만 실패하면 받은 것만 주고 캐시하지 않는다', async () => {
    let n = 0
    fetchMock.mockImplementation(async () =>
      n++ === 0 ? new Response('boom', { status: 500 }) : new Response(JSON.stringify({ documents: [] }), { status: 200 }),
    )
    const res = await call('lat=37.5612&lng=127.0371')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(((await res.json()) as NearbyResponse).partial).toBe(true)
  })

  it('모두 401이면 키·카카오맵 설정 문제로 알려 준다', async () => {
    fetchMock.mockImplementation(async () => new Response('{"errorType":"NotAuthorizedError"}', { status: 401 }))
    const res = await call('lat=37.5612&lng=127.0371')
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'kakao_auth' })
  })
})
