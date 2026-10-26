import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, FileText, FolderOpen, Target, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { fetchUserGoals } from '../api/goals'
import { fetchPortfolios } from '../api/portfolios'
import { fetchProfileByHandle } from '../api/profiles'
import {
  addFeedback,
  deleteFeedback,
  deleteResume,
  fetchFeedback,
  fetchResume,
  openResume,
  RESUME_MAX_BYTES,
  updateResumeSettings,
  uploadResume,
} from '../api/resumes'
import { GoalRow } from '../components/GoalRow'
import { TabPanel, Tabs } from '../components/list'
import { OverflowMenu } from '../components/overlays'
import { EmptyState, ErrorState, ListSkeleton } from '../components/states'
import { Avatar, Button, IconButton, PageHeader } from '../components/ui'
import { WorkCard } from '../components/WorkCard'
import { useAuth, useConfirm, useToast } from '../lib/contexts'
import { useLocalState } from '../lib/hooks'
import { formatBytes, formatDate, formatRelative } from '../lib/format'
import type { Profile as ProfileType, Resume } from '../lib/types'

type Tab = 'works' | 'resume' | 'goals'

// ---------------------------------------------------------------------------
// 포트폴리오 탭
// ---------------------------------------------------------------------------
function WorksTab({ profile, isMe }: { profile: ProfileType; isMe: boolean }) {
  const q = useQuery({
    queryKey: ['portfolios', { userId: profile.id }],
    queryFn: () => fetchPortfolios({ q: '', stack: '', page: 1, userId: profile.id, pageSize: 60 }),
  })
  if (q.isPending) return <ListSkeleton rows={3} />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (q.data.rows.length === 0) {
    return (
      <div className="panel">
        <EmptyState
          icon={<FolderOpen size={24} strokeWidth={1.75} />}
          title={isMe ? '첫 작업물을 올려 보세요' : '아직 올린 작업물이 없어요'}
          body={isMe ? '사이드 프로젝트, 과제, 오픈소스 기여 무엇이든 좋아요. 멤버들이 보고 피드백을 남길 수 있어요.' : undefined}
          actions={
            isMe ? (
              <Link to="/works/new" className="btn btn-primary">
                포트폴리오 추가
              </Link>
            ) : undefined
          }
        />
      </div>
    )
  }
  return (
    <div className="stack-lg">
      {isMe && (
        <div className="tab-toolbar">
          <Link to="/works/new" className="btn btn-secondary">
            포트폴리오 추가
          </Link>
        </div>
      )}
      <div className="card-grid">
        {q.data.rows.map((w) => (
          <WorkCard key={w.id} work={w} showAuthor={false} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 이력서 탭
// ---------------------------------------------------------------------------
function Feedback({ resume, isOwner }: { resume: Resume; isOwner: boolean }) {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [body, setBody] = useLocalState(`draft:feedback:${resume.user_id}`, '')
  const [error, setError] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['resume-feedback', resume.user_id], queryFn: () => fetchFeedback(resume.user_id) })

  const add = useMutation({
    mutationFn: () => addFeedback(resume.user_id, body.trim()),
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries({ queryKey: ['resume-feedback', resume.user_id] })
      toast.show({ message: '피드백을 남겼어요. 고마워요.' })
    },
    onError: (e) => toast.error('피드백을 남기지 못했어요. 쓴 내용은 그대로 있어요. 다시 시도해 주세요.', e),
  })

  const remove = async (id: string, author: string) => {
    const ok = await confirm({
      title: `${author} 님의 피드백을 삭제할까요?`,
      body: '삭제하면 되돌릴 수 없어요.',
      confirmLabel: '피드백 삭제',
    })
    if (!ok) return
    try {
      await deleteFeedback(id)
      queryClient.invalidateQueries({ queryKey: ['resume-feedback', resume.user_id] })
    } catch (e) {
      toast.error('피드백을 삭제하지 못했어요. 다시 시도해 주세요.', e)
    }
  }

  return (
    <section className="feedback" aria-labelledby="feedback-title">
      <h2 id="feedback-title" className="section-title">
        받은 피드백 {q.data && <span className="num tab-count">{q.data.length}</span>}
      </h2>
      {q.isPending ? (
        <ListSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <p className="secondary">
          {resume.wants_feedback
            ? '아직 피드백이 없어요.'
            : isOwner
              ? '피드백 받기를 켜면 멤버들이 의견을 남길 수 있어요.'
              : '지금은 피드백을 받지 않고 있어요.'}
        </p>
      ) : (
        <ul className="panel divided">
          {q.data.map((f) => (
            <li key={f.id} className="comment">
              <Avatar profile={f.author} />
              <div className="comment-main">
                <p className="comment-head">
                  <Link to={`/u/${f.author.handle}`} className="row-title">
                    {f.author.display_name}
                  </Link>
                  <time className="meta" dateTime={f.created_at}>
                    {formatRelative(f.created_at)}
                  </time>
                </p>
                <p className="prose-body">{f.body}</p>
              </div>
              {(isOwner || f.author_id === user?.id) && (
                <IconButton
                  label="피드백 삭제"
                  icon={<Trash2 size={18} strokeWidth={1.75} />}
                  tooltipAlign="end"
                  onClick={() => remove(f.id, f.author.display_name)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {!isOwner && resume.wants_feedback && (
        <form
          className="comment-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (!body.trim()) {
              setError('남길 피드백을 적어 주세요.')
              return
            }
            add.mutate()
          }}
        >
          <label className="field-label" htmlFor="feedback-body">
            피드백 남기기
          </label>
          <textarea
            id="feedback-body"
            className="textarea"
            rows={4}
            maxLength={2000}
            value={body}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'feedback-error' : 'feedback-hint'}
            onFocus={() => setError(null)}
            onChange={(e) => {
              setBody(e.target.value)
              setError(null)
            }}
          />
          {error ? (
            <p id="feedback-error" className="field-error" role="alert">
              {error}
            </p>
          ) : (
            <p id="feedback-hint" className="field-hint">
              좋았던 점 하나, 고치면 좋을 점 하나를 구체적으로 적어 주세요.
            </p>
          )}
          <div className="comment-form-actions">
            <span />
            <Button type="submit" variant="primary" loading={add.isPending}>
              피드백 남기기
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

function ResumeTab({ profile, isMe }: { profile: ProfileType; isMe: boolean }) {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)

  const q = useQuery({
    queryKey: ['resume', profile.id],
    queryFn: () => fetchResume(profile.id),
    enabled: Boolean(user),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['resume', profile.id] })

  const upload = useMutation({
    mutationFn: (file: File) => uploadResume(profile.id, file, q.data ?? null),
    onSuccess: () => {
      refresh()
      toast.show({ message: '이력서를 올렸어요. 공개 범위를 확인해 주세요.' })
    },
    onError: (e) => toast.error('이력서를 올리지 못했어요. 연결을 확인하고 다시 시도해 주세요.', e),
  })

  const settings = useMutation({
    mutationFn: (patch: Partial<Pick<Resume, 'visibility' | 'wants_feedback'>>) => updateResumeSettings(profile.id, patch),
    onSuccess: refresh,
    onError: (e) => toast.error('설정을 저장하지 못했어요. 다시 시도해 주세요.', e),
  })

  if (!user) {
    return (
      <div className="panel">
        <EmptyState
          icon={<FileText size={24} strokeWidth={1.75} />}
          title="이력서는 로그인한 멤버만 볼 수 있어요"
          actions={
            <Link to={`/login?next=${encodeURIComponent(`/u/${profile.handle}?tab=resume`)}`} className="btn btn-primary">
              로그인하기
            </Link>
          }
        />
      </div>
    )
  }
  if (q.isPending) return <ListSkeleton rows={2} />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />

  const resume = q.data

  const pickFile = (file: File | undefined) => {
    setFileError(null)
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('PDF 파일만 올릴 수 있어요. 문서를 PDF로 내보낸 뒤 다시 골라 주세요.')
      return
    }
    if (file.size > RESUME_MAX_BYTES) {
      setFileError(`10MB 이하 파일만 올릴 수 있어요. 고른 파일은 ${formatBytes(file.size)}예요.`)
      return
    }
    upload.mutate(file)
  }

  const open = async () => {
    if (!resume) return
    setOpening(true)
    // 팝업 차단을 피하려고 창을 먼저 연다
    const win = window.open('', '_blank')
    if (win) win.opener = null
    try {
      const url = await openResume(resume.file_path)
      if (win) win.location.href = url
      else window.location.href = url
    } catch (e) {
      win?.close()
      toast.error('이력서를 열지 못했어요. 다시 시도해 주세요.', e)
    } finally {
      setOpening(false)
    }
  }

  const remove = async () => {
    if (!resume) return
    const ok = await confirm({
      title: `이력서 '${resume.file_name}'을 삭제할까요?`,
      body: '받은 피드백도 함께 지워지고 되돌릴 수 없어요.',
      confirmLabel: '이력서 삭제',
    })
    if (!ok) return
    try {
      await deleteResume(resume)
      refresh()
      toast.show({ message: '이력서를 삭제했어요.' })
    } catch (e) {
      toast.error('이력서를 삭제하지 못했어요. 다시 시도해 주세요.', e)
    }
  }

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="application/pdf,.pdf"
      className="visually-hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        pickFile(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  if (!resume) {
    return isMe ? (
      <div className="panel">
        <EmptyState
          icon={<FileText size={24} strokeWidth={1.75} />}
          title="이력서를 올려 두세요"
          body="처음엔 나만 볼 수 있어요. 멤버에게 공개하고 피드백을 요청할 수도 있어요. PDF, 10MB까지."
          actions={
            <Button variant="primary" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
              PDF 올리기
            </Button>
          }
        />
        {fileError && (
          <p className="field-error resume-error" role="alert">
            {fileError}
          </p>
        )}
        {fileInput}
      </div>
    ) : (
      <div className="panel">
        <EmptyState
          icon={<FileText size={24} strokeWidth={1.75} />}
          title="공개된 이력서가 없어요"
          body={`${profile.display_name} 님이 이력서를 올리지 않았거나 비공개로 두었어요.`}
        />
      </div>
    )
  }

  return (
    <div className="resume-grid">
      <div className="stack-lg">
        <div className="panel resume-file">
          <FileText size={24} strokeWidth={1.75} aria-hidden="true" className="resume-icon" />
          <div className="list-row-main">
            <p className="row-title">{resume.file_name}</p>
            <p className="meta dot-sep">
              <span>{formatBytes(resume.file_size)}</span>
              <span>{formatDate(resume.updated_at)} 업데이트</span>
            </p>
          </div>
          <div className="resume-actions">
            <Button variant="secondary" loading={opening} onClick={open}>
              이력서 열기
              <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
            </Button>
            {isMe && (
              <>
                <Button variant="ghost" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                  새 파일로 교체
                </Button>
                <OverflowMenu label="이력서 메뉴" items={[{ label: '이력서 삭제', danger: true, onSelect: remove }]} />
              </>
            )}
          </div>
          {fileInput}
        </div>
        {fileError && (
          <p className="field-error" role="alert">
            {fileError}
          </p>
        )}
        <Feedback resume={resume} isOwner={isMe} />
      </div>

      {isMe && (
        <aside className="panel panel-body resume-settings" aria-labelledby="resume-settings-title">
          <h2 id="resume-settings-title" className="side-title">
            공개 범위
          </h2>
          <fieldset className="field">
            <legend className="visually-hidden">공개 범위</legend>
            <div className="segmented" role="radiogroup">
              {(
                [
                  ['private', '나만 보기'],
                  ['members', '멤버에게 공개'],
                ] as const
              ).map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={resume.visibility === value}
                    disabled={settings.isPending}
                    onChange={() =>
                      settings.mutate(value === 'private' ? { visibility: 'private', wants_feedback: false } : { visibility: 'members' })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <p className="field-hint">멤버에게 공개하면 로그인한 사람만 파일을 열 수 있어요. 링크는 10분 뒤 만료돼요.</p>
          </fieldset>
          <label className="check-row">
            <input
              type="checkbox"
              checked={resume.wants_feedback}
              disabled={resume.visibility !== 'members' || settings.isPending}
              onChange={(e) => settings.mutate({ wants_feedback: e.target.checked })}
            />
            <span className="check-row-text">
              <span className="check-row-title">피드백 받기</span>
              <span className="check-row-hint">
                {resume.visibility === 'members' ? '멤버들이 이력서 아래에 의견을 남길 수 있어요.' : '멤버에게 공개해야 켤 수 있어요.'}
              </span>
            </span>
          </label>
        </aside>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 주간 목표 탭
// ---------------------------------------------------------------------------
function GoalsTab({ profile, isMe }: { profile: ProfileType; isMe: boolean }) {
  const queryClient = useQueryClient()
  const q = useQuery({ queryKey: ['user-goals', profile.id], queryFn: () => fetchUserGoals(profile.id) })
  if (q.isPending) return <ListSkeleton rows={3} />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (q.data.length === 0) {
    return (
      <div className="panel">
        <EmptyState
          icon={<Target size={24} strokeWidth={1.75} />}
          title={isMe ? '아직 올린 목표가 없어요' : '아직 올린 목표가 없어요'}
          body={isMe ? '이번 주에 할 일 하나를 적어 두면 다른 멤버들이 응원해 줘요.' : undefined}
          actions={
            isMe ? (
              <Link to="/goals" className="btn btn-primary">
                이번 주 목표 쓰기
              </Link>
            ) : undefined
          }
        />
      </div>
    )
  }
  return (
    <section className="panel feed">
      <ul className="divided">
        {q.data.map((g) => (
          <GoalRow
            key={g.id}
            goal={g}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ['user-goals', profile.id] })
              queryClient.invalidateQueries({ queryKey: ['goals'] })
            }}
          />
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 페이지
// ---------------------------------------------------------------------------
export default function Profile() {
  const { handle = '' } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const q = useQuery({ queryKey: ['profile', handle], queryFn: () => fetchProfileByHandle(handle) })

  const tab = (['works', 'resume', 'goals'].includes(params.get('tab') ?? '') ? params.get('tab') : 'works') as Tab
  const setTab = (t: Tab) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (t === 'works') next.delete('tab')
        else next.set('tab', t)
        return next
      },
      { replace: true },
    )

  if (q.isPending) {
    return (
      <div className="page">
        <ListSkeleton rows={3} />
      </div>
    )
  }
  if (q.isError) {
    return (
      <div className="page">
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </div>
    )
  }
  if (!q.data) return <Navigate to="/people" replace />

  const profile = q.data
  const isMe = user?.id === profile.id
  const facts = [
    profile.job_role,
    profile.years != null ? (profile.years === 0 ? '신입' : `${profile.years}년 차`) : null,
    profile.area_label,
  ].filter(Boolean) as string[]

  return (
    <div className="page">
      <div className="profile-head">
        <Avatar profile={profile} size="lg" />
        <PageHeader
          breadcrumb={{ to: '/people', label: '멤버' }}
          title={profile.display_name}
          meta={
            <span className="dot-sep">
              <span className="mono">@{profile.handle}</span>
              {facts.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </span>
          }
          actions={
            isMe ? (
              <Link to="/me/edit" className="btn btn-secondary">
                프로필 수정
              </Link>
            ) : undefined
          }
        />
      </div>

      <div className="profile-intro">
        {profile.bio ? <p className="prose-body">{profile.bio}</p> : isMe ? <p className="secondary">한 줄 소개를 적어 두면 모임장이 나를 알아보기 쉬워요.</p> : null}
        {profile.stack.length > 0 && (
          <p className="stack-list">
            <span className="visually-hidden">기술 스택: </span>
            {profile.stack.join(' · ')}
          </p>
        )}
        {(profile.github_url || profile.blog_url) && (
          <p className="profile-links">
            {profile.github_url && (
              <a href={profile.github_url} target="_blank" rel="noreferrer" className="text-link">
                GitHub
              </a>
            )}
            {profile.blog_url && (
              <a href={profile.blog_url} target="_blank" rel="noreferrer" className="text-link">
                블로그
              </a>
            )}
          </p>
        )}
      </div>

      <Tabs<Tab>
        label="프로필 정보"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'works', label: '포트폴리오' },
          { id: 'resume', label: '이력서' },
          { id: 'goals', label: '주간 목표' },
        ]}
      />
      <TabPanel id={tab}>
        {tab === 'works' && <WorksTab profile={profile} isMe={isMe} />}
        {tab === 'resume' && <ResumeTab profile={profile} isMe={isMe} />}
        {tab === 'goals' && <GoalsTab profile={profile} isMe={isMe} />}
      </TabPanel>
    </div>
  )
}
