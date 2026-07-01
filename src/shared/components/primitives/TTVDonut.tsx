export interface TTVDonutProps {
  score: number | null
  size?: 48 | 72
  label?: string
}

const STROKE_WIDTH = 4

/** CSS variable reference for a score's semantic stroke color. */
function strokeColor(score: number | null): string {
  if (score === null) return 'var(--color-gray-100)'
  if (score >= 85) return 'var(--color-success)'
  if (score >= 50) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

/**
 * SVG donut chart for a TTV score. Draws a gray track with a colored progress
 * arc and the score (or "N/A") in the center. At size 72 an optional label is
 * shown beneath.
 */
export function TTVDonut({ score, size = 48, label }: TTVDonutProps) {
  const radius = size / 2 - STROKE_WIDTH
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  const isNa = score === null
  const pct = isNa ? 100 : Math.max(0, Math.min(100, score))
  const dash = (pct / 100) * circumference

  const color = strokeColor(score)
  const centerText = isNa ? 'N/A' : `${Math.round(score)}%`
  const valueFontSize = size === 72 ? 15 : 11
  const naFontSize = size === 72 ? 13 : 10

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: 'rotate(-90deg)' }}
          aria-hidden="true"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-gray-50)"
            strokeWidth={STROKE_WIDTH}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-mono font-bold leading-none"
          style={{
            fontSize: isNa ? naFontSize : valueFontSize,
            color: isNa ? 'var(--color-muted)' : color,
          }}
        >
          {centerText}
        </span>
      </div>
      {size === 72 && label && (
        <span className="text-[10px] text-muted">{label}</span>
      )}
    </div>
  )
}
