const METRIC_LABELS = {
    design_excellence: 'design excellence',
    ux_mastery: 'ux mastery',
    industry_expertise: 'industry expertise',
    technical_sophistication: 'technical sophistication',
    innovation_creativity: 'innovation & creativity',
    specialization_alignment: 'specialization alignment',
    market_positioning: 'market positioning',
}

const DOTS = '.'.repeat(50)

function extractDomain(url) {
    try {
        const hostname = new URL(url).hostname.replace('www.', '')
        return hostname.split('.')[0]
    } catch {
        return 'link'
    }
}

export default function CandidateDetail({ profile }) {
    const fa = profile.final_analysis || {}
    const rec = fa.recommendation || {}
    const metrics = fa.metrics || {}
    const works = profile.relevant_works || []
    const socialLinks = profile.social_media_links || []
    const strengths = fa.strengths || []
    const improvements = fa.areas_for_improvement || []

    return (
        <>
            {/* Metrics */}
            <div className="detail-section-label">performance metrics</div>
            <ul className="metrics-list">
                {Object.entries(METRIC_LABELS).map(([key, label]) => {
                    const m = metrics[key] || {}
                    const rating = (m.rating || 0).toFixed(1)
                    return (
                        <li key={key}>
                            <span className="metric-name">{label}</span>
                            <span className="metric-dots">{DOTS}</span>
                            <span className="metric-value">{rating} / 5.0</span>
                        </li>
                    )
                })}
            </ul>

            {/* Recommendation */}
            <div className="detail-section-label">recommendation</div>
            <div className="recommendation-decision">{rec.decision || '—'}</div>
            <div className="recommendation-confidence">
                confidence: {rec.confidence || '—'}
            </div>
            <p className="recommendation-reasoning">{rec.reasoning || ''}</p>

            {/* Social Links */}
            {socialLinks.length > 0 && (
                <>
                    <div className="detail-section-label">social links</div>
                    <div className="social-links">
                        {socialLinks.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                {extractDomain(url)}
                            </a>
                        ))}
                    </div>
                </>
            )}

            {/* Work Samples */}
            {works.length > 0 && (
                <>
                    <div className="detail-section-label">work samples</div>
                    <div className="works-strip">
                        {works.flatMap((w) =>
                            (w.images || []).map((img, i) => {
                                // Prefer locally saved image, fall back to CDN
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
                                        onError={(e) => {
                                            // If local fails, try CDN
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

            {/* Strengths */}
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

            {/* Areas for Improvement */}
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
