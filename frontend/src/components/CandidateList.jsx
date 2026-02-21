import CandidateDetail from './CandidateDetail'

function formatNumber(n) {
    if (!n) return '0'
    const num = typeof n === 'string' ? parseInt(n.replace(/,/g, ''), 10) : n
    if (isNaN(num)) return String(n)
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return String(num)
}

function extractDomain(url) {
    try {
        const hostname = new URL(url).hostname.replace('www.', '')
        return hostname.split('.')[0]
    } catch {
        return 'link'
    }
}

export default function CandidateList({
    profiles,
    statuses,
    currentFilter,
    expandedUser,
    onFilterChange,
    onCycleStatus,
    onToggleDetail,
}) {
    const filters = ['all', 'selected', 'waitlisted', 'rejected']

    return (
        <>
            <div className="filter-tabs">
                {filters.map((f) => (
                    <button
                        key={f}
                        className={`filter-tab ${currentFilter === f ? 'active' : ''}`}
                        onClick={() => onFilterChange(f)}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <ul className="candidate-list">
                <li className="candidate-header-row">
                    <div>name</div>
                    <div>specializations</div>
                    <div>score</div>
                    <div>status</div>
                    <div>links</div>
                    <div style={{ textAlign: 'right' }}>followers</div>
                </li>
                {profiles.map((profile) => {
                    const od = profile.original_data || {}
                    const fa = profile.final_analysis || {}
                    const username = od.username || ''
                    const score = fa.overall_score || 0
                    const defaultStatus = score >= 85 ? 'selected' : score < 60 ? 'rejected' : 'waitlisted'
                    const status = statuses[username] || defaultStatus
                    const specs = (od.specializations || []).join(' · ') || '—'
                    const dribbbleUrl = username ? `https://dribbble.com/${username}` : null
                    const otherLinks = profile.social_media_links || []
                    const socialLinks = dribbbleUrl ? [dribbbleUrl, ...otherLinks] : otherLinks
                    const isExpanded = expandedUser === username

                    return (
                        <li className="candidate-item" key={username}>
                            <div
                                className="candidate-row"
                                onClick={() => onToggleDetail(username)}
                            >
                                <div className="c-name">{od.name || username}</div>
                                <div className="c-meta">
                                    {specs.length > 60 ? specs.substring(0, 60) + '...' : specs}
                                    <br />
                                    {od.location || '—'}
                                </div>
                                <div>
                                    <span className="c-score">{score}</span>
                                    <span className="c-score-label">score</span>
                                </div>
                                <button
                                    className="c-status"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onCycleStatus(username)
                                    }}
                                >
                                    {status}
                                </button>
                                <div className="c-social-links" onClick={(e) => e.stopPropagation()}>
                                    {socialLinks.length > 0 ? (
                                        socialLinks.slice(0, 4).map((url, i) => (
                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" title={url}>
                                                {extractDomain(url)}
                                            </a>
                                        ))
                                    ) : (
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>—</span>
                                    )}
                                </div>
                                <div className="c-followers">{formatNumber(od.followers_count)}</div>
                            </div>

                            <div className={`candidate-detail ${isExpanded ? 'open' : ''}`}>
                                {isExpanded && (
                                    <div className="detail-inner">
                                        <CandidateDetail profile={profile} />
                                    </div>
                                )}
                            </div>
                        </li>
                    )
                })}
            </ul>
        </>
    )
}
