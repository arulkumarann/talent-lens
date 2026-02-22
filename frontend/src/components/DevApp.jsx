import { useState, useEffect, useCallback, useMemo } from 'react'
import API_BASE from '../config'
import RoleForm from './RoleForm'
import DevCandidateList from './DevCandidateList'
import DevStatsDashboard from './DevStatsDashboard'

const JD_CHAR_LIMIT = 200

function JdText({ text }) {
    const [expanded, setExpanded] = useState(false)
    if (!text) return null
    const needsTruncate = text.length > JD_CHAR_LIMIT
    const display = expanded || !needsTruncate ? text : text.slice(0, JD_CHAR_LIMIT).trimEnd() + '...'

    return (
        <div className="dev-role-jd-wrap">
            <p className="dev-role-jd">{display}</p>
            {needsTruncate && (
                <button
                    className="dev-jd-toggle"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? 'Show less' : 'Show more'}
                </button>
            )}
        </div>
    )
}

/* ── Tiny bar chart for score distribution ── */
/* ── Leaderboard view ── */
function Leaderboard({ candidates }) {
    const sorted = [...candidates]
        .filter(c => c.evaluation?.overall_score)
        .sort((a, b) => (b.evaluation?.overall_score || 0) - (a.evaluation?.overall_score || 0))

    if (sorted.length === 0) return <div className="dev-empty-state">No scored candidates yet.</div>

    return (
        <div className="dev-leaderboard">
            {sorted.map((c, i) => {
                const score = c.evaluation?.overall_score || 0
                const metrics = c.evaluation?.metrics || {}
                const topMetrics = Object.entries(metrics)
                    .sort(([, a], [, b]) => (b.rating || 0) - (a.rating || 0))
                    .slice(0, 2)
                return (
                    <div key={c.id} className="dev-lb-row">
                        <span className={`dev-lb-rank ${i < 3 ? 'top' : ''}`}>#{i + 1}</span>
                        <div className="dev-lb-score-ring" style={{
                            '--score-color': score >= 71 ? '#c8a05a' : score >= 41 ? '#a08040' : '#6b5530',
                            '--score-pct': `${score}%`
                        }}>
                            <span>{score}</span>
                        </div>
                        <div className="dev-lb-info">
                            <span className="dev-lb-name">{c.name || 'Unknown'}</span>
                            <div className="dev-lb-tags">
                                {topMetrics.map(([k, v]) => (
                                    <span key={k} className="dev-lb-tag">
                                        {k.replace(/_/g, ' ')} {((v.rating / 5) * 100).toFixed(0)}%
                                    </span>
                                ))}
                            </div>
                        </div>
                        <span className="dev-lb-decision">{c.evaluation?.recommendation?.decision || '—'}</span>
                    </div>
                )
            })}
        </div>
    )
}

