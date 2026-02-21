import { useState, useEffect, useCallback } from 'react'
import API_BASE from '../config'
import RoleForm from './RoleForm'
import DevCandidateList from './DevCandidateList'

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

export default function DevApp() {
    const [roles, setRoles] = useState([])
    const [activeRoleId, setActiveRoleId] = useState(null)
    const [activeRole, setActiveRole] = useState(null)
    const [showRoleForm, setShowRoleForm] = useState(false)
    const [loading, setLoading] = useState(true)

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
            const res = await fetch(`${API_BASE}/api/devs/roles/${activeRoleId}/analyze`, { method: 'POST' })
            const data = await res.json()
            alert(data.message || 'Analysis triggered')
            // Refresh data after triggering
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

                <div className="dev-roles-list">
                    {loading ? (
                        <div className="dev-empty-state">Loading...</div>
                    ) : roles.length === 0 ? (
                        <div className="dev-empty-state">
                            No roles yet. Click "Add Role" to get started.
                        </div>
                    ) : (
                        roles.map((r) => (
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
                {activeRole ? (
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
                                    className="dev-action-btn"
                                    onClick={handleTriggerAnalysis}
                                    disabled={analyzing}
                                >
                                    {analyzing ? '⟳ Analyzing...' : '▸ Analyze All'}
                                </button>
                                <button
                                    className="dev-action-btn refresh"
                                    onClick={handleRefreshSheet}
                                    disabled={refreshing}
                                >
                                    {refreshing ? '⟳ Importing...' : '↻ Refresh'}
                                </button>
                            </div>
                        </div>

                        <DevCandidateList
                            role={activeRole}
                            onRefresh={() => {
                                fetchRoles()
                                fetchRoleDetail()
                            }}
                        />
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
