import { cn } from '@/shared/lib/utils'

export type TaskStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked'

const STATUS_STYLES: Record<TaskStatus, { label: string; className: string }> =
  {
    not_started: { label: 'Not Started', className: 'bg-gray-50 text-muted' },
    in_progress: {
      label: 'In Progress',
      className: 'bg-info-subtle text-info',
    },
    complete: {
      label: 'Complete',
      className: 'bg-success-subtle text-success',
    },
    blocked: { label: 'Blocked', className: 'bg-warning-subtle text-warning' },
  }

export interface StatusBadgeProps {
  status: TaskStatus
  className?: string
}

/** Pill badge for a lifecycle task status. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, className: styles } = STATUS_STYLES[status]
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
