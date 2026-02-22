import { useState, useMemo, useEffect, useRef } from 'react'

const GOLD = '#c8a05a'
const GOLD_LIGHT = '#e8c97a'
const GOLD_DIM = 'rgba(200, 160, 90, 0.35)'

const DEV_METRIC_LABELS = {
    technical_depth: 'Technical Depth',
    project_quality: 'Project Quality',
    experience_relevance: 'Experience Relevance',
    github_activity: 'GitHub Activity',
    skill_match: 'Skill Match',
    overall_fit: 'Overall Fit',
}

/* ── Animated number counter ── */
function AnimatedNumber({ value, duration = 1200 }) {
    const [display, setDisplay] = useState(0)
    const ref = useRef(null)

    useEffect(() => {
        const startTime = performance.now()
        function tick(now) {
            const elapsed = now - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplay(Math.round(eased * value))
            if (progress < 1) ref.current = requestAnimationFrame(tick)
        }
        ref.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(ref.current)
    }, [value, duration])

    return <span>{display}</span>
}

/* ── Summary stat cards ── */
function SummaryCards({ total, analyzed, pending, hired, consider, rejected, avgScore, topScorer }) {
    const cards = [
        { label: 'total candidates', value: total, color: GOLD },
        { label: 'analyzed', value: analyzed, color: GOLD },
        { label: 'pending', value: pending, color: 'rgba(200, 160, 90, 0.5)' },
        { label: 'hired', value: hired, color: GOLD_LIGHT },
        { label: 'consider', value: consider, color: GOLD },
        { label: 'rejected', value: rejected, color: 'rgba(200, 160, 90, 0.4)' },
    ]

    return (
        <div className="dev-stats-summary-row">
            {cards.map((c) => (
                <div className="dev-stats-summary-card" key={c.label}>
                    <div className="dev-stats-card-value" style={{ color: c.color }}>
                        <AnimatedNumber value={c.value} />
                    </div>
                    <div className="dev-stats-card-label">{c.label}</div>
                </div>
            ))}
            <div className="dev-stats-summary-card">
                <div className="dev-stats-card-value" style={{ color: GOLD_LIGHT }}>
                    <AnimatedNumber value={Math.round(avgScore)} />
                </div>
                <div className="dev-stats-card-label">avg score</div>
            </div>
            {topScorer && (
                <div className="dev-stats-summary-card dev-stats-card-highlight">
                    <div className="dev-stats-card-value" style={{ color: GOLD_LIGHT }}>
                        {topScorer.score}
                    </div>
                    <div className="dev-stats-card-label">top: {topScorer.name}</div>
                </div>
            )}
        </div>
    )
}

