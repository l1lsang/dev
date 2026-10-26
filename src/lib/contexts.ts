import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Profile } from './types'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** 세션 복원이 끝났는지 */
  ready: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
export type ToastInput = {
  message: string
  tone?: 'default' | 'error'
  action?: { label: string; onClick: () => void }
}

export type ToastApi = {
  show: (toast: ToastInput) => void
  /** 실패 알림: 사용자 탓을 하지 않고 다음 행동을 알려 준다 */
  error: (message: string, error?: unknown, retry?: () => void) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------
export type ConfirmOptions = {
  title: string
  body?: string
  confirmLabel: string
  tone?: 'danger' | 'default'
}

export const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}
