import { useEffect, useRef, useState } from 'react'

/* ─────────── data ─────────── */
const STATS = [
  { value: '10x',   label: 'Faster Screening' },
  { value: '95%',   label: 'Analysis Accuracy' },
  { value: '2',     label: 'Talent Verticals' },
  { value: '<60s',  label: 'Per Candidate' },
]

const FEATURES = [
  {
    num: '01',
    title: 'AI-Powered Design Scouting',
    desc: 'Scrape Dribbble in real-time, download portfolios, and let Gemini Vision score visual quality, consistency, and style — all in one click.',
  },
  {
    num: '02',
    title: 'GitHub Deep Analysis',
    desc: 'Pull commit history, repo quality, language diversity, and contribution patterns through the GitHub GraphQL API. No guessing — just data.',
  },
  {
    num: '03',
    title: 'Resume Intelligence',
    desc: 'PDF parsing powered by LLM extraction. Skills, experience, projects, certifications — structured and scored against your role requirements.',
  },
  {
    num: '04',
    title: 'Unified Evaluation Engine',
    desc: 'Gemini synthesizes portfolio, code, and resume signals into a single weighted score with detailed metric breakdowns and hire/reject recommendations.',
  },
]

const WORKFLOW = [
  { step: '01', title: 'Define', desc: 'Set your role, keywords, or paste a Google Sheet link.' },
  { step: '02', title: 'Scan', desc: 'AI scrapes, downloads, and analyzes candidates in real-time.' },
  { step: '03', title: 'Review', desc: 'Browse scored profiles, compare stats, and manage statuses.' },
  { step: '04', title: 'Recruit', desc: 'Export your shortlist as JSON or CSV. Done.' },
]

/* ─────────── hook: intersection observer for scroll animations ─────────── */
function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('lp-visible')
          io.unobserve(el)
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

/* ─────────── small components ─────────── */
function RevealSection({ className = '', children, style }) {
  const ref = useReveal()
  return (
    <div ref={ref} className={`lp-reveal ${className}`} style={style}>
      {children}
    </div>
  )
}

function StatCard({ value, label, delay }) {
  const ref = useReveal()
  return (
    <div ref={ref} className="lp-reveal lp-stat-card" style={{ transitionDelay: `${delay}ms` }}>
      <span className="lp-stat-value">{value}</span>
      <span className="lp-stat-label">{label}</span>
    </div>
  )
}

function FeatureCard({ num, title, desc, delay }) {
  const ref = useReveal()
  return (
    <div ref={ref} className="lp-reveal lp-feature-card" style={{ transitionDelay: `${delay}ms` }}>
      <span className="lp-feature-num">{num}</span>
      <h3 className="lp-feature-title">{title}</h3>
      <p className="lp-feature-desc">{desc}</p>
    </div>
  )
}

function WorkflowStep({ step, title, desc, delay }) {
  const ref = useReveal()
  return (
    <div ref={ref} className="lp-reveal lp-wf-step" style={{ transitionDelay: `${delay}ms` }}>
      <div className="lp-wf-num">{step}</div>
      <div>
        <h4 className="lp-wf-title">{title}</h4>
        <p className="lp-wf-desc">{desc}</p>
      </div>
    </div>
  )
}

/* ─────────── animated counter ─────────── */
function Counter({ end, suffix = '', duration = 2000 }) {
  const [val, setVal] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const num = parseInt(end, 10)
          if (isNaN(num)) { setVal(end); io.unobserve(el); return }
          const step = Math.ceil(num / (duration / 16))
          let cur = 0
          const id = setInterval(() => {
            cur += step
            if (cur >= num) { cur = num; clearInterval(id) }
            setVal(cur)
          }, 16)
          io.unobserve(el)
        }
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [end, duration])

  return <span ref={ref}>{val}{suffix}</span>
}

