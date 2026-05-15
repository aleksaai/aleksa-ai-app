// Hand-rolled SVG line chart with optional comparison series.
// Smooth via Catmull-Rom-to-Bezier interpolation.

import { useMemo } from 'react'

type Series = {
  data: number[]
  color: string
  label?: string
}

export function MiniLineChart({
  current,
  previous,
  labels,
  formatY,
  height = 220,
  currentColor = 'var(--accent-500)',
  previousColor = '#fb923c',
}: {
  current: number[]
  previous?: number[]
  labels: string[]
  formatY?: (v: number) => string
  height?: number
  currentColor?: string
  previousColor?: string
}) {
  const W = 1000 // viewBox width
  const H = height
  const padTop = 24
  const padBottom = 28
  const padLeft = 56
  const padRight = 16
  const plotW = W - padLeft - padRight
  const plotH = H - padTop - padBottom

  const series: Series[] = useMemo(() => {
    const list: Series[] = [{ data: current, color: currentColor, label: 'Neueste' }]
    if (previous) list.unshift({ data: previous, color: previousColor, label: 'Vorherige' })
    return list
  }, [current, previous, currentColor, previousColor])

  const maxY = useMemo(() => {
    const allValues = series.flatMap((s) => s.data)
    const peak = Math.max(0, ...allValues)
    if (peak === 0) return 4
    // round up to nice number
    const mag = Math.pow(10, Math.floor(Math.log10(peak)))
    const norm = peak / mag
    const niceTop = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
    return niceTop * mag
  }, [series])

  const yTicks = useMemo(() => {
    return [0, 0.25, 0.5, 0.75, 1].map((p) => maxY * p)
  }, [maxY])

  const xFor = (i: number, count: number) =>
    padLeft + (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW)
  const yFor = (v: number) => padTop + plotH - (v / maxY) * plotH

  const pathFor = (data: number[]) => {
    if (data.length === 0) return ''
    if (data.length === 1) {
      const x = xFor(0, 1)
      const y = yFor(data[0])
      return `M ${x},${y}`
    }
    const pts = data.map((v, i) => ({ x: xFor(i, data.length), y: yFor(v) }))
    // Catmull-Rom -> Bezier
    let d = `M ${pts[0].x},${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[i + 2] ?? pts[i + 1]
      const tension = 0.5
      const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension
      const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension
      const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension
      const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
    }
    return d
  }

  const areaPathFor = (data: number[]) => {
    const linePath = pathFor(data)
    if (!linePath) return ''
    const lastX = xFor(data.length - 1, data.length)
    const firstX = xFor(0, data.length)
    const baselineY = padTop + plotH
    return `${linePath} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`
  }

  const gradId = useMemo(() => `g-${Math.random().toString(36).slice(2, 8)}`, [])

  return (
    <div className="w-full">
      {/* Legend */}
      {(previous || series.length > 1) && (
        <div className="mb-3 flex items-center justify-end gap-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: currentColor }} />
            Neueste
          </span>
          {previous && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: previousColor }} />
              Vorherige
            </span>
          )}
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${gradId}-current`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={currentColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={currentColor} stopOpacity="0" />
          </linearGradient>
          {previous && (
            <linearGradient id={`${gradId}-previous`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={previousColor} stopOpacity="0.12" />
              <stop offset="100%" stopColor={previousColor} stopOpacity="0" />
            </linearGradient>
          )}
        </defs>

        {/* Y grid + labels */}
        {yTicks.map((tv, i) => {
          const y = yFor(tv)
          return (
            <g key={i}>
              <line
                x1={padLeft}
                x2={W - padRight}
                y1={y}
                y2={y}
                stroke="rgba(0,0,0,0.05)"
                strokeDasharray="3 5"
              />
              <text
                x={padLeft - 8}
                y={y}
                fontSize="11"
                fill="#a7a3b5"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatY ? formatY(tv) : tv.toFixed(0)}
              </text>
            </g>
          )
        })}

        {/* Previous series (drawn first, behind) */}
        {previous && (
          <>
            <path d={areaPathFor(previous)} fill={`url(#${gradId}-previous)`} />
            <path
              d={pathFor(previous)}
              fill="none"
              stroke={previousColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
            />
          </>
        )}

        {/* Current series */}
        <path d={areaPathFor(current)} fill={`url(#${gradId}-current)`} />
        <path
          d={pathFor(current)}
          fill="none"
          stroke={currentColor}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X labels */}
        {labels.map((label, i) => {
          if (labels.length > 7 && i % 2 !== 0 && i !== labels.length - 1) return null
          const x = xFor(i, labels.length)
          return (
            <text
              key={i}
              x={x}
              y={H - 8}
              fontSize="11"
              fill="#a7a3b5"
              textAnchor="middle"
            >
              {label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
