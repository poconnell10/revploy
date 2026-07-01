import { cn } from '@/shared/lib/utils'

export interface TTVBadgeProps {
  score: number | null
  size?: 'sm' | 'md'
  className?: string
}

/** Tailwind classes for a TTV score's semantic tier. */
function tierClasses(score: number | null): string {
  if (score === null) return 'bg-gray-50 text-muted'
  if (score >= 85) return 'bg-success-subtle text-success'
  if (score >= 50) return 'bg-warning-subtle text-warning'
  return 'bg-danger-subtle text-danger'
}

const SIZE_CLASSES: Record<NonNullable<TTVBadgeProps['size']>, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-[11.5px]',
}

/** Time-to-value score as a mono pill badge. Shows "N/A" when null. */
export function TTVBadge({ score, size = 'md', className }: TTVBadgeProps) {
  const label = score === null ? 'N/A' : `${Math.round(score)}%`
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-[20px] font-mono font-semibold',
        SIZE_CLASSES[size],
        tierClasses(score),
        className,
      )}
    >
      {label}
    </span>
  )
}
