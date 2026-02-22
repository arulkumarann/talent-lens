import { useState, useMemo } from 'react'
import API_BASE from '../config'
import DevCandidateDetail from './DevCandidateDetail'

const ASSESSMENT_STAGES = [
    { key: 'assessment_sent', label: 'Assessment Sent', color: '#3b82f6' },
    { key: 'in_review', label: 'In Review', color: '#f59e0b' },
    { key: 'failed', label: 'Failed', color: '#ef4444' },
]

export default function DevCandidateList({ role, pipelineFilter = 'all', onRefresh }) {
    const [expandedId, setExpandedId] = useState(null)
    const [updatingStatus, setUpdatingStatus] = useState(null)
    const [updatingAssessment, setUpdatingAssessment] = useState(null)
    const [searchText, setSearchText] = useState('')

    const candidates = role?.candidates || []
    const positions = role?.positions || 0
    const selectedCount = role?.selected_count || 0
    const slotsFilled = selectedCount >= positions

    const statusColors = {
        selected: '#22c55e',
        waitlisted: '#f59e0b',
        rejected: '#ef4444',
    }

    const statusLabels = {
        selected: 'HIRE',
        waitlisted: 'CONSIDER',
        rejected: 'REJECT',
    }

    // Filter candidates by pipeline + search
    const filteredCandidates = useMemo(() => {
        let list = candidates
        if (pipelineFilter === 'pending') {
            list = list.filter(c => !c.evaluation)
        } else if (pipelineFilter !== 'all') {
            list = list.filter(c => (c.status || 'waitlisted') === pipelineFilter)
        }
        if (searchText.trim()) {
            const q = searchText.toLowerCase()
            list = list.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.email || '').toLowerCase().includes(q)
            )
        }
        return list
    }, [candidates, pipelineFilter, searchText])

    const updateStatus = async (candidateId, newStatus) => {
        setUpdatingStatus(candidateId)
        try {
            const res = await fetch(`${API_BASE}/api/devs/roles/${role.id}/candidates/${candidateId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            })
            const data = await res.json()
            if (data.error) {
                alert(data.error)
            } else {
                onRefresh?.()
            }
        } catch (err) {
            console.error(err)
        } finally {
            setUpdatingStatus(null)
        }
    }

    const cycleStatus = (candidateId, currentStatus) => {
        const cycle = ['selected', 'waitlisted', 'rejected']
        const idx = cycle.indexOf(currentStatus)
        const next = cycle[(idx + 1) % cycle.length]

        if (next === 'selected' && slotsFilled) {
            alert(`All ${positions} positions are filled!`)
            return
        }

        updateStatus(candidateId, next)
    }

    const updateAssessmentStatus = async (candidateId, newStage) => {
        setUpdatingAssessment(candidateId)
        try {
            const res = await fetch(`${API_BASE}/api/devs/roles/${role.id}/candidates/${candidateId}/assessment-status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assessment_status: newStage }),
            })
            const data = await res.json()
            if (data.error) {
                alert(data.error)
            } else {
                onRefresh?.()
            }
        } catch (err) {
            console.error(err)
        } finally {
            setUpdatingAssessment(null)
        }
    }

    const cycleAssessmentStatus = (e, candidateId, currentStage) => {
        e.stopPropagation()
        const keys = ASSESSMENT_STAGES.map(s => s.key)
        const idx = keys.indexOf(currentStage)
        const next = keys[(idx + 1) % keys.length]
        updateAssessmentStatus(candidateId, next)
    }

    return (
        <div className="dev-candidates">
            {/* Candidate search */}
            <div className="dev-cand-search-bar">
                <input
                    type="text"
                    placeholder="Search candidates by name or email..."
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    className="dev-cand-search-input"
                />
            </div>

            {/* Slot Counter */}
            <div className="dev-slot-counter">
                <div className="dev-slot-info">
                    <span className="dev-slot-label">Positions Filled</span>
                    <span className="dev-slot-nums">
                        <strong>{selectedCount}</strong> / {positions}
                    </span>
                </div>
                <div className="dev-slot-bar-bg">
                    <div
                        className={`dev-slot-bar-fill ${slotsFilled ? 'full' : ''}`}
                        style={{ width: `${Math.min((selectedCount / Math.max(positions, 1)) * 100, 100)}%` }}
                    />
                </div>
                {slotsFilled && (
                    <div className="dev-slot-full-msg">
                        All positions filled ✓
                    </div>
                )}
            </div>

            {/* Candidate Rows */}
            {filteredCandidates.length === 0 ? (
                <div className="dev-empty-state">
                    {candidates.length === 0
                        ? 'No candidates yet. Share the Tally form link or wait for submissions.'
                        : 'No candidates match the current filters.'}
                </div>
            ) : (
                <div className="dev-candidate-rows">
                    {filteredCandidates.map((c) => {
                        const score = c.evaluation?.overall_score || 0
                        const decision = c.evaluation?.recommendation?.decision || '—'
                        const status = c.status || 'waitlisted'
                        const isExpanded = expandedId === c.id
                        const analyzing = !c.evaluation
                        const metrics = c.evaluation?.metrics || {}

                        // Top 3 domain metrics for mini bars
                        const topDomains = Object.entries(metrics)
                            .map(([k, v]) => ({ name: k.replace(/_/g, ' '), pct: Math.round(((v.rating || 0) / 5) * 100) }))
                            .sort((a, b) => b.pct - a.pct)
                            .slice(0, 3)

                        return (
                            <div
                                key={c.id}
                                className={`dev-candidate-row ${isExpanded ? 'expanded' : ''}`}
                            >
                                <div
                                    className="dev-candidate-summary"
                                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                                >
                                    <div className="dev-cand-left">
                                        <div
                                            className="dev-cand-score-ring"
                                            style={{
                                                '--score-color': score >= 71 ? '#c8a05a' : score >= 41 ? '#a08040' : '#6b5530',
                                                '--score-pct': `${score}%`,
                                            }}
                                        >
                                            {analyzing ? (
                                                <span className="dev-cand-analyzing">···</span>
                                            ) : (
                                                <span className="dev-cand-score-num">{score}</span>
                                            )}
                                        </div>
                                        <div className="dev-cand-info">
                                            <div className="dev-cand-name-row">
                                                <span className="dev-cand-name">{c.name || 'Unknown'}</span>
                                                {(() => {
                                                    const aStage = c.assessment_status || 'assessment_sent'
                                                    const stageInfo = ASSESSMENT_STAGES.find(s => s.key === aStage) || ASSESSMENT_STAGES[0]
                                                    return (
                                                        <button
                                                            className="dev-assessment-badge clickable"
                                                            style={{
                                                                '--badge-color': stageInfo.color,
                                                            }}
                                                            onClick={(e) => cycleAssessmentStatus(e, c.id, aStage)}
                                                            disabled={updatingAssessment === c.id}
                                                            title="Click to cycle assessment stage"
                                                        >
                                                            {stageInfo.label}
                                                        </button>
                                                    )
                                                })()}
                                            </div>
                                            <span className="dev-cand-meta">
                                                {c.email || ''}{c.current_ctc ? ` · ₹${c.current_ctc}` : ''}
                                            </span>
                                            {/* Mini domain score bars */}
                                            {topDomains.length > 0 && (
                                                <div className="dev-mini-domains">
                                                    {topDomains.map(d => (
                                                        <div key={d.name} className="dev-mini-domain">
                                                            <span className="dev-mini-domain-label">{d.name}</span>
                                                            <div className="dev-mini-domain-bar">
                                                                <div className="dev-mini-domain-fill" style={{ width: `${d.pct}%` }} />
                                                            </div>
                                                            <span className="dev-mini-domain-pct">{d.pct}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="dev-cand-right">
                                        {c.github_username && (
                                            <a
                                                href={`https://github.com/${c.github_username}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="dev-cand-gh-link"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                GitHub
                                            </a>
                                        )}

                                        {c.resume_url && (
                                            <a
                                                href={c.resume_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="dev-cand-resume-link"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Resume
                                            </a>
                                        )}

                                        {!analyzing && (
                                            <span className="dev-cand-decision" style={{ color: statusColors[status] }}>
                                                {statusLabels[status] || decision}
                                            </span>
                                        )}

                                        <button
                                            className="dev-cand-status-btn"
                                            style={{
                                                background: statusColors[status] + '22',
                                                color: statusColors[status],
                                                borderColor: statusColors[status] + '55',
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                cycleStatus(c.id, status)
                                            }}
                                            disabled={updatingStatus === c.id}
                                        >
                                            {status}
                                        </button>

                                        <span className={`dev-expand-arrow ${isExpanded ? 'open' : ''}`}>▾</span>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="dev-expanded-wrapper">
                                        {/* Status controls inside detail */}
                                        <div className="dev-status-bar">
                                            <span className="dev-status-bar-label">Status:</span>
                                            {['selected', 'waitlisted', 'rejected'].map((s) => (
                                                <button
                                                    key={s}
                                                    className={`dev-status-option ${status === s ? 'active' : ''}`}
                                                    style={{
                                                        '--status-color': statusColors[s],
                                                    }}
                                                    onClick={() => {
                                                        if (s === status) return
                                                        if (s === 'selected' && slotsFilled) {
                                                            alert(`All ${positions} positions are filled!`)
                                                            return
                                                        }
                                                        updateStatus(c.id, s)
                                                    }}
                                                    disabled={updatingStatus === c.id}
                                                >
                                                    {s === 'selected' ? '✓ Hire' : s === 'waitlisted' ? '◉ Consider' : '✕ Reject'}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Timeline / Assessment stages */}
                                        <div className="dev-timeline">
                                            {ASSESSMENT_STAGES.map((stage) => {
                                                const currentStage = c.assessment_status || 'assessment_sent'
                                                const currentIdx = ASSESSMENT_STAGES.findIndex(s => s.key === currentStage)
                                                const stageIdx = ASSESSMENT_STAGES.findIndex(s => s.key === stage.key)
                                                const isActive = stage.key === currentStage
                                                const isPast = stageIdx < currentIdx
                                                return (
                                                    <button
                                                        key={stage.key}
                                                        className={`dev-timeline-item clickable ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                                                        onClick={() => updateAssessmentStatus(c.id, stage.key)}
                                                        disabled={updatingAssessment === c.id}
                                                        title={`Set to: ${stage.label}`}
                                                    >
                                                        <span
                                                            className={`dev-timeline-dot ${isActive || isPast ? 'filled' : ''}`}
                                                            style={{ '--dot-color': stage.color }}
                                                        ></span>
                                                        <span className="dev-timeline-text">{stage.label}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        <DevCandidateDetail candidate={c} role={role} />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
