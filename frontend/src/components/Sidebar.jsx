export default function Sidebar({
    activeNav, onNavigate, mode, onModeChange,
    keywords = [], activeKeyword, onSelectKeyword, onDeleteKeyword,
    mobileOpen = false
}) {
    const designerNav = [
        { id: 'search', num: '01', label: 'search' },
        { id: 'candidates', num: '02', label: 'candidates' },
        { id: 'stats', num: '03', label: 'stats' },
        { id: 'export', num: '04', label: 'export' },
    ]

    const devNav = [
        { id: 'roles', num: '01', label: 'roles' },
        { id: 'candidates', num: '02', label: 'candidates' },
        { id: 'stats', num: '03', label: 'stats' },
    ]

    const navItems = mode === 'devs' ? devNav : designerNav

    return (
        <aside className={`sidebar ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
            <div className="sidebar-brand">
                Talent<em>Lens</em>
            </div>

            {/* Mode Toggle */}
            <div className="mode-toggle">
                <button
                    className={`mode-btn ${mode === 'designers' ? 'active' : ''}`}
                    onClick={() => onModeChange('designers')}
                >
                    Designers
                </button>
                <button
                    className={`mode-btn ${mode === 'devs' ? 'active' : ''}`}
                    onClick={() => onModeChange('devs')}
                >
                    Devs
                </button>
            </div>

            <ul className="sidebar-nav">
                {navItems.map((item) => (
                    <li key={item.id}>
                        <button
                            className={activeNav === item.id ? 'active' : ''}
                            onClick={() => onNavigate(item.id)}
                        >
                            <span className="nav-num">{item.num}</span>
                            {item.label}
                        </button>
                    </li>
                ))}
            </ul>

            {/* Keywords list (designer mode only) */}
            {mode === 'designers' && keywords.length > 0 && (
                <div className="sidebar-keywords">
                    <div className="sidebar-keywords-title">Keywords</div>
                    <div className="sidebar-keywords-list">
                        {keywords.map((kw) => (
                            <div
                                key={kw.keyword}
                                className={`sidebar-keyword-item ${activeKeyword === kw.keyword ? 'active' : ''}`}
                                onClick={() => onSelectKeyword?.(kw.keyword)}
                            >
                                <div className="sidebar-kw-name">{kw.keyword}</div>
                                <div className="sidebar-kw-meta">
                                    {kw.total_profiles} designer{kw.total_profiles !== 1 ? 's' : ''}
                                </div>
                                <button
                                    className="sidebar-kw-delete"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onDeleteKeyword?.(kw.keyword)
                                    }}
                                    title="Delete keyword"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="sidebar-footer">
                {mode === 'devs' ? 'developer intelligence' : 'designer intelligence'}
            </div>
        </aside>
    )
}
