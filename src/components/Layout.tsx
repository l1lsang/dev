import { Menu, X } from 'lucide-react'
import { Suspense, useCallback, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../lib/contexts'
import { useDismiss } from '../lib/hooks'
import { NAV, SITE } from '../lib/site'
import { isSupabaseConfigured } from '../lib/supabase'
import { BrandMark } from './BrandMark'
import { Avatar, IconButton, Tooltip } from './ui'

function UserMenu() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dismiss = useCallback((reason: 'escape' | 'outside') => {
    setOpen(false)
    if (reason === 'escape') buttonRef.current?.focus()
  }, [])
  useDismiss(open, wrapRef, dismiss)

  if (!user) {
    return (
      <Link to="/login" className="btn btn-secondary">
        로그인
      </Link>
    )
  }

  const name = profile?.display_name ?? user.email ?? '내 계정'
  return (
    <div className="menu-wrap tooltip-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="user-button"
        aria-label="계정 메뉴 열기"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar profile={{ display_name: name, avatar_url: profile?.avatar_url ?? null }} />
      </button>
      {!open && <Tooltip label="계정 메뉴 열기" placement="bottom" align="end" />}
      {open && (
        <div role="menu" className="popover menu" aria-label="계정 메뉴">
          <p className="menu-caption">
            <strong>{name}</strong>
            {profile && <span className="meta mono">@{profile.handle}</span>}
          </p>
          {profile && (
            <Link role="menuitem" className="menu-item" to={`/u/${profile.handle}`} onClick={() => setOpen(false)}>
              내 프로필 보기
            </Link>
          )}
          <Link role="menuitem" className="menu-item" to="/me/edit" onClick={() => setOpen(false)}>
            프로필 수정하기
          </Link>
          <button
            role="menuitem"
            type="button"
            className="menu-item"
            onClick={async () => {
              setOpen(false)
              await signOut()
              navigate('/')
            }}
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const [prevPath, setPrevPath] = useState(location.pathname)

  // 페이지가 바뀌면 모바일 메뉴를 닫는다
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname)
    setMenuOpen(false)
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand">
          <BrandMark />
          {SITE.name}
        </Link>
        <nav className="nav" aria-label="주요 메뉴">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <UserMenu />
          <span className="menu-toggle">
            <IconButton
              label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
              icon={menuOpen ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              tooltipPlacement="bottom"
              tooltipAlign="end"
              onClick={() => setMenuOpen((v) => !v)}
            />
          </span>
        </div>
      </div>
      {menuOpen && (
        <nav id="mobile-nav" className="mobile-nav" aria-label="주요 메뉴">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="mobile-nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          <strong>{SITE.name}</strong> · {SITE.description}
        </p>
        <p className="meta">지도 데이터 © OpenStreetMap 기여자 · 이동시간은 직선거리 기반 추정치예요.</p>
      </div>
    </footer>
  )
}

export function Layout() {
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <Header />
      {!isSupabaseConfigured && (
        <div className="setup-banner" role="note">
          데이터베이스가 아직 연결되지 않았어요. 장소 찾기는 바로 써 볼 수 있고, 나머지 기능은 README의 Supabase 설정 뒤에
          동작해요.
        </div>
      )}
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<div className="page" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  )
}

/** 로그인해야 볼 수 있는 페이지 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <div className="page" aria-busy="true" />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}