/* ── Score distribution horizontal bars ── */
function ScoreDistribution({ buckets }) {
    const maxCount = Math.max(...buckets.map((b) => b.count), 1)
    const total = buckets.reduce((s, b) => s + b.count, 0) || 1
    const [hovered, setHovered] = useState(null)

    return (
        <div className="dev-stats-chart-card">
            <div className="dev-stats-chart-title">score distribution</div>
            <div className="dev-score-dist-bars">
                {buckets.map((b, i) => {
                    const opacity = 0.4 + (0.6 * (buckets.length - i) / buckets.length)
                    const isHovered = hovered === i
                    return (
                        <div
                            className={`dev-score-dist-row ${isHovered ? 'hovered' : ''}`}
                            key={b.label}
                            onMouseEnter={() => setHovered(i)}
                            onMouseLeave={() => setHovered(null)}
                        >
                            <span className="dev-score-dist-label">{b.label}</span>
                            <div className="dev-score-dist-track">
                                <div
                                    className="dev-score-dist-fill"
                                    style={{
                                        width: `${(b.count / maxCount) * 100}%`,
                                        background: `linear-gradient(90deg, rgba(200,160,90,${opacity}), rgba(232,201,122,${opacity}))`,
                                        animationDelay: `${b.delay}ms`,
                                    }}
                                />
                            </div>
                            <span className="dev-score-dist-count">
                                {b.count} ({Math.round((b.count / total) * 100)}%)
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ── Status breakdown donut chart ── */
function StatusDonut({ hired, consider, rejected }) {
    const total = hired + consider + rejected || 1
    const slices = [
        { label: 'hired', value: hired, color: GOLD_LIGHT },
        { label: 'consider', value: consider, color: GOLD },
        { label: 'rejected', value: rejected, color: GOLD_DIM },
    ]

    const r = 60
    const cx = 80
    const cy = 80
    const circumference = 2 * Math.PI * r
    let offset = 0
    const [hoveredSlice, setHoveredSlice] = useState(null)

    return (
        <div className="dev-stats-chart-card">
            <div className="dev-stats-chart-title">status breakdown</div>
            <div className="dev-donut-container">
                <svg width="160" height="160" viewBox="0 0 160 160">
                    {slices.map((slice) => {
                        const pct = slice.value / total
                        const dashLen = pct * circumference
                        const currentOffset = offset
                        offset += dashLen
                        const isHovered = hoveredSlice === slice.label
                        return (
                            <circle
                                key={slice.label}
                                cx={cx}
                                cy={cy}
                                r={r}
                                fill="none"
                                stroke={slice.color}
                                strokeWidth={isHovered ? 22 : 18}
                                strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                                strokeDashoffset={-currentOffset}
                                className="dev-donut-segment"
                                style={{
                                    transform: 'rotate(-90deg)',
                                    transformOrigin: '50% 50%',
                                    transition: 'stroke-width 0.2s ease',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={() => setHoveredSlice(slice.label)}
                                onMouseLeave={() => setHoveredSlice(null)}
                            />
                        )
                    })}
                    <text x={cx} y={cy - 6} textAnchor="middle" className="dev-donut-total-value">
                        {total}
                    </text>
                    <text x={cx} y={cy + 12} textAnchor="middle" className="dev-donut-total-label">
                        total
                    </text>
                </svg>
                <div className="dev-donut-legend">
                    {slices.map((s) => (
                        <div
                            className={`dev-donut-legend-item ${hoveredSlice === s.label ? 'hovered' : ''}`}
                            key={s.label}
                            onMouseEnter={() => setHoveredSlice(s.label)}
                            onMouseLeave={() => setHoveredSlice(null)}
                        >
                            <span className="dev-donut-legend-dot" style={{ backgroundColor: s.color }} />
                            <span className="dev-donut-legend-text">{s.label}</span>
                            <span className="dev-donut-legend-value">{s.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

/* ── Average metric bars ── */
function MetricBars({ metricAverages }) {
    const maxVal = 5.0
    const [hoveredIdx, setHoveredIdx] = useState(null)

    return (
        <div className="dev-stats-chart-card">
            <div className="dev-stats-chart-title">average metrics across all candidates</div>
            <div className="dev-metric-bars-container">
                {Object.entries(DEV_METRIC_LABELS).map(([key, label], idx) => {
                    const val = metricAverages[key] || 0
                    const pct = (val / maxVal) * 100
                    const isHovered = hoveredIdx === idx
                    return (
                        <div
                            className={`dev-metric-bar-row ${isHovered ? 'hovered' : ''}`}
                            key={key}
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onMouseLeave={() => setHoveredIdx(null)}
                        >
                            <span className="dev-metric-bar-label">{label}</span>
                            <div className="dev-metric-bar-track-stat">
                                <div
                                    className="dev-metric-bar-fill-stat"
                                    style={{
                                        width: `${pct}%`,
                                        animationDelay: `${idx * 80}ms`,
                                    }}
                                />
                            </div>
                            <span className="dev-metric-bar-value-stat">{val.toFixed(1)}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ── Assessment Pipeline Breakdown ── */
function AssessmentPipelineChart({ assessmentCounts }) {
    const stages = [
        { key: 'assessment_sent', label: 'Assessment Sent', color: GOLD_LIGHT },
        { key: 'in_review', label: 'In Review', color: GOLD },
        { key: 'failed', label: 'Failed', color: GOLD_DIM },
    ]
    const maxCount = Math.max(...stages.map(s => assessmentCounts[s.key] || 0), 1)
    const [hovered, setHovered] = useState(null)

    return (
        <div className="dev-stats-chart-card">
            <div className="dev-stats-chart-title">assessment pipeline</div>
            <div className="dev-assessment-pipeline-bars">
                {stages.map((stage) => {
                    const count = assessmentCounts[stage.key] || 0
                    const pct = (count / maxCount) * 100
                    const isHovered = hovered === stage.key
                    return (
                        <div
                            className={`dev-pipeline-bar-row ${isHovered ? 'hovered' : ''}`}
                            key={stage.key}
                            onMouseEnter={() => setHovered(stage.key)}
                            onMouseLeave={() => setHovered(null)}
                        >
                            <span className="dev-pipeline-bar-label">{stage.label}</span>
                            <div className="dev-pipeline-bar-track">
                                <div
                                    className="dev-pipeline-bar-fill"
                                    style={{
                                        width: `${pct}%`,
                                        background: isHovered ? stage.color : `${stage.color}aa`,
                                        transition: 'all 0.3s ease',
                                    }}
                                />
                            </div>
                            <span className="dev-pipeline-bar-count">{count}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ── Role Comparison ── */
function RoleComparison({ roles }) {
    if (!roles || roles.length <= 1) return null

    const maxCandidates = Math.max(...roles.map(r => r.total_candidates || 0), 1)
    const [hovered, setHovered] = useState(null)

    return (
        <div className="dev-stats-chart-card">
            <div className="dev-stats-chart-title">role comparison</div>
            <div className="dev-metric-bars-container">
                {roles.map((r, idx) => {
                    const pct = ((r.total_candidates || 0) / maxCandidates) * 100
                    const isHovered = hovered === idx
                    return (
                        <div
                            className={`dev-metric-bar-row ${isHovered ? 'hovered' : ''}`}
                            key={r.id}
                            onMouseEnter={() => setHovered(idx)}
                            onMouseLeave={() => setHovered(null)}
                        >
                            <span className="dev-metric-bar-label">{r.name}</span>
                            <div className="dev-metric-bar-track-stat">
                                <div
                                    className="dev-metric-bar-fill-stat"
                                    style={{
                                        width: `${pct}%`,
                                        animationDelay: `${idx * 80}ms`,
                                        opacity: isHovered ? 1 : 0.7,
                                    }}
                                />
                            </div>
                            <span className="dev-metric-bar-value-stat">
                                {r.total_candidates || 0}
                                {r.selected_count > 0 && (
                                    <small style={{ color: GOLD_DIM, marginLeft: 4 }}>
                                        ({r.selected_count} hired)
                                    </small>
                                )}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ── Main Dashboard ── */
export default function DevStatsDashboard({ role, allRoles }) {
    const stats = useMemo(() => {
        const cands = role?.candidates ? Object.values(role.candidates) : []
        // If candidates is already an array (from parent component), use it directly
        const candidates = Array.isArray(cands) && cands.length > 0 && typeof cands[0] === 'object'
            ? cands
            : (role?.candidates || [])

        const total = Array.isArray(candidates) ? candidates.length : 0
        if (total === 0) return null

        let analyzed = 0, pending = 0
        let hired = 0, consider = 0, rejected = 0
        let scoreSum = 0, scoredCount = 0
        let topScorer = null
        const metricSums = {}
        let metricCount = 0
        const assessmentCounts = { assessment_sent: 0, in_review: 0, failed: 0 }

        const scoreBuckets = [
            { label: '85-100', min: 85, max: 100, count: 0, delay: 0 },
            { label: '60-84', min: 60, max: 84, count: 0, delay: 100 },
            { label: '40-59', min: 40, max: 59, count: 0, delay: 200 },
            { label: '0-39', min: 0, max: 39, count: 0, delay: 300 },
        ]

        candidates.forEach((c) => {
            // Count evaluation status
            if (c.evaluation) {
                analyzed++
                const score = c.evaluation.overall_score || 0
                scoreSum += score
                scoredCount++

                if (!topScorer || score > topScorer.score) {
                    topScorer = { name: c.name || 'Unknown', score }
                }

                scoreBuckets.forEach((b) => {
                    if (score >= b.min && score <= b.max) b.count++
                })

                const metrics = c.evaluation.metrics || {}
                Object.keys(DEV_METRIC_LABELS).forEach((key) => {
                    const rating = metrics[key]?.rating || 0
                    if (rating > 0) {
                        metricSums[key] = (metricSums[key] || 0) + rating
                    }
                })
                if (Object.keys(metrics).length > 0) metricCount++
            } else {
                pending++
            }

            // Count hiring statuses
            const status = c.status || 'waitlisted'
            if (status === 'selected') hired++
            else if (status === 'rejected') rejected++
            else consider++

            // Count assessment stages
            const aStage = c.assessment_status || 'assessment_sent'
            if (assessmentCounts[aStage] !== undefined) {
                assessmentCounts[aStage]++
            }
        })

        const metricAverages = {}
        Object.keys(DEV_METRIC_LABELS).forEach((key) => {
            metricAverages[key] = metricCount > 0 ? (metricSums[key] || 0) / metricCount : 0
        })

        return {
            total,
            analyzed,
            pending,
            hired,
            consider,
            rejected,
            avgScore: scoredCount > 0 ? scoreSum / scoredCount : 0,
            topScorer,
            scoreBuckets,
            metricAverages,
            assessmentCounts,
        }
    }, [role])

    if (!stats) {
        return (
            <div className="dev-stats-empty">
                <p>No candidate data available for statistics.</p>
                <span>Select a role with candidates to view stats.</span>
            </div>
        )
    }

    return (
        <div className="dev-stats-dashboard">
            <h1 className="dev-stats-heading">
                statistics <em>overview.</em>
            </h1>

            <SummaryCards
                total={stats.total}
                analyzed={stats.analyzed}
                pending={stats.pending}
                hired={stats.hired}
                consider={stats.consider}
                rejected={stats.rejected}
                avgScore={stats.avgScore}
                topScorer={stats.topScorer}
            />

            <div className="dev-stats-charts-row">
                <ScoreDistribution buckets={stats.scoreBuckets} />
                <StatusDonut
                    hired={stats.hired}
                    consider={stats.consider}
                    rejected={stats.rejected}
                />
            </div>

            <MetricBars metricAverages={stats.metricAverages} />

            <AssessmentPipelineChart assessmentCounts={stats.assessmentCounts} />

            <RoleComparison roles={allRoles || []} />
        </div>
    )
}
