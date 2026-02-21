import { useState, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar'
import SearchSection from './components/SearchSection'
import CandidateList from './components/CandidateList'
import CandidateDetail from './components/CandidateDetail'
import StatsDashboard from './components/StatsDashboard'
import ExportSection from './components/ExportSection'

export default function App() {
  const [profiles, setProfiles] = useState([])
  const [statuses, setStatuses] = useState({})
  const [currentFilter, setCurrentFilter] = useState('all')
  const [isScanning, setIsScanning] = useState(false)
  const [logLines, setLogLines] = useState([])
  const [keywordTags, setKeywordTags] = useState([])
  const [activeNav, setActiveNav] = useState('search')
  const [expandedUser, setExpandedUser] = useState(null)

  const sectionRefs = {
    search: useRef(null),
    candidates: useRef(null),
    stats: useRef(null),
    export: useRef(null),
  }

  const scrollTo = useCallback((section) => {
    setActiveNav(section)
    sectionRefs[section]?.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const startScan = useCallback((queries, maxUsers = 5) => {
    if (isScanning || queries.length === 0) return

    setIsScanning(true)
    setLogLines([])
    setProfiles([])
    setStatuses({})
    setExpandedUser(null)
    setKeywordTags(queries)

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
              finishScan([])
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
                    finishScan(resultProfiles)
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

  const finishScan = useCallback((resultProfiles) => {
    setIsScanning(false)
    if (resultProfiles.length > 0) {
      setProfiles(resultProfiles)
      const initialStatuses = {}
      resultProfiles.forEach((p) => {
        const username = p.original_data?.username || ''
        const score = p.final_analysis?.overall_score || 0
        let status = 'waitlisted'
        if (score >= 71) status = 'selected'
        else if (score <= 40) status = 'rejected'
        else status = 'waitlisted'
        if (username) initialStatuses[username] = status
      })
      setStatuses(initialStatuses)

      setTimeout(() => {
        sectionRefs.candidates.current?.scrollIntoView({ behavior: 'smooth' })
        setActiveNav('candidates')
      }, 400)
    }
  }, [])

  const cycleStatus = useCallback((username) => {
    setStatuses((prev) => {
      const cycle = ['selected', 'waitlisted', 'rejected']
      const current = prev[username] || 'selected'
      const idx = cycle.indexOf(current)
      return { ...prev, [username]: cycle[(idx + 1) % cycle.length] }
    })
  }, [])

  const toggleDetail = useCallback((username) => {
    setExpandedUser((prev) => (prev === username ? null : username))
  }, [])

  const filteredProfiles = currentFilter === 'all'
    ? profiles
    : profiles.filter((p) => statuses[p.original_data?.username] === currentFilter)

  return (
    <div className="app-layout">
      <Sidebar activeNav={activeNav} onNavigate={scrollTo} />

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
            <StatsDashboard profiles={profiles} statuses={statuses} />
          </section>
        )}

        {/* 04 EXPORT */}
        {profiles.length > 0 && (
          <section ref={sectionRefs.export}>
            <ExportSection profiles={profiles} statuses={statuses} />
          </section>
        )}
      </main>
    </div>
  )
}
