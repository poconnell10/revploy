import { useEffect, type ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

/**
 * Reusable modal shell for the property Actions menu: overlay + centered card,
 * close on Escape / overlay click, fadeUp entrance, navy/danger title and an
 * optional right-aligned footer.
 */
export function ActionModal({
  open,
  onClose,
  title,
  titleVariant = 'default',
  description,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  titleVariant?: 'default' | 'danger'
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(13,31,60,0.45)', backdropFilter: 'blur(2px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[480px] max-w-[calc(100vw-40px)] rounded-2xl bg-white"
        style={{
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          animation: 'actionModalFadeUp 0.15s ease',
        }}
      >
        <div className="px-6 pb-5 pt-6">
          <h2
            className={cn(
              'mb-1.5 text-base font-bold tracking-tight',
              titleVariant === 'danger' ? 'text-[#dc2626]' : 'text-navy',
            )}
          >
            {title}
          </h2>
          {description && (
            <div className="mb-5 text-[12.5px] leading-relaxed text-gray-400">
              {description}
            </div>
          )}
          {children}
          {footer && (
            <div className="flex justify-end gap-2 pt-1">{footer}</div>
          )}
        </div>
      </div>
    </div>
  )
}
