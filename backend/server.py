"""
TalentLens — FastAPI Backend Server
====================================
Streams real-time logs via SSE while running the Jina+Gemini
scraper → analyzer pipeline. Serves scraped images as static files.
"""

import sys
import io
import os
import json
import csv
import asyncio
import threading
from typing import List, Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from scraper import run_scraper
from analyzer import analyze_all_designers
from dev_module import router as dev_router, start_sheets_poller

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="TalentLens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure scraped_images directory exists and serve it as static files
IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scraped_images")
os.makedirs(IMAGES_DIR, exist_ok=True)
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

# Mount devs API router
app.include_router(dev_router)

# Start Google Sheets poller on startup
@app.on_event("startup")
async def startup_event():
    start_sheets_poller()

# ─── Designer Data Persistence ────────────────────────────────────────────────

DESIGNERS_DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "designers_data.json")

# Structure: { "keywords": { "<keyword>": { "profiles": [...], "statuses": {...}, "last_scanned": "..." } } }
designers_store: dict = {"keywords": {}}


def _load_designers():
    """Load persisted designer data from JSON."""
    global designers_store
    if os.path.exists(DESIGNERS_DATA_FILE):
        try:
            with open(DESIGNERS_DATA_FILE, "r", encoding="utf-8") as f:
                designers_store = json.load(f)
            if "keywords" not in designers_store:
                designers_store = {"keywords": {}}
            kw_count = len(designers_store["keywords"])
            total = sum(len(v.get("profiles", [])) for v in designers_store["keywords"].values())
            print(f"[Designers] Loaded {kw_count} keywords, {total} profiles from {DESIGNERS_DATA_FILE}")
        except Exception as e:
            print(f"[Designers] Error loading data: {e}")
            designers_store = {"keywords": {}}


def _save_designers():
    """Persist designer data to JSON."""
    try:
        with open(DESIGNERS_DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(designers_store, f, indent=2, default=str)
    except Exception as e:
        print(f"[Designers] Error saving data: {e}")


def _merge_profiles(existing_profiles: list, new_profiles: list) -> list:
    """Merge new profiles into existing, updating duplicates by username."""
    by_username = {}
    for p in existing_profiles:
        uname = p.get("original_data", {}).get("username", "")
        if uname:
            by_username[uname] = p
    for p in new_profiles:
        uname = p.get("original_data", {}).get("username", "")
        if uname:
            by_username[uname] = p  # new data overwrites old
    return list(by_username.values())


# In-memory store for last scan results (for SSE compatibility)
last_results: List[dict] = []
last_keyword: str = ""

# Number of work images to download per designer (env-controlled)
NUM_IMAGES_PER_PROFILE = int(os.getenv("NUM_IMAGES_PER_PROFILE", "3"))


# ─── Models ───────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    queries: List[str]
    max_profiles: int = 5


# ─── Log Capture ──────────────────────────────────────────────────────────────

class LogCapture(io.TextIOBase):
    """Redirect stdout to an asyncio queue for SSE streaming."""

    def __init__(self, queue: asyncio.Queue, loop: asyncio.AbstractEventLoop):
        self.queue = queue
        self.loop = loop
        self.buffer = ""

    def write(self, text: str) -> int:
        if not text:
            return 0
        self.buffer += text
        while "\n" in self.buffer:
            line, self.buffer = self.buffer.split("\n", 1)
            line = line.strip()
            if line:
                asyncio.run_coroutine_threadsafe(
                    self.queue.put(("log", line)), self.loop
                )
        return len(text)

    def flush(self):
        if self.buffer.strip():
            asyncio.run_coroutine_threadsafe(
                self.queue.put(("log", self.buffer.strip())), self.loop
            )
            self.buffer = ""


# ─── Pipeline Thread ──────────────────────────────────────────────────────────

def run_pipeline_thread(keyword: str, max_profiles: int,
                        queue: asyncio.Queue, loop: asyncio.AbstractEventLoop):
    """Run scraper → analyzer in a background thread with log capture."""
    global last_keyword
    old_stdout = sys.stdout
    capture = LogCapture(queue, loop)
    sys.stdout = capture
    last_keyword = keyword

    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))

        # 1. Scrape
        scraped = run_scraper(
            keyword=keyword,
            num_users=max_profiles,
            num_images=NUM_IMAGES_PER_PROFILE,
            base_dir=base_dir,
        )

        # 2. Analyze
        profiles = analyze_all_designers(scraped, focus_area=keyword)

        # 3. Persist — merge into existing keyword data
        kw_key = keyword.strip().lower()
        existing = designers_store["keywords"].get(kw_key, {}).get("profiles", [])
        merged = _merge_profiles(existing, profiles)
        designers_store["keywords"][kw_key] = {
            "profiles": merged,
            "statuses": designers_store["keywords"].get(kw_key, {}).get("statuses", {}),
            "last_scanned": __import__("datetime").datetime.now().isoformat(),
        }
        # Auto-assign statuses for new profiles
        existing_statuses = designers_store["keywords"][kw_key].get("statuses", {})
        for p in profiles:
            uname = p.get("original_data", {}).get("username", "")
            if uname and uname not in existing_statuses:
                score = p.get("final_analysis", {}).get("overall_score", 0)
                if score >= 71:
                    existing_statuses[uname] = "selected"
                elif score <= 40:
                    existing_statuses[uname] = "rejected"
                else:
                    existing_statuses[uname] = "waitlisted"
        designers_store["keywords"][kw_key]["statuses"] = existing_statuses
        _save_designers()

        capture.flush()
        asyncio.run_coroutine_threadsafe(
            queue.put(("result", merged)), loop
        )
    except Exception as e:
        capture.flush()
        asyncio.run_coroutine_threadsafe(
            queue.put(("error", str(e))), loop
        )
    finally:
        sys.stdout = old_stdout
        asyncio.run_coroutine_threadsafe(
            queue.put(("done", None)), loop
        )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/api/scan")
