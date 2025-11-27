import React from 'react'
import { Box, Typography } from '@mui/material'

// Small SVG pie chart with outside labels and leader lines.
// Props:
// - data: [{ name, value, color? }]
// - size: number (px) optional
// - innerRadius: number (for donut effect) optional
function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg - 90) * Math.PI / 180.0
  return { x: cx + (r * Math.cos(a)), y: cy + (r * Math.sin(a)) }
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  const d = [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    'Z'
  ].join(' ')
  return d
}

const MostSoldPie = ({ data = [], size = 320, innerRadius = 60, centerLabel = null }) => {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id) }, [])

  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1
  const cx = size / 2
  const cy = size / 2
  const r = Math.min(cx, cy) - 8

  let angle = 0

  const processed = data.map((d, i) => ({ ...d, color: d.color || `hsl(${(i * 60) % 360} 70% 55%)` }))

  const showLegend = size >= 220

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ maxWidth: size, width: '100%', display: 'flex', justifyContent: 'center', transition: 'transform 360ms ease', transform: mounted ? 'scale(1)' : 'scale(0.96)' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Most sold products">
          <defs>
            <filter id="ms-drop" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.08" />
            </filter>
            <radialGradient id="ms-grad" cx="50%" cy="45%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>
        {data.map((d, i) => {
          const value = Number(d.value) || 0
          const anglePercent = (value / total) * 360
          const start = angle
          const end = angle + anglePercent

          // If this slice covers (almost) the entire circle, render a simple circle element
          // because an SVG arc from point->point with same coordinates may not render as expected.
          const isFull = anglePercent >= 359.999 || Math.abs((value / total) - 1) < 1e-9

          if (isFull) {
            angle += anglePercent
            return (
              <g key={d.name} filter={"url(#ms-drop)"}>
                <circle cx={cx} cy={cy} r={r} fill={processed[i].color} stroke="#fff" strokeWidth="1" />
                <circle cx={cx} cy={cy} r={r} fill="url(#ms-grad)" style={{ mixBlendMode: 'overlay' }} />
              </g>
            )
          }

          const path = describeArc(cx, cy, r, start, end)
          const mid = start + (anglePercent / 2)
          const labelPos = polarToCartesian(cx, cy, r + 18, mid)
          const linePos = polarToCartesian(cx, cy, r - 6, mid)
          const pct = ((value / total) * 100)
          angle += anglePercent
          const textAnchor = (mid > 90 && mid < 270) ? 'end' : 'start'
          return (
            <g key={d.name} filter={"url(#ms-drop)"}>
              <path d={path} fill={processed[i].color} stroke="#fff" strokeWidth="1" />
              <path d={path} fill="url(#ms-grad)" style={{ mixBlendMode: 'overlay' }} />
              {/* leader line */}
              {showLegend ? (
                <>
                  <line x1={linePos.x} y1={linePos.y} x2={labelPos.x} y2={labelPos.y} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
                  {/* horizontal stub so labels don't overlap the line */}
                  <line x1={labelPos.x} y1={labelPos.y} x2={textAnchor === 'start' ? labelPos.x + 36 : labelPos.x - 36} y2={labelPos.y} stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
                  <text x={textAnchor === 'start' ? labelPos.x + 40 : labelPos.x - 40} y={labelPos.y + 4} fontSize="12" textAnchor={textAnchor} fill="#111" style={{ fontWeight: 700 }}>{d.name}</text>
                  <text x={textAnchor === 'start' ? labelPos.x + 40 : labelPos.x - 40} y={labelPos.y + 18} fontSize="11" textAnchor={textAnchor} fill="#6b7280">{`${Math.round(pct * 10) / 10}%`}</text>
                </>
              ) : null}
            </g>
          )
        })}

        {/* inner cutout to make it a donut */}
        <circle cx={cx} cy={cy} r={innerRadius} fill="#fff" />

        {/* center label if provided */}
        {centerLabel ? (
          <g>
            <text x={cx} y={cy - 6} fontSize={Math.max(12, size * 0.08)} textAnchor="middle" fill="#111" style={{ fontWeight: 700 }}>{centerLabel.title}</text>
            <text x={cx} y={cy + 14} fontSize={Math.max(10, size * 0.06)} textAnchor="middle" fill="#6b7280">{centerLabel.subtitle}</text>
          </g>
        ) : null}
        </svg>
      </Box>

      {/* Simple legend underneath to ensure visibility on all layouts */}
      {showLegend ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%', maxWidth: size, px: 1 }}>
          {processed.map((d) => (
            <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: 1, background: d.color }} />
              <Typography variant="caption" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</Typography>
              <Typography variant="caption" color="text.secondary">{d.value}</Typography>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  )
}

export default React.memo(MostSoldPie)
