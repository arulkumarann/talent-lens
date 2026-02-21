"""
Dev Module — Roles, Webhook, Sheets Poller
=============================================
Manages developer recruitment roles, Tally webhook intake,
Google Sheets polling, and candidate lifecycle.
"""

import os
import csv
import io
import json
import time
import uuid
import threading
import requests
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

from dev_analyzer import analyze_dev_candidate

from dotenv import load_dotenv
load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────

GOOGLE_SHEET_URL = os.getenv("GOOGLE_SHEET_URL", "")
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "devs_data.json")
SHEET_POLL_INTERVAL = 300  # 5 minutes

# ─── Router ───────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/devs", tags=["devs"])

# ─── In-Memory Store ──────────────────────────────────────────────────────────

store: Dict = {"roles": {}, "sheet_last_ids": set()}


def _save():
    """Persist store to JSON file."""
    data = {
        "roles": store["roles"],
        "sheet_last_ids": list(store["sheet_last_ids"]),
    }
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)


def _load():
    """Load store from JSON file if it exists."""
    global store
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            store["roles"] = data.get("roles", {})
            store["sheet_last_ids"] = set(data.get("sheet_last_ids", []))
            print(f"[DevModule] Loaded {len(store['roles'])} roles from {DATA_FILE}")
        except Exception as e:
            print(f"[DevModule] Error loading data: {e}")


# ─── Models ───────────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str
    jd: str
    ctc: str
    positions: int
    tally_link: str = ""
    tally_form_id: str = ""
    sheet_url: str = ""


class StatusUpdate(BaseModel):
    status: str  # selected, waitlisted, rejected


# ─── Role Endpoints ──────────────────────────────────────────────────────────

@router.get("/roles")
async def list_roles():
    roles = []
    for role_id, role in store["roles"].items():
        candidates = role.get("candidates", {})
        selected = sum(1 for c in candidates.values()
                       if c.get("status") == "selected")
        roles.append({
            "id": role_id,
            "name": role["name"],
            "jd": role["jd"],
            "ctc": role["ctc"],
            "positions": role["positions"],
            "tally_link": role.get("tally_link", ""),
            "tally_form_id": role.get("tally_form_id", ""),
            "sheet_url": role.get("sheet_url", ""),
            "total_candidates": len(candidates),
            "selected_count": selected,
        })
    return {"roles": roles}


@router.post("/roles")
async def create_role(req: RoleCreate):
    role_id = str(uuid.uuid4())[:8]
    store["roles"][role_id] = {
        "name": req.name,
        "jd": req.jd,
        "ctc": req.ctc,
        "positions": req.positions,
        "tally_link": req.tally_link,
        "tally_form_id": req.tally_form_id,
        "sheet_url": req.sheet_url,
        "candidates": {},
        "created_at": datetime.now().isoformat(),
    }
    _save()
    print(f"[DevModule] Created role: {req.name} ({role_id})")
    return {"id": role_id, "message": f"Role '{req.name}' created"}


@router.get("/roles/{role_id}")
async def get_role(role_id: str):
    role = store["roles"].get(role_id)
    if not role:
        return {"error": "Role not found"}, 404

    candidates_list = []
    for cid, c in role.get("candidates", {}).items():
        candidates_list.append({**c, "id": cid})

    # Sort by score descending
    candidates_list.sort(
        key=lambda x: x.get("evaluation", {}).get("overall_score", 0),
        reverse=True
    )

    selected_count = sum(1 for c in candidates_list if c.get("status") == "selected")

    return {
        "id": role_id,
        "name": role["name"],
        "jd": role["jd"],
        "ctc": role["ctc"],
        "positions": role["positions"],
        "tally_link": role.get("tally_link", ""),
        "tally_form_id": role.get("tally_form_id", ""),
        "sheet_url": role.get("sheet_url", ""),
        "selected_count": selected_count,
        "candidates": candidates_list,
    }


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str):
    if role_id in store["roles"]:
        name = store["roles"][role_id]["name"]
        del store["roles"][role_id]
        _save()
        return {"message": f"Role '{name}' deleted"}
    return {"error": "Role not found"}


# ─── Candidate Status ────────────────────────────────────────────────────────

@router.put("/roles/{role_id}/candidates/{candidate_id}/status")
async def update_candidate_status(role_id: str, candidate_id: str, req: StatusUpdate):
    role = store["roles"].get(role_id)
    if not role:
        return {"error": "Role not found"}

    candidate = role["candidates"].get(candidate_id)
    if not candidate:
        return {"error": "Candidate not found"}

    # Check slot limit for selection
    if req.status == "selected":
        selected_count = sum(1 for c in role["candidates"].values()
                             if c.get("status") == "selected" and c.get("id") != candidate_id)
        if selected_count >= role["positions"]:
            return {"error": f"All {role['positions']} positions are filled. Cannot select more."}

    candidate["status"] = req.status
    _save()
    return {"message": f"Status updated to {req.status}"}


