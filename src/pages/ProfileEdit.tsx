import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { fetchMyLocation, saveMyLocation, updateProfile } from '../api/profiles'
import { LocationPicker, type PickedPlace } from '../components/LocationPicker'
import { StackInput } from '../components/StackInput'
import { ErrorState } from '../components/states'
import { Button, DraftNotice, Field, PageHeader } from '../components/ui'
import { useAuth, useToast } from '../lib/contexts'
import { isValidUrl, normalizeUrl } from '../lib/format'
import { useUnsavedChanges } from '../lib/hooks'
import { JOB_ROLES } from '../lib/site'
import { ApiError } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { useForm } from '../lib/useForm'

type Values = {
  display_name: string
  handle: string
  job_role: string
  years: string
  bio: string
  stack: string[]
  github_url: string
  blog_url: string
  area_label: string
  location: PickedPlace | null
}

// 집 위치는 초안으로도 브라우저에 남기지 않는다
const DRAFT_EXCLUDE: (keyof Values)[] = ['location']

const urlRule = (v: string) => (!v.trim() || isValidUrl(v) ? null : 'https://로 시작하는 주소로 적어 주세요.')

function ProfileEditForm({ profile, location }: { profile: Profile; location: { lat: number; lng: number } | null }) {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const { hash } = useLocation()

  const initialLocation = location ? { ...location, label: profile.area_label ?? '등록한 위치' } : null
  const form = useForm<Values>(
    {
      display_name: profile.display_name,
      handle: profile.handle,
      job_role: profile.job_role ?? '',
      years: profile.years != null ? String(profile.years) : '',
      bio: profile.bio ?? '',
      stack: profile.stack,
      github_url: profile.github_url ?? '',
      blog_url: profile.blog_url ?? '',
      area_label: profile.area_label ?? '',
      location: initialLocation,
    },
    {
      display_name: (v) => (!v.trim() ? '이름을 입력해 주세요.' : v.length > 40 ? '40자 안으로 줄여 주세요.' : null),
      handle: (v) =>
        /^[a-z0-9_]{3,20}$/.test(v) ? null : '영문 소문자, 숫자, 밑줄(_)로 3~20자를 적어 주세요.',
      years: (v) => {
        if (!v) return null
        const n = Number(v)
        return Number.isInteger(n) && n >= 0 && n <= 50 ? null : '0에서 50 사이 숫자로 적어 주세요.'
      },
      bio: (v) => (v.length > 500 ? '500자 안으로 줄여 주세요.' : null),
      github_url: urlRule,
      blog_url: urlRule,
    },
    { draftKey: `profile:${profile.id}`, exclude: DRAFT_EXCLUDE },
  )
  useUnsavedChanges(form.dirty && !saving)

  useEffect(() => {
    if (hash === '#location') document.getElementById('location')?.scrollIntoView({ block: 'start' })
  }, [hash])

  const submit = async () => {
    if (!form.validateAll()) return
    const v = form.values
    setSaving(true)
    try {
      await updateProfile(profile.id, {
        display_name: v.display_name.trim(),
        handle: v.handle,
        job_role: v.job_role || null,
        years: v.years ? Number(v.years) : null,
        bio: v.bio.trim() || null,
        stack: v.stack,
        github_url: v.github_url.trim() ? normalizeUrl(v.github_url) : null,
        blog_url: v.blog_url.trim() ? normalizeUrl(v.blog_url) : null,
        area_label: v.area_label.trim() || null,
      })
      const locChanged =
        (v.location?.lat ?? null) !== (location?.lat ?? null) || (v.location?.lng ?? null) !== (location?.lng ?? null)
      if (locChanged) await saveMyLocation(profile.id, v.location ? { lat: v.location.lat, lng: v.location.lng } : null)

      form.markClean()
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      await queryClient.invalidateQueries({ queryKey: ['my-location'] })
      await queryClient.invalidateQueries({ queryKey: ['meetup-locations'] })
      toast.show({ message: '프로필을 저장했어요.' })
      navigate(`/u/${v.handle}`, { replace: true })
    } catch (e) {
      setSaving(false)
      if (e instanceof ApiError && e.code === '23505') {
        toast.error('이 핸들은 이미 다른 멤버가 쓰고 있어요. 다른 핸들로 바꿔 주세요.')
        document.getElementById('f-handle')?.focus()
        return
      }
      toast.error('프로필을 저장하지 못했어요. 입력한 내용은 그대로 있어요. 다시 시도해 주세요.', e)
    }
  }

  return (
    <div className="page page-narrow">
      <PageHeader
        title="프로필 수정"
        breadcrumb={{ to: `/u/${profile.handle}`, label: '내 프로필' }}
        description="모임장과 멤버들이 보는 정보예요. 위치는 공개되지 않아요."
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
        <div className="form-row">
          <Field id="f-display_name" label="이름" error={form.errors.display_name}>
            <input {...form.input('display_name')} className="input" autoComplete="name" maxLength={40} aria-required="true" />
          </Field>
          <Field id="f-handle" label="핸들" error={form.errors.handle} hint="프로필 주소에 쓰여요. 영문 소문자·숫자·밑줄">
            <input
              {...form.input('handle')}
              className="input mono"
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={20}
              onChange={(e) => form.set('handle', e.target.value.toLowerCase())}
              aria-required="true"
            />
          </Field>
        </div>

        <div className="form-row">
          <Field id="f-job_role" label="직군" optional>
            <select {...form.input('job_role')} className="select">
              <option value="">고르지 않음</option>
              {JOB_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field id="f-years" label="경력" optional error={form.errors.years} hint="신입이면 0을 적어 주세요.">
            <input {...form.input('years')} className="input" type="number" inputMode="numeric" min={0} max={50} placeholder="3" />
          </Field>
        </div>

        <Field id="f-bio" label="한 줄 소개" optional error={form.errors.bio} hint="요즘 공부하는 것, 같이 하고 싶은 것을 적어 주세요. 500자까지.">
          <textarea {...form.input('bio')} className="textarea" rows={4} maxLength={500} />
        </Field>

        <Field id="f-stack" label="기술 스택" optional hint="Enter나 쉼표로 추가해요. 최대 15개.">
          <StackInput id="f-stack" value={form.values.stack} onChange={(next) => form.set('stack', next)} max={15} describedBy="f-stack-hint" />
        </Field>

        <div className="form-row">
          <Field id="f-github_url" label="GitHub" optional error={form.errors.github_url}>
            <input {...form.input('github_url')} className="input" type="url" inputMode="url" placeholder="https://github.com/username" />
          </Field>
          <Field id="f-blog_url" label="블로그" optional error={form.errors.blog_url}>
            <input {...form.input('blog_url')} className="input" type="url" inputMode="url" placeholder="https://velog.io/@username" />
          </Field>
        </div>

        <section id="location" className="form-section" aria-labelledby="location-title">
          <div className="form-section-head">
            <h2 id="location-title">만남 장소 계산용 위치</h2>
            <p className="secondary">
              집 근처 역이나 동네를 골라 주세요. 약 1km 단위로 반올림해 저장하고, 같은 모임 멤버의 장소 계산에만 쓰여요.
              좌표는 누구에게도 보이지 않아요.
            </p>
          </div>

          <Field id="f-area_label" label="프로필에 보일 지역 이름" optional hint="예: 마포구 망원동. 비워 두면 지역이 표시되지 않아요.">
            <input {...form.input('area_label')} className="input" maxLength={40} placeholder="마포구 망원동" />
          </Field>

          <LocationPicker
            value={form.values.location}
            privacyDigits={2}
            onSelect={(place) => {
              form.set('location', place)
              if (!form.values.area_label.trim() && place.label !== '지도에서 고른 곳' && place.label !== '현재 위치 근처') {
                form.set('area_label', `${place.label} 근처`.slice(0, 40))
              }
            }}
          />
          {form.values.location && (
            <Button variant="danger-text" onClick={() => form.set('location', null)}>
              등록한 위치 지우기
            </Button>
          )}
        </section>

        <div className="form-actions is-sticky">
          <Link to={`/u/${profile.handle}`} className="btn btn-ghost">
            취소
          </Link>
          <Button type="submit" variant="primary" loading={saving}>
            변경사항 저장
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function ProfileEdit() {
  const { user, profile } = useAuth()
  const loc = useQuery({
    queryKey: ['my-location', user?.id],
    queryFn: () => fetchMyLocation(user!.id),
    enabled: Boolean(user),
  })

  if (!profile || loc.isPending) return <div className="page page-narrow" aria-busy="true" />
  if (loc.isError) {
    return (
      <div className="page page-narrow">
        <ErrorState error={loc.error} onRetry={() => loc.refetch()} />
      </div>
    )
  }
  return <ProfileEditForm key={profile.id} profile={profile} location={loc.data} />
}
