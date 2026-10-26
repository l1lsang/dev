import type { LatLng } from './geo'

/**
 * 만남 후보지(환승역/상권 중심 역).
 * - lines: 정차하는 노선 수(KTX·SRT 포함). 많을수록 환승 부담이 줄어든다.
 * - venues: 카페·스터디룸 밀도 (1 보통 · 2 많음 · 3 아주 많음)
 * 좌표는 역 중심의 근사값이다. 필요하면 지역을 더 추가하면 된다.
 */
export type Hub = LatLng & {
  id: string
  name: string
  region: string
  lines: number
  venues: 1 | 2 | 3
}

export const HUBS: Hub[] = [
  // 서울 도심
  { id: 'seoul', name: '서울역', region: '서울 중구', lat: 37.5547, lng: 126.9707, lines: 4, venues: 2 },
  { id: 'cityhall', name: '시청역', region: '서울 중구', lat: 37.5657, lng: 126.9769, lines: 2, venues: 2 },
  { id: 'gwanghwamun', name: '광화문역', region: '서울 종로구', lat: 37.571, lng: 126.9768, lines: 1, venues: 2 },
  { id: 'jonggak', name: '종각역', region: '서울 종로구', lat: 37.5702, lng: 126.9831, lines: 1, venues: 3 },
  { id: 'jongno3ga', name: '종로3가역', region: '서울 종로구', lat: 37.5714, lng: 126.9918, lines: 3, venues: 2 },
  { id: 'euljiro3ga', name: '을지로3가역', region: '서울 중구', lat: 37.5663, lng: 126.991, lines: 2, venues: 2 },
  { id: 'ddp', name: '동대문역사문화공원역', region: '서울 중구', lat: 37.5653, lng: 127.0079, lines: 3, venues: 2 },
  { id: 'hyehwa', name: '혜화역', region: '서울 종로구', lat: 37.5822, lng: 127.0019, lines: 1, venues: 3 },
  { id: 'yaksu', name: '약수역', region: '서울 중구', lat: 37.5543, lng: 127.0107, lines: 2, venues: 1 },
  { id: 'samgakji', name: '삼각지역', region: '서울 용산구', lat: 37.5347, lng: 126.9731, lines: 2, venues: 1 },
  { id: 'yongsan', name: '용산역', region: '서울 용산구', lat: 37.5298, lng: 126.9648, lines: 2, venues: 2 },

  // 서울 동북
  { id: 'wangsimni', name: '왕십리역', region: '서울 성동구', lat: 37.5612, lng: 127.0371, lines: 4, venues: 2 },
  { id: 'seongsu', name: '성수역', region: '서울 성동구', lat: 37.5446, lng: 127.0557, lines: 1, venues: 3 },
  { id: 'konkuk', name: '건대입구역', region: '서울 광진구', lat: 37.5404, lng: 127.0692, lines: 2, venues: 3 },
  { id: 'gunja', name: '군자역', region: '서울 광진구', lat: 37.5571, lng: 127.0794, lines: 2, venues: 1 },
  { id: 'cheongnyangni', name: '청량리역', region: '서울 동대문구', lat: 37.5801, lng: 127.047, lines: 4, venues: 1 },
  { id: 'hoegi', name: '회기역', region: '서울 동대문구', lat: 37.5898, lng: 127.0577, lines: 2, venues: 2 },
  { id: 'sangbong', name: '상봉역', region: '서울 중랑구', lat: 37.5966, lng: 127.0857, lines: 3, venues: 1 },
  { id: 'sungshin', name: '성신여대입구역', region: '서울 성북구', lat: 37.5926, lng: 127.017, lines: 2, venues: 2 },
  { id: 'suyu', name: '수유역', region: '서울 강북구', lat: 37.638, lng: 127.0257, lines: 1, venues: 2 },
  { id: 'changdong', name: '창동역', region: '서울 도봉구', lat: 37.6531, lng: 127.0477, lines: 2, venues: 1 },
  { id: 'nowon', name: '노원역', region: '서울 노원구', lat: 37.6551, lng: 127.0613, lines: 2, venues: 3 },

  // 서울 동남
  { id: 'jamsil', name: '잠실역', region: '서울 송파구', lat: 37.5133, lng: 127.1, lines: 2, venues: 3 },
  { id: 'sports', name: '종합운동장역', region: '서울 송파구', lat: 37.511, lng: 127.0736, lines: 2, venues: 1 },
  { id: 'samseong', name: '삼성역', region: '서울 강남구', lat: 37.5088, lng: 127.0631, lines: 1, venues: 3 },
  { id: 'seolleung', name: '선릉역', region: '서울 강남구', lat: 37.5045, lng: 127.049, lines: 2, venues: 3 },
  { id: 'yeoksam', name: '역삼역', region: '서울 강남구', lat: 37.5006, lng: 127.0364, lines: 1, venues: 3 },
  { id: 'gangnam', name: '강남역', region: '서울 강남구', lat: 37.4979, lng: 127.0276, lines: 2, venues: 3 },
  { id: 'sinnonhyeon', name: '신논현역', region: '서울 강남구', lat: 37.5046, lng: 127.0251, lines: 2, venues: 3 },
  { id: 'expressbus', name: '고속터미널역', region: '서울 서초구', lat: 37.5049, lng: 127.0049, lines: 3, venues: 2 },
  { id: 'gyodae', name: '교대역', region: '서울 서초구', lat: 37.4934, lng: 127.0142, lines: 2, venues: 2 },
  { id: 'yangjae', name: '양재역', region: '서울 서초구', lat: 37.4846, lng: 127.0342, lines: 2, venues: 2 },
  { id: 'suseo', name: '수서역', region: '서울 강남구', lat: 37.4874, lng: 127.1018, lines: 3, venues: 1 },
  { id: 'garak', name: '가락시장역', region: '서울 송파구', lat: 37.4926, lng: 127.1183, lines: 2, venues: 1 },
  { id: 'cheonho', name: '천호역', region: '서울 강동구', lat: 37.5386, lng: 127.1236, lines: 2, venues: 2 },

  // 서울 서남
  { id: 'sadang', name: '사당역', region: '서울 동작구', lat: 37.4766, lng: 126.9816, lines: 2, venues: 2 },
  { id: 'snu', name: '서울대입구역', region: '서울 관악구', lat: 37.4812, lng: 126.9527, lines: 1, venues: 2 },
  { id: 'sillim', name: '신림역', region: '서울 관악구', lat: 37.4842, lng: 126.9297, lines: 2, venues: 2 },
  { id: 'yeouido', name: '여의도역', region: '서울 영등포구', lat: 37.5216, lng: 126.9243, lines: 2, venues: 2 },
  { id: 'yeongdeungpo', name: '영등포역', region: '서울 영등포구', lat: 37.5156, lng: 126.9073, lines: 1, venues: 2 },
  { id: 'dangsan', name: '당산역', region: '서울 영등포구', lat: 37.5343, lng: 126.9024, lines: 2, venues: 1 },
  { id: 'sindorim', name: '신도림역', region: '서울 구로구', lat: 37.5088, lng: 126.8913, lines: 2, venues: 2 },
  { id: 'daerim', name: '대림역', region: '서울 구로구', lat: 37.4925, lng: 126.8949, lines: 2, venues: 1 },
  { id: 'gurodigital', name: '구로디지털단지역', region: '서울 구로구', lat: 37.4852, lng: 126.9015, lines: 1, venues: 2 },
  { id: 'gasan', name: '가산디지털단지역', region: '서울 금천구', lat: 37.4816, lng: 126.8827, lines: 2, venues: 2 },
  { id: 'omokgyo', name: '오목교역', region: '서울 양천구', lat: 37.5244, lng: 126.875, lines: 1, venues: 2 },

  // 서울 서북
  { id: 'gongdeok', name: '공덕역', region: '서울 마포구', lat: 37.5443, lng: 126.9516, lines: 4, venues: 2 },
  { id: 'sinchon', name: '신촌역', region: '서울 서대문구', lat: 37.5552, lng: 126.9369, lines: 1, venues: 3 },
  { id: 'hongdae', name: '홍대입구역', region: '서울 마포구', lat: 37.5572, lng: 126.9245, lines: 3, venues: 3 },
  { id: 'hapjeong', name: '합정역', region: '서울 마포구', lat: 37.5495, lng: 126.9139, lines: 2, venues: 3 },
  { id: 'dmc', name: '디지털미디어시티역', region: '서울 마포구', lat: 37.577, lng: 126.8996, lines: 3, venues: 1 },
  { id: 'yeonsinnae', name: '연신내역', region: '서울 은평구', lat: 37.619, lng: 126.921, lines: 2, venues: 2 },
  { id: 'magoknaru', name: '마곡나루역', region: '서울 강서구', lat: 37.5668, lng: 126.8272, lines: 2, venues: 2 },
  { id: 'gimpoairport', name: '김포공항역', region: '서울 강서구', lat: 37.5624, lng: 126.8013, lines: 5, venues: 1 },

  // 경기 · 인천
  { id: 'pangyo', name: '판교역', region: '성남 분당구', lat: 37.3948, lng: 127.1112, lines: 2, venues: 3 },
  { id: 'jeongja', name: '정자역', region: '성남 분당구', lat: 37.367, lng: 127.1083, lines: 2, venues: 2 },
  { id: 'moran', name: '모란역', region: '성남 중원구', lat: 37.4322, lng: 127.129, lines: 2, venues: 1 },
  { id: 'indeogwon', name: '인덕원역', region: '안양 동안구', lat: 37.4012, lng: 126.9765, lines: 1, venues: 1 },
  { id: 'beomgye', name: '범계역', region: '안양 동안구', lat: 37.3897, lng: 126.9508, lines: 1, venues: 2 },
  { id: 'geumjeong', name: '금정역', region: '군포', lat: 37.3722, lng: 126.9433, lines: 2, venues: 1 },
  { id: 'suwon', name: '수원역', region: '수원 팔달구', lat: 37.266, lng: 127.0001, lines: 2, venues: 3 },
  { id: 'gwanggyo', name: '광교중앙역', region: '수원 영통구', lat: 37.2886, lng: 127.0514, lines: 1, venues: 2 },
  { id: 'dongtan', name: '동탄역', region: '화성', lat: 37.2001, lng: 127.0957, lines: 2, venues: 2 },
  { id: 'gwangmyeong', name: '광명역', region: '광명', lat: 37.4163, lng: 126.8848, lines: 1, venues: 1 },
  { id: 'bucheon', name: '부천역', region: '부천', lat: 37.484, lng: 126.7827, lines: 1, venues: 2 },
  { id: 'bupyeong', name: '부평역', region: '인천 부평구', lat: 37.4895, lng: 126.7245, lines: 2, venues: 3 },
  { id: 'incheonterminal', name: '인천터미널역', region: '인천 미추홀구', lat: 37.4422, lng: 126.701, lines: 1, venues: 2 },
  { id: 'incheonuniv', name: '인천대입구역', region: '인천 연수구', lat: 37.3862, lng: 126.6393, lines: 1, venues: 2 },
  { id: 'daegok', name: '대곡역', region: '고양 덕양구', lat: 37.6317, lng: 126.8113, lines: 3, venues: 1 },
  { id: 'jeongbalsan', name: '정발산역', region: '고양 일산동구', lat: 37.66, lng: 126.7731, lines: 1, venues: 2 },
  { id: 'uijeongbu', name: '의정부역', region: '의정부', lat: 37.7385, lng: 127.0459, lines: 1, venues: 2 },

  // 그 밖의 광역시
  { id: 'daejeon', name: '대전역', region: '대전 동구', lat: 36.3324, lng: 127.4344, lines: 2, venues: 2 },
  { id: 'dongdaegu', name: '동대구역', region: '대구 동구', lat: 35.8794, lng: 128.6286, lines: 2, venues: 2 },
  { id: 'banwoldang', name: '반월당역', region: '대구 중구', lat: 35.8655, lng: 128.5935, lines: 2, venues: 3 },
  { id: 'busan', name: '부산역', region: '부산 동구', lat: 35.1151, lng: 129.0422, lines: 2, venues: 2 },
  { id: 'seomyeon', name: '서면역', region: '부산 부산진구', lat: 35.1578, lng: 129.0597, lines: 2, venues: 3 },
  { id: 'centum', name: '센텀시티역', region: '부산 해운대구', lat: 35.169, lng: 129.132, lines: 2, venues: 2 },
  { id: 'gwangjusongjeong', name: '광주송정역', region: '광주 광산구', lat: 35.1378, lng: 126.7931, lines: 2, venues: 1 },
  { id: 'geumnamro4ga', name: '금남로4가역', region: '광주 동구', lat: 35.1491, lng: 126.9147, lines: 1, venues: 2 },
]

export function searchHubs(query: string, limit = 6): Hub[] {
  const q = query.trim().replace(/역$/, '')
  if (!q) return []
  return HUBS.filter((h) => h.name.includes(q) || h.region.includes(q)).slice(0, limit)
}
