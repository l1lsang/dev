import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { createPost, fetchPost, updatePost } from '../api/posts'
import { ErrorState } from '../components/states'
import { Button, DraftNotice, Field, PageHeader } from '../components/ui'
import { useAuth, useToast } from '../lib/contexts'
import { useUnsavedChanges } from '../lib/hooks'
import { POST_CATEGORIES } from '../lib/site'
import type { Post, PostCategory } from '../lib/types'
import { useForm } from '../lib/useForm'

type Values = { category: PostCategory; title: string; body: string }

function PostFormBody({ post }: { post: Post | null }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const initialCategory = (params.get('category') as PostCategory) || 'question'
  const form = useForm<Values>(
    post
      ? { category: post.category, title: post.title, body: post.body }
      : { category: initialCategory in POST_CATEGORIES ? initialCategory : 'question', title: '', body: '' },
    {
      title: (v) =>
        !v.trim() ? '제목을 입력해 주세요.' : v.trim().length < 2 ? '두 글자 이상으로 적어 주세요.' : null,
      body: (v) => (!v.trim() ? '본문을 입력해 주세요.' : null),
    },
    { draftKey: `post:${post?.id ?? 'new'}` },
  )
  useUnsavedChanges(form.dirty && !saving)

  const submit = async () => {
    if (!form.validateAll()) return
    const input = { category: form.values.category, title: form.values.title.trim(), body: form.values.body.trim() }
    setSaving(true)
    try {
      let id = post?.id
      if (post) await updatePost(post.id, input)
      else id = (await createPost(input)).id
      form.markClean()
      await queryClient.invalidateQueries({ queryKey: ['posts'] })
      await queryClient.invalidateQueries({ queryKey: ['post', id] })
      navigate(`/board/${id}`, { replace: true })
    } catch (e) {
      setSaving(false)
      toast.error('글을 저장하지 못했어요. 쓴 내용은 그대로 있어요. 잠시 뒤 다시 시도해 주세요.', e)
    }
  }

  return (
    <div className="page page-narrow">
      <PageHeader
        title={post ? '글 수정' : '글쓰기'}
        breadcrumb={post ? { to: `/board/${post.id}`, label: post.title } : { to: '/board', label: '게시판' }}
      />
      {form.restored && <DraftNotice onDiscard={form.discardDraft} />}
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <fieldset className="field">
          <legend className="field-label">분류</legend>
          <div className="segmented" role="radiogroup">
            {Object.entries(POST_CATEGORIES).map(([k, label]) => (
              <label key={k}>
                <input
                  type="radio"
                  name="category"
                  value={k}
                  checked={form.values.category === k}
                  onChange={() => form.set('category', k as PostCategory)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field id="f-title" label="제목" error={form.errors.title}>
          <input {...form.input('title')} className="input" maxLength={100} autoComplete="off" aria-required="true" />
        </Field>

        <Field
          id="f-body"
          label="본문"
          error={form.errors.body}
          hint="코드는 그대로 붙여 넣어도 줄바꿈이 유지돼요. 질문이라면 시도해 본 것과 오류 메시지를 함께 적어 주세요."
        >
          <textarea {...form.input('body')} className="textarea textarea-tall" rows={16} maxLength={20000} aria-required="true" />
        </Field>

        <div className="form-actions is-sticky">
          <Link to={post ? `/board/${post.id}` : '/board'} className="btn btn-ghost">
            취소
          </Link>
          <Button type="submit" variant="primary" loading={saving}>
            {post ? '변경사항 저장' : '글 올리기'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function PostForm() {
  const { id } = useParams()
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['post', id], queryFn: () => fetchPost(id as string), enabled: Boolean(id) })

  if (!id) return <PostFormBody post={null} />
  if (q.isPending) return <div className="page page-narrow" aria-busy="true" />
  if (q.isError) return <div className="page page-narrow"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
  if (!q.data) return <Navigate to="/board" replace />
  if (q.data.author_id !== user?.id) return <Navigate to={`/board/${id}`} replace />
  return <PostFormBody key={q.data.id} post={q.data} />
}
