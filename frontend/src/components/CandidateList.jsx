import CandidateDetail from './CandidateDetail'

function formatNumber(n) {
    if (!n) return '0'
    const num = typeof n === 'string' ? parseInt(n.replace(/,/g, ''), 10) : n
    if (isNaN(num)) return String(n)
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return String(num)
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
                <li className="candidate-row" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px', cursor: 'default' }}>
                    <div className="c-meta" style={{ color: 'var(--text-secondary)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>name</div>
                    <div className="c-meta" style={{ color: 'var(--text-secondary)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>specializations</div>
                    <div className="c-meta" style={{ color: 'var(--text-secondary)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>score</div>
                    <div className="c-meta" style={{ color: 'var(--text-secondary)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>status</div>
                    <div className="c-meta" style={{ color: 'var(--text-secondary)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>skills</div>
                    <div className="c-meta" style={{ color: 'var(--text-secondary)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1.5px', textAlign: 'right' }}>followers</div>
                </li>
                {profiles.map((profile) => {
                    const od = profile.original_data || {}
                    const fa = profile.final_analysis || {}
                    const username = od.username || ''
                    const decision = (fa.recommendation?.decision || '').toUpperCase()
                    const defaultStatus = decision === 'HIRE' ? 'selected' : decision === 'REJECT' ? 'rejected' : 'waitlisted'
                    const status = statuses[username] || defaultStatus
                    const specs = (od.specializations || []).join(' · ') || '—'
                    const score = fa.overall_score || '—'
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
                                <div className="c-keywords">{specs}</div>
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
