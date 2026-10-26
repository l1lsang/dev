# 커밋테이블

가까운 개발자끼리 매주 오프라인에서 만나는 정기 모임 커뮤니티.

- **정기 모임** — 모임 개설·참여, 일정 등록, 참석/불참 응답
- **만날 장소 찾기** — 멤버들이 사는 곳을 바탕으로 모두에게 공평한 역 추천
- **역 주변 추천** — 그 역 근처의 카페 · 스터디룸 · 회의실 · 주차장을 모임에 맞게 골라 줌 (카카오 로컬 API)
- **포트폴리오** — 작업물 업로드(대표 이미지, 링크, 기술 스택)
- **이력서** — PDF 업로드, 공개 범위(나만 / 멤버) 선택, 멤버 피드백
- **게시판 · 주간 목표** — 질문·정보 공유·회고, 이번 주 목표와 응원

스택: Vite + React 19 + TypeScript, Supabase(Auth · Postgres · Storage), Leaflet(OpenStreetMap), Vercel 호스팅.

---

## 1. 로컬에서 실행

```bash
npm install
cp .env.example .env.local   # Supabase 값을 채운다 (아래 2번)
npm run dev                  # http://localhost:5173
```

환경변수가 없어도 앱은 뜹니다. 이때는 **장소 찾기만** 동작하고, 나머지 화면은 "데이터베이스 연결이 아직 안 됐어요" 안내를 보여 줍니다.

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm test` | 장소 추천 알고리즘 · 주변 장소 순위 · `/api/places` 단위 테스트 (Vitest) |
| `npm run lint` | ESLint |
| `npm run build` | 타입 체크 + 프로덕션 빌드 (`dist/`) |

## 2. Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만든다.
2. **SQL Editor**에 [`supabase/migrations/20261026000000_init.sql`](supabase/migrations/20261026000000_init.sql)을 통째로 붙여 넣고 실행한다.
   테이블, RLS 정책, 트리거, Storage 버킷(`resumes` 비공개, `portfolio-covers` 공개)까지 한 번에 만들어진다.
   (Supabase CLI를 쓴다면 `supabase link` 후 `supabase db push`)
3. **Project Settings → API**에서 URL과 publishable(또는 anon) 키를 `.env.local`에 넣는다.

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

4. **Authentication → URL Configuration**
   - Site URL: 배포 주소 (예: `https://committable.vercel.app`)
   - Redirect URLs에 추가:
     - `http://localhost:5173/auth/callback`
     - `https://committable.vercel.app/auth/callback`
     - 프리뷰 배포용: `https://*-<vercel-팀-슬러그>.vercel.app/auth/callback`
