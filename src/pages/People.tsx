import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDown, ChevronRight, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { fetchPeople } from '../api/profiles'
import { ActiveFilters, FilterMenu, Pagination, SearchBox } from '../components/list'
import { EmptyState, ErrorState, TableSkeleton } from '../components/states'
import { Avatar, PageHeader } from '../components/ui'
import { useAuth } from '../lib/contexts'
import { useListParams } from '../lib/hooks'
import { JOB_ROLES } from '../lib/site'

const DEFAULTS = { q: '', role: '', stack: '' }

function StackFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    if (draft === value) return
    const t = window.setTimeout(() => onChange(draft.trim()), 400)
    return () => window.clearTimeout(t)
  }, [draft, value, onChange])
  return (
    <div className="field">
      <label className="field-label" htmlFor="filter-stack">
        기술 스택
      </label>
      <input
        id="filter-stack"
        className="input"
        value={draft}
        placeholder="React"
        aria-describedby="filter-stack-hint"
        onChange={(e) => setDraft(e.target.value)}
      />
      <p id="filter-stack-hint" className="field-hint">
        대소문자까지 같은 이름만 찾아요.
      </p>
    </div>
  )
}

export default function People() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { values, page, update } = useListParams(DEFAULTS)
  const params = { ...values, page }
  const query = useQuery({
    queryKey: ['people', params],
    queryFn: () => fetchPeople(params),
    placeholderData: keepPreviousData,
  })

  const chips = [
    ...(values.role ? [{ key: 'role', label: `직군: ${values.role}`, onRemove: () => update({ role: '' }) }] : []),
    ...(values.stack ? [{ key: 'stack', label: `스택: ${values.stack}`, onRemove: () => update({ stack: '' }) }] : []),
  ]
  const filtered = chips.length > 0 || Boolean(values.q)
  const clearAll = () => update({ q: '', role: '', stack: '' })

  return (
    <div className="page">
      <PageHeader
        title="멤버"
        description="함께 모이는 개발자들이에요. 프로필에서 포트폴리오와 공개된 이력서를 볼 수 있어요."
        actions={
          user ? (
            <Link to="/me/edit" className="btn btn-secondary">
              내 프로필 수정
            </Link>
          ) : (
            <Link to="/login?next=/people" className="btn btn-primary">
              가입하고 프로필 만들기
            </Link>
          )
        }
      />

      <div className="list-toolbar">
        <div className="toolbar">
          <SearchBox value={values.q} onChange={(q) => update({ q })} placeholder="이름, 핸들" />
          <FilterMenu activeCount={chips.length}>
            <div className="field">
              <label className="field-label" htmlFor="filter-role">
                직군
              </label>
              <select id="filter-role" className="select" value={values.role} onChange={(e) => update({ role: e.target.value })}>
                <option value="">전체</option>
                {JOB_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <StackFilter value={values.stack} onChange={(stack) => update({ stack })} />
          </FilterMenu>
        </div>
        <ActiveFilters items={chips} onClearAll={clearAll} />
      </div>

      <div className="panel list-frame">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">멤버</th>
                <th scope="col">직군</th>
                <th scope="col">기술 스택</th>
                <th scope="col">지역</th>
                <th scope="col">포트폴리오</th>
                <th scope="col" aria-sort="descending">
                  <span className="th-sort">
                    가입 <ArrowDown size={14} strokeWidth={1.75} aria-hidden="true" />
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
                  <tr key={p.id} className="is-link" onClick={() => navigate(`/u/${p.handle}`)}>
                    <td className="cell-main">
                      <Link to={`/u/${p.handle}`} className="person-cell" onClick={(e) => e.stopPropagation()}>
                        <Avatar profile={p} />
                        <span>
                          <span className="row-title">{p.display_name}</span>
                          <span className="row-sub mono">@{p.handle}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      {p.job_role ?? <span className="meta">미입력</span>}
                      {p.years != null && <span className="row-sub">{p.years === 0 ? '신입' : `${p.years}년 차`}</span>}
                    </td>
                    <td className="secondary cell-stack">{p.stack.length ? p.stack.slice(0, 4).join(', ') : <span className="meta">미입력</span>}</td>
                    <td>{p.area_label ?? <span className="meta">미입력</span>}</td>
                    <td className="num">{p.portfolio_count}</td>
                    <td className="secondary num">{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
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
              title="조건에 맞는 멤버가 없어요"
              body="검색어를 줄이거나 필터를 지워 보세요."
              actions={
                <button type="button" className="btn btn-secondary" onClick={clearAll}>
                  필터 모두 지우기
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={<Users size={24} strokeWidth={1.75} />}
              title="아직 가입한 멤버가 없어요"
              body="먼저 가입해서 프로필을 만들어 두면 모임을 찾는 사람들이 볼 수 있어요."
              actions={
                <Link to="/login?next=/me/edit" className="btn btn-primary">
                  가입하고 프로필 만들기
                </Link>
              }
            />
          )
        ) : null}

        <Pagination page={page} total={query.data?.total ?? 0} onChange={(p) => update({ page: p })} unit="명" />
      </div>
    </div>
  )
}
