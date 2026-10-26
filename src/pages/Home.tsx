import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, MessageSquare } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { fetchUpcomingSessions } from '../api/meetups'
import { fetchPosts } from '../api/posts'
import { EmptyState, ErrorState, ListSkeleton } from '../components/states'
import { formatMinutes, formatRelative, formatShortDate, formatTime } from '../lib/format'
import { HUBS } from '../lib/meeting/hubs'
import { planMeeting, type Participant } from '../lib/meeting/optimize'
import { POST_CATEGORIES } from '../lib/site'

const DEMO_ORIGINS = ['hapjeong', 'jamsil', 'nowon']

function HeroDemo() {
  const { participants, plan } = useMemo(() => {
    const ps: Participant[] = DEMO_ORIGINS.map((id) => {
      const h = HUBS.find((x) => x.id === id)!
      return { id, name: h.name.replace(/역$/, ''), lat: h.lat, lng: h.lng }
    })
    return { participants: ps, plan: planMeeting(ps, { limit: 3 }) }
  }, [])
  const best = plan.results[0]

  return (
    <aside className="panel hero-demo" aria-labelledby="demo-title">
      <div className="panel-header">
        <h2 id="demo-title">합정 · 잠실 · 노원에 사는 세 사람이라면</h2>
      </div>
      <ol className="demo-results">
        {plan.results.map((r, i) => (
          <li key={r.hub.id} className={i === 0 ? 'is-best' : undefined}>
            <span className="num demo-rank">{i + 1}</span>
            <span className="demo-name">{r.hub.name}</span>
            <span className="secondary num">
              평균 {formatMinutes(r.meanMinutes)} · 최대 {formatMinutes(r.maxMinutes)}
            </span>
          </li>
        ))}
      </ol>
      <ul className="legs demo-legs" aria-label={`${best.hub.name}까지 각자 걸리는 시간`}>
        {best.legs.map((leg) => (
          <li key={leg.participantId} className="leg">
            <span className="leg-name">{participants.find((p) => p.id === leg.participantId)?.name}</span>
            <span className="leg-bar" aria-hidden="true">
              <span style={{ width: `${(leg.minutes / best.maxMinutes) * 100}%` }} />
            </span>
            <span className="num leg-time">{formatMinutes(leg.minutes)}</span>
          </li>
        ))}
      </ul>
      <div className="hero-demo-foot">
        <Link to="/place" className="text-link">
          우리 멤버 위치로 계산하기
        </Link>
      </div>
    </aside>
  )
}

function UpcomingSessions() {
  const q = useQuery({ queryKey: ['sessions-upcoming'], queryFn: () => fetchUpcomingSessions(5) })
  return (
    <section className="panel" aria-labelledby="upcoming-title">
      <div className="panel-header">
        <h2 id="upcoming-title">다가오는 모임</h2>
        <Link to="/meetups" className="text-link secondary">
          모임 전체 보기
        </Link>
      </div>
      {q.isPending ? (
        <ListSkeleton rows={3} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={24} strokeWidth={1.75} />}
          title="잡힌 일정이 아직 없어요"
          body="모임을 열고 첫 일정을 잡으면 여기에 보여요."
          actions={
            <Link to="/meetups/new" className="btn btn-primary">
              모임 만들기
            </Link>
          }
        />
      ) : (
        <ul className="divided">
          {q.data.map((s) => (
            <li key={s.id}>
              <Link to={`/meetups/${s.meetup.id}?tab=schedule`} className="list-row">
                <span className="date-block">
                  <span className="date-block-day">{formatShortDate(s.starts_at)}</span>
                  <span className="meta num">{formatTime(s.starts_at)}</span>
                </span>
                <span className="list-row-main">
                  <span className="row-title">{s.meetup.title}</span>
                  <span className="row-sub secondary">{s.place_name}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RecentPosts() {
  const q = useQuery({
    queryKey: ['posts', { home: true }],
    queryFn: () => fetchPosts({ q: '', category: '', page: 1, limit: 5 }),
  })
  return (
    <section className="panel" aria-labelledby="posts-title">
      <div className="panel-header">
        <h2 id="posts-title">게시판 새 글</h2>
        <Link to="/board" className="text-link secondary">
          게시판 가기
        </Link>
      </div>
      {q.isPending ? (
        <ListSkeleton rows={3} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.rows.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={24} strokeWidth={1.75} />}
          title="첫 글을 기다리고 있어요"
          body="막힌 문제, 읽은 글, 이번 주 회고 무엇이든 좋아요."
          actions={
            <Link to="/board/new" className="btn btn-primary">
              글쓰기
            </Link>
          }
        />
      ) : (
        <ul className="divided">
          {q.data.rows.map((p) => (
            <li key={p.id}>
              <Link to={`/board/${p.id}`} className="list-row">
                <span className="list-row-main">
                  <span className="row-title">{p.title}</span>
                  <span className="row-sub meta dot-sep">
                    <span>{POST_CATEGORIES[p.category]}</span>
                    <span>{p.author.display_name}</span>
                    <span>{formatRelative(p.created_at)}</span>
                    {p.comment_count > 0 && <span>댓글 {p.comment_count}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const FEATURES = [
  {
    title: '정기 모임',
    body: '주기와 활동 지역을 정해 두고 꾸준히 만나요. 일정마다 참석 여부를 받아서 자리 예약이 쉬워요.',
  },
  {
    title: '모두에게 공평한 장소',
    body: '멤버들의 대략적인 위치로 환승이 편하고 카페가 많은 역을 추천해요. 정확한 집 주소는 저장하지 않아요.',
  },
  {
    title: '포트폴리오와 이력서',
    body: '작업물을 올려 두고, 이력서는 멤버에게만 공개해서 현업 개발자의 피드백을 받을 수 있어요.',
  },
  {
    title: '주간 목표',
    body: '이번 주에 할 일 하나를 적고 서로 응원해요. 혼자서는 미루던 것도 같이 하면 끝까지 가요.',
  },
]

export default function Home() {
  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-copy">
          <h1 className="display">
            가까운 개발자들과
            <br />
            매주 한 번, 오프라인에서
          </h1>
          <p className="lead">
            모각코·스터디·사이드 프로젝트 모임을 열고 참여해요. 멤버들이 사는 곳을 바탕으로 모두에게 공평한 역을 골라 주고,
            포트폴리오와 이력서는 서로 봐줘요.
          </p>
          <div className="hero-actions">
            <Link to="/meetups" className="btn btn-primary">
              모임 둘러보기
            </Link>
            <Link to="/place" className="btn btn-secondary">
              만날 장소 계산해 보기
            </Link>
          </div>
        </div>
        <HeroDemo />
      </section>

      <section className="section" aria-labelledby="features-title">
        <h2 id="features-title" className="section-title">
          여기서 할 수 있는 것
        </h2>
        <dl className="features">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature">
              <dt>{f.title}</dt>
              <dd>{f.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="home-grid">
        <UpcomingSessions />
        <RecentPosts />
      </div>

      <section className="cta-band">
        <div>
          <h2>이번 주 목표 하나로 시작해 볼까요</h2>
          <p className="secondary">작은 목표라도 적어 두면 다른 멤버들이 응원해 줘요.</p>
        </div>
        <Link to="/goals" className="btn btn-primary">
          주간 목표 쓰기
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </section>
    </div>
  )
}
