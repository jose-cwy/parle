import { useState } from 'react'

export function AdminBarChart({ rows = [], xKey = 'day', series = [], height = 200 }) {
  const [hover, setHover] = useState(null)
  const width = 640
  const pad = { l: 36, r: 12, t: 16, b: 28 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const max = Math.max(1, ...rows.flatMap((row) => series.map((s) => Number(row[s.key] || 0))))
  const barGroup = rows.length ? innerW / rows.length : innerW
  const barW = Math.max(4, (barGroup * 0.7) / Math.max(series.length, 1))

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="admin-chart" role="img">
        {rows.map((row, i) =>
          series.map((s, si) => {
            const value = Number(row[s.key] || 0)
            const h = (value / max) * innerH
            const x = pad.l + i * barGroup + si * barW + barGroup * 0.15
            const y = pad.t + innerH - h
            return (
              <rect
                key={`${i}-${s.key}`}
                x={x}
                y={y}
                width={barW}
                height={h}
                fill={s.color}
                rx="2"
                onMouseEnter={() => setHover({ i, label: row[xKey], value, series: s.label })}
                onMouseLeave={() => setHover(null)}
              />
            )
          }),
        )}
        {rows.map((row, i) =>
          i % Math.ceil(rows.length / 6) === 0 ? (
            <text key={row[xKey]} x={pad.l + i * barGroup + barGroup / 2} y={height - 8} fill="#9a9088" fontSize="10" textAnchor="middle">
              {String(row[xKey] || '').slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="flex gap-3 text-[11px] text-[#cfc4bb] mt-2">
        {series.map((s) => (
          <span key={s.key}>
            <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      {hover ? (
        <p className="text-[12px] text-[#f0c7c2] mt-1">
          {hover.label}: {hover.series} {hover.value}
        </p>
      ) : (
        <p className="text-[12px] text-[#8a8178] mt-1">Hover a bar for the exact count.</p>
      )}
    </div>
  )
}

export function AdminHBar({ rows = [], labelKey = 'mode_id', valueKey = 'n' }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)))
  const total = rows.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0)
  return (
    <div className="space-y-2">
      {rows.length === 0 ? <p className="admin-empty">No rows in this range.</p> : null}
      {rows.map((row) => {
        const n = Number(row[valueKey] || 0)
        const pct = total ? Math.round((n / total) * 1000) / 10 : 0
        return (
          <div key={row[labelKey]}>
            <div className="flex justify-between text-[12px] mb-1">
              <span>{row[labelKey]}</span>
              <span>
                {n} ({pct}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-black/30">
              <div className="h-2 rounded-full bg-[#c54b44]" style={{ width: `${(n / max) * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function formatPct(n, d) {
  if (!d) return 'n/a'
  return `${Math.round((n / d) * 1000) / 10}%`
}
