import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { addComment, deleteComment, deletePost, fetchComments, fetchPost } from '../api/posts'
import { OverflowMenu } from '../components/overlays'
import { ErrorState, ListSkeleton } from '../components/states'
import { Avatar, Button, IconButton, PageHeader } from '../components/ui'
import { useAuth, useConfirm, useToast } from '../lib/contexts'
import { useLocalState } from '../lib/hooks'
import { formatDateTime, formatRelative, snippet } from '../lib/format'
import { POST_CATEGORIES } from '../lib/site'

function Comments({ postId }: { postId: string }) {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [body, setBody] = useLocalState(`draft:comment:${postId}`, '')
  const [error, setError] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['comments', postId], queryFn: () => fetchComments(postId) })

  const add = useMutation({
    mutationFn: () => addComment(postId, body.trim()),
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
    onError: (e) => toast.error('댓글을 남기지 못했어요. 쓴 내용은 그대로 있어요. 다시 시도해 주세요.', e),
  })

  const remove = async (id: string, text: string) => {
    const ok = await confirm({
      title: `댓글 “${snippet(text)}”을 삭제할까요?`,
      body: '삭제하면 되돌릴 수 없어요.',
      confirmLabel: '댓글 삭제',
    })
    if (!ok) return
    try {
      await deleteComment(id)
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
    } catch (e) {
      toast.error('댓글을 삭제하지 못했어요. 다시 시도해 주세요.', e)
    }
  }

  return (
    <section className="comments" aria-labelledby="comments-title">
      <h2 id="comments-title" className="section-title">
        댓글 {q.data ? <span className="num tab-count">{q.data.length}</span> : null}
      </h2>

      {q.isPending ? (
        <ListSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <p className="secondary comments-empty">아직 댓글이 없어요. 첫 댓글로 대화를 시작해 보세요.</p>
      ) : (
        <ul className="panel divided">
          {q.data.map((c) => (
            <li key={c.id} className="comment">
              <Avatar profile={c.author} />
              <div className="comment-main">
                <p className="comment-head">
                  <Link to={`/u/${c.author.handle}`} className="row-title">
                    {c.author.display_name}
                  </Link>
                  <time className="meta" dateTime={c.created_at} title={formatDateTime(c.created_at)}>
                    {formatRelative(c.created_at)}
                  </time>
                </p>
                <p className="prose-body">{c.body}</p>
              </div>
              {user?.id === c.author_id && (
                <IconButton label="댓글 삭제" icon={<Trash2 size={18} strokeWidth={1.75} />} tooltipAlign="end" onClick={() => remove(c.id, c.body)} />
              )}
            </li>
          ))}
        </ul>
      )}

      {user ? (
        <form
          className="comment-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (!body.trim()) {
              setError('댓글 내용을 입력해 주세요.')
              return
            }
            add.mutate()
          }}
        >
          <label className="field-label" htmlFor="comment-body">
            댓글 쓰기
          </label>
          <textarea
            id="comment-body"
            className="textarea"
            rows={3}
            maxLength={2000}
            value={body}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'comment-error' : undefined}
            onFocus={() => setError(null)}
            onChange={(e) => {
              setBody(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
            }}
          />
          {error && (
            <p id="comment-error" className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="comment-form-actions">
            <span className="meta">Ctrl + Enter로 바로 남길 수 있어요</span>
            <Button type="submit" variant="primary" loading={add.isPending}>
              댓글 남기기
            </Button>
          </div>
        </form>
      ) : (
        <p className="secondary">
          <Link to={`/login?next=${encodeURIComponent(`/board/${postId}`)}`} className="text-link">
            로그인
          </Link>
          하면 댓글을 남길 수 있어요.
        </p>
      )}
    </section>
  )
}

export default function PostDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const q = useQuery({ queryKey: ['post', id], queryFn: () => fetchPost(id) })

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
  if (!q.data) return <Navigate to="/board" replace />

  const post = q.data
  const isAuthor = user?.id === post.author_id
  const edited = new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60_000

  const remove = async () => {
    const ok = await confirm({
      title: `'${post.title}' 글을 삭제할까요?`,
      body: '댓글도 함께 지워지고 되돌릴 수 없어요.',
      confirmLabel: '글 삭제',
    })
    if (!ok) return
    try {
      await deletePost(post.id)
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      toast.show({ message: '글을 삭제했어요.' })
      navigate('/board', { replace: true })
    } catch (e) {
      toast.error('글을 삭제하지 못했어요. 다시 시도해 주세요.', e)
    }
  }

  return (
    <div className="page page-read">
      <PageHeader
        breadcrumb={{ to: `/board?category=${post.category}`, label: `게시판 · ${POST_CATEGORIES[post.category]}` }}
        title={post.title}
        meta={
          <span className="post-byline">
            <Link to={`/u/${post.author.handle}`} className="person-link">
              <Avatar profile={post.author} />
              <span>{post.author.display_name}</span>
            </Link>
            <span className="meta dot-sep">
              <time dateTime={post.created_at}>{formatDateTime(post.created_at)}</time>
              {edited && <span>수정됨</span>}
            </span>
          </span>
        }
        actions={
          isAuthor ? (
            <>
              <Link to={`/board/${post.id}/edit`} className="btn btn-secondary">
                글 수정
              </Link>
              <OverflowMenu label="글 메뉴" items={[{ label: '글 삭제', danger: true, onSelect: remove }]} />
            </>
          ) : undefined
        }
      />
      <article className="prose">
        <p className="prose-body">{post.body}</p>
      </article>
      <hr className="section-rule" />
      <Comments postId={post.id} />
    </div>
  )
}
