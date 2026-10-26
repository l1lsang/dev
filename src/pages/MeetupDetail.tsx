import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, MapPinOff, Trash2, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  createSession,
  deleteMeetup,
  deleteSession,
  fetchMeetup,
  fetchMemberLocations,
  fetchMembers,
  fetchSessions,
  joinMeetup,
  removeMember,
  setRsvp,
} from '../api/meetups'
import { TabPanel, Tabs } from '../components/list'
import { Drawer, OverflowMenu } from '../components/overlays'
import { FairnessControl, PlaceResults } from '../components/PlaceOptimizer'
import { EmptyState, ErrorState, ListSkeleton } from '../components/states'
import { Avatar, Button, Field, IconButton, PageHeader } from '../components/ui'
import { useAuth, useConfirm, useToast } from '../lib/contexts'
import { formatDate, formatDateTime, formatShortDate, formatTime } from '../lib/format'
import { DEFAULT_FAIRNESS, mapLinks, type Participant } from '../lib/meeting/optimize'
import { TOPICS } from '../lib/site'
import type { Meetup, MeetupMember, ProfileLite, SessionWithRsvps } from '../lib/types'
import { clearDraft, useForm } from '../lib/useForm'

type Tab = 'about' | 'schedule' | 'members' | 'place'
type SessionDraft = { date: string; time: string; place_name: string; note: string; lat: number | null; lng: number | null }

