export default function Sidebar({ activeNav, onNavigate, mode, onModeChange }) {
    const designerNav = [
        { id: 'search', num: '01', label: 'search' },
        { id: 'candidates', num: '02', label: 'candidates' },
        { id: 'stats', num: '03', label: 'stats' },
        { id: 'export', num: '04', label: 'export' },
    ]

    const devNav = [
        { id: 'roles', num: '01', label: 'roles' },
        { id: 'candidates', num: '02', label: 'candidates' },
    ]

    const navItems = mode === 'devs' ? devNav : designerNav

    return (
        <aside className="sidebar">
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

            <div className="sidebar-footer">
                {mode === 'devs' ? 'developer intelligence' : 'designer intelligence'}
            </div>
        </aside>
    )
}
