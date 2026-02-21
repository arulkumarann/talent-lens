"""
Dribbble Scraper — Jina AI + Gemini Flash
==========================================
Scrapes Dribbble search results, designer profiles, and shot images.

Inputs:
  - keyword          : search term (e.g. "healthcare")
  - num_users        : how many designer profiles to scrape
  - num_images       : how many shot images to download per profile

Output:
  - JSON file with all scraped designer data + relative image paths
  - Downloaded images in ./scraped_images/<username>/
"""

import requests
import json
import time
import re
import os
from typing import List, Dict, Optional
from datetime import datetime
from urllib.parse import quote

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

JINA_API_KEY = os.getenv("JINA_API_KEY")
GEMINI_FLASH = "gemini-2.5-flash"

JINA_HEADERS = {
    "Authorization": f"Bearer {JINA_API_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Engine": "browser",
    "X-With-Shadow-Dom": "true",
}

# Exclusion set — these are Dribbble system pages, not real designer profiles
EXCLUDED_USERNAMES = {
    "signups", "session", "pro", "shots", "search", "designers",
    "instantmatch", "stories", "jobs", "contact", "about", "careers",
    "advertise", "hiring", "for-designers", "browse-project-briefs",
    "services", "freshbooks", "designer-advertising", "tags",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _gemini_text(system: str, user: str, max_tokens: int = 2000) -> str:
    """Call Gemini Flash and return the raw text response."""
    response = gemini_client.models.generate_content(
        model=GEMINI_FLASH,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_tokens,
            temperature=0.1,
        ),
    )
    return response.text or ""


