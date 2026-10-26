import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { BrandMark } from '../components/Layout'
import { Button, Field } from '../components/ui'
import { useAuth } from '../lib/contexts'
import { safeNext } from '../lib/format'
import { SITE } from '../lib/site'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useForm } from '../lib/useForm'

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const { user, ready } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm(
    { email: '' },
    {
      email: (v) =>
        !v.trim() ? '이메일을 입력해 주세요.' : EMAIL_RE.test(v.trim()) ? null : 'name@example.com 형식으로 입력해 주세요.',
    },
  )

  if (ready && user) return <Navigate to={next} replace />

  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

  const sendLink = async (email: string) => {
    setFormError(null)
    setSending(true)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
    setSending(false)
    if (error) {
      setFormError(
        error.status === 429
          ? '방금 메일을 보냈어요. 1분 뒤에 다시 보내 주세요.'
          : '메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.',
      )
      return
    }
    setSentTo(email)
  }

  const github = async () => {
    setFormError(null)
    setGithubLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } })
    if (error) {
      setGithubLoading(false)
      setFormError('GitHub 로그인을 시작하지 못했어요. 잠시 뒤 다시 시도하거나 이메일로 로그인해 주세요.')
    }
  }

  return (
    <div className="auth-page">
      <main id="main" className="auth-card panel">
        <Link to="/" className="brand auth-brand">
          <BrandMark />
          {SITE.name}
        </Link>

        {!isSupabaseConfigured ? (
          <div className="auth-body">
            <h1>로그인</h1>
            <p className="secondary">
              아직 데이터베이스가 연결되지 않아 로그인할 수 없어요. README의 Supabase 설정을 마친 뒤 다시 열어 주세요.
            </p>
          </div>
        ) : sentTo ? (
          <div className="auth-body">
            <h1>메일함을 확인해 주세요</h1>
            <p className="secondary">
              <strong>{sentTo}</strong>로 로그인 링크를 보냈어요. 링크를 누르면 이 화면으로 돌아와요.
            </p>
            {formError && (
              <p className="field-error" role="alert">
                {formError}
              </p>
            )}
            <div className="auth-actions">
              <Button variant="secondary" loading={sending} onClick={() => sendLink(sentTo)}>
                링크 다시 보내기
              </Button>
              <Button variant="ghost" onClick={() => setSentTo(null)}>
                다른 이메일 쓰기
              </Button>
            </div>
          </div>
        ) : (
          <div className="auth-body">
            <h1>로그인</h1>
            <p className="secondary">처음이면 로그인하면서 바로 가입돼요.</p>

            <Button variant="secondary" block loading={githubLoading} onClick={github}>
              <GitHubMark />
              GitHub로 계속하기
            </Button>

            <div className="auth-divider">
              <span>또는 이메일로</span>
            </div>

            <form
              className="form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                if (form.validateAll()) sendLink(form.values.email.trim())
              }}
            >
              <Field id="f-email" label="이메일" error={form.errors.email} hint="비밀번호 없이 메일로 받은 링크로 로그인해요.">
                <input
                  {...form.input('email')}
                  type="email"
                  className="input"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="name@example.com"
                  aria-required="true"
                />
              </Field>
              {formError && (
                <p className="field-error" role="alert">
                  {formError}
                </p>
              )}
              <Button type="submit" variant="primary" block loading={sending}>
                로그인 링크 받기
              </Button>
            </form>
          </div>
        )}

        <Link to="/" className="text-link secondary auth-back">
          홈으로 돌아가기
        </Link>
      </main>
    </div>
  )
}
