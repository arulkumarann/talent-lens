import { useState, useCallback, useRef, useEffect } from 'react'
import LandingPage from './components/LandingPage'
import Sidebar from './components/Sidebar'
import SearchSection from './components/SearchSection'
import CandidateList from './components/CandidateList'
import CandidateDetail from './components/CandidateDetail'
import StatsDashboard from './components/StatsDashboard'
import ExportSection from './components/ExportSection'
import DevApp from './components/DevApp'

export default function App() {
  const [page, setPage] = useState('landing') // 'landing' | 'app'

  // ─── Keywords & data ─── 
  const [keywords, setKeywords] = useState([])          // all stored keywords
  const [activeKeyword, setActiveKeyword] = useState(null) // currently selected keyword
  const [profiles, setProfiles] = useState([])
  const [statuses, setStatuses] = useState({})
  const [currentFilter, setCurrentFilter] = useState('all')

  // ─── Scan state ───
  const [isScanning, setIsScanning] = useState(false)
  const [logLines, setLogLines] = useState([])
  const [keywordTags, setKeywordTags] = useState([])

  // ─── UI state ───
  const [activeNav, setActiveNav] = useState('search')
  const [expandedUser, setExpandedUser] = useState(null)
  const [mode, setMode] = useState('designers')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const sectionRefs = {
    search: useRef(null),
    candidates: useRef(null),
    stats: useRef(null),
    export: useRef(null),
  }

  // ─── Load keywords on mount ───
  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch('/api/designers/keywords')
      const data = await res.json()
      setKeywords(data.keywords || [])
    } catch (err) {
      console.error('Error fetching keywords:', err)
    }
  }, [])

  useEffect(() => {
    fetchKeywords()
  }, [])

  // ─── Load keyword data when activeKeyword changes ───
  const loadKeywordData = useCallback(async (kw) => {
    if (!kw) {
      setProfiles([])
      setStatuses({})
      return
    }
    try {
      const res = await fetch(`/api/designers/keyword/${encodeURIComponent(kw)}`)
      if (!res.ok) return
      const data = await res.json()
      setProfiles(data.profiles || [])
      setStatuses(data.statuses || {})
    } catch (err) {
      console.error('Error loading keyword data:', err)
    }
  }, [])

  useEffect(() => {
    if (activeKeyword) loadKeywordData(activeKeyword)
  }, [activeKeyword, loadKeywordData])

  const scrollTo = useCallback((section) => {
    setActiveNav(section)
    sectionRefs[section]?.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // ─── Scan ───
  const startScan = useCallback((queries, maxUsers = 5) => {
    if (isScanning || queries.length === 0) return

    setIsScanning(true)
    setLogLines([])
    setExpandedUser(null)
    setKeywordTags(queries)

    const keyword = queries[0]

    fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries, max_profiles: maxUsers }),
    })
      .then((response) => {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        function readStream() {
          reader.read().then(({ done, value }) => {
            if (done) {
              finishScan([], keyword)
              return
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop()

            let eventType = ''
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim()
              } else if (line.startsWith('data: ')) {
                const eventData = line.slice(6).trim()
                try {
                  const parsed = JSON.parse(eventData)
                  if (eventType === 'log') {
                    setLogLines((prev) => [...prev, parsed.message])
                  } else if (eventType === 'result') {
                    const resultProfiles = parsed.profiles || []
                    finishScan(resultProfiles, parsed.keyword || keyword)
                  } else if (eventType === 'error') {
                    setLogLines((prev) => [...prev, 'error: ' + parsed.error])
                  } else if (eventType === 'done') {
                    setLogLines((prev) => [...prev, 'done.'])
                  }
                } catch (e) {
                  // ignore parse errors
                }
                eventType = ''
              }
            }

            readStream()
          }).catch(() => {
            setLogLines((prev) => [...prev, 'error: connection lost'])
            setIsScanning(false)
          })
        }

        readStream()
      })
      .catch(() => {
        setLogLines((prev) => [...prev, 'error: could not connect to server'])
        setIsScanning(false)
      })
  }, [isScanning])

  const finishScan = useCallback((resultProfiles, keyword) => {
    setIsScanning(false)
    if (resultProfiles.length > 0) {
      setProfiles(resultProfiles)
      // Build statuses from server (already auto-assigned)
      const kwNorm = keyword?.trim().toLowerCase() || ''
      setActiveKeyword(kwNorm)
      fetchKeywords() // refresh sidebar keyword list

      // Load the full persisted data (includes merged results + statuses)
      setTimeout(() => {
        loadKeywordData(kwNorm)
        sectionRefs.candidates.current?.scrollIntoView({ behavior: 'smooth' })
        setActiveNav('candidates')
      }, 500)
    }
  }, [fetchKeywords, loadKeywordData])

  // ─── Status management (persisted to backend) ───
  const cycleStatus = useCallback(async (username) => {
    const cycle = ['selected', 'waitlisted', 'rejected']
    const current = statuses[username] || 'waitlisted'
    const idx = cycle.indexOf(current)
    const next = cycle[(idx + 1) % cycle.length]

    // Optimistic update
    setStatuses((prev) => ({ ...prev, [username]: next }))

    // Persist to backend
    if (activeKeyword) {
      try {
        await fetch(
          `/api/designers/keyword/${encodeURIComponent(activeKeyword)}/status/${encodeURIComponent(username)}?status=${next}`,
          { method: 'PUT' }
        )
      } catch (err) {
        console.error('Error persisting status:', err)
      }
    }
  }, [statuses, activeKeyword])

  const toggleDetail = useCallback((username) => {
    setExpandedUser((prev) => (prev === username ? null : username))
  }, [])

  const filteredProfiles = currentFilter === 'all'
    ? profiles
    : profiles.filter((p) => statuses[p.original_data?.username] === currentFilter)

  const handleSelectKeyword = useCallback((kw) => {
    setActiveKeyword(kw)
    setExpandedUser(null)
    setCurrentFilter('all')
    setActiveNav('candidates')
    setTimeout(() => {
      sectionRefs.candidates.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  const handleDeleteKeyword = useCallback(async (kw) => {
    if (!confirm(`Delete all data for "${kw}"?`)) return
    try {
      await fetch(`/api/designers/keyword/${encodeURIComponent(kw)}`, { method: 'DELETE' })
      if (activeKeyword === kw) {
        setActiveKeyword(null)
        setProfiles([])
        setStatuses({})
      }
      fetchKeywords()
    } catch (err) {
      console.error(err)
    }
  }, [activeKeyword, fetchKeywords])

  if (page === 'landing') {
    return <LandingPage onEnter={() => setPage('app')} />
  }

  return (
    <div className="app-layout">
      {/* Mobile hamburger */}
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        <span className={`hamburger ${sidebarOpen ? 'open' : ''}`} />
      </button>

      {/* Top-right home button */}
      <button className="home-btn" onClick={() => setPage('landing')} aria-label="Back to home">
        ← home
      </button>

      {/* Sidebar overlay backdrop */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        activeNav={activeNav}
        onNavigate={(s) => { scrollTo(s); setSidebarOpen(false) }}
        mode={mode}
        onModeChange={(m) => { setMode(m); setSidebarOpen(false) }}
        keywords={keywords}
        activeKeyword={activeKeyword}
        onSelectKeyword={(kw) => { handleSelectKeyword(kw); setSidebarOpen(false) }}
        onDeleteKeyword={handleDeleteKeyword}
        mobileOpen={sidebarOpen}
      />

      {mode === 'devs' ? (
        <main className="main-content">
          <DevApp />
        </main>
      ) : (
        <main className="main-content">
          {/* 01 SEARCH */}
          <section className="section" ref={sectionRefs.search}>
            <SearchSection
              isScanning={isScanning}
              keywordTags={keywordTags}
              logLines={logLines}
              onScan={startScan}
            />
          </section>

          {/* 02 CANDIDATES */}
          {profiles.length > 0 && (
            <section className="section" ref={sectionRefs.candidates}>
              <h1 className="section-heading">
                {filteredProfiles.length} designer{filteredProfiles.length !== 1 ? 's' : ''}{' '}
                <em>found.</em>
              </h1>
              {activeKeyword && <p className="section-keyword-label">{activeKeyword}</p>}

              <CandidateList
                profiles={filteredProfiles}
                statuses={statuses}
                currentFilter={currentFilter}
                expandedUser={expandedUser}
                onFilterChange={setCurrentFilter}
                onCycleStatus={cycleStatus}
                onToggleDetail={toggleDetail}
              />
            </section>
          )}

          {/* 03 STATS */}
          {profiles.length > 0 && (
            <section className="section" ref={sectionRefs.stats}>
              <h1 className="section-heading">
                statistics <em>overview.</em>
              </h1>
              <StatsDashboard
                profiles={profiles}
                statuses={statuses}
                allKeywords={designers_store_keywords_for_stats(keywords)}
                activeKeyword={activeKeyword}
              />
            </section>
          )}

          {/* 04 EXPORT */}
          {profiles.length > 0 && (
            <section ref={sectionRefs.export}>
              <ExportSection profiles={profiles} statuses={statuses} keyword={activeKeyword} />
            </section>
          )}
        </main>
      )}
    </div>
  )
}

// Helper — keywords summary for stats component (just pass the list)
function designers_store_keywords_for_stats(keywords) {
  return keywords
}