5. **GitHub 로그인 (선택)**
   - GitHub → Settings → Developer settings → OAuth Apps → New
   - Authorization callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`
   - 발급된 Client ID / Secret을 Supabase **Authentication → Providers → GitHub**에 입력
6. **이메일 로그인** — 기본 제공 메일 서버는 시간당 발송량이 매우 적다. 실제 운영 전에 **Authentication → SMTP**에서 Resend·SES 같은 SMTP를 연결하자.

## 3. 카카오 로컬 API (역 주변 장소 추천)

키가 없어도 앱은 동작한다. 이때는 추천 목록 대신 카카오맵 검색 링크를 보여 준다.

1. [developers.kakao.com](https://developers.kakao.com) 로그인 → **내 애플리케이션 → 애플리케이션 추가하기** (앱 이름: 커밋테이블)
2. 만든 앱 → **앱 키**에서 **REST API 키** 복사
3. 왼쪽 메뉴 **카카오맵 → 사용 설정 → 상태 ON**
   (2024년 12월부터 새 앱은 이걸 켜야 지도·로컬 API가 동작한다. 꺼져 있으면 401 오류)
4. 로컬: `.env`(또는 `.env.local`)에 추가하고 개발 서버를 다시 켠다.
   ```
   KAKAO_REST_API_KEY=복사한_REST_API_키
   ```
   `VITE_`로 시작하지 않으므로 브라우저 번들에 들어가지 않는다. 서버 함수 [`api/places.ts`](api/places.ts)만 읽는다.
5. Vercel: **Settings → Environment Variables**에 같은 이름으로 추가하고 **Redeploy**.

동작 방식

- 브라우저 → `/api/places?lat=..&lng=..` (Vercel 함수, 로컬에선 [`vite.config.ts`](vite.config.ts)의 미들웨어가 같은 파일을 실행)
- 함수가 카카오에 6번 검색(카페 카테고리, 스터디룸, 스터디카페, 회의실, 공유오피스, 주차장 카테고리)해서 종류별로 묶어 돌려준다.
- 같은 역은 같은 주소로 요청하므로 응답이 Vercel CDN에 하루 캐시된다. 호출량이 거의 늘지 않는다.
- 순위는 화면 쪽 [`src/lib/meeting/nearby.ts`](src/lib/meeting/nearby.ts)에서 매긴다. 걷는 시간이 기본이고, 모임에 맞는 곳에 가산점을 준다.
  - 카페: 단체석이 많은 대형 브랜드 우선, 테마카페(보드게임·만화 등)·스터디카페 제외
  - 스터디: 방을 빌리는 스터디룸·모임공간 우선, 1인석 위주 스터디카페는 뒤로, 독서실 제외
  - 회의실: 시간 단위 회의실 우선, 공유오피스는 대여 여부 확인 안내
  - 주차장: 공영주차장 우선, 거주자·직원 전용 제외
- 모임장은 목록에서 **여기로 일정 잡기**를 누르면 장소 이름·좌표·주소가 채워진 일정 추가 창이 열린다.

## 4. Vercel 배포

1. 이 폴더를 GitHub 저장소로 올리고 Vercel에서 Import (Framework: Vite 자동 인식).
2. **Settings → Environment Variables**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, (선택) `KAKAO_REST_API_KEY` 추가.
3. 배포. [`vercel.json`](vercel.json)이 `/api/`를 뺀 모든 경로를 `index.html`로 돌려 SPA 라우팅이 새로고침에도 동작한다.
4. 배포 주소를 Supabase Site URL / Redirect URLs에 반영 (2-4).

---

## 만날 장소 추천 알고리즘

코드: [`src/lib/meeting/`](src/lib/meeting/) · 테스트: [`optimize.test.ts`](src/lib/meeting/optimize.test.ts)

1. **후보 역** — 서울·수도권 환승역/상권 중심 역과 광역시 주요 역 약 80곳([`hubs.ts`](src/lib/meeting/hubs.ts)). 역마다 노선 수와 카페·스터디룸 밀도(1~3)를 가진다.
2. **두 가지 중심점** — 직선거리 합이 최소인 *기하 중앙값*(Weiszfeld 반복법)과 가장 먼 사람의 거리가 최소인 *최소 포함 원 중심*을 구한다. 지도에는 후자를 "모두의 가운데"로 표시한다.
3. **이동시간 추정** — 직선거리를 대중교통 시간으로 바꾼다.
   `역까지 걷기·대기 10분 + 도시철도 km당 2.2분(25km 초과 구간은 km당 0.9분) + 예상 환승 × 5분 × 환승역 보정`. 아주 가까우면 걷는 시간을 쓴다.
4. **점수** — `(1 − f) × 평균 시간 + f × 가장 오래 걸리는 사람의 시간 − 상권 가산점`.
   `f`(공평함)는 화면의 슬라이더로 조절하며 기본값은 0.6이다.
5. **결과 다양화** — 1.5km 안에 더 좋은 후보가 있으면 건너뛰어 서로 다른 동네 후보 5곳을 보여 준다.
6. **데이터 밖 지역** — 모두를 감싸는 원 안에 후보 역이 없으면(예: 제주) 가운데 좌표만 알려 주고 카카오맵 링크를 준다.

정확한 경로·시간은 결과의 카카오맵/네이버 지도 링크로 확인하게 한다. 실제 대중교통 API(ODsay 등)를 붙이면 3단계만 교체하면 된다.

### 위치 개인정보

- 프로필 위치는 저장 전에 **약 1km 단위로 반올림**하고, DB 트리거가 한 번 더 소수 셋째 자리(약 100m)로 자른다.
- `member_locations` 테이블은 본인만 읽을 수 있다. 다른 사람 좌표는 `meetup_member_locations()` 함수로만, **같은 모임 멤버일 때만** 받는다.
- 프로필에는 사용자가 직접 적은 지역 이름(예: "마포구 망원동")만 공개된다.

## 권한 요약 (RLS)

| 데이터 | 읽기 | 쓰기 |
| --- | --- | --- |
| 프로필, 모임, 일정, 게시글, 댓글, 주간 목표, 포트폴리오 | 누구나 | 본인 / 모임장 |
| 모임 참여 | 누구나 | 본인 (모집 중·정원 이내일 때만) |
| 일정 등록·삭제, 멤버 내보내기 | — | 모임장 |
| 참석 응답 | 누구나 | 그 모임 멤버 본인 |
| 위치 좌표 | 본인 + 같은 모임 멤버(RPC) | 본인 |
| 이력서 파일·정보 | 본인, '멤버 공개'면 로그인 사용자 | 본인 |
| 이력서 피드백 | 이력서를 볼 수 있는 사람 | 피드백 요청 중일 때 로그인 사용자 |

## 폴더 구조

```
api/
  places.ts     Vercel 함수: 역 주변 장소 검색 (카카오 로컬 API)
