import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fetchProfileById } from '../api/profiles'
import {
  AuthContext,
  ConfirmContext,
  ToastContext,
  type ConfirmOptions,
  type ToastApi,
  type ToastInput,
} from '../lib/contexts'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { IconButton } from './ui'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isSupabaseConfigured) return
    // INITIAL_SESSION 이벤트로 저장된 세션 복원까지 처리된다
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['profile', 'me', userId],
    queryFn: () => fetchProfileById(userId as string),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }, [queryClient])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile: profileQuery.data ?? null,
      ready: ready && (!userId || !profileQuery.isPending),
      signOut,
    }),
    [session, profileQuery.data, profileQuery.isPending, ready, userId, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
type ToastItem = ToastInput & { id: number }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++
      setItems((prev) => [...prev.slice(-2), { ...toast, id }])
      window.setTimeout(() => dismiss(id), toast.tone === 'error' ? 8000 : 4000)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      error: (message, error, retry) => {
        if (error) console.error(error)
        show({
          message,
          tone: 'error',
          action: retry ? { label: '다시 시도', onClick: retry } : undefined,
        })
      },
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast${t.tone === 'error' ? ' is-error' : ''}`}>
            <p>{t.message}</p>
            <div className="toast-actions">
              {t.action && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    dismiss(t.id)
                    t.action?.onClick()
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <IconButton
                label="알림 닫기"
                icon={<X size={18} strokeWidth={1.75} />}
                tooltipAlign="end"
                onClick={() => dismiss(t.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Confirm dialog — 대상 이름을 밝히고, 취소에 기본 포커스, Esc로 닫힘
// ---------------------------------------------------------------------------
type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void }

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    triggerRef.current = document.activeElement as HTMLElement | null
    return new Promise<boolean>((resolve) => setPending({ ...options, resolve }))
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!pending || !dialog) return
    if (!dialog.open) dialog.showModal()
    cancelRef.current?.focus()
  }, [pending])

  const close = (ok: boolean) => {
    pending?.resolve(ok)
    dialogRef.current?.close()
    setPending(null)
    triggerRef.current?.focus()
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="confirm-title"
        aria-describedby={pending?.body ? 'confirm-body' : undefined}
        onCancel={(e) => {
          e.preventDefault()
          close(false)
        }}
      >
        {pending && (
          <>
            <div className="dialog-body">
              <h2 id="confirm-title">{pending.title}</h2>
              {pending.body && <p id="confirm-body">{pending.body}</p>}
            </div>
            <div className="dialog-actions">
              <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={() => close(false)}>
                취소
              </button>
              <button
                type="button"
                className={`btn ${pending.tone === 'default' ? 'btn-primary' : 'btn-danger'}`}
                onClick={() => close(true)}
              >
                {pending.confirmLabel}
              </button>
            </div>
          </>
        )}
      </dialog>
    </ConfirmContext.Provider>
  )
}
