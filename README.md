# TalentLens — Designer Talent Intelligence Dashboard

A full-stack tool that finds, analyzes, and scores designers from Dribbble using AI. Editorial-minimalist interface inspired by unitedbyai.com.

## Project Structure

```
talent-lens/
├── backend/
│   ├── server.py                    # FastAPI with SSE streaming
│   ├── dribble_scraper_agent.py     # Scraper + Analyzer pipeline
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js               # Proxies /api → :8000
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css                # Editorial design system
│       └── components/
│           ├── Sidebar.jsx
│           ├── SearchSection.jsx
│           ├── CandidateList.jsx
│           ├── CandidateDetail.jsx
│           └── ExportSection.jsx
└── README.md
```

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python server.py
```

The API server starts on **http://localhost:8000**.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server starts on **http://localhost:5173** and proxies `/api` requests to the backend.

### 3. Open

Navigate to **http://localhost:5173** in your browser.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scan` | Start a scan (SSE stream) |
| GET | `/api/export?format=json\|csv` | Export last results |
| GET | `/api/health` | Health check |

### POST /api/scan

```json
{
  "queries": ["vc fund dashboard", "cap table"],
  "max_profiles": 5
}
```

Returns a Server-Sent Events stream with `log`, `result`, `error`, and `done` events.

## Design

- **Typography**: Playfair Display (serif headings) + DM Mono (monospace data)
- **Colors**: `#0a0a0a` background, `#f0ece4` text, `#1e1e1e` borders
- **Layout**: Fixed 220px sidebar, editorial spacing, accordion detail rows
- **Aesthetic**: Raw editorial minimalism — no gradients, no glow, no colored cards
