import { History } from 'lucide-react'
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useConfirm } from '../lib/contexts'
import { useDelayedFlag } from '../lib/hooks'
import { initials } from '../lib/format'
import type { ProfileLite } from '../lib/types'

// ---------------------------------------------------------------------------
// Button with inline loading (스피너는 100ms 뒤에만 보인다)
// ---------------------------------------------------------------------------
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-text'
  loading?: boolean
  block?: boolean
}

export function Button({
  variant = 'secondary',
  loading = false,
  block = false,
  className = '',
  children,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  const showSpinner = useDelayedFlag(loading, 100)
  return (
    <button
      type={type}
      className={`btn btn-${variant}${block ? ' btn-block' : ''} ${className}`}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (loading) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      {...rest}
    >
      {showSpinner && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Icon button — 정사각형, 툴팁(hover + focus), aria-label 필수
// ---------------------------------------------------------------------------
type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  icon: ReactNode
  shortcut?: string
  bordered?: boolean
  tooltipPlacement?: 'top' | 'bottom'
  tooltipAlign?: 'center' | 'end'
}

export function IconButton({
  label,
  icon,
  shortcut,
  bordered,
  tooltipPlacement = 'top',
  tooltipAlign = 'center',
  className = '',
  type = 'button',
  ...rest
}: IconButtonProps) {
  const tipId = useId()
  return (
    <span className="tooltip-wrap">
      <button
        type={type}
        className={`icon-btn${bordered ? ' is-bordered' : ''} ${className}`}
        aria-label={label}
        aria-describedby={shortcut ? tipId : undefined}
        {...rest}
      >
        {icon}
      </button>
      <Tooltip id={tipId} label={label} shortcut={shortcut} placement={tooltipPlacement} align={tooltipAlign} />
    </span>
  )
}

export function Tooltip({
  id,
  label,
  shortcut,
  placement = 'top',
  align = 'center',
}: {
  id?: string
  label: string
  shortcut?: string
  placement?: 'top' | 'bottom'
  align?: 'center' | 'end'
}) {
  return (
    <span
      role="tooltip"
      id={id}
      className={`tooltip${placement === 'bottom' ? ' is-below' : ''}${align === 'end' ? ' is-end' : ''}`}
    >
      {label}
      {shortcut && <kbd>{shortcut}</kbd>}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Field — 보이는 라벨 + 도움말/오류 (오류가 도움말 자리를 대신한다)
// ---------------------------------------------------------------------------
export function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  hint?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {optional && <span className="field-optional"> (선택)</span>}
      </label>
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 복원한 초안 안내 — 이어 쓰거나 버릴 수 있다
// ---------------------------------------------------------------------------
export function DraftNotice({ onDiscard }: { onDiscard: () => void }) {
  const confirm = useConfirm()
  return (
    <div className="notice draft-notice" role="status">
      <History size={16} strokeWidth={1.75} aria-hidden="true" />
      <p>
        <strong>작성하던 내용을 불러왔어요.</strong> 이어서 쓰거나 처음부터 다시 쓸 수 있어요.
      </p>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={async () => {
          const ok = await confirm({
            title: '작성하던 초안을 버릴까요?',
            body: '불러온 내용이 지워지고 저장된 값으로 돌아가요.',
            confirmLabel: '초안 버리기',
          })
          if (ok) onDiscard()
        }}
      >
        초안 버리기
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
export function Avatar({ profile, size = 'md' }: { profile: Pick<ProfileLite, 'display_name' | 'avatar_url'>; size?: 'md' | 'lg' }) {
  return (
    <span className={`avatar${size === 'lg' ? ' is-lg' : ''}`} aria-hidden="true">
      {profile.avatar_url ? <img src={profile.avatar_url} alt="" loading="lazy" /> : initials(profile.display_name)}
    </span>
  )
}

export function PersonLink({ profile }: { profile: ProfileLite }) {
  return (
    <Link to={`/u/${profile.handle}`} className="person-link">
      <Avatar profile={profile} />
      <span>{profile.display_name}</span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  meta,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  breadcrumb?: { to: string; label: string }
  meta?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {breadcrumb && (
          <nav aria-label="상위 메뉴" className="breadcrumb">
            <Link to={breadcrumb.to}>{breadcrumb.label}</Link>
            <span aria-hidden="true">›</span>
          </nav>
        )}
        <h1>{title}</h1>
        {meta && <div className="page-meta">{meta}</div>}
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
