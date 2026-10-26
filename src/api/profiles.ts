import { PAGE_SIZE } from '../lib/site'
import { db, sanitizeSearch, unwrap } from '../lib/supabase'
import type { Page, PersonRow, Profile } from '../lib/types'

export const PROFILE_LITE = 'id, handle, display_name, avatar_url'

export async function fetchProfileById(id: string): Promise<Profile | null> {
  return unwrap(await db().from('profiles').select('*').eq('id', id).maybeSingle())
}

export async function fetchProfileByHandle(handle: string): Promise<Profile | null> {
  return unwrap(await db().from('profiles').select('*').eq('handle', handle).maybeSingle())
}

export type ProfilePatch = Partial<
  Pick<
    Profile,
    'handle' | 'display_name' | 'job_role' | 'years' | 'bio' | 'stack' | 'github_url' | 'blog_url' | 'area_label'
  >
>

export async function updateProfile(id: string, patch: ProfilePatch): Promise<Profile> {
  return unwrap(await db().from('profiles').update(patch).eq('id', id).select('*').single())
}

export async function fetchMyLocation(userId: string): Promise<{ lat: number; lng: number } | null> {
  return unwrap(
    await db().from('member_locations').select('lat, lng').eq('user_id', userId).maybeSingle(),
  )
}

export async function saveMyLocation(userId: string, loc: { lat: number; lng: number } | null) {
  if (!loc) {
    unwrap(await db().from('member_locations').delete().eq('user_id', userId))
    return
  }
  unwrap(await db().from('member_locations').upsert({ user_id: userId, lat: loc.lat, lng: loc.lng }))
}

export type PeopleParams = { q: string; role: string; stack: string; page: number }

export async function fetchPeople({ q, role, stack, page }: PeopleParams): Promise<Page<PersonRow>> {
  const from = (page - 1) * PAGE_SIZE
  let query = db()
    .from('profiles')
    .select('*, portfolios(count)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  const s = sanitizeSearch(q)
  if (s) query = query.or(`display_name.ilike.%${s}%,handle.ilike.%${s}%`)
  if (role) query = query.eq('job_role', role)
  if (stack.trim()) query = query.contains('stack', [stack.trim()])

  const { data, error, count } = await query
  const rows = unwrap({ data, error }) as (Profile & { portfolios: { count: number }[] })[]
  return {
    total: count ?? 0,
    rows: rows.map(({ portfolios, ...p }) => ({ ...p, portfolio_count: portfolios[0]?.count ?? 0 })),
  }
}
