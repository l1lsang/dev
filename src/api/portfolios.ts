import { PAGE_SIZE } from '../lib/site'
import { db, sanitizeSearch, unwrap } from '../lib/supabase'
import type { Page, Portfolio } from '../lib/types'
import { PROFILE_LITE } from './profiles'

const BUCKET = 'portfolio-covers'
const SELECT = `*, author:profiles!portfolios_user_id_fkey(${PROFILE_LITE})`

export type PortfolioListParams = { q: string; stack: string; page: number; userId?: string; pageSize?: number }

export async function fetchPortfolios({
  q,
  stack,
  page,
  userId,
  pageSize = PAGE_SIZE,
}: PortfolioListParams): Promise<Page<Portfolio>> {
  const from = (page - 1) * pageSize
  let query = db()
    .from('portfolios')
    .select(SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  const s = sanitizeSearch(q)
  if (s) query = query.or(`title.ilike.%${s}%,summary.ilike.%${s}%`)
  if (stack.trim()) query = query.contains('stack', [stack.trim()])
  if (userId) query = query.eq('user_id', userId)

  const { data, error, count } = await query
  return { rows: unwrap({ data, error }) as Portfolio[], total: count ?? 0 }
}

export async function fetchPortfolio(id: string): Promise<Portfolio | null> {
  return unwrap(await db().from('portfolios').select(SELECT).eq('id', id).maybeSingle()) as Portfolio | null
}

export type PortfolioInput = Pick<
  Portfolio,
  'title' | 'summary' | 'body' | 'live_url' | 'repo_url' | 'stack' | 'cover_path'
>

export async function createPortfolio(input: PortfolioInput): Promise<{ id: string }> {
  return unwrap(await db().from('portfolios').insert(input).select('id').single())
}

export async function updatePortfolio(id: string, input: PortfolioInput) {
  unwrap(await db().from('portfolios').update(input).eq('id', id))
}

export async function deletePortfolio(p: Pick<Portfolio, 'id' | 'cover_path'>) {
  unwrap(await db().from('portfolios').delete().eq('id', p.id))
  if (p.cover_path) await db().storage.from(BUCKET).remove([p.cover_path])
}

export async function uploadCover(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await db().storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw error
  return path
}

export async function removeCover(path: string) {
  await db().storage.from(BUCKET).remove([path])
}

export function coverUrl(path: string | null): string | null {
  if (!path) return null
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
