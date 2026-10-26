import { PAGE_SIZE } from '../lib/site'
import { db, sanitizeSearch, unwrap } from '../lib/supabase'
import type {
  MemberLocation,
  Meetup,
  MeetupMember,
  MeetupRow,
  MeetupTopic,
  Page,
  ProfileLite,
  SessionWithRsvps,
  UpcomingSession,
} from '../lib/types'
import { PROFILE_LITE } from './profiles'

export type MeetupListParams = { q: string; topic: MeetupTopic | ''; open: boolean; page: number }

export async function fetchMeetups({ q, topic, open, page }: MeetupListParams): Promise<Page<MeetupRow>> {
  const from = (page - 1) * PAGE_SIZE
  let query = db()
    .from('meetups')
    .select('*, meetup_members(count), meetup_sessions(starts_at)', { count: 'exact' })
    // 다가오는 일정 하나만 붙인다
    .gte('meetup_sessions.starts_at', new Date().toISOString())
    .order('starts_at', { referencedTable: 'meetup_sessions', ascending: true })
    .limit(1, { referencedTable: 'meetup_sessions' })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  const s = sanitizeSearch(q)
  if (s) query = query.or(`title.ilike.%${s}%,summary.ilike.%${s}%,area_label.ilike.%${s}%`)
  if (topic) query = query.eq('topic', topic)
  if (open) query = query.eq('is_open', true)

  const { data, error, count } = await query
  type Raw = Meetup & { meetup_members: { count: number }[]; meetup_sessions: { starts_at: string }[] }
  const rows = unwrap({ data, error }) as Raw[]
  return {
    total: count ?? 0,
    rows: rows.map(({ meetup_members, meetup_sessions, ...m }) => ({
      ...m,
      member_count: meetup_members[0]?.count ?? 0,
      next_session: meetup_sessions[0]?.starts_at ?? null,
    })),
  }
}

export async function fetchMeetup(id: string): Promise<(Meetup & { host: ProfileLite }) | null> {
  return unwrap(
    await db().from('meetups').select(`*, host:profiles!meetups_host_id_fkey(${PROFILE_LITE})`).eq('id', id).maybeSingle(),
  )
}

export type MeetupInput = Pick<
  Meetup,
  'title' | 'summary' | 'description' | 'topic' | 'cadence' | 'area_label' | 'capacity' | 'is_open'
>

export async function createMeetup(input: MeetupInput): Promise<Meetup> {
  return unwrap(await db().from('meetups').insert(input).select('*').single())
}

export async function updateMeetup(id: string, input: Partial<MeetupInput>): Promise<Meetup> {
  return unwrap(await db().from('meetups').update(input).eq('id', id).select('*').single())
}

export async function deleteMeetup(id: string) {
  unwrap(await db().from('meetups').delete().eq('id', id))
}

export async function fetchMembers(meetupId: string): Promise<MeetupMember[]> {
  return unwrap(
    await db()
      .from('meetup_members')
      .select(`meetup_id, user_id, role, joined_at, profile:profiles!meetup_members_user_id_fkey(${PROFILE_LITE}, job_role, area_label)`)
      .eq('meetup_id', meetupId)
      .order('joined_at', { ascending: true }),
  ) as unknown as MeetupMember[]
}

export async function joinMeetup(meetupId: string, userId: string) {
  unwrap(await db().from('meetup_members').insert({ meetup_id: meetupId, user_id: userId }))
}

export async function removeMember(meetupId: string, userId: string) {
  unwrap(await db().from('meetup_members').delete().eq('meetup_id', meetupId).eq('user_id', userId))
}

export async function fetchSessions(meetupId: string): Promise<SessionWithRsvps[]> {
  return unwrap(
    await db()
      .from('meetup_sessions')
      .select('*, rsvps:session_rsvps(user_id, status)')
      .eq('meetup_id', meetupId)
      .order('starts_at', { ascending: true }),
  ) as SessionWithRsvps[]
}

export async function fetchUpcomingSessions(limit = 5): Promise<UpcomingSession[]> {
  return unwrap(
    await db()
      .from('meetup_sessions')
      .select('*, meetup:meetups(id, title)')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(limit),
  ) as unknown as UpcomingSession[]
}

export type SessionInput = {
  meetup_id: string
  starts_at: string
  place_name: string
  place_lat: number | null
  place_lng: number | null
  note: string | null
}

export async function createSession(input: SessionInput) {
  unwrap(await db().from('meetup_sessions').insert(input))
}

export async function deleteSession(id: string) {
  unwrap(await db().from('meetup_sessions').delete().eq('id', id))
}

export async function setRsvp(sessionId: string, userId: string, status: 'going' | 'not_going' | null) {
  if (!status) {
    unwrap(await db().from('session_rsvps').delete().eq('session_id', sessionId).eq('user_id', userId))
    return
  }
  unwrap(await db().from('session_rsvps').upsert({ session_id: sessionId, user_id: userId, status }))
}

export async function fetchMemberLocations(meetupId: string): Promise<MemberLocation[]> {
  return unwrap(await db().rpc('meetup_member_locations', { p_meetup: meetupId })) as MemberLocation[]
}
