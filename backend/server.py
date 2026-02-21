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

# In-memory store for last scan results
last_results: List[dict] = []

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
    old_stdout = sys.stdout
    capture = LogCapture(queue, loop)
    sys.stdout = capture

    try:
        # The base_dir is the backend directory so images are saved in backend/scraped_images/
        base_dir = os.path.dirname(os.path.abspath(__file__))

        # 1. Scrape
        scraped = run_scraper(
            keyword=keyword,
            num_users=max_profiles,
            num_images=NUM_IMAGES_PER_PROFILE,
            base_dir=base_dir,
        )

        # 2. Analyze (uses Gemini vision on the saved images)
        profiles = analyze_all_designers(scraped, focus_area=keyword)

        capture.flush()
        asyncio.run_coroutine_threadsafe(
            queue.put(("result", profiles)), loop
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
    global last_results

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
                yield f"event: result\ndata: {json.dumps({'profiles': msg_data}, default=str)}\n\n"

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


@app.get("/api/export")
async def export_results(format: str = Query("json")):
    if not last_results:
        return JSONResponse({"error": "No results to export"}, status_code=404)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Username", "Name", "Location", "Followers",
            "Score", "Decision", "Skills", "Profile URL",
        ])
        for p in last_results:
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

    return JSONResponse(last_results)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "TalentLens API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
