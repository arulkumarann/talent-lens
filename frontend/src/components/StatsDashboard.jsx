import { useState, useMemo, useEffect, useRef } from 'react'

// Single gold palette — subtle tones from the user's reference bar chart
const GOLD = '#c8a05a'
const GOLD_LIGHT = '#e8c97a'
const GOLD_DIM = 'rgba(200, 160, 90, 0.35)'
const GOLD_BG = 'rgba(200, 160, 90, 0.08)'

const METRIC_LABELS = {
    design_excellence: 'Design Excellence',
    ux_mastery: 'UX Mastery',
    industry_expertise: 'Industry Expertise',
    technical_sophistication: 'Technical Sophistication',
    innovation_creativity: 'Innovation & Creativity',
    specialization_alignment: 'Specialization Align.',
    market_positioning: 'Market Positioning',
}

function AnimatedNumber({ value, duration = 1200 }) {
    const [display, setDisplay] = useState(0)
    const ref = useRef(null)

    useEffect(() => {
        let start = 0
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

function SummaryCards({ total, selected, waitlisted, rejected, avgScore, topScorer }) {
    const cards = [
        { label: 'total designers', value: total },
        { label: 'selected', value: selected },
        { label: 'waitlisted', value: waitlisted },
        { label: 'rejected', value: rejected },
    ]

    return (
        <div className="stats-summary-row">
            {cards.map((c) => (
                <div className="stats-summary-card" key={c.label}>
                    <div className="stats-card-value" style={{ color: GOLD }}>
                        <AnimatedNumber value={c.value} />
                    </div>
                    <div className="stats-card-label">{c.label}</div>
                </div>
            ))}
            <div className="stats-summary-card">
                <div className="stats-card-value" style={{ color: GOLD_LIGHT }}>
                    <AnimatedNumber value={Math.round(avgScore)} />
                </div>
                <div className="stats-card-label">avg score</div>
            </div>
            {topScorer && (
                <div className="stats-summary-card stats-card-highlight">
                    <div className="stats-card-value" style={{ color: GOLD_LIGHT }}>
                        {topScorer.score}
                    </div>
                    <div className="stats-card-label">top: {topScorer.name}</div>
                </div>
            )}
        </div>
    )
}

function ScoreDistribution({ buckets }) {
    const maxCount = Math.max(...buckets.map((b) => b.count), 1)
    const total = buckets.reduce((s, b) => s + b.count, 0) || 1

    return (
        <div className="stats-chart-card">
            <div className="stats-chart-title">score distribution</div>
            <div className="score-dist-bars">
                {buckets.map((b, i) => {
                    // Gold gradient — darker for lower buckets, brighter for higher
                    const opacity = 0.4 + (0.6 * (buckets.length - i) / buckets.length)
                    return (
                        <div className="score-dist-row" key={b.label}>
                            <span className="score-dist-label">{b.label}</span>
                            <div className="score-dist-track">
                                <div
                                    className="score-dist-fill"
                                    style={{
                                        width: `${(b.count / maxCount) * 100}%`,
                                        background: `linear-gradient(90deg, rgba(200,160,90,${opacity}), rgba(232,201,122,${opacity}))`,
                                        animationDelay: `${b.delay}ms`,
                                    }}
                                />
                            </div>
                            <span className="score-dist-count">
                                {b.count} ({Math.round((b.count / total) * 100)}%)
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function StatusDonut({ selected, waitlisted, rejected }) {
    const total = selected + waitlisted + rejected || 1
    // All gold tones instead of green/amber/red
    const slices = [
        { label: 'selected', value: selected, color: GOLD_LIGHT },
        { label: 'waitlisted', value: waitlisted, color: GOLD },
        { label: 'rejected', value: rejected, color: GOLD_DIM },
    ]

    const r = 60
    const cx = 80
    const cy = 80
    const circumference = 2 * Math.PI * r
    let offset = 0

    return (
        <div className="stats-chart-card">
            <div className="stats-chart-title">status breakdown</div>
            <div className="donut-container">
                <svg width="160" height="160" viewBox="0 0 160 160">
                    {slices.map((slice) => {
                        const pct = slice.value / total
                        const dashLen = pct * circumference
                        const currentOffset = offset
                        offset += dashLen
                        return (
                            <circle
                                key={slice.label}
                                cx={cx}
                                cy={cy}
                                r={r}
                                fill="none"
                                stroke={slice.color}
                                strokeWidth="18"
                                strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                                strokeDashoffset={-currentOffset}
                                className="donut-segment"
                                style={{
                                    transform: 'rotate(-90deg)',
                                    transformOrigin: '50% 50%',
                                }}
                            />
                        )
                    })}
                    <text x={cx} y={cy - 6} textAnchor="middle" className="donut-total-value">
                        {total}
                    </text>
                    <text x={cx} y={cy + 12} textAnchor="middle" className="donut-total-label">
                        total
                    </text>
                </svg>
                <div className="donut-legend">
                    {slices.map((s) => (
                        <div className="donut-legend-item" key={s.label}>
                            <span className="donut-legend-dot" style={{ backgroundColor: s.color }} />
                            <span className="donut-legend-text">{s.label}</span>
                            <span className="donut-legend-value">{s.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function MetricBars({ metricAverages }) {
    const maxVal = 5.0

    return (
        <div className="stats-chart-card">
            <div className="stats-chart-title">average metrics across all designers</div>
            <div className="metric-bars-container">
                {Object.entries(METRIC_LABELS).map(([key, label], idx) => {
                    const val = metricAverages[key] || 0
                    const pct = (val / maxVal) * 100
                    return (
                        <div className="metric-bar-row" key={key}>
                            <span className="metric-bar-label">{label}</span>
                            <div className="metric-bar-track">
                                <div
                                    className="metric-bar-fill"
                                    style={{
                                        width: `${pct}%`,
                                        animationDelay: `${idx * 80}ms`,
                                    }}
                                />
                            </div>
                            <span className="metric-bar-value">{val.toFixed(1)}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function KeywordComparison({ allKeywords, activeKeyword }) {
    if (!allKeywords || allKeywords.length <= 1) return null

    const maxProfiles = Math.max(...allKeywords.map((k) => k.total_profiles), 1)

    return (
        <div className="stats-chart-card">
            <div className="stats-chart-title">keyword comparison</div>
            <div className="metric-bars-container">
                {allKeywords.map((kw, idx) => {
                    const pct = (kw.total_profiles / maxProfiles) * 100
                    const isActive = kw.keyword === activeKeyword
                    return (
                        <div className="metric-bar-row" key={kw.keyword}>
                            <span className={`metric-bar-label ${isActive ? 'metric-bar-label-active' : ''}`}>
                                {kw.keyword}
                            </span>
                            <div className="metric-bar-track">
                                <div
                                    className="metric-bar-fill"
                                    style={{
                                        width: `${pct}%`,
                                        animationDelay: `${idx * 80}ms`,
                                        opacity: isActive ? 1 : 0.5,
                                    }}
                                />
                            </div>
                            <span className="metric-bar-value">
                                {kw.total_profiles}
                                {kw.selected > 0 && <small style={{ color: GOLD_DIM, marginLeft: 4 }}>({kw.selected} ✓)</small>}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default function StatsDashboard({ profiles, statuses, allKeywords, activeKeyword }) {
    const stats = useMemo(() => {
        const total = profiles.length
        let selected = 0, waitlisted = 0, rejected = 0
        let scoreSum = 0
        let topScorer = null
        const metricSums = {}
        let metricCount = 0

        const scoreBuckets = [
            { label: '85-100', min: 85, max: 100, count: 0, delay: 0 },
            { label: '60-84', min: 60, max: 84, count: 0, delay: 100 },
            { label: '40-59', min: 40, max: 59, count: 0, delay: 200 },
            { label: '0-39', min: 0, max: 39, count: 0, delay: 300 },
        ]

        profiles.forEach((p) => {
            const od = p.original_data || {}
            const fa = p.final_analysis || {}
            const username = od.username || ''
            const score = fa.overall_score || 0
            const status = statuses[username] || 'waitlisted'

            if (status === 'selected') selected++
            else if (status === 'rejected') rejected++
            else waitlisted++

            scoreSum += score

            if (!topScorer || score > topScorer.score) {
                topScorer = { name: od.name || username, score }
            }

            scoreBuckets.forEach((b) => {
                if (score >= b.min && score <= b.max) b.count++
            })

            const metrics = fa.metrics || {}
            Object.keys(METRIC_LABELS).forEach((key) => {
                const rating = metrics[key]?.rating || 0
                if (rating > 0) {
                    metricSums[key] = (metricSums[key] || 0) + rating
                }
            })
            if (Object.keys(metrics).length > 0) metricCount++
        })

        const metricAverages = {}
        Object.keys(METRIC_LABELS).forEach((key) => {
            metricAverages[key] = metricCount > 0 ? (metricSums[key] || 0) / metricCount : 0
        })

        return {
            total,
            selected,
            waitlisted,
            rejected,
            avgScore: total > 0 ? scoreSum / total : 0,
            topScorer,
            scoreBuckets,
            metricAverages,
        }
    }, [profiles, statuses])

    if (profiles.length === 0) return null

    return (
        <div className="stats-dashboard">
            <SummaryCards
                total={stats.total}
                selected={stats.selected}
                waitlisted={stats.waitlisted}
                rejected={stats.rejected}
                avgScore={stats.avgScore}
                topScorer={stats.topScorer}
            />
            <div className="stats-charts-row">
                <ScoreDistribution buckets={stats.scoreBuckets} />
                <StatusDonut
                    selected={stats.selected}
                    waitlisted={stats.waitlisted}
                    rejected={stats.rejected}
                />
            </div>
            <MetricBars metricAverages={stats.metricAverages} />
            <KeywordComparison allKeywords={allKeywords} activeKeyword={activeKeyword} />
        </div>
    )
}
