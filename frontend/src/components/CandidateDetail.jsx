import { useState, useCallback, useEffect } from 'react'
import RadarChart from './RadarChart'

const METRIC_LABELS = {
    design_excellence: 'Design Excellence',
    ux_mastery: 'UX Mastery',
    industry_expertise: 'Industry Expertise',
    technical_sophistication: 'Technical Sophistication',
    innovation_creativity: 'Innovation & Creativity',
    specialization_alignment: 'Specialization Alignment',
    market_positioning: 'Market Positioning',
}

function ScoreRing({ value, max = 100, size = 72, label }) {
    const pct = Math.min(1, Math.max(0, value / max))
    const r = (size - 8) / 2
    const circumference = 2 * Math.PI * r

    return (
        <div className="score-ring">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="3"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="#c8a05a"
                    strokeWidth="3"
                    strokeDasharray={`${pct * circumference} ${circumference}`}
                    strokeDashoffset={circumference * 0.25}
                    strokeLinecap="round"
                    style={{
                        transition: 'stroke-dasharray 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        transform: 'rotate(-90deg)',
                        transformOrigin: '50% 50%',
                    }}
                />
                <text
                    x={size / 2}
                    y={size / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ fill: '#fff', fontSize: '18px', fontFamily: 'DM Mono, monospace' }}
                >
                    {value}
                </text>
            </svg>
            {label && <span className="score-ring-label">{label}</span>}
        </div>
    )
}

function StatCard({ label, value, maxVal = 5.0 }) {
    const pct = Math.min(1, Math.max(0, value / maxVal))

    return (
        <div className="stat-card">
            <div className="stat-card-header">
                <span className="stat-card-label">{label}</span>
                <span className="stat-card-value">{value.toFixed(1)}</span>
            </div>
            <div className="stat-card-bar-bg">
                <div
                    className="stat-card-bar"
                    style={{ width: `${pct * 100}%` }}
                />
            </div>
        </div>
    )
}

function ImageLightbox({ src, alt, onClose }) {
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    return (
        <div className="lightbox-overlay" onMouseLeave={onClose} onClick={onClose}>
            <img
                className="lightbox-image"
                src={src}
                alt={alt}
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    )
}

export default function CandidateDetail({ profile }) {
    const fa = profile.final_analysis || {}
    const rec = fa.recommendation || {}
    const metrics = fa.metrics || {}
    const works = profile.relevant_works || []
    const strengths = fa.strengths || []
    const improvements = fa.areas_for_improvement || []
    const feedback = fa.detailed_feedback || {}

    const [lightboxSrc, setLightboxSrc] = useState(null)

    const openLightbox = useCallback((src) => setLightboxSrc(src), [])
    const closeLightbox = useCallback(() => setLightboxSrc(null), [])

    const decisionColor =
        rec.decision === 'HIRE'
            ? '#4ade80'
            : rec.decision === 'REJECT'
                ? '#f87171'
                : '#fbbf24'

    return (
        <>
            {lightboxSrc && (
                <ImageLightbox src={lightboxSrc} alt="work preview" onClose={closeLightbox} />
            )}

            {/* ─── Top Row: Score Ring + Radar Chart ─── */}
            <div className="detail-top-row">
                <div className="detail-score-section">
                    <ScoreRing value={fa.overall_score || 0} label="overall score" />

                    <div className="detail-decision" style={{ borderColor: decisionColor }}>
                        <span className="decision-badge" style={{ color: decisionColor }}>
                            {rec.decision || '—'}
                        </span>
                        <span className="decision-conf">
                            {rec.confidence || '—'} confidence
                        </span>
                    </div>

                    {rec.suitable_roles && rec.suitable_roles.length > 0 && (
                        <div className="suitable-roles">
                            {rec.suitable_roles.map((role, i) => (
                                <span key={i} className="role-tag">{role}</span>
                            ))}
                        </div>
                    )}
                </div>

                <RadarChart metrics={metrics} />
            </div>

            {/* ─── Stat Cards Grid (numbers only) ─── */}
            <div className="detail-section-label">performance metrics</div>
            <div className="stat-cards-grid">
                {Object.entries(METRIC_LABELS).map(([key, label]) => {
                    const m = metrics[key] || {}
                    return (
                        <StatCard
                            key={key}
                            label={label}
                            value={m.rating || 0}
                        />
                    )
                })}
            </div>

            {/* ─── Recommendation ─── */}
            <div className="detail-section-label">recommendation</div>
            <p className="recommendation-reasoning">{rec.reasoning || ''}</p>

            {/* ─── Designer Intelligence ─── */}
            {feedback.what_stands_out && (
                <>
                    <div className="detail-section-label">designer intelligence</div>
                    <div className="intel-grid">
                        {feedback.what_stands_out && (
                            <div className="intel-card">
                                <span className="intel-icon">✦</span>
                                <div className="intel-label">stands out</div>
                                <div className="intel-text">{feedback.what_stands_out}</div>
                            </div>
                        )}
                        {feedback.biggest_concerns && (
                            <div className="intel-card">
                                <span className="intel-icon">⚠</span>
                                <div className="intel-label">concerns</div>
                                <div className="intel-text">{feedback.biggest_concerns}</div>
                            </div>
                        )}
                        {feedback.growth_potential && (
                            <div className="intel-card">
                                <span className="intel-icon">↗</span>
                                <div className="intel-label">growth potential</div>
                                <div className="intel-text">{feedback.growth_potential}</div>
                            </div>
                        )}
                        {feedback.industry_fit && (
                            <div className="intel-card">
                                <span className="intel-icon">◎</span>
                                <div className="intel-label">industry fit</div>
                                <div className="intel-text">{feedback.industry_fit}</div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ─── Work Samples with hover-to-expand ─── */}
            {works.length > 0 && (
                <>
                    <div className="detail-section-label">work samples</div>
                    <div className="works-strip">
                        {works.flatMap((w) =>
                            (w.images || []).map((img, i) => {
                                const localSrc = img.local_path
                                    ? `/images/${img.local_path.replace('scraped_images/', '')}`
                                    : null
                                const src = localSrc || img.original_url
                                return src ? (
                                    <img
                                        key={`${w.id}-${i}`}
                                        className="work-thumb"
                                        src={src}
                                        alt={w.title || 'work'}
                                        loading="lazy"
                                        onMouseEnter={() => openLightbox(src)}
                                        onError={(e) => {
                                            if (localSrc && img.original_url && e.target.src !== img.original_url) {
                                                e.target.src = img.original_url
                                            } else {
                                                e.target.style.display = 'none'
                                            }
                                        }}
                                    />
                                ) : null
                            })
                        )}
                    </div>
                </>
            )}

            {/* ─── Strengths ─── */}
            {strengths.length > 0 && (
                <>
                    <div className="detail-section-label">strengths</div>
                    <ul className="detail-bullets">
                        {strengths.map((s, i) => (
                            <li key={i}>{s}</li>
                        ))}
                    </ul>
                </>
            )}

            {/* ─── Areas for Improvement ─── */}
            {improvements.length > 0 && (
                <>
                    <div className="detail-section-label">areas for improvement</div>
                    <ul className="detail-bullets">
                        {improvements.map((s, i) => (
                            <li key={i}>{s}</li>
                        ))}
                    </ul>
                </>
            )}
        </>
    )
}
