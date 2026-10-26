import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { createMeetup, fetchMeetup, updateMeetup, type MeetupInput } from '../api/meetups'
import { ErrorState } from '../components/states'
import { Button, DraftNotice, Field, PageHeader } from '../components/ui'
import { useAuth, useToast } from '../lib/contexts'
import { useUnsavedChanges } from '../lib/hooks'
import { TOPICS } from '../lib/site'
import type { Meetup, MeetupTopic } from '../lib/types'
import { required, useForm } from '../lib/useForm'

type Values = {
  title: string
  summary: string
  topic: MeetupTopic | ''
  cadence: string
  area_label: string
  capacity: string
  description: string
  is_open: boolean
}

const EMPTY: Values = {
  title: '',
  summary: '',
  topic: 'mogakco',
  cadence: '',
  area_label: '',
  capacity: '',
  description: '',
  is_open: true,
}

function toValues(m: Meetup): Values {
  return {
    title: m.title,
    summary: m.summary,
    topic: m.topic,
    cadence: m.cadence,
    area_label: m.area_label ?? '',
    capacity: m.capacity ? String(m.capacity) : '',
    description: m.description ?? '',
    is_open: m.is_open,
  }
}

function MeetupFormBody({ meetup }: { meetup: Meetup | null }) {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(meetup)

  const form = useForm<Values>(meetup ? toValues(meetup) : EMPTY, {
    title: (v) =>
      !v.trim() ? '모임 이름을 입력해 주세요.' : v.trim().length < 2 ? '두 글자 이상으로 지어 주세요.' : v.length > 60 ? '60자 안으로 줄여 주세요.' : null,
    summary: (v) => (!v.trim() ? '한 줄 소개를 입력해 주세요.' : v.length > 140 ? '140자 안으로 줄여 주세요.' : null),
    topic: required('주제를 골라 주세요.'),
    cadence: (v) => (!v.trim() ? '언제 모이는지 적어 주세요.' : v.length > 40 ? '40자 안으로 줄여 주세요.' : null),
    capacity: (v) => {
      if (!v) return null
      const n = Number(v)
      return Number.isInteger(n) && n >= 2 && n <= 100 ? null : '2명에서 100명 사이로 적어 주세요.'
    },
  }, { draftKey: `meetup:${meetup?.id ?? 'new'}` })

  useUnsavedChanges(form.dirty && !saving)

  const submit = async () => {
    if (!form.validateAll()) return
    const v = form.values
    const input: MeetupInput = {
      title: v.title.trim(),
      summary: v.summary.trim(),
      topic: v.topic as MeetupTopic,
      cadence: v.cadence.trim(),
      area_label: v.area_label.trim() || null,
      capacity: v.capacity ? Number(v.capacity) : null,
      description: v.description.trim() || null,
      is_open: v.is_open,
    }
    setSaving(true)
    try {
      const saved = meetup ? await updateMeetup(meetup.id, input) : await createMeetup(input)
      form.markClean()
      await queryClient.invalidateQueries({ queryKey: ['meetups'] })
      await queryClient.invalidateQueries({ queryKey: ['meetup', saved.id] })
      toast.show({ message: isEdit ? '모임 정보를 저장했어요.' : '모임을 열었어요. 첫 일정을 잡아 보세요.' })
      navigate(`/meetups/${saved.id}${isEdit ? '' : '?tab=schedule'}`, { replace: true })
    } catch (e) {
      setSaving(false)
      toast.error('모임을 저장하지 못했어요. 입력한 내용은 그대로 있어요. 잠시 뒤 다시 시도해 주세요.', e)
    }
  }

  return (
    <div className="page page-narrow">
      <PageHeader
        title={isEdit ? '모임 정보 수정' : '모임 만들기'}
        description={isEdit ? undefined : '모임장이 되면 일정을 잡고, 멤버들 위치로 만날 장소를 계산할 수 있어요.'}
        breadcrumb={meetup ? { to: `/meetups/${meetup.id}`, label: meetup.title } : { to: '/meetups', label: '모임' }}
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
        <Field id="f-title" label="모임 이름" error={form.errors.title} hint="예: 망원 주말 모각코, 판교 퇴근길 알고리즘 스터디">
          <input {...form.input('title')} className="input" maxLength={60} autoComplete="off" aria-required="true" />
        </Field>

        <Field id="f-summary" label="한 줄 소개" error={form.errors.summary} hint="목록에 보이는 문장이에요.">
          <input {...form.input('summary')} className="input" maxLength={140} autoComplete="off" aria-required="true" />
        </Field>

        <div className="form-row">
          <Field id="f-topic" label="주제" error={form.errors.topic}>
            <select {...form.input('topic')} className="select" aria-required="true">
              {Object.entries(TOPICS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="f-cadence" label="모이는 때" error={form.errors.cadence}>
            <input {...form.input('cadence')} className="input" placeholder="격주 토요일 오후 2시" maxLength={40} aria-required="true" />
          </Field>
        </div>

        <div className="form-row">
          <Field id="f-area_label" label="주 활동 지역" optional hint="정하지 않았다면 비워 두고, 장소 찾기로 정해도 돼요.">
            <input {...form.input('area_label')} className="input" placeholder="마포구, 강남역 근처" maxLength={40} />
          </Field>
          <Field id="f-capacity" label="정원" optional error={form.errors.capacity} hint="비워 두면 제한 없이 받아요.">
            <input {...form.input('capacity')} className="input" type="number" inputMode="numeric" min={2} max={100} placeholder="8" />
          </Field>
        </div>

        <Field id="f-description" label="자세한 소개" optional hint="진행 방식, 준비물, 이런 분과 함께하고 싶어요 같은 내용을 적어 주세요.">
          <textarea {...form.input('description')} className="textarea" rows={8} maxLength={4000} />
        </Field>

        {isEdit && (
          <label className="check-row">
            <input type="checkbox" checked={form.values.is_open} onChange={(e) => form.set('is_open', e.target.checked)} />
            <span className="check-row-text">
              <span className="check-row-title">새 멤버 받기</span>
              <span className="check-row-hint">끄면 목록에 &lsquo;마감&rsquo;으로 보이고 참여 버튼이 사라져요.</span>
            </span>
          </label>
        )}

        <div className="form-actions is-sticky">
          <Link to={meetup ? `/meetups/${meetup.id}` : '/meetups'} className="btn btn-ghost">
            취소
          </Link>
          <Button type="submit" variant="primary" loading={saving}>
            {isEdit ? '변경사항 저장' : '모임 열기'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function MeetupForm() {
  const { id } = useParams()
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['meetup', id], queryFn: () => fetchMeetup(id as string), enabled: Boolean(id) })

  if (!id) return <MeetupFormBody meetup={null} />
  if (q.isPending) return <div className="page page-narrow" aria-busy="true" />
  if (q.isError) return <div className="page page-narrow"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
  if (!q.data) return <Navigate to="/meetups" replace />
  if (q.data.host_id !== user?.id) return <Navigate to={`/meetups/${id}`} replace />
  return <MeetupFormBody key={q.data.id} meetup={q.data} />
}