def _parse_json_from_text(text: str):
    """Try several strategies to extract a JSON value from text."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    if "```json" in text:
        s = text.find("```json") + 7
        e = text.find("```", s)
        try:
            return json.loads(text[s:e].strip())
        except Exception:
            pass
    if "```" in text:
        s = text.find("```") + 3
        e = text.find("```", s)
        try:
            return json.loads(text[s:e].strip())
        except Exception:
            pass
    for pattern in (r'\{.*\}', r'\[.*?\]'):
        m = re.search(pattern, text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return None


def _jina_fetch(url: str, retries: int = 2) -> Optional[str]:
    """Fetch a page via Jina Reader API with retries."""
    for attempt in range(retries + 1):
        try:
            print(f"  [Jina] Fetching: {url}" + (f" (retry {attempt})" if attempt > 0 else ""))
            response = requests.post(
                "https://r.jina.ai/",
                headers=JINA_HEADERS,
                json={"url": url},
                timeout=60,
            )
            if response.status_code == 200:
                data = response.json()
                content = data.get("data", {}).get("content", "")
                if content and len(content) > 500:
                    print(f"  [Jina] Got {len(content)} chars")
                    return content
                else:
                    print(f"  [Jina] Content too short ({len(content)} chars), retrying...")
            else:
                print(f"  [Jina] HTTP {response.status_code}")
        except Exception as e:
            print(f"  [Jina] Error: {e}")
        if attempt < retries:
            time.sleep(3)
    return None


# ─── Step 1: Search Dribbble (regex-based, no LLM needed) ────────────────────

def search_dribbble(keyword: str, num_users: int) -> List[Dict]:
    """
    Search Dribbble for a keyword and extract unique designer usernames
    and their shot image URLs directly from the Jina markdown content.
    """
    search_url = f"https://dribbble.com/search/{quote(keyword)}"
    raw = _jina_fetch(search_url)
    if not raw:
        print("[Search] Failed to fetch search page")
        return []

    # Extract username -> shots mapping from the markdown
    username_pattern = re.compile(
        r'\[!\[Image \d+: ([^\]]*)\]\([^)]+\)([^\]]*)\]\(https://dribbble\.com/([a-zA-Z0-9_\-]+)\)'
    )

    # Extract shots with their image URLs
    shot_pattern = re.compile(
        r'!\[Image \d+: ([^\]]*)\]\((https://cdn\.dribbble\.com/[^\s\)]+)\).*?\[View ([^\]]*)\]\(https://dribbble\.com/shots/[^\)]+\)'
    )

    shots_data = []
    for m in shot_pattern.finditer(raw):
        shots_data.append({
            "alt_text": m.group(1),
            "image_url": m.group(2),
            "title": m.group(3),
        })

    all_usernames = []
    for m in username_pattern.finditer(raw):
        uname = m.group(3).strip()
        display = m.group(1).strip()
        if uname not in EXCLUDED_USERNAMES and not uname.startswith("shots"):
            all_usernames.append({"username": uname, "display_name": display})

    seen = set()
    designers = []
    for entry in all_usernames:
        uname = entry["username"]
        if uname not in seen:
            seen.add(uname)
            designers.append({
                "username": uname,
                "display_name": entry["display_name"],
                "profile_url": f"https://dribbble.com/{uname}",
            })

    print(f"[Search] Found {len(designers)} unique designers")

    # Pair shots with designers from the markdown
    lines = raw.split("\n")
    current_shot_images = []
    designer_shots_map = {}

    for line in lines:
        shot_match = re.search(
            r'!\[Image \d+: ([^\]]*)\]\((https://cdn\.dribbble\.com/userupload/[^\s\)]+)\).*?\[View ([^\]]*)\]',
            line
        )
        if shot_match:
            current_shot_images.append({
                "title": shot_match.group(3),
                "image_url": shot_match.group(2),
            })
            continue

        user_match = re.search(
            r'\[!\[Image \d+: ([^\]]*)\]\([^)]+\)([^\]]*)\]\(https://dribbble\.com/([a-zA-Z0-9_\-]+)\)',
            line
        )
        if user_match:
            uname = user_match.group(3).strip()
            if uname not in EXCLUDED_USERNAMES and current_shot_images:
                if uname not in designer_shots_map:
                    designer_shots_map[uname] = []
                designer_shots_map[uname].extend(current_shot_images)
                current_shot_images = []
            elif uname not in EXCLUDED_USERNAMES:
                current_shot_images = []

    for d in designers:
        d["search_shots"] = designer_shots_map.get(d["username"], [])

    return designers[:num_users]


# ─── Step 2: Scrape Designer Profile Details ──────────────────────────────────

def scrape_designer_profile(username: str) -> Dict:
    """
    Scrape a designer's /about page to extract profile details,
    contact info, and social links using Gemini Flash.
    """
    about_url = f"https://dribbble.com/{username}/about"
    raw = _jina_fetch(about_url)
    if not raw:
        print(f"[Profile] Failed to fetch about page for {username}")
        return {}

    system = (
        "You are a web scraping expert. You are given the raw text/markdown content of a Dribbble designer's About page. "
        "Extract ALL available profile information into a structured JSON object. "
        "Return ONLY a valid JSON object with these fields (use null for anything not found):\n"
        "{\n"
        '  "name": "Full display name",\n'
        '  "location": "City, Country or whatever is shown",\n'
        '  "bio": "Their bio/description text",\n'
        '  "followers_count": "e.g. 64,618 or null",\n'
        '  "following_count": "e.g. 191 or null",\n'
        '  "likes_count": "e.g. 2,171 or null",\n'
        '  "contact_email": "email@example.com or null",\n'
        '  "phone": "phone number or null",\n'
        '  "portfolio_website": "their personal website URL or null",\n'
        '  "skills": ["skill1", "skill2"],\n'
        '  "social_links": {\n'
        '    "linkedin": "full URL or null",\n'
        '    "twitter": "full URL or null",\n'
        '    "instagram": "full URL or null",\n'
        '    "facebook": "full URL or null",\n'
        '    "behance": "full URL or null",\n'
        '    "github": "full URL or null",\n'
        '    "youtube": "full URL or null",\n'
        '    "other": ["any other social/portfolio URLs found"]\n'
        "  }\n"
        "}\n"
        "Extract ONLY what is actually present in the content. Do NOT guess or invent data."
    )
    user_prompt = f"Extract profile details for Dribbble user '{username}' from this about page content:\n\n{raw[:12000]}"

    try:
        result_text = _gemini_text(system, user_prompt, max_tokens=2000)
        parsed = _parse_json_from_text(result_text)
        if isinstance(parsed, dict):
            return parsed
    except Exception as e:
        print(f"[Profile] Gemini parse error for {username}: {e}")

    return {}


# ─── Step 3: Scrape Shot / Work Image URLs from Profile ───────────────────────

def scrape_designer_shots(username: str) -> List[Dict]:
    """
    Scrape a designer's main profile page to extract shot image URLs.
    Uses regex to extract from Jina markdown — no LLM call needed.
    """
    profile_url = f"https://dribbble.com/{username}"
    raw = _jina_fetch(profile_url)
    if not raw:
        print(f"[Shots] Failed to fetch profile page for {username}")
        return []

    shot_pattern = re.compile(
        r'!\[Image \d+: ([^\]]*)\]\((https://cdn\.dribbble\.com/[^\s\)]+)\)',
    )

    shots = []
    seen_urls = set()
    for m in shot_pattern.finditer(raw):
        title = m.group(1).strip()
        image_url = m.group(2).strip()
        clean_url = re.sub(r'\?.*$', '', image_url)

        if clean_url not in seen_urls and "avatar" not in image_url.lower():
            seen_urls.add(clean_url)
            shots.append({
                "title": title[:80] if title else "Untitled",
                "image_url": image_url,
            })

    print(f"[Shots] Found {len(shots)} shots for {username}")
    return shots


# ─── Step 4: Download Images ─────────────────────────────────────────────────

def download_images(username: str, shots: List[Dict], max_images: int, base_dir: str = ".") -> List[Dict]:
    """
    Download up to max_images shot images for a designer.
    Saves to <base_dir>/scraped_images/<username>/.
    Returns list of dicts with title, original_url, and local_path.
    """
    if not shots:
        return []

    save_dir = os.path.join(base_dir, "scraped_images", username)
    os.makedirs(save_dir, exist_ok=True)

    downloaded = []
    for idx, shot in enumerate(shots[:max_images]):
        image_url = shot.get("image_url", "")
        title = shot.get("title", f"shot_{idx}")
        if not image_url:
            continue

        ext = ".jpg"
        url_lower = image_url.lower()
        if ".png" in url_lower:
            ext = ".png"
        elif ".gif" in url_lower:
            ext = ".gif"
        elif ".webp" in url_lower:
            ext = ".webp"

        clean_title = re.sub(r"[^a-zA-Z0-9_\-]", "_", title.lower())[:40]
        filename = f"{clean_title}_{idx}{ext}"
        filepath = os.path.join(save_dir, filename)
        relative_path = f"scraped_images/{username}/{filename}"

        try:
            print(f"  [Download] {idx + 1}/{min(len(shots), max_images)}: {filename}")
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://dribbble.com/",
                "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
            }
            r = requests.get(image_url, headers=headers, timeout=20)
            r.raise_for_status()

            if len(r.content) < 1000:
                print(f"  [Download] Skipping — too small ({len(r.content)} bytes)")
                continue

            with open(filepath, "wb") as f:
                f.write(r.content)

            size_kb = len(r.content) / 1024
            print(f"  [Download] Saved {size_kb:.1f} KB → {relative_path}")
            downloaded.append({
                "title": title,
                "original_url": image_url,
                "local_path": relative_path,
                "absolute_path": os.path.abspath(filepath),
            })
        except Exception as e:
            print(f"  [Download] Failed: {e}")

        time.sleep(1)

    return downloaded


# ─── Orchestrator ─────────────────────────────────────────────────────────────

def run_scraper(keyword: str, num_users: int = 5, num_images: int = 3, base_dir: str = ".") -> Dict:
    """
    Main entry point.

    Args:
        keyword:    Search term (e.g. "healthcare", "fintech")
        num_users:  Number of designer profiles to scrape
        num_images: Number of shot images to download per profile
        base_dir:   Base directory for saving images

    Returns:
        The full results dict (also saved as JSON on disk).
    """
    print("=" * 60)
    print(f"  Dribbble Scraper — Jina AI")
    print(f"  Keyword:     {keyword}")
    print(f"  Users:       {num_users}")
    print(f"  Images/user: {num_images}")
    print("=" * 60)

    # ── 1. Search ─────────────────────────────────────────────────────────────
    print(f"\n[Step 1] Searching Dribbble for '{keyword}'...")
    designers = search_dribbble(keyword, num_users)
    if not designers:
        print("No designers found. Exiting.")
        return {"metadata": {"keyword": keyword, "error": "No designers found"}, "designers": []}

    print(f"  → {len(designers)} designers to process")

    # ── 2–4. Process each designer ────────────────────────────────────────────
    results = []
    for i, designer_stub in enumerate(designers):
        username = designer_stub["username"]
        print(f"\n{'─' * 50}")
        print(f"[Designer {i + 1}/{len(designers)}] {username}")
        print(f"{'─' * 50}")

        # Step 2: Profile details (Gemini-powered)
        print(f"\n  [Step 2] Scraping profile details...")
        profile = scrape_designer_profile(username)
        time.sleep(2)

        # Step 3: Shot image URLs
        # Always prioritize keyword-relevant shots from the search page first
        search_shots = designer_stub.get("search_shots", [])
        shots = list(search_shots)  # start with keyword-relevant shots

        if shots:
            print(f"\n  [Step 3] Got {len(shots)} keyword-relevant shots from search page")

        # If we still need more images, supplement from the profile page
        if len(shots) < num_images:
            needed = num_images - len(shots)
            print(f"  [Step 3] Need {needed} more — scraping profile page...")
            profile_shots = scrape_designer_shots(username)
            # Deduplicate: don't add shots we already have from search
            existing_urls = {s.get("image_url") for s in shots}
            for ps in profile_shots:
                if ps.get("image_url") not in existing_urls:
                    shots.append(ps)
            time.sleep(2)

        # Step 4: Download images
        print(f"\n  [Step 4] Downloading up to {num_images} images...")
        downloaded_images = download_images(username, shots, num_images, base_dir=base_dir)

        # Assemble designer record
        social_links = profile.get("social_links", {})
        if isinstance(social_links, list):
            social_links = {"other": social_links}

        designer_record = {
            "username": username,
            "name": profile.get("name") or designer_stub.get("display_name", ""),
            "profile_url": f"https://dribbble.com/{username}",
            "location": profile.get("location"),
            "bio": profile.get("bio"),
            "metrics": {
                "followers_count": profile.get("followers_count"),
                "following_count": profile.get("following_count"),
                "likes_count": profile.get("likes_count"),
            },
            "contact": {
                "email": profile.get("contact_email"),
                "phone": profile.get("phone"),
                "portfolio_website": profile.get("portfolio_website"),
            },
            "skills": profile.get("skills", []),
            "social_links": social_links,
            "shots": downloaded_images,
            "total_shots_found": len(shots),
            "total_images_downloaded": len(downloaded_images),
            "scraped_at": datetime.now().isoformat(),
        }
        results.append(designer_record)

        print(f"\n  ✓ {username} done — {len(downloaded_images)} images downloaded")
        time.sleep(3)

    # ── Save JSON ─────────────────────────────────────────────────────────────
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = os.path.join(base_dir, f"dribbble_scraped_{keyword}_{timestamp}.json")

    output = {
        "metadata": {
            "keyword": keyword,
            "num_users_requested": num_users,
            "num_users_scraped": len(results),
            "num_images_per_profile": num_images,
            "scraped_at": datetime.now().isoformat(),
        },
        "designers": results,
    }

    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"  DONE!")
    print(f"  Designers scraped: {len(results)}")
    print(f"  Total images: {sum(d['total_images_downloaded'] for d in results)}")
    print(f"  Output: {output_filename}")
    print(f"{'=' * 60}")

    return output


if __name__ == "__main__":
    results = run_scraper(
        keyword="fintech",
        num_users=1,
        num_images=1,
    )
    print(f"\nFinal: {len(results.get('designers', []))} designers scraped")
