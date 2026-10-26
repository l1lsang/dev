import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'

type Rules<V> = { [K in keyof V]?: (value: V[K], values: V) => string | null }
type Errors<V> = Partial<Record<keyof V, string>>

type FormOptions<V> = {
  /** 이 키로 작성 중인 내용을 브라우저에 자동 저장하고, 돌아오면 복원한다 */
  draftKey?: string
  /** 브라우저에 남기면 안 되는 칸 (예: 집 위치) */
  exclude?: (keyof V)[]
}

const DRAFT_PREFIX = 'draft:'

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(DRAFT_PREFIX + key)
  } catch {
    // 저장소를 못 쓰면 지울 것도 없다
  }
}

function readDraft<V extends Record<string, unknown>>(key: string | undefined, initial: V): Partial<V> | null {
  if (!key) return null
  try {
    const raw = window.localStorage.getItem(DRAFT_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const picked: Partial<V> = {}
    for (const k of Object.keys(initial) as (keyof V)[]) {
      if (k in parsed && typeof parsed[k as string] === typeof initial[k]) picked[k] = parsed[k as string] as V[keyof V]
    }
    return Object.keys(picked).length ? picked : null
  } catch {
    return null
  }
}

/**
 * 폼 검증 규칙
 * - 처음 입력 중에는 오류를 보여 주지 않는다 (첫 blur 때 검사)
 * - 오류가 난 칸에 다시 들어가거나 고치기 시작하면 바로 오류를 지운다
 * - 제출 버튼은 막지 않는다. 누르면 모든 칸을 검사하고 첫 오류로 이동한다
 * - draftKey가 있으면 작성 중인 내용을 자동 저장하고, 돌아오면 복원한다
 */
export function useForm<V extends Record<string, unknown>>(initial: V, rules: Rules<V>, options: FormOptions<V> = {}) {
  const { draftKey, exclude } = options
  const [draft] = useState(() => readDraft(draftKey, initial))
  const [values, setValues] = useState<V>(() => (draft ? { ...initial, ...draft } : initial))
  const [errors, setErrors] = useState<Errors<V>>({})
  const [dirty, setDirty] = useState(Boolean(draft))
  const [restored, setRestored] = useState(Boolean(draft))
  const elements = useRef<Partial<Record<keyof V, HTMLElement | null>>>({})
  const valuesRef = useRef(values)
  const initialRef = useRef(initial)

  useEffect(() => {
    if (!draftKey || !dirty) return
    try {
      const toSave: Record<string, unknown> = { ...values }
      for (const k of exclude ?? []) delete toSave[k as string]
      window.localStorage.setItem(DRAFT_PREFIX + draftKey, JSON.stringify(toSave))
    } catch {
      // 저장소가 막힌 환경에서는 메모리 상태만 쓴다
    }
  }, [draftKey, dirty, values, exclude])

  const check = useCallback(
    <K extends keyof V>(name: K, vals: V) => rules[name]?.(vals[name], vals) ?? null,
    [rules],
  )

  const clearError = useCallback((name: keyof V) => {
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  const set = useCallback(
    <K extends keyof V>(name: K, value: V[K]) => {
      const next = { ...valuesRef.current, [name]: value }
      valuesRef.current = next
      setValues(next)
      setDirty(true)
      clearError(name)
    },
    [clearError],
  )

  const blur = useCallback(
    (name: keyof V) => {
      const message = check(name, valuesRef.current)
      setErrors((prev) => {
        const next = { ...prev }
        if (message) next[name] = message
        else delete next[name]
        return next
      })
    },
    [check],
  )

  /** 텍스트 계열 input/textarea/select에 그대로 펼쳐 쓰는 props */
  function input<K extends keyof V>(name: K) {
    const id = `f-${String(name)}`
    const error = errors[name]
    return {
      id,
      name: String(name),
      value: (values[name] ?? '') as string,
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        set(name, e.target.value as V[K]),
      onBlur: () => blur(name),
      onFocus: () => clearError(name),
      ref: (el: HTMLElement | null) => {
        elements.current[name] = el
      },
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${id}-error` : `${id}-hint`,
    }
  }

  /** 모든 칸을 검사한다. 오류가 있으면 첫 칸으로 스크롤하고 false */
  function validateAll(): boolean {
    const vals = valuesRef.current
    const next: Errors<V> = {}
    for (const name of Object.keys(rules) as (keyof V)[]) {
      const message = check(name, vals)
      if (message) next[name] = message
    }
    setErrors(next)
    const first = (Object.keys(rules) as (keyof V)[]).find((k) => next[k])
    if (first) {
      const el = elements.current[first]
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
      el?.focus({ preventScroll: true })
      // focus가 오류를 지우므로 다음 틱에 다시 표시한다
      requestAnimationFrame(() => setErrors(next))
      return false
    }
    return true
  }

  /** 저장이 끝났을 때: 초안을 지우고 깨끗한 상태로 */
  function markClean() {
    if (draftKey) clearDraft(draftKey)
    setDirty(false)
    setRestored(false)
  }

  /** 복원한 초안을 버리고 원래 값으로 */
  function discardDraft() {
    if (draftKey) clearDraft(draftKey)
    valuesRef.current = initialRef.current
    setValues(initialRef.current)
    setErrors({})
    setDirty(false)
    setRestored(false)
  }

  return {
    values,
    errors,
    dirty,
    restored,
    set,
    input,
    validateAll,
    markClean,
    discardDraft,
  }
}

export const required =
  (message: string) =>
  (value: unknown): string | null => {
    if (typeof value === 'string') return value.trim() ? null : message
    if (Array.isArray(value)) return value.length ? null : message
    return value == null ? message : null
  }
