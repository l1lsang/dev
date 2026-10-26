import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FolderOpen } from 'lucide-react'
import { Link } from 'react-router'
import { fetchPortfolios } from '../api/portfolios'
import { ActiveFilters, Pagination, SearchBox } from '../components/list'
import { Delayed, EmptyState, ErrorState } from '../components/states'
import { PageHeader } from '../components/ui'
import { WorkCard } from '../components/WorkCard'
import { useListParams } from '../lib/hooks'

const DEFAULTS = { q: '', stack: '' }
const PAGE = 24
const POPULAR = ['React', 'Next.js', 'Spring', 'TypeScript', 'Python', 'Flutter', 'Supabase']

export default function Showcase() {
  const { values, page, update } = useListParams(DEFAULTS)
  const params = { ...values, page, pageSize: PAGE }
  const query = useQuery({
    queryKey: ['portfolios', params],
    queryFn: () => fetchPortfolios(params),
    placeholderData: keepPreviousData,
  })

  const chips = values.stack ? [{ key: 'stack', label: `기술: ${values.stack}`, onRemove: () => update({ stack: '' }) }] : []
  const filtered = Boolean(values.q || values.stack)
  const clearAll = () => update({ q: '', stack: '' })

  return (
    <div className="page">
      <PageHeader
        title="포트폴리오"
        description="멤버들이 만든 것들이에요. 마음에 드는 작업이 있으면 만든 사람에게 말을 걸어 보세요."
        actions={
          <Link to="/works/new" className="btn btn-primary">
            포트폴리오 올리기
          </Link>
        }
      />

      <div className="list-toolbar">
        <div className="toolbar">
          <SearchBox value={values.q} onChange={(q) => update({ q })} placeholder="프로젝트 이름, 요약" />
          <div className="quick-filters" role="group" aria-label="기술로 거르기">
            {POPULAR.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                aria-pressed={values.stack === s}
                onClick={() => update({ stack: values.stack === s ? '' : s })}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <ActiveFilters items={chips} onClearAll={clearAll} />
      </div>

      {query.isPending ? (
        <Delayed>
          <div className="card-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="work-card">
                <div className="work-cover skeleton" />
                <div className="work-body">
                  <span className="skeleton" style={{ width: '60%' }} />
                  <span className="skeleton" style={{ width: '85%' }} />
                </div>
              </div>
            ))}
          </div>
        </Delayed>
      ) : query.isError ? (
        <div className="panel">
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </div>
      ) : query.data.rows.length === 0 ? (
        <div className="panel">
          {filtered ? (
            <EmptyState
              title="조건에 맞는 작업이 없어요"
              body="검색어를 줄이거나 기술 필터를 지워 보세요."
              actions={
                <button type="button" className="btn btn-secondary" onClick={clearAll}>
                  필터 모두 지우기
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={<FolderOpen size={24} strokeWidth={1.75} />}
              title="첫 포트폴리오를 기다리고 있어요"
              body="완성작이 아니어도 괜찮아요. 만들고 있는 것을 올리면 피드백을 받을 수 있어요."
              actions={
                <Link to="/works/new" className="btn btn-primary">
                  포트폴리오 올리기
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <div className="card-grid">
          {query.data.rows.map((w) => (
            <WorkCard key={w.id} work={w} />
          ))}
        </div>
      )}

      <div className="panel showcase-pagination">
        <Pagination page={page} pageSize={PAGE} total={query.data?.total ?? 0} onChange={(p) => update({ page: p })} />
      </div>
    </div>
  )
}