# ─── Tally Webhook ────────────────────────────────────────────────────────────

@router.post("/webhook")
async def tally_webhook(request: Request):
    """Receive Tally form submission webhook."""
    try:
        payload = await request.json()
    except Exception:
        return {"error": "Invalid JSON"}

    data = payload.get("data", {})
    form_id = data.get("formId", "")
    submission_id = data.get("submissionId", "")
    fields = data.get("fields", [])

    if not fields:
        return {"status": "no fields"}

    # Parse fields
    candidate = _parse_tally_fields(fields, submission_id)

    # Find matching role by formId
    matched_role_id = None
    for role_id, role in store["roles"].items():
        if role.get("tally_form_id") == form_id:
            matched_role_id = role_id
            break

    if not matched_role_id:
        # No matching role — try to find a role that has no form_id set (default)
        for role_id, role in store["roles"].items():
            if not role.get("tally_form_id"):
                matched_role_id = role_id
                break

    if not matched_role_id:
        # Still no match — add to first role if any
        if store["roles"]:
            matched_role_id = list(store["roles"].keys())[0]
        else:
            print(f"[Webhook] No roles exist. Creating default role.")
            matched_role_id = str(uuid.uuid4())[:8]
            store["roles"][matched_role_id] = {
                "name": data.get("formName", "Default Role"),
                "jd": "",
                "ctc": "",
                "positions": 10,
                "tally_link": "",
                "tally_form_id": form_id,
                "sheet_url": "",
                "candidates": {},
                "created_at": datetime.now().isoformat(),
            }

    # Check for duplicates
    role = store["roles"][matched_role_id]
    if submission_id in role["candidates"]:
        print(f"[Webhook] Duplicate submission {submission_id}, skipping")
        return {"status": "duplicate"}

    # Add candidate
    role["candidates"][submission_id] = candidate
    _save()

    print(f"[Webhook] Added {candidate['name']} to role '{role['name']}'")

    # Trigger async analysis
    threading.Thread(
        target=_analyze_candidate_async,
        args=(matched_role_id, submission_id),
        daemon=True
    ).start()

    return {"status": "received", "candidate": candidate["name"], "role": role["name"]}


def _parse_tally_fields(fields: List[Dict], submission_id: str = "") -> Dict:
    """Parse Tally form fields into a candidate dict."""
    candidate = {
        "submission_id": submission_id,
        "name": "",
        "phone": "",
        "email": "",
        "resume_url": "",
        "github_username": "",
        "linkedin": "",
        "current_ctc": "",
        "status": "waitlisted",
        "submitted_at": datetime.now().isoformat(),
        "evaluation": None,
        "github_analysis": None,
        "resume_analysis": None,
    }

    for field in fields:
        label = field.get("label", "").lower()
        value = field.get("value", "")
        field_type = field.get("type", "")

        if "name" in label and "user" not in label:
            candidate["name"] = value
        elif "number" in label or "phone" in label:
            candidate["phone"] = value
        elif "email" in label:
            candidate["email"] = value
        elif "resume" in label or field_type == "FILE_UPLOAD":
            if isinstance(value, list) and len(value) > 0:
                candidate["resume_url"] = value[0].get("url", "")
            elif isinstance(value, str):
                candidate["resume_url"] = value
        elif "github" in label:
            candidate["github_username"] = value
        elif "linkedin" in label:
            candidate["linkedin"] = value
        elif "ctc" in label or "salary" in label:
            candidate["current_ctc"] = value

    return candidate


def _analyze_candidate_async(role_id: str, candidate_id: str):
    """Run analysis in background thread."""
    try:
        role = store["roles"].get(role_id)
        if not role:
            return
        candidate = role["candidates"].get(candidate_id)
        if not candidate:
            return

        result = analyze_dev_candidate(candidate, role)

        # Update candidate with results
        candidate["github_analysis"] = result.get("github_analysis")
        candidate["resume_analysis"] = result.get("resume_analysis")
        candidate["evaluation"] = result.get("evaluation")

        # Set initial status based on score
        score = (result.get("evaluation") or {}).get("overall_score", 50)
        if score >= 71:
            candidate["status"] = "selected"
            # But check slot limit
            selected = sum(1 for c in role["candidates"].values()
                           if c.get("status") == "selected"
                           and c.get("submission_id") != candidate_id)
            if selected >= role["positions"]:
                candidate["status"] = "waitlisted"
        elif score <= 40:
            candidate["status"] = "rejected"
        else:
            candidate["status"] = "waitlisted"

        _save()
        print(f"  [DevModule] Analysis complete for {candidate['name']}: "
              f"score={score}, status={candidate['status']}")

    except Exception as e:
        print(f"  [DevModule] Error in async analysis: {e}")