/* ─────────── MAIN COMPONENT ─────────── */
export default function LandingPage({ onEnter }) {
  const heroRef = useRef(null)
  const [scrollY, setScrollY] = useState(0)

  /* parallax + blur on scroll */
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const heroBlur = Math.min(scrollY / 80, 12)
  const heroOpacity = Math.max(1 - scrollY / 600, 0)
  const heroScale = 1 + scrollY * 0.0002

  return (
    <div className="lp">
      {/* ░░░ NAV ░░░ */}
      <nav className="lp-nav">
        <div className="lp-nav-brand">Talent<em>Lens</em></div>
        <button className="lp-nav-cta" onClick={onEnter}>launch app →</button>
      </nav>

      {/* ░░░ HERO ░░░ */}
      <section className="lp-hero" ref={heroRef}>
        <div
          className="lp-hero-inner"
          style={{
            filter: `blur(${heroBlur}px)`,
            opacity: heroOpacity,
            transform: `scale(${heroScale})`,
          }}
        >
          <p className="lp-hero-eyebrow">ai-powered recruitment intelligence</p>
          <h1 className="lp-hero-title">
            Find <span className="hero-talent">talent</span><br />
            that <em>matters.</em>
          </h1>
          <p className="lp-hero-sub">
            From Dribbble portfolios to GitHub commits to resume parsing — one platform
            that analyzes, scores, and ranks candidates so you don't have to.
          </p>
          <button className="lp-hero-btn" onClick={onEnter}>
            recruit now
          </button>
        </div>
        <div className="lp-hero-scroll-hint">
          <span>scroll</span>
          <div className="lp-scroll-line" />
        </div>
      </section>

      {/* ░░░ STATS BAR ░░░ */}
      <section className="lp-stats">
        {STATS.map((s, i) => (
          <StatCard key={i} value={s.value} label={s.label} delay={i * 120} />
        ))}
      </section>

      {/* ░░░ PROBLEM / WHY ░░░ */}
      <section className="lp-section">
        <RevealSection className="lp-why">
          <span className="lp-section-num">01</span>
          <h2 className="lp-section-title">
            Recruitment is <em>broken.</em>
          </h2>
          <p className="lp-section-body">
            Hiring managers spend an average of <strong>23 hours</strong> screening
            candidates for a single role — scrolling portfolios, reading resumes,
            and checking GitHub profiles one by one. Most of it is noise.
          </p>
          <p className="lp-section-body">
            TalentLens replaces that entire workflow with an AI pipeline that
            scrapes, analyzes, and evaluates candidates across <strong>designers</strong> and{' '}
            <strong>developers</strong> — in under 60 seconds per candidate.
          </p>
        </RevealSection>
      </section>

      {/* ░░░ FEATURES ░░░ */}
      <section className="lp-section">
        <RevealSection>
          <span className="lp-section-num">02</span>
          <h2 className="lp-section-title">
            What it <em>does.</em>
          </h2>
        </RevealSection>
        <div className="lp-features-grid">
          {FEATURES.map((f, i) => (
            <FeatureCard key={i} num={f.num} title={f.title} desc={f.desc} delay={i * 100} />
          ))}
        </div>
      </section>

      {/* ░░░ WORKFLOW ░░░ */}
      <section className="lp-section">
        <RevealSection>
          <span className="lp-section-num">03</span>
          <h2 className="lp-section-title">
            How it <em>works.</em>
          </h2>
        </RevealSection>
        <div className="lp-workflow">
          {WORKFLOW.map((w, i) => (
            <WorkflowStep key={i} step={w.step} title={w.title} desc={w.desc} delay={i * 120} />
          ))}
        </div>
      </section>

      {/* ░░░ NUMBERS ░░░ */}
      <section className="lp-section lp-numbers-section">
        <RevealSection>
          <span className="lp-section-num">04</span>
          <h2 className="lp-section-title">
            Built for <em>scale.</em>
          </h2>
        </RevealSection>
        <div className="lp-numbers-grid">
          <RevealSection className="lp-number-card" style={{ transitionDelay: '0ms' }}>
            <span className="lp-number-val"><Counter end="500" suffix="+" /></span>
            <span className="lp-number-label">Designers Analyzed</span>
          </RevealSection>
          <RevealSection className="lp-number-card" style={{ transitionDelay: '100ms' }}>
            <span className="lp-number-val"><Counter end="200" suffix="+" /></span>
            <span className="lp-number-label">Dev Candidates Scored</span>
          </RevealSection>
          <RevealSection className="lp-number-card" style={{ transitionDelay: '200ms' }}>
            <span className="lp-number-val"><Counter end="50" suffix="+" /></span>
            <span className="lp-number-label">Keywords Tracked</span>
          </RevealSection>
          <RevealSection className="lp-number-card" style={{ transitionDelay: '300ms' }}>
            <span className="lp-number-val"><Counter end="98" suffix="%" /></span>
            <span className="lp-number-label">Time Saved</span>
          </RevealSection>
        </div>
      </section>

      {/* ░░░ NOVELTY ░░░ */}
      <section className="lp-section">
        <RevealSection className="lp-novelty">
          <span className="lp-section-num">05</span>
          <h2 className="lp-section-title">
            Why this <em>exists.</em>
          </h2>
          <div className="lp-novelty-grid">
            <div className="lp-novelty-card">
              <h4>No SaaS Lock-in</h4>
              <p>Runs locally. Your data stays in JSON on your machine. No subscriptions, no vendor dependency.</p>
            </div>
            <div className="lp-novelty-card">
              <h4>Multi-Signal Fusion</h4>
              <p>Unlike single-channel tools, TalentLens fuses portfolio visuals, code quality, and resume data into one score.</p>
            </div>
            <div className="lp-novelty-card">
              <h4>Real-time Streaming</h4>
              <p>Watch the AI think. SSE-powered live logs show every scrape, download, and analysis as it happens.</p>
            </div>
            <div className="lp-novelty-card">
              <h4>Two Verticals, One Tool</h4>
              <p>Designers via Dribbble + Gemini Vision. Developers via GitHub + Resume + LLM. Switch with one click.</p>
            </div>
          </div>
        </RevealSection>
      </section>

      {/* ░░░ CTA ░░░ */}
      <section className="lp-cta-section">
        <RevealSection className="lp-cta-inner">
          <h2 className="lp-cta-title">
            Stop scrolling portfolios.<br />
            Start <em>recruiting.</em>
          </h2>
          <button className="lp-hero-btn" onClick={onEnter}>
            recruit now
          </button>
          <p className="lp-cta-sub">No sign-up needed. Runs locally. Free forever.</p>
        </RevealSection>
      </section>

      {/* ░░░ FOOTER ░░░ */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">Talent<em>Lens</em></div>
        <p className="lp-footer-copy">built with gemini, react & obsession © 2026</p>
      </footer>
    </div>
  )
}
