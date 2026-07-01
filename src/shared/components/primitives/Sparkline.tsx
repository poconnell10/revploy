export interface SparklineProps {
  data: number[]
  /** Stroke color — a CSS color or `var(--color-*)` token reference. */
  color: string
  width?: number
  height?: number
}

/** Minimal SVG trend line — no axes, no dots. */
export function Sparkline({
  data,
  color,
  width = 60,
  height = 20,
}: SparklineProps) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2

  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - pad - ((value - min) / range) * (height - pad * 2)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: 'visible', flexShrink: 0 }}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
