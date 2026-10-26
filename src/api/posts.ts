import { PAGE_SIZE } from '../lib/site'
import { db, sanitizeSearch, unwrap } from '../lib/supabase'
import type { Comment, Page, Post, PostCategory, PostRow } from '../lib/types'
import { PROFILE_LITE } from './profiles'

export type PostListParams = { q: string; category: PostCategory | ''; page: number; limit?: number }

export async function fetchPosts({ q, category, page, limit = PAGE_SIZE }: PostListParams): Promise<Page<PostRow>> {
  const from = (page - 1) * limit
  let query = db()
    .from('posts')
    .select(`id, author_id, category, title, created_at, updated_at, author:profiles!posts_author_id_fkey(${PROFILE_LITE}), comments(count)`, {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)

  const s = sanitizeSearch(q)
  if (s) query = query.or(`title.ilike.%${s}%,body.ilike.%${s}%`)
  if (category) query = query.eq('category', category)

  const { data, error, count } = await query
  type Raw = Omit<PostRow, 'comment_count'> & { comments: { count: number }[] }
  const rows = unwrap({ data, error }) as unknown as Raw[]
  return {
    total: count ?? 0,
    rows: rows.map(({ comments, ...p }) => ({ ...p, comment_count: comments[0]?.count ?? 0 })),
  }
}

export async function fetchPost(id: string): Promise<Post | null> {
  return unwrap(
    await db().from('posts').select(`*, author:profiles!posts_author_id_fkey(${PROFILE_LITE})`).eq('id', id).maybeSingle(),
  ) as Post | null
}

export type PostInput = Pick<Post, 'category' | 'title' | 'body'>

export async function createPost(input: PostInput): Promise<{ id: string }> {
  return unwrap(await db().from('posts').insert(input).select('id').single())
}

export async function updatePost(id: string, input: PostInput) {
  unwrap(await db().from('posts').update(input).eq('id', id))
}

export async function deletePost(id: string) {
  unwrap(await db().from('posts').delete().eq('id', id))
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  return unwrap(
    await db()
      .from('comments')
      .select(`*, author:profiles!comments_author_id_fkey(${PROFILE_LITE})`)
      .eq('post_id', postId)
      .order('created_at', { ascending: true }),
  ) as Comment[]
}

export async function addComment(postId: string, body: string) {
  unwrap(await db().from('comments').insert({ post_id: postId, body }))
}

export async function deleteComment(id: string) {
  unwrap(await db().from('comments').delete().eq('id', id))
}
