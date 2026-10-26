import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import {
  coverUrl,
  createPortfolio,
  fetchPortfolio,
  removeCover,
  updatePortfolio,
  uploadCover,
} from '../api/portfolios'
import { StackInput } from '../components/StackInput'
import { ErrorState } from '../components/states'
import { Button, DraftNotice, Field, PageHeader } from '../components/ui'
import { useAuth, useToast } from '../lib/contexts'
import { formatBytes, isValidUrl, normalizeUrl } from '../lib/format'
import { useUnsavedChanges } from '../lib/hooks'
import type { Portfolio } from '../lib/types'
import { useForm } from '../lib/useForm'

const COVER_MAX = 5 * 1024 * 1024
const COVER_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

type Values = {
  title: string
  summary: string
  stack: string[]
  live_url: string
  repo_url: string
  body: string
}

const urlRule = (v: string) => (!v.trim() || isValidUrl(v) ? null : 'https://로 시작하는 주소로 적어 주세요.')

function PortfolioFormBody({ work }: { work: Portfolio | null }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverRemoved, setCoverRemoved] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)

  const form = useForm<Values>(
    {
      title: work?.title ?? '',
      summary: work?.summary ?? '',
      stack: work?.stack ?? [],
      live_url: work?.live_url ?? '',
      repo_url: work?.repo_url ?? '',
      body: work?.body ?? '',
    },
    {
      title: (v) =>
        !v.trim() ? '프로젝트 이름을 입력해 주세요.' : v.trim().length < 2 ? '두 글자 이상으로 적어 주세요.' : null,
      summary: (v) => (!v.trim() ? '어떤 프로젝트인지 한 줄로 적어 주세요.' : v.length > 200 ? '200자 안으로 줄여 주세요.' : null),
      live_url: urlRule,
      repo_url: urlRule,
    },
    { draftKey: `portfolio:${work?.id ?? 'new'}` },
  )
  useUnsavedChanges((form.dirty || Boolean(coverFile) || coverRemoved) && !saving)

  const previewUrl = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile])
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])
  const shownCover = previewUrl ?? (coverRemoved ? null : coverUrl(work?.cover_path ?? null))

  const pickCover = (file: File | undefined) => {
    setCoverError(null)
    if (!file) return
    if (!COVER_TYPES.includes(file.type)) {
      setCoverError('PNG, JPG, WebP, GIF 이미지만 쓸 수 있어요.')
      return
    }
    if (file.size > COVER_MAX) {
      setCoverError(`5MB 이하 이미지만 올릴 수 있어요. 고른 파일은 ${formatBytes(file.size)}예요.`)
      return
    }
    setCoverFile(file)
    setCoverRemoved(false)
  }

  const submit = async () => {
    if (!form.validateAll() || !user) return
    const v = form.values
    setSaving(true)
    let uploaded: string | null = null
    try {
      if (coverFile) uploaded = await uploadCover(user.id, coverFile)
      const cover_path = uploaded ?? (coverRemoved ? null : (work?.cover_path ?? null))
      const input = {
        title: v.title.trim(),
        summary: v.summary.trim(),
        stack: v.stack,
        live_url: v.live_url.trim() ? normalizeUrl(v.live_url) : null,
        repo_url: v.repo_url.trim() ? normalizeUrl(v.repo_url) : null,
        body: v.body.trim() || null,
        cover_path,
      }
      let id = work?.id
      if (work) await updatePortfolio(work.id, input)
      else id = (await createPortfolio(input)).id

      // 이전 커버는 새 내용이 저장된 뒤에 지운다
      if (work?.cover_path && work.cover_path !== cover_path) await removeCover(work.cover_path)

      form.markClean()
      setCoverFile(null)
      await queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      await queryClient.invalidateQueries({ queryKey: ['portfolio', id] })
      toast.show({ message: work ? '포트폴리오를 저장했어요.' : '포트폴리오를 올렸어요.' })
      navigate(`/works/${id}`, { replace: true })
    } catch (e) {
      if (uploaded) await removeCover(uploaded)
      setSaving(false)
      toast.error('포트폴리오를 저장하지 못했어요. 입력한 내용은 그대로 있어요. 다시 시도해 주세요.', e)
    }
  }

  return (
    <div className="page page-narrow">
      <PageHeader
        title={work ? '포트폴리오 수정' : '포트폴리오 추가'}
        breadcrumb={work ? { to: `/works/${work.id}`, label: work.title } : { to: '/showcase', label: '포트폴리오' }}
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
        <Field id="f-title" label="프로젝트 이름" error={form.errors.title}>
          <input {...form.input('title')} className="input" maxLength={80} autoComplete="off" aria-required="true" />
        </Field>

        <Field id="f-summary" label="한 줄 요약" error={form.errors.summary} hint="카드에 보이는 문장이에요. 무엇을, 왜 만들었는지.">
          <input {...form.input('summary')} className="input" maxLength={200} autoComplete="off" aria-required="true" />
        </Field>

        <div className="field">
          <span className="field-label" id="cover-label">
            대표 이미지 <span className="field-optional">(선택)</span>
          </span>
          <div className="cover-picker">
            <div className="work-cover cover-preview">
              {shownCover ? <img src={shownCover} alt="선택한 대표 이미지 미리보기" /> : <span className="meta">이미지 없음</span>}
            </div>
            <div className="cover-picker-actions">
              <Button onClick={() => fileRef.current?.click()} aria-describedby="cover-hint">
                <ImagePlus size={16} strokeWidth={1.75} aria-hidden="true" />
                {shownCover ? '이미지 바꾸기' : '이미지 고르기'}
              </Button>
              {shownCover && (
                <Button
                  variant="danger-text"
                  onClick={() => {
                    setCoverFile(null)
                    setCoverRemoved(true)
                  }}
                >
                  이미지 빼기
                </Button>
              )}
            </div>
          </div>
          {coverError ? (
            <p className="field-error" role="alert">
              {coverError}
            </p>
          ) : (
            <p className="field-hint" id="cover-hint">
              16:9 비율 스크린샷이 가장 잘 보여요. PNG·JPG·WebP·GIF, 5MB까지.
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={COVER_TYPES.join(',')}
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              pickCover(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        <Field id="f-stack" label="사용한 기술" optional hint="Enter나 쉼표로 추가해요. 최대 12개.">
          <StackInput id="f-stack" value={form.values.stack} onChange={(next) => form.set('stack', next)} describedBy="f-stack-hint" />
        </Field>

        <div className="form-row">
          <Field id="f-live_url" label="서비스 주소" optional error={form.errors.live_url}>
            <input {...form.input('live_url')} className="input" type="url" inputMode="url" placeholder="https://my-app.vercel.app" />
          </Field>
          <Field id="f-repo_url" label="저장소 주소" optional error={form.errors.repo_url}>
            <input {...form.input('repo_url')} className="input" type="url" inputMode="url" placeholder="https://github.com/me/my-app" />
          </Field>
        </div>

        <Field id="f-body" label="자세한 설명" optional hint="문제, 내가 맡은 부분, 기술적으로 고민한 점, 결과 순서로 쓰면 읽기 좋아요.">
          <textarea {...form.input('body')} className="textarea textarea-tall" rows={12} maxLength={5000} />
        </Field>

        <div className="form-actions is-sticky">
          <Link to={work ? `/works/${work.id}` : '/showcase'} className="btn btn-ghost">
            취소
          </Link>
          <Button type="submit" variant="primary" loading={saving}>
            {work ? '변경사항 저장' : '포트폴리오 올리기'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function PortfolioForm() {
  const { id } = useParams()
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['portfolio', id], queryFn: () => fetchPortfolio(id as string), enabled: Boolean(id) })

  if (!id) return <PortfolioFormBody work={null} />
  if (q.isPending) return <div className="page page-narrow" aria-busy="true" />
  if (q.isError) return <div className="page page-narrow"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
  if (!q.data) return <Navigate to="/showcase" replace />
  if (q.data.user_id !== user?.id) return <Navigate to={`/works/${id}`} replace />
  return <PortfolioFormBody key={q.data.id} work={q.data} />
}
