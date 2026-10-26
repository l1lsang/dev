import { MoreHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useDismiss } from '../lib/hooks'
import { IconButton } from './ui'

// ---------------------------------------------------------------------------
// Drawer (slide-over) — 오른쪽에서 열림, 포커스 가둠, 닫으면 연 버튼으로 복귀
// 입력값은 부모가 들고 있어서 닫았다 열어도 남는다
// ---------------------------------------------------------------------------
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      triggerRef.current = document.activeElement as HTMLElement | null
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
      triggerRef.current?.focus()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      {open && (
        <>
          <div className="drawer-header">
            <h2 id={titleId}>{title}</h2>
            <IconButton label="닫기" icon={<X size={20} strokeWidth={1.75} />} shortcut="Esc" tooltipPlacement="bottom" tooltipAlign="end" onClick={onClose} />
          </div>
          <div className="drawer-body">{children}</div>
          {footer && <div className="drawer-footer">{footer}</div>}
        </>
      )}
    </dialog>
  )
}

// ---------------------------------------------------------------------------
// Overflow menu (⋯) — 화살표로 이동, Esc로 닫고 버튼으로 포커스 복귀
// ---------------------------------------------------------------------------
export type MenuItem = { label: string; onSelect: () => void; danger?: boolean }

export function OverflowMenu({ label = '더 보기', items }: { label?: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) wrapRef.current?.querySelector<HTMLButtonElement>('.icon-btn')?.focus()
  }, [])

  const dismiss = useCallback((reason: 'escape' | 'outside') => close(reason === 'escape'), [close])
  useDismiss(open, wrapRef, dismiss)

  useEffect(() => {
    if (open) itemRefs.current[0]?.focus()
  }, [open])

  const focusItem = (i: number) => itemRefs.current[(i + items.length) % items.length]?.focus()

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <IconButton
        label={label}
        icon={<MoreHorizontal size={20} strokeWidth={1.75} />}
        bordered
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        tooltipAlign="end"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div id={menuId} role="menu" className="popover menu" aria-label={label}>
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              type="button"
              role="menuitem"
              className={`menu-item${item.danger ? ' is-danger' : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') focusItem(i + 1)
                else if (e.key === 'ArrowUp') focusItem(i - 1)
                else if (e.key === 'Tab') close(false)
                else return
                if (e.key !== 'Tab') e.preventDefault()
              }}
              onClick={() => {
                close(true)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
