import { cn } from '@/shared/lib/utils'

export type LifecycleState = 'onboarding' | 'activated' | 'archived'

const LIFECYCLE_STYLES: Record<
  LifecycleState,
  { label: string; className: string }
> = {
  onboarding: { label: 'Onboarding', className: 'bg-info-subtle text-info' },
  activated: {
    label: 'Activated',
    className: 'bg-success-subtle text-success',
  },
  archived: { label: 'Archived', className: 'bg-gray-50 text-muted' },
}

export interface LifecycleBadgeProps {
  state: LifecycleState
  className?: string
}

/** Pill badge for a property lifecycle state. */
export function LifecycleBadge({ state, className }: LifecycleBadgeProps) {
  const { label, className: styles } = LIFECYCLE_STYLES[state]
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-[20px] px-2 py-0.5 text-[11px] font-semibold',
        styles,
        className,
      )}
    >
      {label}
    </span>
  )
}
