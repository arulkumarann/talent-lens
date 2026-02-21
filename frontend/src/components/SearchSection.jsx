import { useState, useRef, useEffect } from 'react'

export default function SearchSection({ isScanning, keywordTags, logLines, onScan }) {
    const [query, setQuery] = useState('')
    const [maxUsers, setMaxUsers] = useState(5)
    const terminalRef = useRef(null)

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight
        }
    }, [logLines])

    const handleScan = () => {
        const queries = query
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        if (queries.length > 0) {
            onScan(queries, maxUsers)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleScan()
    }

    return (
        <>
            <h1 className="section-heading">
                find <em>designers.</em>
            </h1>

            <div className="search-box">
                <input
                    className="search-input"
                    type="text"
                    placeholder="vc fund dashboard, cap table..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isScanning}
                    aria-label="Search queries"
                />
                <input
                    className="search-input"
                    type="number"
                    min="1"
                    max="20"
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                    disabled={isScanning}
                    aria-label="Number of users"
                    style={{ width: '48px', textAlign: 'center', flex: 'none' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>users</span>
                <button
                    className="btn-scan"
                    onClick={handleScan}
                    disabled={isScanning || !query.trim()}
                >
                    {isScanning ? 'scanning...' : 'run scan'}
                </button>
            </div>

            {keywordTags.length > 0 && (
                <div className="keyword-tags">
                    {keywordTags.map((tag, i) => (
                        <span className="keyword-tag" key={i}>
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {logLines.length > 0 && (
                <div className="terminal">
                    <div className="terminal-lines" ref={terminalRef}>
                        {logLines.map((line, i) => (
                            <div className="terminal-line" key={i}>
                                {line}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
}
