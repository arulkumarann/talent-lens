import { useState } from 'react'

export default function DevCandidateDetail({ candidate, role }) {
    const [activeTab, setActiveTab] = useState('overview')
    const evaluation = candidate.evaluation || {}
    const github = candidate.github_analysis || null
    const resume = candidate.resume_analysis || null
    const metrics = evaluation.metrics || {}
    const recommendation = evaluation.recommendation || {}
    const feedback = evaluation.detailed_feedback || {}

    const metricEntries = Object.entries(metrics)

    return (
        <div className="dev-detail">
            <div className="dev-detail-tabs">
                {['overview', 'github', 'resume', 'evaluation'].map((tab) => (
                    <button
                        key={tab}
                        className={`dev-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="dev-detail-section">
                    <div className="dev-overview-grid">
                        <div className="dev-info-card">
                            <span className="dev-info-label">Email</span>
                            <span className="dev-info-value">{candidate.email || '—'}</span>
                        </div>
                        <div className="dev-info-card">
                            <span className="dev-info-label">Phone</span>
                            <span className="dev-info-value">{candidate.phone || '—'}</span>
                        </div>
                        <div className="dev-info-card">
                            <span className="dev-info-label">Current CTC</span>
                            <span className="dev-info-value">{candidate.current_ctc || '—'}</span>
                        </div>
                        <div className="dev-info-card">
                            <span className="dev-info-label">LinkedIn</span>
                            <span className="dev-info-value">
                                {candidate.linkedin ? (
                                    <a href={candidate.linkedin.startsWith('http') ? candidate.linkedin : `https://linkedin.com/in/${candidate.linkedin}`}
                                        target="_blank" rel="noopener noreferrer">
                                        {candidate.linkedin}
                                    </a>
                                ) : '—'}
                            </span>
                        </div>
                        <div className="dev-info-card">
                            <span className="dev-info-label">GitHub</span>
                            <span className="dev-info-value">
                                {candidate.github_username ? (
                                    <a href={`https://github.com/${candidate.github_username}`}
                                        target="_blank" rel="noopener noreferrer">
                                        {candidate.github_username}
                                    </a>
                                ) : '—'}
                            </span>
                        </div>
                        <div className="dev-info-card">
                            <span className="dev-info-label">Resume</span>
                            <span className="dev-info-value">
                                {candidate.resume_url ? (
                                    <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer">
                                        Download PDF
                                    </a>
                                ) : '—'}
                            </span>
                        </div>
                    </div>

                    {evaluation.strengths && (
                        <div className="dev-feedback-section">
                            <h4>Strengths</h4>
                            <div className="dev-tags">
                                {evaluation.strengths.map((s, i) => (
                                    <span key={i} className="dev-tag strength">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {evaluation.areas_for_improvement && (
                        <div className="dev-feedback-section">
                            <h4>Areas for Improvement</h4>
                            <div className="dev-tags">
                                {evaluation.areas_for_improvement.map((s, i) => (
                                    <span key={i} className="dev-tag improvement">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {recommendation.reasoning && (
                        <div className="dev-feedback-section">
                            <h4>Recommendation</h4>
                            <p className="dev-reasoning">{recommendation.reasoning}</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'github' && (
                <div className="dev-detail-section">
                    {github ? (
                        <>
                            <div className="dev-overview-grid">
                                <div className="dev-info-card accent">
                                    <span className="dev-info-label">Repos</span>
                                    <span className="dev-info-value big">{github.total_repos}</span>
                                </div>
                                <div className="dev-info-card accent">
                                    <span className="dev-info-label">Stars</span>
                                    <span className="dev-info-value big">{github.total_stars}</span>
                                </div>
                                <div className="dev-info-card accent">
                                    <span className="dev-info-label">Contributions (yr)</span>
                                    <span className="dev-info-value big">{github.contributions?.total || 0}</span>
                                </div>
                                <div className="dev-info-card accent">
                                    <span className="dev-info-label">Followers</span>
                                    <span className="dev-info-value big">{github.followers}</span>
                                </div>
                                <div className="dev-info-card accent">
                                    <span className="dev-info-label">Commits</span>
                                    <span className="dev-info-value big">{github.contributions?.commits || 0}</span>
                                </div>
                                <div className="dev-info-card accent">
                                    <span className="dev-info-label">PRs</span>
                                    <span className="dev-info-value big">{github.contributions?.pull_requests || 0}</span>
                                </div>
                            </div>

                            {github.top_languages && github.top_languages.length > 0 && (
                                <div className="dev-feedback-section">
                                    <h4>Top Languages</h4>
                                    <div className="dev-tags">
                                        {github.top_languages.map((l, i) => (
                                            <span key={i} className="dev-tag lang">
                                                {l.language} <small>({l.count})</small>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {github.top_repos && github.top_repos.length > 0 && (
                                <div className="dev-feedback-section">
                                    <h4>Top Repositories</h4>
                                    <div className="dev-repos-list">
                                        {github.top_repos.map((r, i) => (
                                            <div key={i} className="dev-repo-card">
                                                <div className="dev-repo-name">
                                                    <a href={`https://github.com/${github.username}/${r.name}`}
                                                        target="_blank" rel="noopener noreferrer">
                                                        {r.name}
                                                    </a>
                                                    {r.language && <span className="dev-repo-lang">{r.language}</span>}
                                                </div>
                                                <div className="dev-repo-desc">{r.description || 'No description'}</div>
                                                <div className="dev-repo-stats">
                                                    ★ {r.stars} · ⑂ {r.forks}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="dev-empty-state">
                            {candidate.github_username
                                ? 'GitHub analysis pending...'
                                : 'No GitHub username provided'}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'resume' && (
                <div className="dev-detail-section">
                    {resume ? (
                        <>
                            {resume.summary && (
                                <div className="dev-feedback-section">
                                    <h4>Summary</h4>
                                    <p className="dev-reasoning">{resume.summary}</p>
                                </div>
                            )}

                            {resume.skills && resume.skills.length > 0 && (
                                <div className="dev-feedback-section">
                                    <h4>Skills</h4>
                                    <div className="dev-tags">
                                        {resume.skills.map((s, i) => (
                                            <span key={i} className="dev-tag skill">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {resume.work_experience && resume.work_experience.length > 0 && (
                                <div className="dev-feedback-section">
                                    <h4>Experience ({resume.experience_years || '?'} yrs)</h4>
                                    <div className="dev-repos-list">
                                        {resume.work_experience.map((w, i) => (
                                            <div key={i} className="dev-repo-card">
                                                <div className="dev-repo-name">{w.title} @ {w.company}</div>
                                                <div className="dev-repo-desc">{w.duration}</div>
                                                {w.highlights && <div className="dev-repo-stats">{w.highlights}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {resume.education && resume.education.length > 0 && (
                                <div className="dev-feedback-section">
                                    <h4>Education</h4>
                                    <div className="dev-repos-list">
                                        {resume.education.map((e, i) => (
                                            <div key={i} className="dev-repo-card">
                                                <div className="dev-repo-name">{e.degree}</div>
                                                <div className="dev-repo-desc">{e.institution} {e.year && `(${e.year})`}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {resume.projects && resume.projects.length > 0 && (
                                <div className="dev-feedback-section">
                                    <h4>Projects</h4>
                                    <div className="dev-repos-list">
                                        {resume.projects.map((p, i) => (
                                            <div key={i} className="dev-repo-card">
                                                <div className="dev-repo-name">{p.name}</div>
                                                <div className="dev-repo-desc">{p.description}</div>
                                                {p.tech_stack && (
                                                    <div className="dev-tags" style={{ marginTop: '6px' }}>
                                                        {p.tech_stack.map((t, j) => (
                                                            <span key={j} className="dev-tag skill">{t}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="dev-empty-state">
                            {candidate.resume_url
                                ? 'Resume analysis pending...'
                                : 'No resume uploaded'}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'evaluation' && (
                <div className="dev-detail-section">
                    {metricEntries.length > 0 ? (
                        <div className="dev-metrics-grid">
                            {metricEntries.map(([key, val]) => (
                                <div key={key} className="dev-metric-card">
                                    <div className="dev-metric-header">
                                        <span className="dev-metric-name">{key.replace(/_/g, ' ')}</span>
                                        <span className="dev-metric-rating">{val.rating?.toFixed(1)}</span>
                                    </div>
                                    <div className="dev-metric-bar-bg">
                                        <div
                                            className="dev-metric-bar-fill"
                                            style={{ width: `${(val.rating / 5) * 100}%` }}
                                        />
                                    </div>
                                    <p className="dev-metric-reasoning">{val.reasoning}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="dev-empty-state">Evaluation pending...</div>
                    )}

                    {feedback.technical_assessment && (
                        <div className="dev-feedback-grid">
                            {Object.entries(feedback).map(([key, val]) => (
                                <div key={key} className="dev-feedback-item">
                                    <span className="dev-info-label">{key.replace(/_/g, ' ')}</span>
                                    <p>{val}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
