import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDown, ChevronRight, MessageSquare } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { fetchPosts } from '../api/posts'
import { ActiveFilters, FilterMenu, Pagination, SearchBox } from '../components/list'
import { EmptyState, ErrorState, TableSkeleton } from '../components/states'
import { PageHeader } from '../components/ui'
import { formatRelative } from '../lib/format'
import { useListParams } from '../lib/hooks'
import { POST_CATEGORIES } from '../lib/site'
import type { PostCategory } from '../lib/types'

const DEFAULTS = { q: '', category: '' }

export default function Board() {
  const navigate = useNavigate()
  const { values, page, update } = useListParams(DEFAULTS)
  const params = { q: values.q, category: values.category as PostCategory | '', page }
  const query = useQuery({
    queryKey: ['posts', params],
    queryFn: () => fetchPosts(params),
    placeholderData: keepPreviousData,
  })

  const chips = values.category
    ? [
        {
          key: 'category',
          label: `분류: ${POST_CATEGORIES[values.category as PostCategory]}`,
          onRemove: () => update({ category: '' }),
        },
      ]
    : []
  const filtered = chips.length > 0 || Boolean(values.q)
  const clearAll = () => update({ q: '', category: '' })

  return (
    <div className="page">
      <PageHeader
        title="게시판"
        description="막힌 문제를 묻고, 읽은 글을 나누고, 한 주를 돌아봐요."
        actions={
          <Link to="/board/new" className="btn btn-primary">
            글쓰기
          </Link>
        }
      />

      <div className="list-toolbar">
        <div className="toolbar">
          <SearchBox value={values.q} onChange={(q) => update({ q })} placeholder="제목, 본문" />
          <FilterMenu activeCount={chips.length}>
            <div className="field">
              <label className="field-label" htmlFor="filter-category">
                분류
              </label>
              <select
                id="filter-category"
                className="select"
                value={values.category}
                onChange={(e) => update({ category: e.target.value })}
              >
                <option value="">전체</option>
                {Object.entries(POST_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </FilterMenu>
        </div>
        <ActiveFilters items={chips} onClearAll={clearAll} />
      </div>

      <div className="panel list-frame">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col" className="col-category">
                  분류
                </th>
                <th scope="col">제목</th>
                <th scope="col">작성자</th>
                <th scope="col" aria-sort="descending">
                  <span className="th-sort">
                    작성 <ArrowDown size={14} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                </th>
                <th scope="col">
                  <span className="visually-hidden">열기</span>
                </th>
              </tr>
            </thead>
            {query.isSuccess && query.data.rows.length > 0 && (
              <tbody>
                {query.data.rows.map((p) => (
                  <tr key={p.id} className="is-link" onClick={() => navigate(`/board/${p.id}`)}>
                    <td className="secondary">{POST_CATEGORIES[p.category]}</td>
                    <td className="cell-main">
                      <Link to={`/board/${p.id}`} className="row-title" onClick={(e) => e.stopPropagation()}>
                        {p.title}
                      </Link>
                      {p.comment_count > 0 && <span className="row-sub">댓글 {p.comment_count}</span>}
                    </td>
                    <td>{p.author.display_name}</td>
                    <td className="secondary">{formatRelative(p.created_at)}</td>
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
          <TableSkeleton columns={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.rows.length === 0 ? (
          filtered ? (
            <EmptyState
              title="조건에 맞는 글이 없어요"
              body="검색어를 바꾸거나 분류 필터를 지워 보세요."
              actions={
                <button type="button" className="btn btn-secondary" onClick={clearAll}>
                  필터 모두 지우기
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={<MessageSquare size={24} strokeWidth={1.75} />}
              title="첫 글을 기다리고 있어요"
              body="질문이든 회고든, 한 줄이라도 남기면 대화가 시작돼요."
              actions={
                <Link to="/board/new" className="btn btn-primary">
                  글쓰기
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
