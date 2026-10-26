import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useAuth } from '../lib/contexts'
import { safeNext } from '../lib/format'

export default function AuthCallback() {
  const { user, ready } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const urlError = params.get('error_description') || new URLSearchParams(window.location.hash.slice(1)).get('error_description')
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 10000)
    return () => window.clearTimeout(t)
  }, [])

  if (ready && user) return <Navigate to={next} replace />

  const failed = Boolean(urlError) || timedOut

  return (
    <div className="auth-page">
      <main id="main" className="auth-card panel">
        <div className="auth-body" role="status" aria-live="polite">
          {failed ? (
            <>
              <h1>로그인을 마치지 못했어요</h1>
              <p className="secondary">링크가 만료됐거나 이미 사용됐을 수 있어요. 새 링크로 다시 로그인해 주세요.</p>
              <Link to={`/login?next=${encodeURIComponent(next)}`} className="btn btn-primary">
                다시 로그인하기
              </Link>
            </>
          ) : (
            <>
              <h1>로그인하는 중이에요</h1>
              <p className="secondary">잠시만 기다려 주세요.</p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
