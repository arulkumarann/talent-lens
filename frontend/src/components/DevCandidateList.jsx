import { useState } from 'react'
import DevCandidateDetail from './DevCandidateDetail'

export default function DevCandidateList({ role, onRefresh }) {
    const [expandedId, setExpandedId] = useState(null)
    const [updatingStatus, setUpdatingStatus] = useState(null)

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

    const updateStatus = async (candidateId, newStatus) => {
        setUpdatingStatus(candidateId)
        try {
            const res = await fetch(`/api/devs/roles/${role.id}/candidates/${candidateId}/status`, {
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

    return (
        <div className="dev-candidates">
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
            {candidates.length === 0 ? (
                <div className="dev-empty-state">
                    No candidates yet. Share the Tally form link or wait for submissions.
                </div>
            ) : (
                <div className="dev-candidate-rows">
                    {candidates.map((c) => {
                        const score = c.evaluation?.overall_score || 0
                        const decision = c.evaluation?.recommendation?.decision || '—'
                        const status = c.status || 'waitlisted'
                        const isExpanded = expandedId === c.id
                        const analyzing = !c.evaluation

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
                                                '--score-color': score >= 71 ? '#22c55e' : score >= 41 ? '#f59e0b' : '#ef4444',
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
                                            <span className="dev-cand-name">{c.name || 'Unknown'}</span>
                                            <span className="dev-cand-meta">
                                                {c.email || ''}{c.current_ctc ? ` · ₹${c.current_ctc}` : ''}
                                            </span>
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
                                                GH
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
                                                CV
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