async def scan_designers(req: ScanRequest):
    global last_results, last_keyword

    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    # Use first query as keyword
    keyword = req.queries[0] if req.queries else "design"

    thread = threading.Thread(
        target=run_pipeline_thread,
        args=(keyword, req.max_profiles, queue, loop),
        daemon=True,
    )
    thread.start()

    async def event_stream():
        global last_results
        while True:
            msg_type, msg_data = await queue.get()

            if msg_type == "log":
                yield f"event: log\ndata: {json.dumps({'message': msg_data})}\n\n"

            elif msg_type == "result":
                last_results = msg_data
                yield f"event: result\ndata: {json.dumps({'profiles': msg_data, 'keyword': keyword}, default=str)}\n\n"

            elif msg_type == "error":
                yield f"event: error\ndata: {json.dumps({'error': msg_data})}\n\n"

            elif msg_type == "done":
                yield f"event: done\ndata: {json.dumps({'status': 'complete'})}\n\n"
                break

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Designer Keyword Endpoints ──────────────────────────────────────────────

@app.get("/api/designers/keywords")
async def list_keywords():
    """Return all stored keywords with metadata."""
    keywords = []
    for kw, data in designers_store.get("keywords", {}).items():
        profiles = data.get("profiles", [])
        statuses = data.get("statuses", {})
        selected = sum(1 for s in statuses.values() if s == "selected")
        keywords.append({
            "keyword": kw,
            "total_profiles": len(profiles),
            "selected": selected,
            "last_scanned": data.get("last_scanned", ""),
        })
    # Sort by most recent scan
    keywords.sort(key=lambda x: x.get("last_scanned", ""), reverse=True)
    return {"keywords": keywords}


@app.get("/api/designers/keyword/{keyword}")
async def get_keyword_data(keyword: str):
    """Return profiles and statuses for a specific keyword."""
    kw_key = keyword.strip().lower()
    data = designers_store.get("keywords", {}).get(kw_key)
    if not data:
        return JSONResponse({"error": "Keyword not found"}, status_code=404)
    return {
        "keyword": kw_key,
        "profiles": data.get("profiles", []),
        "statuses": data.get("statuses", {}),
        "last_scanned": data.get("last_scanned", ""),
    }


