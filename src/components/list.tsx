import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useDismiss, useSlashFocus } from '../lib/hooks'
import { PAGE_SIZE } from '../lib/site'

// ---------------------------------------------------------------------------
// Search — 보이는 라벨 + 돋보기, `/`로 포커스. 입력이 멈추면 반영한다
// ---------------------------------------------------------------------------
export function SearchBox({
  value,
  onChange,
  placeholder,
  label = '검색',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(value)
  const [prevValue, setPrevValue] = useState(value)
  useSlashFocus(ref)

  // 뒤로 가기 등으로 URL 값이 바뀌면 입력칸도 맞춘다
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) return
    const t = window.setTimeout(() => onChange(draft), 250)
    return () => window.clearTimeout(t)
  }, [draft, value, onChange])

  return (
    <div className="search">
      <label className="search-label" htmlFor="list-search">
        {label}
      </label>
      <div className="search-box">
        <Search size={16} strokeWidth={1.75} aria-hidden="true" />
        <input
          ref={ref}
          id="list-search"
          type="search"
          className="input"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onChange(draft)
          }}
          aria-keyshortcuts="/"
        />
        {!draft && <kbd aria-hidden="true">/</kbd>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filters — 필터는 버튼 하나, 조건은 패널 안에. 적용된 값은 툴바 아래 칩으로
// ---------------------------------------------------------------------------
export function FilterMenu({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const dismiss = useCallback((reason: 'escape' | 'outside') => {
    setOpen(false)
    if (reason === 'escape') buttonRef.current?.focus()
  }, [])
  useDismiss(open, wrapRef, dismiss)

  return (
    <div className="filter-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-secondary"
        aria-expanded={open}
        aria-controls="filter-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
        필터
        {activeCount > 0 && <span className="num filter-count">{activeCount}</span>}
      </button>
      {open && (
        <div id="filter-panel" className="popover filter-panel" role="group" aria-label="필터">
          {children}
        </div>
      )}
    </div>
  )
}

export function ActiveFilters({
  items,
  onClearAll,
}: {
  items: { key: string; label: string; onRemove: () => void }[]
  onClearAll: () => void
}) {
  if (items.length === 0) return null
  return (
    <div className="active-filters">
      {items.map((item) => (
        <button key={item.key} type="button" className="chip" onClick={item.onRemove} aria-label={`${item.label} 필터 지우기`}>
          {item.label}
          <X size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ))}
      <button type="button" className="btn btn-ghost" onClick={onClearAll}>
        모두 지우기
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pagination — 한 페이지뿐이어도 항상 보인다
// ---------------------------------------------------------------------------
export function Pagination({
  page,
  total,
  pageSize = PAGE_SIZE,
  onChange,
  unit = '개',
}: {
  page: number
  total: number
  pageSize?: number
  onChange: (page: number) => void
  unit?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav className="pagination" aria-label="페이지 이동">
      <p className="secondary">
        <span className="num">
          {from}–{to}
        </span>{' '}
        / 전체 <span className="num">{total}</span>
        {unit}
      </p>
      <div className="pagination-buttons">
        <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          이전 페이지
        </button>
        <button type="button" className="btn btn-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          다음 페이지
        </button>
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Tabs — 화살표로 이동 (roving tabindex)
// ---------------------------------------------------------------------------
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[]
  value: T
  onChange: (id: T) => void
  label: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const move = (index: number) => {
    const i = (index + tabs.length) % tabs.length
    onChange(tabs[i].id)
    refs.current[i]?.focus()
  }
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-controls={`panel-${tab.id}`}
          aria-selected={tab.id === value}
          tabIndex={tab.id === value ? 0 : -1}
          className="tab"
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') move(i + 1)
            else if (e.key === 'ArrowLeft') move(i - 1)
            else if (e.key === 'Home') move(0)
            else if (e.key === 'End') move(tabs.length - 1)
            else return
            e.preventDefault()
          }}
        >
          {tab.label}
          {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="tab-panel">
      {children}
    </div>
  )
}
