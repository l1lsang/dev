import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { coverUrl, deletePortfolio, fetchPortfolio } from '../api/portfolios'
import { OverflowMenu } from '../components/overlays'
import { ErrorState, ListSkeleton } from '../components/states'
import { Avatar, PageHeader } from '../components/ui'
import { useAuth, useConfirm, useToast } from '../lib/contexts'
import { formatDate } from '../lib/format'

export default function WorkDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const q = useQuery({ queryKey: ['portfolio', id], queryFn: () => fetchPortfolio(id) })

  if (q.isPending) {
    return (
      <div className="page page-read">
        <ListSkeleton rows={3} />
      </div>
    )
  }
  if (q.isError) {
    return (
      <div className="page page-read">
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </div>
    )
  }
  if (!q.data) return <Navigate to="/showcase" replace />

  const work = q.data
  const isOwner = user?.id === work.user_id
  const cover = coverUrl(work.cover_path)

  const remove = async () => {
    const ok = await confirm({
      title: `'${work.title}' 포트폴리오를 삭제할까요?`,
      body: '대표 이미지도 함께 지워지고 되돌릴 수 없어요.',
      confirmLabel: '포트폴리오 삭제',
    })
    if (!ok) return
    try {
      await deletePortfolio(work)
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      toast.show({ message: '포트폴리오를 삭제했어요.' })
      navigate(`/u/${work.author.handle}`, { replace: true })
    } catch (e) {
      toast.error('포트폴리오를 삭제하지 못했어요. 다시 시도해 주세요.', e)
    }
  }

  return (
    <div className="page page-read">
      <PageHeader
        breadcrumb={{ to: '/showcase', label: '포트폴리오' }}
        title={work.title}
        meta={
          <span className="post-byline">
            <Link to={`/u/${work.author.handle}`} className="person-link">
              <Avatar profile={work.author} />
              <span>{work.author.display_name}</span>
            </Link>
            <span className="meta">{formatDate(work.created_at)}</span>
          </span>
        }
        actions={
          isOwner ? (
            <>
              <Link to={`/works/${work.id}/edit`} className="btn btn-secondary">
                포트폴리오 수정
              </Link>
              <OverflowMenu label="포트폴리오 메뉴" items={[{ label: '포트폴리오 삭제', danger: true, onSelect: remove }]} />
            </>
          ) : undefined
        }
      />

      {cover && (
        <figure className="work-hero">
          <img src={cover} alt={`${work.title} 대표 이미지`} />
        </figure>
      )}

      <div className="work-facts">
        <p className="lead-sm">{work.summary}</p>
        {work.stack.length > 0 && <p className="stack-list mono">{work.stack.join(' · ')}</p>}
        {(work.live_url || work.repo_url) && (
          <div className="work-links">
            {work.live_url && (
              <a href={work.live_url} target="_blank" rel="noreferrer" className="btn btn-primary">
                서비스 열기
                <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
              </a>
            )}
            {work.repo_url && (
              <a href={work.repo_url} target="_blank" rel="noreferrer" className="btn btn-secondary">
                코드 보기
                <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>

      {work.body && (
        <article className="prose">
          <p className="prose-body">{work.body}</p>
        </article>
      )}
    </div>
  )
}