export default function DevApp({ activeNav }) {
    const [roles, setRoles] = useState([])
    const [activeRoleId, setActiveRoleId] = useState(null)
    const [activeRole, setActiveRole] = useState(null)
    const [showRoleForm, setShowRoleForm] = useState(false)
    const [loading, setLoading] = useState(true)
    const [sidebarSearch, setSidebarSearch] = useState('')
    const [pipelineFilter, setPipelineFilter] = useState('all')
    const [activeView, setActiveView] = useState('candidates') // 'candidates' | 'leaderboard'
    const [lastAnalyzed, setLastAnalyzed] = useState(null)

    // Fetch roles list
    const fetchRoles = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/devs/roles`)
            const data = await res.json()
            setRoles(data.roles || [])
            if (!activeRoleId && data.roles?.length > 0) {
                setActiveRoleId(data.roles[0].id)
            }
        } catch (err) {
            console.error('Error fetching roles:', err)
        } finally {
            setLoading(false)
        }
    }, [activeRoleId])

    // Fetch selected role details
    const fetchRoleDetail = useCallback(async () => {
        if (!activeRoleId) {
            setActiveRole(null)
            return
        }
        try {
            const res = await fetch(`${API_BASE}/api/devs/roles/${activeRoleId}`)
            const data = await res.json()
            setActiveRole(data)
        } catch (err) {
            console.error('Error fetching role detail:', err)
        }
    }, [activeRoleId])

    useEffect(() => {
        fetchRoles()
    }, [])

    useEffect(() => {
        fetchRoleDetail()
    }, [activeRoleId, fetchRoleDetail])

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchRoles()
            if (activeRoleId) fetchRoleDetail()
        }, 30000)
        return () => clearInterval(interval)
    }, [activeRoleId, fetchRoles, fetchRoleDetail])

    const handleDeleteRole = async (roleId) => {
        if (!confirm('Delete this role and all its candidates?')) return
        try {
            await fetch(`${API_BASE}/api/devs/roles/${roleId}`, { method: 'DELETE' })
            if (activeRoleId === roleId) setActiveRoleId(null)
            fetchRoles()
        } catch (err) {
            console.error(err)
        }
    }

    const [analyzing, setAnalyzing] = useState(false)
    const [refreshing, setRefreshing] = useState(false)

    const handleTriggerAnalysis = async () => {
        if (!activeRoleId) return
        setAnalyzing(true)
        try {
            const res = await fetch(`${API_BASE}/api/devs/roles/${activeRoleId}/analyze?force=true`, { method: 'POST' })
            const data = await res.json()
            alert(data.message || 'Analysis triggered')
            setLastAnalyzed(new Date())
            fetchRoles()
            fetchRoleDetail()
        } catch (err) {
            console.error(err)
            alert('Error triggering analysis')
        } finally {
            setAnalyzing(false)
        }
    }

    const handleRefreshSheet = async () => {
        if (!activeRoleId) return
        setRefreshing(true)
        try {
            const res = await fetch(`${API_BASE}/api/devs/roles/${activeRoleId}/refresh-sheet`, { method: 'POST' })
            const data = await res.json()
            alert(data.message || 'Refresh complete')
            fetchRoles()
            fetchRoleDetail()
        } catch (err) {
            console.error(err)
            alert('Error refreshing from sheet')
        } finally {
            setRefreshing(false)
        }
    }

    // Determine if stats view is active
    const showStats = activeNav === 'stats'

    // Filter roles in sidebar by search
    const filteredRoles = sidebarSearch
        ? roles.filter(r => r.name.toLowerCase().includes(sidebarSearch.toLowerCase()))
        : roles

    return (
        <div className="dev-app">
            {/* Roles Sidebar */}
            <div className="dev-roles-panel">
                <div className="dev-roles-header">
                    <h2>Roles</h2>
                    <button
                        className="dev-add-role-btn"
                        onClick={() => setShowRoleForm(true)}
                    >
                        + Add Role
                    </button>
                </div>

                {/* Sidebar Search */}
                <div className="dev-sidebar-search">
                    <input
                        type="text"
                        placeholder="Search roles..."
                        value={sidebarSearch}
                        onChange={(e) => setSidebarSearch(e.target.value)}
                        className="dev-sidebar-search-input"
                    />
                </div>

                <div className="dev-roles-list">
                    {loading ? (
                        <div className="dev-empty-state">Loading...</div>
                    ) : filteredRoles.length === 0 ? (
                        <div className="dev-empty-state">
                            {roles.length === 0 ? 'No roles yet. Click "Add Role" to get started.' : 'No matching roles.'}
                        </div>
                    ) : (
                        filteredRoles.map((r) => (
                            <div
                                key={r.id}
                                className={`dev-role-card ${activeRoleId === r.id ? 'active' : ''}`}
                                onClick={() => setActiveRoleId(r.id)}
                            >
                                <div className="dev-role-card-top">
                                    <span className="dev-role-name">{r.name}</span>
                                    <button
                                        className="dev-role-delete"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteRole(r.id)
                                        }}
                                        title="Delete role"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="dev-role-meta">
                                    <span>{r.ctc || 'CTC TBD'}</span>
                                    <span className="dev-role-slot-badge">
                                        {r.selected_count}/{r.positions} filled
                                    </span>
                                </div>
                                <div className="dev-role-candidates-count">
                                    {r.total_candidates} candidate{r.total_candidates !== 1 ? 's' : ''}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="dev-main-panel">
                {showStats ? (
                    <DevStatsDashboard role={activeRole} allRoles={roles} />
                ) : activeRole ? (
                    <>
                        <div className="dev-main-header">
                            <div>
                                <h1 className="dev-role-title">{activeRole.name}</h1>
                                {activeRole.jd && (
                                    <JdText text={activeRole.jd} />
                                )}
                                <div className="dev-role-badges">
                                    {activeRole.ctc && (
                                        <span className="dev-badge">₹{activeRole.ctc}</span>
                                    )}
                                    <span className="dev-badge">{activeRole.positions} position{activeRole.positions > 1 ? 's' : ''}</span>
                                    {activeRole.tally_link && (
                                        <a
                                            href={activeRole.tally_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="dev-badge link"
                                        >
                                            Tally Form ↗
                                        </a>
                                    )}
                                </div>
                            </div>
                            <div className="dev-header-actions">
                                <button
                                    className="dev-action-btn primary"
                                    onClick={handleTriggerAnalysis}
                                    disabled={analyzing}
                                >
                                    {analyzing ? '⟳ Analyzing...' : '▸ Analyze All'}
                                </button>
                                <button
                                    className="dev-action-btn"
                                    onClick={handleRefreshSheet}
                                    disabled={refreshing}
                                >
                                    {refreshing ? '⟳ Importing...' : '↻ Refresh'}
                                </button>
                                {lastAnalyzed && (
                                    <span className="dev-last-analyzed">
                                        Last analyzed {lastAnalyzed.toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── Pipeline filter + View toggle ── */}
                        <div className="dev-toolbar">
                            <div className="dev-pipeline-filters">
                                {[
                                    { key: 'all', label: 'All' },
                                    { key: 'selected', label: 'Hired' },
                                    { key: 'waitlisted', label: 'Consider' },
                                    { key: 'rejected', label: 'Rejected' },
                                    { key: 'pending', label: 'Pending' },
                                ].map(f => (
                                    <button
                                        key={f.key}
                                        className={`dev-pipeline-btn ${pipelineFilter === f.key ? 'active' : ''}`}
                                        onClick={() => setPipelineFilter(f.key)}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                            <div className="dev-view-toggle">
                                <button
                                    className={`dev-view-btn ${activeView === 'candidates' ? 'active' : ''}`}
                                    onClick={() => setActiveView('candidates')}
                                >
                                    List
                                </button>
                                <button
                                    className={`dev-view-btn ${activeView === 'leaderboard' ? 'active' : ''}`}
                                    onClick={() => setActiveView('leaderboard')}
                                >
                                    Leaderboard
                                </button>
                            </div>
                        </div>

                        {activeView === 'candidates' ? (
                            <DevCandidateList
                                role={activeRole}
                                pipelineFilter={pipelineFilter}
                                onRefresh={() => {
                                    fetchRoles()
                                    fetchRoleDetail()
                                }}
                            />
                        ) : (
                            <Leaderboard candidates={activeRole.candidates || []} />
                        )}
                    </>
                ) : (
                    <div className="dev-welcome">
                        <h2>Developer Recruitment</h2>
                        <p>
                            {roles.length === 0
                                ? 'Create your first role to start receiving candidates.'
                                : 'Select a role from the sidebar to view candidates.'
                            }
                        </p>
                    </div>
                )}
            </div>

            {/* Role Form Modal */}
            {showRoleForm && (
                <RoleForm
                    onClose={() => setShowRoleForm(false)}
                    onCreated={(data) => {
                        fetchRoles()
                        setActiveRoleId(data.id)
                    }}
                />
            )}
        </div>
    )
}