# ─── Google Sheets Poller ─────────────────────────────────────────────────────

def _convert_sheet_url(url):
    """Convert Google Sheets edit URL to CSV export URL."""
    if not url:
        return url
    # Already a CSV export URL
    if "export?format=csv" in url or "pub?output=csv" in url:
        return url
    # Convert /edit... to /export?format=csv
    import re as _re
    match = _re.match(r'https://docs\.google\.com/spreadsheets/d/([^/]+)', url)
    if match:
        sheet_id = match.group(1)
        csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
        print(f"[Sheets] Converted URL to CSV export: {csv_url}")
        return csv_url
    return url


def _import_from_sheet(target_role_id, sheet_url):
    """Fetch a sheet CSV and add new candidates to the role. Returns count added."""
    sheet_url = _convert_sheet_url(sheet_url)
    if not sheet_url:
        return 0

    try:
        resp = requests.get(sheet_url, timeout=30)
        resp.raise_for_status()
        reader = csv.DictReader(io.StringIO(resp.text))

        new_count = 0
        for row in reader:
            sub_id = row.get("Submission ID", "").strip()
            if not sub_id:
                continue

            # Find target role
            actual_role_id = target_role_id
            if actual_role_id == "__global__":
                if store["roles"]:
                    actual_role_id = list(store["roles"].keys())[0]
                else:
                    print(f"[Sheets] No roles exist, skipping")
                    continue

            role = store["roles"].get(actual_role_id)
            if not role:
                continue

            # Skip if already in this role OR already seen
            if sub_id in role["candidates"]:
                continue
            if sub_id in store["sheet_last_ids"]:
                continue

            candidate = {
                "submission_id": sub_id,
                "name": row.get("What is your full name?", "").strip(),
                "phone": row.get("Your number?", "").strip(),
                "email": row.get("Your email", "").strip(),
                "resume_url": row.get("Updated resume", "").strip(),
                "github_username": row.get("Your github username", "").strip(),
                "linkedin": row.get("Your linkedin", "").strip(),
                "current_ctc": row.get("Current CTC", "").strip(),
                "status": "waitlisted",
                "submitted_at": row.get("Submitted at", datetime.now().isoformat()),
                "evaluation": None,
                "github_analysis": None,
                "resume_analysis": None,
            }

            role["candidates"][sub_id] = candidate
            # Only mark as seen AFTER successfully adding
            store["sheet_last_ids"].add(sub_id)
            new_count += 1

            # Trigger async analysis
            threading.Thread(
                target=_analyze_candidate_async,
                args=(actual_role_id, sub_id),
                daemon=True
            ).start()

        if new_count > 0:
            _save()
            print(f"[Sheets] Added {new_count} new candidates from sheet")

        return new_count

    except Exception as e:
        print(f"[Sheets] Error fetching sheet: {e}")
        return 0


def _poll_google_sheet():
    """Periodically fetch Google Sheet CSV and add new candidates."""
    while True:
        try:
            urls_to_check = set()
            if GOOGLE_SHEET_URL:
                urls_to_check.add(("__global__", GOOGLE_SHEET_URL))
            for role_id, role in store["roles"].items():
                if role.get("sheet_url"):
                    urls_to_check.add((role_id, role["sheet_url"]))

            for target_role_id, sheet_url in urls_to_check:
                _import_from_sheet(target_role_id, sheet_url)

        except Exception as e:
            print(f"[Sheets] Poller error: {e}")

        time.sleep(SHEET_POLL_INTERVAL)


def start_sheets_poller():
    """Start the Google Sheets polling thread."""
    thread = threading.Thread(target=_poll_google_sheet, daemon=True)
    thread.start()
    print("[DevModule] Google Sheets poller started (every 5 min)")


# ─── Trigger analysis for a role ──────────────────────────────────────────────

@router.post("/roles/{role_id}/analyze")
async def analyze_role_candidates(role_id: str):
    """Manually trigger analysis for all un-analyzed candidates in a role."""
    role = store["roles"].get(role_id)
    if not role:
        return {"error": "Role not found"}

    unanalyzed = [
        (cid, c) for cid, c in role["candidates"].items()
        if not c.get("evaluation")
    ]

    if not unanalyzed:
        return {"message": "All candidates already analyzed"}

    for cid, _ in unanalyzed:
        threading.Thread(
            target=_analyze_candidate_async,
            args=(role_id, cid),
            daemon=True
        ).start()

    return {"message": f"Triggered analysis for {len(unanalyzed)} candidates"}


# ─── Initialize ───────────────────────────────────────────────────────────────

_load()
