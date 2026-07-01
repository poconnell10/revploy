import { cn } from '@/shared/lib/utils'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

const RISK_STYLES: Record<RiskLevel, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-success-subtle text-success' },
  medium: { label: 'Medium', className: 'bg-info-subtle text-info' },
  high: { label: 'High', className: 'bg-warning-subtle text-warning' },
  critical: { label: 'Critical', className: 'bg-danger-subtle text-danger' },
}

export interface RiskBadgeProps {
  risk: RiskLevel | null
  className?: string
}

/** Pill badge for a derived risk level. Renders nothing when null. */
export function RiskBadge({ risk, className }: RiskBadgeProps) {
  if (risk === null) return null
  const { label, className: styles } = RISK_STYLES[risk]
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
