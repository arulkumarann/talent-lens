export default function Sidebar({ activeNav, onNavigate }) {
    const navItems = [
        { id: 'search', num: '01', label: 'search' },
        { id: 'candidates', num: '02', label: 'candidates' },
        { id: 'stats', num: '03', label: 'stats' },
        { id: 'export', num: '04', label: 'export' },
    ]

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                Talent<em>Lens</em>
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

            <div className="sidebar-footer">designer intelligence</div>
        </aside>
    )
}