@app.put("/api/designers/keyword/{keyword}/status/{username}")
async def update_designer_status(keyword: str, username: str, status: str = Query(...)):
    """Update a designer's status within a keyword group."""
    kw_key = keyword.strip().lower()
    data = designers_store.get("keywords", {}).get(kw_key)
    if not data:
        return JSONResponse({"error": "Keyword not found"}, status_code=404)

    if status not in ("selected", "waitlisted", "rejected"):
        return JSONResponse({"error": "Invalid status"}, status_code=400)

    data.setdefault("statuses", {})[username] = status
    _save_designers()
    return {"message": f"{username} → {status}"}


@app.delete("/api/designers/keyword/{keyword}")
async def delete_keyword(keyword: str):
    """Delete all data for a keyword."""
    kw_key = keyword.strip().lower()
    if kw_key in designers_store.get("keywords", {}):
        del designers_store["keywords"][kw_key]
        _save_designers()
        return {"message": f"Deleted keyword '{kw_key}'"}
    return JSONResponse({"error": "Keyword not found"}, status_code=404)


@app.get("/api/export")
async def export_results(format: str = Query("json"), keyword: str = Query("")):
    # If keyword specified, use that data; otherwise use last_results
    if keyword:
        kw_key = keyword.strip().lower()
        data = designers_store.get("keywords", {}).get(kw_key, {})
        export_profiles = data.get("profiles", [])
    else:
        export_profiles = last_results

    if not export_profiles:
        return JSONResponse({"error": "No results to export"}, status_code=404)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Username", "Name", "Location", "Followers",
            "Score", "Decision", "Skills", "Profile URL",
        ])
        for p in export_profiles:
            od = p.get("original_data", {})
            fa = p.get("final_analysis", {})
            rec = fa.get("recommendation", {})
            writer.writerow([
                od.get("username", ""),
                od.get("name", ""),
                od.get("location", ""),
                od.get("followers_count", ""),
                fa.get("overall_score", ""),
                rec.get("decision", ""),
                ", ".join(od.get("specializations", [])),
                od.get("profile_url", ""),
            ])

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=talentlens_export.csv"},
        )

    return JSONResponse(export_profiles)


@app.get("/api/health")
async def health():
    # Show partial keys so we can verify env vars are loaded on Render
    def _mask(key):
        val = (os.getenv(key) or "").strip().strip('"').strip("'")
        if not val:
            return "NOT SET"
        return f"{val[:8]}...{val[-4:]}" if len(val) > 12 else "***"
    return {
        "status": "ok",
        "service": "TalentLens API",
        "env": {
            "GEMINI_API_KEY": _mask("GEMINI_API_KEY"),
            "JINA_API_KEY": _mask("JINA_API_KEY"),
            "GITHUB_TOKEN": _mask("GITHUB_TOKEN"),
            "GEMINI_SCRAPER_MODEL": os.getenv("GEMINI_SCRAPER_MODEL", "(default)"),
        }
    }


@app.get("/api/debug-gemini")
async def debug_gemini():
    """Minimal Gemini test — call with the raw env var to pinpoint the issue."""
    from google import genai as _genai

    raw_val = os.getenv("GEMINI_API_KEY", "")
    cleaned = raw_val.strip().strip('"').strip("'")

    info = {
        "raw_length": len(raw_val),
        "cleaned_length": len(cleaned),
        "raw_repr": repr(raw_val[:20]) + "..." if len(raw_val) > 20 else repr(raw_val),
        "has_newline": "\n" in raw_val or "\r" in raw_val,
        "has_space": " " in raw_val,
        "starts_with_AIza": cleaned.startswith("AIza"),
    }

    # Try a minimal Gemini call
    try:
        client = _genai.Client(api_key=cleaned)
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents="Say hello in one word.",
        )
        info["gemini_test"] = "SUCCESS"
        info["gemini_response"] = resp.text[:100] if resp.text else "(empty)"
    except Exception as e:
        info["gemini_test"] = "FAILED"
        info["gemini_error"] = str(e)[:300]

    return info


# ─── Initialize ───────────────────────────────────────────────────────────────
_load_designers()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
