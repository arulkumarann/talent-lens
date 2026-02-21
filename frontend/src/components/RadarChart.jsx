import { useState, useRef, useEffect } from 'react'

/**
 * Interactive SVG Radar / Spider Chart
 * Shows 7 metrics as a filled polygon on a web grid.
 * Hover reveals per-axis value tooltip.
 */

const CHART_SIZE = 280
const CENTER = CHART_SIZE / 2
const RADIUS = 110
const RINGS = 5
const LABEL_PAD = 22

const DEFAULT_AXES = [
    { key: 'design_excellence', label: 'Design' },
    { key: 'ux_mastery', label: 'UX' },
    { key: 'industry_expertise', label: 'Industry' },
    { key: 'technical_sophistication', label: 'Technical' },
    { key: 'innovation_creativity', label: 'Innovation' },
    { key: 'specialization_alignment', label: 'Alignment' },
    { key: 'market_positioning', label: 'Market' },
]

function polarToCart(angleDeg, r) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) }
}

export default function RadarChart({ metrics = {}, axes = DEFAULT_AXES }) {
    const [hovered, setHovered] = useState(null)
    const [animated, setAnimated] = useState(false)
    const svgRef = useRef(null)

    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 100)
        return () => clearTimeout(t)
    }, [])

    const angleStep = 360 / axes.length

    // Build data points
    const values = axes.map((a, i) => {
        const m = metrics[a.key] || {}
        const val = Math.max(0, Math.min(5, m.rating || 0))
        const angle = i * angleStep
        const pt = polarToCart(angle, (val / 5) * RADIUS)
        return { ...a, val, angle, pt, reasoning: m.reasoning || '' }
    })

    // Polygon points string
    const polyStr = animated
        ? values.map((v) => `${v.pt.x},${v.pt.y}`).join(' ')
        : values.map(() => `${CENTER},${CENTER}`).join(' ')

    return (
        <div className="radar-container">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
                width={CHART_SIZE}
                height={CHART_SIZE}
                className="radar-svg"
            >
                {/* Concentric ring grid */}
                {Array.from({ length: RINGS }, (_, i) => {
                    const r = ((i + 1) / RINGS) * RADIUS
                    const pts = axes
                        .map((_, j) => {
                            const p = polarToCart(j * angleStep, r)
                            return `${p.x},${p.y}`
                        })
                        .join(' ')
                    return (
                        <polygon
                            key={`ring-${i}`}
                            points={pts}
                            fill="none"
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth="1"
                        />
                    )
                })}

                {/* Axis lines */}
                {axes.map((_, i) => {
                    const end = polarToCart(i * angleStep, RADIUS)
                    return (
                        <line
                            key={`axis-${i}`}
                            x1={CENTER}
                            y1={CENTER}
                            x2={end.x}
                            y2={end.y}
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="1"
                        />
                    )
                })}

                {/* Data polygon */}
                <polygon
                    points={polyStr}
                    fill="rgba(200, 160, 90, 0.15)"
                    stroke="rgba(200, 160, 90, 0.7)"
                    strokeWidth="1.5"
                    style={{ transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                />

                {/* Data dots + hit areas */}
                {values.map((v, i) => {
                    const isHov = hovered === i
                    const dotPt = animated ? v.pt : { x: CENTER, y: CENTER }
                    return (
                        <g key={`dot-${i}`}>
                            {/* Invisible larger hit area */}
                            <circle
                                cx={dotPt.x}
                                cy={dotPt.y}
                                r={14}
                                fill="transparent"
                                onMouseEnter={() => setHovered(i)}
                                onMouseLeave={() => setHovered(null)}
                                style={{ cursor: 'pointer' }}
                            />
                            <circle
                                cx={dotPt.x}
                                cy={dotPt.y}
                                r={isHov ? 5 : 3}
                                fill={isHov ? '#c8a05a' : 'rgba(200,160,90,0.9)'}
                                style={{
                                    transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                    filter: isHov ? 'drop-shadow(0 0 6px rgba(200,160,90,0.6))' : 'none',
                                }}
                            />
                        </g>
                    )
                })}

                {/* Axis labels */}
                {values.map((v, i) => {
                    const labelPt = polarToCart(i * angleStep, RADIUS + LABEL_PAD)
                    const isHov = hovered === i
                    return (
                        <text
                            key={`label-${i}`}
                            x={labelPt.x}
                            y={labelPt.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="radar-label"
                            style={{
                                fill: isHov ? '#c8a05a' : 'rgba(255,255,255,0.4)',
                                fontSize: isHov ? '10px' : '9px',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {v.label}
                        </text>
                    )
                })}
            </svg>

            {/* Tooltip */}
            {hovered !== null && (
                <div className="radar-tooltip">
                    <div className="radar-tooltip-label">{values[hovered].label}</div>
                    <div className="radar-tooltip-value">{values[hovered].val.toFixed(1)}<span>/5.0</span></div>
                    {values[hovered].reasoning && (
                        <div className="radar-tooltip-reason">{values[hovered].reasoning}</div>
                    )}
                </div>
            )}
        </div>
    )
}
