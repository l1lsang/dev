import { db, unwrap } from '../lib/supabase'
import type { Resume, ResumeFeedback } from '../lib/types'
import { PROFILE_LITE } from './profiles'

const BUCKET = 'resumes'
export const RESUME_MAX_BYTES = 10 * 1024 * 1024

export async function fetchResume(userId: string): Promise<Resume | null> {
  return unwrap(await db().from('resumes').select('*').eq('user_id', userId).maybeSingle())
}

/** 새 파일을 올리고 행을 갱신한 뒤, 이전 파일을 지운다 */
export async function uploadResume(userId: string, file: File, previous: Resume | null): Promise<void> {
  const path = `${userId}/${Date.now()}.pdf`
  const { error } = await db().storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf' })
  if (error) throw error

  unwrap(
    await db()
      .from('resumes')
      .upsert({
        user_id: userId,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        visibility: previous?.visibility ?? 'private',
        wants_feedback: previous?.wants_feedback ?? false,
      }),
  )

  if (previous && previous.file_path !== path) {
    await db().storage.from(BUCKET).remove([previous.file_path])
  }
}

export async function updateResumeSettings(
  userId: string,
  patch: Partial<Pick<Resume, 'visibility' | 'wants_feedback'>>,
) {
  unwrap(await db().from('resumes').update(patch).eq('user_id', userId))
}

export async function deleteResume(resume: Resume) {
  unwrap(await db().from('resumes').delete().eq('user_id', resume.user_id))
  await db().storage.from(BUCKET).remove([resume.file_path])
}

export async function openResume(path: string): Promise<string> {
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

export async function fetchFeedback(resumeUserId: string): Promise<ResumeFeedback[]> {
  return unwrap(
    await db()
      .from('resume_feedback')
      .select(`*, author:profiles!resume_feedback_author_id_fkey(${PROFILE_LITE})`)
      .eq('resume_user_id', resumeUserId)
      .order('created_at', { ascending: true }),
  ) as ResumeFeedback[]
}

export async function addFeedback(resumeUserId: string, body: string) {
  unwrap(await db().from('resume_feedback').insert({ resume_user_id: resumeUserId, body }))
}

export async function deleteFeedback(id: string) {
  unwrap(await db().from('resume_feedback').delete().eq('id', id))
}