function nextSaturday(): string {
  const d = new Date()
  d.setDate(d.getDate() + (((6 - d.getDay() + 7) % 7) || 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const emptyDraft = (): SessionDraft => ({ date: nextSaturday(), time: '14:00', place_name: '', note: '', lat: null, lng: null })

// ---------------------------------------------------------------------------
// 일정 추가 slide-over
// ---------------------------------------------------------------------------
function SessionDrawer({
  meetupId,
  open,
  draft,
  onClose,
  onSaved,
}: {
  meetupId: string
  open: boolean
  draft: SessionDraft
  onClose: (draft: SessionDraft) => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const form = useForm(
    { date: draft.date, time: draft.time, place_name: draft.place_name, note: draft.note },
    {
      date: (v) => {
        if (!v) return '날짜를 골라 주세요.'
        return null
      },
      time: (v, all) => {
        if (!v) return '시간을 골라 주세요.'
        return all.date && new Date(`${all.date}T${v}`) < new Date() ? '지금 이후의 시간으로 골라 주세요.' : null
      },
      place_name: (v) => (!v.trim() ? '어디서 만나는지 적어 주세요.' : null),
    },
    { draftKey: `session:${meetupId}` },
  )

  const keepDraft = () => onClose({ ...form.values, lat: draft.lat, lng: draft.lng })

  const save = async () => {
    if (!form.validateAll()) return
    setSaving(true)
    try {
      await createSession({
        meetup_id: meetupId,
        starts_at: new Date(`${form.values.date}T${form.values.time}`).toISOString(),
        place_name: form.values.place_name.trim(),
        place_lat: draft.lat,
        place_lng: draft.lng,
        note: form.values.note.trim() || null,
      })
      toast.show({ message: '일정을 추가했어요. 멤버들이 참석 여부를 남길 수 있어요.' })
      form.markClean()
      onSaved()
    } catch (e) {
      toast.error('일정을 추가하지 못했어요. 입력한 내용은 그대로 있어요. 다시 시도해 주세요.', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={keepDraft}
      title="일정 추가"
      footer={
        <>
          <Button variant="ghost" onClick={keepDraft}>
            취소
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            일정 추가하기
          </Button>
        </>
      }
    >
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="form-row">
          <Field id="f-date" label="날짜" error={form.errors.date}>
            <input {...form.input('date')} type="date" className="input" autoFocus aria-required="true" />
          </Field>
          <Field id="f-time" label="시간" error={form.errors.time}>
            <input {...form.input('time')} type="time" className="input" step={600} aria-required="true" />
          </Field>
        </div>
        <Field
          id="f-place_name"
          label="장소"
          error={form.errors.place_name}
          hint={draft.lat ? '장소 찾기에서 고른 역이에요. 카페 이름을 덧붙여도 좋아요.' : '역 이름이나 카페 이름을 적어 주세요.'}
        >
          <input {...form.input('place_name')} className="input" maxLength={80} placeholder="왕십리역 2번 출구 스터디카페" aria-required="true" />
        </Field>
        <Field id="f-note" label="메모" optional hint="준비물, 진행 순서, 회비 같은 안내를 적어 주세요.">
          <textarea {...form.input('note')} className="textarea" rows={4} maxLength={500} />
        </Field>
      </form>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// 일정 탭
// ---------------------------------------------------------------------------
function SessionRow({
  session,
  isHost,
  isMember,
  myId,
  onChanged,
}: {
  session: SessionWithRsvps
  isHost: boolean
  isMember: boolean
  myId: string | undefined
  onChanged: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const going = session.rsvps.filter((r) => r.status === 'going').length
  const mine = session.rsvps.find((r) => r.user_id === myId)?.status ?? null
  const past = new Date(session.starts_at) < new Date()

  const rsvp = useMutation({
    mutationFn: (status: 'going' | 'not_going' | null) => setRsvp(session.id, myId as string, status),
    onSuccess: onChanged,
    onError: (e) => toast.error('응답을 저장하지 못했어요. 다시 눌러 주세요.', e),
  })

  const remove = async () => {
    const ok = await confirm({
      title: `${formatShortDate(session.starts_at)} 일정을 삭제할까요?`,
      body: `${session.place_name} · 참석 응답 ${session.rsvps.length}개도 함께 지워져요.`,
      confirmLabel: '일정 삭제',
    })
    if (!ok) return
    try {
      await deleteSession(session.id)
      onChanged()
      toast.show({ message: '일정을 삭제했어요.' })
    } catch (e) {
      toast.error('일정을 삭제하지 못했어요. 다시 시도해 주세요.', e)
    }
  }

  return (
    <li className="session-row">
      <div className="date-block">
        <span className="date-block-day">{formatShortDate(session.starts_at)}</span>
        <span className="meta num">{formatTime(session.starts_at)}</span>
      </div>
      <div className="session-main">
        <p className="row-title">{session.place_name}</p>
        {session.note && <p className="secondary session-note">{session.note}</p>}
        <p className="meta dot-sep">
          <span>참석 {going}명</span>
          <a
            className="text-link"
            href={session.place_lat && session.place_lng ? mapLinks.kakaoPoint(session.place_name, { lat: session.place_lat, lng: session.place_lng }) : mapLinks.kakaoSearch(session.place_name)}
            target="_blank"
            rel="noreferrer"
          >
            지도에서 보기
          </a>
        </p>
      </div>
      <div className="session-actions">
        {isMember && !past && (
          <div className="segmented" role="group" aria-label={`${formatShortDate(session.starts_at)} 참석 여부`}>
            {(['going', 'not_going'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className="segmented-btn"
                aria-pressed={mine === s}
                disabled={rsvp.isPending}
                onClick={() => rsvp.mutate(mine === s ? null : s)}
              >
                {s === 'going' ? '참석' : '불참'}
              </button>
            ))}
          </div>
        )}
        {isHost && (
          <IconButton label="일정 삭제" icon={<Trash2 size={18} strokeWidth={1.75} />} tooltipAlign="end" onClick={remove} />
        )}
      </div>
    </li>
  )
}

function ScheduleTab({
  meetup,
  isHost,
  isMember,
  onAdd,
}: {
  meetup: Meetup
  isHost: boolean
  isMember: boolean
  onAdd: () => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const q = useQuery({ queryKey: ['meetup-sessions', meetup.id], queryFn: () => fetchSessions(meetup.id) })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['meetup-sessions', meetup.id] })
    queryClient.invalidateQueries({ queryKey: ['sessions-upcoming'] })
  }

  if (q.isPending) return <ListSkeleton rows={3} />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />

  const now = new Date()
  const upcoming = q.data.filter((s) => new Date(s.starts_at) >= now)
  const past = q.data.filter((s) => new Date(s.starts_at) < now).reverse()

  return (
    <div className="stack-lg">
      <div className="panel">
        <div className="panel-header">
          <h2>다가오는 일정</h2>
          {isHost && (
            <Button variant="secondary" onClick={onAdd}>
              <CalendarPlus size={16} strokeWidth={1.75} aria-hidden="true" />
              일정 추가
            </Button>
          )}
        </div>
        {upcoming.length === 0 ? (
          <EmptyState
            title="잡힌 일정이 없어요"
            body={isHost ? '장소 찾기 탭에서 멤버 위치로 장소를 고른 뒤 일정을 추가해 보세요.' : '모임장이 일정을 올리면 여기에 보여요.'}
            actions={
              isHost ? (
                <Button variant="primary" onClick={onAdd}>
                  일정 추가
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divided">
            {upcoming.map((s) => (
              <SessionRow key={s.id} session={s} isHost={isHost} isMember={isMember} myId={user?.id} onChanged={refresh} />
            ))}
          </ul>
        )}
      </div>

      {past.length > 0 && (
        <details className="panel past-sessions">
          <summary className="panel-header">
            <h2>지난 일정 {past.length}개</h2>
          </summary>
          <ul className="divided">
            {past.map((s) => (
              <SessionRow key={s.id} session={s} isHost={isHost} isMember={isMember} myId={user?.id} onChanged={refresh} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 멤버 탭
// ---------------------------------------------------------------------------
function MembersTab({ meetup, members, isHost }: { meetup: Meetup; members: MeetupMember[]; isHost: boolean }) {
  const confirm = useConfirm()
  const toast = useToast()
  const queryClient = useQueryClient()

  const kick = async (m: MeetupMember) => {
    const ok = await confirm({
      title: `${m.profile.display_name} 님을 모임에서 내보낼까요?`,
      body: '다시 참여하려면 직접 참여 버튼을 눌러야 해요.',
      confirmLabel: '멤버 내보내기',
    })
    if (!ok) return
    try {
      await removeMember(meetup.id, m.user_id)
      queryClient.invalidateQueries({ queryKey: ['meetup-members', meetup.id] })
      toast.show({ message: `${m.profile.display_name} 님을 내보냈어요.` })
    } catch (e) {
      toast.error('멤버를 내보내지 못했어요. 다시 시도해 주세요.', e)
    }
  }

  return (
    <div className="panel">
      <ul className="divided">
        {members.map((m) => (
          <li key={m.user_id} className="member-row">
            <Link to={`/u/${m.profile.handle}`} className="member-link">
              <Avatar profile={m.profile} />
              <span className="list-row-main">
                <span className="row-title">
                  {m.profile.display_name}
                  {m.role === 'host' && <span className="role-label">모임장</span>}
                </span>
                <span className="row-sub meta dot-sep">
                  {m.profile.job_role && <span>{m.profile.job_role}</span>}
                  {m.profile.area_label && <span>{m.profile.area_label}</span>}
                  <span>{formatDate(m.joined_at)} 참여</span>
                </span>
              </span>
            </Link>
            {isHost && m.role !== 'host' && (
              <Button variant="danger-text" onClick={() => kick(m)}>
                내보내기
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 장소 찾기 탭
// ---------------------------------------------------------------------------
function PlaceTab({
  meetup,
  members,
  isMember,
  isHost,
  onJoin,
  joining,
  onPick,
}: {
  meetup: Meetup
  members: MeetupMember[]
  isMember: boolean
  isHost: boolean
  onJoin: () => void
  joining: boolean
  onPick: (draft: SessionDraft) => void
}) {
  const { user } = useAuth()
  const [fairness, setFairness] = useState(DEFAULT_FAIRNESS)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const q = useQuery({
    queryKey: ['meetup-locations', meetup.id],
    queryFn: () => fetchMemberLocations(meetup.id),
    enabled: Boolean(user && isMember),
  })

  const participants: Participant[] = useMemo(
    () =>
      (q.data ?? [])
        .filter((l) => !excluded.has(l.user_id))
        .map((l) => ({ id: l.user_id, name: l.display_name, lat: l.lat, lng: l.lng })),
    [q.data, excluded],
  )

  if (!user) {
    return (
      <div className="panel">
        <EmptyState
          title="로그인하면 멤버 위치로 장소를 계산해요"
          body="위치는 같은 모임 멤버끼리만, 약 100m 단위로만 공유돼요."
          actions={
            <Link to={`/login?next=${encodeURIComponent(`/meetups/${meetup.id}?tab=place`)}`} className="btn btn-primary">
              로그인하기
            </Link>
          }
        />
      </div>
    )
  }
  if (!isMember) {
    return (
      <div className="panel">
        <EmptyState
          title="멤버만 볼 수 있어요"
          body="모임에 참여하면 멤버들 위치로 모두에게 공평한 장소를 계산할 수 있어요."
          actions={
            meetup.is_open ? (
              <Button variant="primary" loading={joining} onClick={onJoin}>
                모임 참여하기
              </Button>
            ) : undefined
          }
        />
      </div>
    )
  }
  if (q.isPending) return <ListSkeleton rows={3} />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />

  const located = new Set(q.data.map((l) => l.user_id))
  const missing = members.filter((m) => !located.has(m.user_id))
  const meMissing = !located.has(user.id)

  return (
    <div className="planner">
      <div className="planner-params">
        {meMissing && (
          <div className="notice">
            <MapPinOff size={16} strokeWidth={1.75} aria-hidden="true" />
            <p>
              <strong>내 위치가 아직 없어요.</strong> 프로필에서 사는 곳 근처 역을 등록하면 계산에 들어가요.{' '}
              <Link to="/me/edit#location" className="text-link">
                위치 등록하기
              </Link>
            </p>
          </div>
        )}
        <fieldset className="panel participant-picker">
          <legend className="panel-header">
            <h2>계산에 넣을 멤버</h2>
          </legend>
          {q.data.length === 0 ? (
            <p className="secondary participant-empty">위치를 등록한 멤버가 아직 없어요.</p>
          ) : (
            <ul className="divided">
              {q.data.map((l) => (
                <li key={l.user_id}>
                  <label className="check-row participant-check">
                    <input
                      type="checkbox"
                      checked={!excluded.has(l.user_id)}
                      onChange={(e) =>
                        setExcluded((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.delete(l.user_id)
                          else next.add(l.user_id)
                          return next
                        })
                      }
                    />
                    <span className="check-row-text">
                      <span className="check-row-title">{l.display_name}</span>
                      <span className="check-row-hint">{l.area_label ?? '지역 이름 없음'}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {missing.length > 0 && (
            <p className="meta participant-missing">
              위치 미등록 {missing.length}명: {missing.map((m) => m.profile.display_name).join(', ')}
            </p>
          )}
        </fieldset>
        <div className="panel panel-body">
          <FairnessControl value={fairness} onChange={setFairness} />
        </div>
      </div>
      <div className="planner-results">
        <PlaceResults
          participants={participants}
          fairness={fairness}
          renderAction={
            isHost
              ? (r) => (
                  <Button
                    variant="primary"
                    onClick={() => onPick({ ...emptyDraft(), place_name: r.hub.name, lat: r.hub.lat, lng: r.hub.lng })}
                  >
                    <CalendarPlus size={16} strokeWidth={1.75} aria-hidden="true" />
                    {r.hub.name}에서 일정 잡기
                  </Button>
                )
              : undefined
          }
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 페이지
// ---------------------------------------------------------------------------
export default function MeetupDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const tab = (['about', 'schedule', 'members', 'place'].includes(params.get('tab') ?? '') ? params.get('tab') : 'about') as Tab
  const setTab = (t: Tab) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (t === 'about') next.delete('tab')
        else next.set('tab', t)
        return next
      },
      { replace: true },
    )

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<SessionDraft>(emptyDraft)
  const [drawerKey, setDrawerKey] = useState(0)

  const meetupQ = useQuery({ queryKey: ['meetup', id], queryFn: () => fetchMeetup(id) })
  const membersQ = useQuery({ queryKey: ['meetup-members', id], queryFn: () => fetchMembers(id) })

  const members = membersQ.data ?? []
  const me = members.find((m) => m.user_id === user?.id)
  const isMember = Boolean(me)
  const meetup = meetupQ.data
  const isHost = Boolean(meetup && user && meetup.host_id === user.id)
  const full = Boolean(meetup?.capacity && members.length >= meetup.capacity)

  const join = useMutation({
    mutationFn: () => joinMeetup(id, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetup-members', id] })
      queryClient.invalidateQueries({ queryKey: ['meetups'] })
      toast.show({ message: '모임에 참여했어요. 일정 탭에서 참석 여부를 남겨 주세요.' })
    },
    onError: (e) => toast.error('참여하지 못했어요. 정원이 찼거나 모집이 끝났을 수 있어요.', e),
  })

  if (meetupQ.isPending) {
    return (
      <div className="page">
        <ListSkeleton rows={4} />
      </div>
    )
  }
  if (meetupQ.isError) {
    return (
      <div className="page">
        <ErrorState error={meetupQ.error} onRetry={() => meetupQ.refetch()} />
      </div>
    )
  }
  if (!meetup) return <Navigate to="/meetups" replace />

  const leave = async () => {
    const ok = await confirm({
      title: `'${meetup.title}' 모임에서 나갈까요?`,
      body: '내 참석 응답은 남고, 멤버 목록과 장소 계산에서 빠져요.',
      confirmLabel: '모임 나가기',
    })
    if (!ok || !user) return
    try {
      await removeMember(meetup.id, user.id)
      queryClient.invalidateQueries({ queryKey: ['meetup-members', id] })
      toast.show({ message: '모임에서 나왔어요.' })
    } catch (e) {
      toast.error('모임에서 나가지 못했어요. 다시 시도해 주세요.', e)
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: `'${meetup.title}' 모임을 삭제할까요?`,
      body: `멤버 ${members.length}명, 모든 일정과 참석 응답이 함께 지워지고 되돌릴 수 없어요.`,
      confirmLabel: '모임 삭제',
    })
    if (!ok) return
    try {
      await deleteMeetup(meetup.id)
      queryClient.invalidateQueries({ queryKey: ['meetups'] })
      toast.show({ message: `'${meetup.title}' 모임을 삭제했어요.` })
      navigate('/meetups', { replace: true })
    } catch (e) {
      toast.error('모임을 삭제하지 못했어요. 다시 시도해 주세요.', e)
    }
  }

  const openDrawer = (next?: SessionDraft) => {
    if (next) {
      // 장소 찾기에서 고른 값이 예전 초안보다 우선한다
      clearDraft(`session:${id}`)
      setDraft(next)
      setDrawerKey((k) => k + 1)
    }
    setTab('schedule')
    setDrawerOpen(true)
  }

  let primary = null
  if (!user) {
    primary = (
      <Link to={`/login?next=${encodeURIComponent(`/meetups/${id}`)}`} className="btn btn-primary">
        로그인하고 참여하기
      </Link>
    )
  } else if (isHost) {
    primary = (
      <Link to={`/meetups/${id}/edit`} className="btn btn-secondary">
        모임 정보 수정
      </Link>
    )
  } else if (!isMember && meetup.is_open && !full && membersQ.isSuccess) {
    primary = (
      <Button variant="primary" loading={join.isPending} onClick={() => join.mutate()}>
        <UserPlus size={16} strokeWidth={1.75} aria-hidden="true" />
        모임 참여하기
      </Button>
    )
  }

  const menuItems = isHost
    ? [{ label: '모임 삭제', danger: true, onSelect: remove }]
    : isMember
      ? [{ label: '모임 나가기', danger: true, onSelect: leave }]
      : []

  const host = (meetup as Meetup & { host: ProfileLite }).host

  return (
    <div className="page">
      <PageHeader
        breadcrumb={{ to: '/meetups', label: '모임' }}
        title={meetup.title}
        meta={
          <span className="dot-sep">
            <span className={`status${meetup.is_open && !full ? ' is-on' : ''}`}>
              {meetup.is_open ? (full ? '정원 마감' : '모집 중') : '모집 마감'}
            </span>
            <span>{TOPICS[meetup.topic]}</span>
            <span>{meetup.cadence}</span>
            {meetup.area_label && <span>{meetup.area_label}</span>}
            <span>
              멤버 <span className="num">{members.length}</span>
              {meetup.capacity ? ` / ${meetup.capacity}` : ''}명
            </span>
          </span>
        }
        actions={
          <>
            {primary}
            {menuItems.length > 0 && <OverflowMenu label="모임 메뉴" items={menuItems} />}
          </>
        }
      />

      <Tabs<Tab>
        label="모임 정보"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'about', label: '소개' },
          { id: 'schedule', label: '일정' },
          { id: 'members', label: '멤버', count: members.length },
          { id: 'place', label: '장소 찾기' },
        ]}
      />

      <TabPanel id={tab}>
        {tab === 'about' && (
          <div className="about-grid">
            <div className="prose">
              <p className="lead-sm">{meetup.summary}</p>
              {meetup.description ? (
                <p className="prose-body">{meetup.description}</p>
              ) : (
                <p className="secondary">자세한 소개가 아직 없어요.</p>
              )}
            </div>
            <aside className="panel panel-body about-side">
              <h2 className="side-title">모임장</h2>
              {host && (
                <Link to={`/u/${host.handle}`} className="member-link">
                  <Avatar profile={host} />
                  <span className="row-title">{host.display_name}</span>
                </Link>
              )}
              <p className="meta">{formatDateTime(meetup.created_at)} 개설</p>
            </aside>
          </div>
        )}
        {tab === 'schedule' && (
          <ScheduleTab meetup={meetup} isHost={isHost} isMember={isMember} onAdd={() => openDrawer()} />
        )}
        {tab === 'members' &&
          (membersQ.isPending ? (
            <ListSkeleton rows={4} />
          ) : membersQ.isError ? (
            <ErrorState error={membersQ.error} onRetry={() => membersQ.refetch()} />
          ) : (
            <MembersTab meetup={meetup} members={members} isHost={isHost} />
          ))}
        {tab === 'place' && (
          <PlaceTab
            meetup={meetup}
            members={members}
            isMember={isMember}
            isHost={isHost}
            onJoin={() => join.mutate()}
            joining={join.isPending}
            onPick={openDrawer}
          />
        )}
      </TabPanel>

      {isHost && (
        <SessionDrawer
          key={drawerKey}
          meetupId={meetup.id}
          open={drawerOpen}
          draft={draft}
          onClose={(d) => {
            setDraft(d)
            setDrawerOpen(false)
          }}
          onSaved={() => {
            setDrawerOpen(false)
            setDraft(emptyDraft())
            setDrawerKey((k) => k + 1)
            queryClient.invalidateQueries({ queryKey: ['meetup-sessions', id] })
            queryClient.invalidateQueries({ queryKey: ['sessions-upcoming'] })
            queryClient.invalidateQueries({ queryKey: ['meetups'] })
          }}
        />
      )}
    </div>
  )
}
