/** Small SVG charts for the analysis views: a gauge, a line over a filled area, and bars around zero. They
 *  take their colours from the theme's tokens, so they follow it. */

import { cn } from '@hermes/plugin-sdk'

const TONES = [
  'var(--ui-red)',
  'color-mix(in srgb, var(--ui-red) 55%, var(--ui-text-quaternary))',
  'var(--ui-text-quaternary)',
  'color-mix(in srgb, var(--ui-green) 55%, var(--ui-text-quaternary))',
  'var(--ui-green)'
]

const point = (radius: number, degrees: number) => {
  const a = (degrees * Math.PI) / 180

  return `${(100 + radius * Math.sin(a)).toFixed(2)} ${(100 - radius * Math.cos(a)).toFixed(2)}`
}

/** A half-circle gauge from strong sell to strong buy, its needle at `score` (−1 to 1). */
export function Gauge({ className, score, title }: { className?: string; score: number; title: string }) {
  const at = Math.max(-1, Math.min(1, score)) * 90

  return (
    <svg aria-label={title} className={cn('w-full', className)} role="img" viewBox="0 0 200 112">
      {TONES.map((tone, i) => (
        <path
          d={`M ${point(82, -90 + i * 36 + 1.5)} A 82 82 0 0 1 ${point(82, -90 + (i + 1) * 36 - 1.5)}`}
          fill="none"
          key={tone}
          stroke={tone}
          strokeWidth="12"
        />
      ))}
      <line
        stroke="var(--ui-text-primary)"
        strokeLinecap="round"
        strokeWidth="3"
        x1="100"
        x2={point(66, at).split(' ')[0]}
        y1="100"
        y2={point(66, at).split(' ')[1]}
      />
      <circle cx="100" cy="100" fill="var(--ui-text-primary)" r="6" />
    </svg>
  )
}

const scale = (values: number[]) => {
  const low = Math.min(...values)
  const high = Math.max(...values)

  return { high, low, span: high - low || 1 }
}

/** A line with its area filled under it. */
export function AreaLine({
  color,
  height = 120,
  label,
  values
}: {
  color: string
  height?: number
  label: string
  values: number[]
}) {
  if (values.length < 2) {
    return null
  }

  const { low, span } = scale(values)
  const x = (i: number) => (i / (values.length - 1)) * 300

  const y = (value: number) => height - 6 - ((value - low) / span) * (height - 12)

  const line = values.map((value, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(value).toFixed(1)}`).join(' ')

  return (
    <svg
      aria-label={label}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
      style={{ height }}
      viewBox={`0 0 300 ${height}`}
    >
      <path d={`${line} L 300 ${height} L 0 ${height} Z`} fill={color} opacity="0.14" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Bars up (green) or down (red) from a zero line. */
export function SignedBars({ height = 120, label, values }: { height?: number; label: string; values: number[] }) {
  if (!values.length) {
    return null
  }

  const peak = Math.max(...values.map(Math.abs)) || 1
  const mid = height / 2
  const width = 300 / values.length

  return (
    <svg
      aria-label={label}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
      style={{ height }}
      viewBox={`0 0 300 ${height}`}
    >
      <line stroke="var(--card-well-stroke)" x1="0" x2="300" y1={mid} y2={mid} />
      {values.map((value, i) => {
        const h = (Math.abs(value) / peak) * (mid - 4)

        return (
          <rect
            fill={value >= 0 ? 'var(--ui-green)' : 'var(--ui-red)'}
            height={Math.max(h, 0.5)}
            key={i}
            width={Math.max(width - 1, 1)}
            x={i * width}
            y={value >= 0 ? mid - h : mid}
          />
        )
      })}
    </svg>
  )
}
