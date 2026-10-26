import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useBeforeUnload, useBlocker, useSearchParams } from 'react-router'
import { useConfirm } from './contexts'

/** flag가 ms 이상 유지될 때만 true (짧은 로딩에 스피너가 깜빡이지 않게) */
export function useDelayedFlag(flag: boolean, ms: number): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!flag) return
    const t = window.setTimeout(() => setShown(true), ms)
    return () => {
      window.clearTimeout(t)
      setShown(false)
    }
  }, [flag, ms])
  return flag && shown
}

/** `/` 키로 검색창에 포커스 */
export function useSlashFocus(ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      ref.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ref])
}

/** 바깥 클릭이나 Esc로 닫기 */
export function useDismiss(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onDismiss: (reason: 'escape' | 'outside') => void,
) {
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onDismiss('outside')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss('escape')
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, containerRef, onDismiss])
}

/** 브라우저에만 남기는 작은 편의 상태 (실패해도 기본값으로 동작) */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // 저장소를 못 쓰는 환경이면 조용히 메모리 상태만 쓴다
    }
  }, [key, value])
  return [value, setValue] as const
}

/** 작성 중인 폼을 떠나려 할 때 확인 */
export function useUnsavedChanges(when: boolean) {
  const confirm = useConfirm()
  const blocker = useBlocker(({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname)
  const asking = useRef(false)

  useEffect(() => {
    if (blocker.state !== 'blocked' || asking.current) return
    asking.current = true
    confirm({
      title: '작성 중인 내용을 버리고 나갈까요?',
      body: '저장하지 않은 내용은 사라져요.',
      confirmLabel: '내용 버리고 나가기',
    }).then((ok) => {
      asking.current = false
      if (ok) blocker.proceed()
      else blocker.reset()
    })
  }, [blocker, confirm])

  useBeforeUnload(
    useCallback(
      (e: BeforeUnloadEvent) => {
        if (when) e.preventDefault()
      },
      [when],
    ),
  )
}

/** URL 쿼리스트링을 목록 상태로 쓴다 (새로고침·공유해도 유지) */
export function useListParams<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams()
  const values = Object.fromEntries(
    Object.entries(defaults).map(([k, v]) => [k, params.get(k) ?? v]),
  ) as T
  const page = Math.max(1, Number(params.get('page')) || 1)

  const update = useCallback(
    (patch: Partial<T> & { page?: number }) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === '' || v === defaults[k] || (k === 'page' && v === 1)) next.delete(k)
            else next.set(k, String(v))
          }
          // 조건이 바뀌면 첫 페이지로
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams, defaults],
  )

  return { values, page, update }
}