src/
  api/          Supabase 쿼리 (도메인별) + /api/places 호출
  components/   공용 UI (Layout, 지도, 장소 추천, 폼 필드, 대화상자 …)
  lib/
    meeting/    장소 추천 알고리즘 + 후보 역 데이터 + 주변 장소 순위
    useForm.ts  blur 검증 + 초안 자동 저장
  pages/        라우트별 화면
  styles/       디자인 토큰 → 기본 → 컴포넌트 → 레이아웃 → 페이지
supabase/migrations/   스키마 · RLS · Storage
```

## UI 원칙

[`.ux-profile.md`](.ux-profile.md)에 정리했다. 요약하면:

- 따뜻한 미색 바탕 + 먹색 글자 + 포인트 색 하나(지도 핀 주홍색). 그라데이션·글래스·이모지 아이콘·장식용 일러스트 없음.
- 글자 굵기 400/500/600, 크기 12/14/16 + 1.2배 스케일, 간격 4/8pt.
- 목록은 테두리 있는 표, 빈 화면엔 다음 행동 버튼, 삭제는 대상 이름을 밝힌 확인 대화상자.
- 폼은 입력 중엔 오류를 띄우지 않고(첫 blur 때 검사) 제출 버튼을 막지 않으며, 작성 중인 내용은 브라우저에 자동 저장한다.
- 375px부터 1280px까지 가로 스크롤 없이, 누르는 영역은 44px 이상.

## 바꾸고 싶을 때

- **서비스 이름** — [`src/lib/site.ts`](src/lib/site.ts)의 `SITE`와 `index.html`의 `<title>`
- **후보 역 추가** — [`src/lib/meeting/hubs.ts`](src/lib/meeting/hubs.ts)에 한 줄 추가 (좌표는 근사값)
- **지도 타일** — [`MapView.tsx`](src/components/MapView.tsx)의 `TILE_URL`. 지금은 키 없이 쓰는 OSM 기본 타일이다. 트래픽이 늘면 [OSM 타일 정책](https://operations.osmfoundation.org/policies/tiles/)에 맞게 MapTiler·Stadia 같은 제공자로 바꾸자.
- **주소 검색** — OSM Nominatim을 버튼을 눌렀을 때만 호출한다(자동완성 금지 정책). 카카오 키를 연결했으니 `api/`에 주소 검색 함수를 하나 더 만들면 국내 주소 검색 품질이 좋아진다.
- **주변 추천 규칙** — [`nearby.ts`](src/lib/meeting/nearby.ts)의 `judge()`에서 종류별 가산점·제외 규칙을 바꾼다. 검색어·반경은 [`api/places.ts`](api/places.ts)의 `SEARCHES`.
