import { createClient, type PostgrestError } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)

// 환경변수가 없어도 앱(특히 장소 찾기)은 돌아가도록 자리표시 값으로 만든다.
// 데이터 요청은 db()가 막아 준다.
export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export class SetupRequiredError extends Error {
  constructor() {
    super('Supabase 환경변수가 없어 데이터를 불러올 수 없어요. README의 설정 단계를 따라 주세요.')
    this.name = 'SetupRequiredError'
  }
}

export function db() {
  if (!isSupabaseConfigured) throw new SetupRequiredError()
  return supabase
}

export class ApiError extends Error {
  code?: string
  details?: string

  constructor(error: PostgrestError | { message: string; code?: string }) {
    super(error.message)
    this.name = 'ApiError'
    this.code = error.code
    this.details = 'details' in error ? error.details : undefined
  }
}

export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new ApiError(res.error)
  return res.data as T
}

/** PostgREST or() 필터를 깨뜨리는 문자를 걷어낸다 */
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()%*\\:"']/g, ' ').trim().slice(0, 60)
}
