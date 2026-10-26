import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDown, ChevronRight, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { fetchMeetups } from '../api/meetups'
import { ActiveFilters, FilterMenu, Pagination, SearchBox } from '../components/list'
import { EmptyState, ErrorState, TableSkeleton } from '../components/states'
import { PageHeader } from '../components/ui'
import { formatDate, formatShortDate, formatTime } from '../lib/format'
import { useListParams } from '../lib/hooks'
import { TOPICS } from '../lib/site'
import type { MeetupTopic } from '../lib/types'

const DEFAULTS = { q: '', topic: '', open: '' }

export default function Meetups() {
  const navigate = useNavigate()
  const { values, page, update } = useListParams(DEFAULTS)
  const params = { q: values.q, topic: values.topic as MeetupTopic | '', open: values.open === '1', page }
  const query = useQuery({
    queryKey: ['meetups', params],
    queryFn: () => fetchMeetups(params),
    placeholderData: keepPreviousData,
  })

  const chips = [
    ...(values.topic
      ? [{ key: 'topic', label: `주제: ${TOPICS[values.topic as MeetupTopic]}`, onRemove: () => update({ topic: '' }) }]
      : []),
    ...(values.open ? [{ key: 'open', label: '모집 중만', onRemove: () => update({ open: '' }) }] : []),
  ]
  const filtered = chips.length > 0 || Boolean(values.q)
  const clearAll = () => update({ q: '', topic: '', open: '' })

  return (
    <div className="page">
      <PageHeader
        title="모임"
        description="정기적으로 만나는 개발자 모임이에요. 마음에 드는 곳에 참여하거나 직접 열어 보세요."
        actions={
          <Link to="/meetups/new" className="btn btn-primary">
            모임 만들기
          </Link>
        }
      />

      <div className="list-toolbar">
        <div className="toolbar">
          <SearchBox value={values.q} onChange={(q) => update({ q })} placeholder="모임 이름, 지역" />
          <FilterMenu activeCount={chips.length}>
            <div className="field">
              <label className="field-label" htmlFor="filter-topic">
                주제
              </label>
              <select
                id="filter-topic"
                className="select"
                value={values.topic}
                onChange={(e) => update({ topic: e.target.value })}
              >
                <option value="">전체</option>
                {Object.entries(TOPICS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={values.open === '1'}
                onChange={(e) => update({ open: e.target.checked ? '1' : '' })}
              />
              <span className="check-row-text">
                <span className="check-row-title">모집 중인 모임만</span>
              </span>
            </label>
          </FilterMenu>
        </div>
        <ActiveFilters items={chips} onClearAll={clearAll} />
      </div>

      <div className="panel list-frame">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">모임</th>
                <th scope="col">주제</th>
                <th scope="col">주기</th>
                <th scope="col">지역</th>
                <th scope="col">인원</th>
                <th scope="col">다음 모임</th>
                <th scope="col" aria-sort="descending">
                  <span className="th-sort">
                    개설일 <ArrowDown size={14} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                </th>
                <th scope="col">
                  <span className="visually-hidden">열기</span>
                </th>
              </tr>
            </thead>
            {query.isSuccess && query.data.rows.length > 0 && (
              <tbody>
                {query.data.rows.map((m) => (
                  <tr key={m.id} className="is-link" onClick={() => navigate(`/meetups/${m.id}`)}>
                    <td className="cell-main">
                      <Link to={`/meetups/${m.id}`} className="row-title" onClick={(e) => e.stopPropagation()}>
                        {m.title}
                      </Link>
                      <span className="row-sub">{m.summary}</span>
                    </td>
                    <td>{TOPICS[m.topic]}</td>
                    <td>{m.cadence}</td>
                    <td>{m.area_label ?? <span className="meta">미정</span>}</td>
                    <td className="num">
                      {m.member_count}
                      {m.capacity ? ` / ${m.capacity}` : ''}
                      {!m.is_open && <span className="meta"> · 마감</span>}
                    </td>
                    <td>
                      {m.next_session ? (
                        <span className="num">
                          {formatShortDate(m.next_session)} {formatTime(m.next_session)}
                        </span>
                      ) : (
                        <span className="meta">미정</span>
                      )}
                    </td>
                    <td className="secondary">{formatDate(m.created_at)}</td>
                    <td className="row-chevron">
                      <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {query.isPending ? (
          <TableSkeleton columns={6} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.rows.length === 0 ? (
          filtered ? (
            <EmptyState
              title="조건에 맞는 모임이 없어요"
              body="검색어를 줄이거나 필터를 지워 보세요."
              actions={
                <>
                  <button type="button" className="btn btn-secondary" onClick={clearAll}>
                    필터 모두 지우기
                  </button>
                  <Link to="/meetups/new" className="btn btn-primary">
                    모임 만들기
                  </Link>
                </>
              }
            />
          ) : (
            <EmptyState
              icon={<Users size={24} strokeWidth={1.75} />}
              title="아직 열린 모임이 없어요"
              body="첫 모임을 열면 근처 개발자들이 찾아올 수 있어요."
              actions={
                <Link to="/meetups/new" className="btn btn-primary">
                  모임 만들기
                </Link>
              }
            />
          )
        ) : null}

        <Pagination page={page} total={query.data?.total ?? 0} onChange={(p) => update({ page: p })} />
      </div>
    </div>
  )
}
