import { cn } from '@/shared/lib/utils'

export type Phase = 'data' | 'configuration' | 'provisioning'

const PHASE_STYLES: Record<Phase, { label: string; className: string }> = {
  data: { label: 'Data', className: 'bg-purple-subtle text-purple' },
  configuration: {
    label: 'Configuration',
    className: 'bg-warning-subtle text-warning',
  },
  provisioning: {
    label: 'Provisioning',
    className: 'bg-info-subtle text-info',
  },
}

export interface PhaseBadgeProps {
  phase: Phase | null
  className?: string
}

/** Pill badge for the current onboarding phase. Renders nothing when null. */
export function PhaseBadge({ phase, className }: PhaseBadgeProps) {
  if (phase === null) return null
  const { label, className: styles } = PHASE_STYLES[phase]
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
