import { useState, type ReactNode } from 'react'
import { useDelayedFlag } from '../lib/hooks'
import { SetupRequiredError } from '../lib/supabase'

export function EmptyState({
  icon,
  title,
  body,
  actions,
}: {
  icon?: ReactNode
  title: string
  body?: string
  actions?: ReactNode
}) {
  return (
    <section className="empty">
      {icon}
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {actions && <div className="empty-actions">{actions}</div>}
    </section>
  )
}

/** 오류: 무엇이 안 됐는지 + 다시 시도. 기술 정보는 화면에 쏟지 않고 복사 버튼으로만 */
export function ErrorState({ error, onRetry, title = '불러오지 못했어요' }: { error: unknown; onRetry?: () => void; title?: string }) {
  const [copied, setCopied] = useState(false)

  if (error instanceof SetupRequiredError) {
    return (
      <section className="empty">
        <h3>데이터베이스 연결이 아직 안 됐어요</h3>
        <p>.env.local에 Supabase URL과 키를 넣고 개발 서버를 다시 시작해 주세요. 자세한 순서는 README에 있어요.</p>
      </section>
    )
  }

  const copy = async () => {
    const detail = {
      message: error instanceof Error ? error.message : String(error),
      code: (error as { code?: string })?.code,
      route: window.location.pathname,
      at: new Date().toISOString(),
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(detail, null, 2))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="empty" role="alert">
      <h3>{title}</h3>
      <p>연결이 잠시 불안정했을 수 있어요. 다시 시도해 주세요.</p>
      <div className="empty-actions">
        {onRetry && (
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            다시 시도
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={copy}>
          {copied ? '복사했어요' : '오류 정보 복사'}
        </button>
      </div>
    </section>
  )
}

/** 100ms 넘게 걸릴 때만 뼈대를 보여 준다 */
export function Delayed({ children, ms = 100 }: { children: ReactNode; ms?: number }) {
  const show = useDelayedFlag(true, ms)
  return show ? <>{children}</> : null
}

const WIDTHS = ['72%', '48%', '64%', '40%', '56%', '68%', '44%', '60%']

export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <Delayed>
      <div aria-hidden="true">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="skeleton-row" style={{ gridTemplateColumns: `2fr repeat(${columns - 1}, 1fr)` }}>
            {Array.from({ length: columns }, (_, c) => (
              <span key={c} className="skeleton" style={{ width: c === 0 ? WIDTHS[r % WIDTHS.length] : '60%' }} />
            ))}
          </div>
        ))}
      </div>
      <span className="visually-hidden" role="status">
        불러오는 중
      </span>
    </Delayed>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Delayed>
      <div aria-hidden="true">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="skeleton-list-row">
            <span className="skeleton skeleton-avatar" />
            <span className="skeleton-lines">
              <span className="skeleton" style={{ width: WIDTHS[r % WIDTHS.length] }} />
              <span className="skeleton" style={{ width: '30%' }} />
            </span>
          </div>
        ))}
      </div>
      <span className="visually-hidden" role="status">
        불러오는 중
      </span>
    </Delayed>
  )
}
